import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DeliveryMethod, ShipmentStatus, ShippingMethod, WarehouseType } from '../../common/enums';
import { money } from '../../common/utils/money';
import { randomCode } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { Order } from '../orders/entities/order.entity';
import { SHIPMENT_FLOW } from '../orders/order-state';
import { SettingsService } from '../settings/settings.service';
import {
  BulkTrackingDto,
  CalculateDto,
  ConsolidateDto,
  ReceiveShipmentDto,
  ShipmentsQueryDto,
  ShipmentStatusDto,
  TariffDto,
  WarehouseDto,
} from './dto/logistics.dto';
import { Consolidation } from './entities/consolidation.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { Shipment } from './entities/shipment.entity';
import { ShippingTariff } from './entities/shipping-tariff.entity';
import { Warehouse } from './entities/warehouse.entity';
import { Parcel, shippingPrice } from './shipping-calc';

export interface ShipmentStatusEvent {
  orderId: string;
  shipmentId: string;
  status: ShipmentStatus;
  actorId: string | null;
}

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  PENDING: 'Заказ оплачен',
  HANDED_BY_SELLER: 'Передано продавцом',
  AT_ORIGIN_WAREHOUSE: 'На складе в Китае',
  IN_TRANSIT: 'В пути',
  AT_CUSTOMS: 'На таможне',
  AT_DESTINATION_WAREHOUSE: 'На складе в КР',
  HANDED_TO_COURIER: 'Передано курьеру',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Отменено',
};

@Injectable()
export class LogisticsService {
  constructor(
    @InjectRepository(Warehouse) private readonly warehouses: Repository<Warehouse>,
    @InjectRepository(ShippingTariff) private readonly tariffs: Repository<ShippingTariff>,
    @InjectRepository(Shipment) private readonly shipments: Repository<Shipment>,
    @InjectRepository(ShipmentEvent) private readonly shipmentEvents: Repository<ShipmentEvent>,
    @InjectRepository(Consolidation) private readonly consolidations: Repository<Consolidation>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Калькулятор ──

  /** Варианты доставки с ценой и сроком — показываются клиенту до оплаты */
  async quote(dto: CalculateDto) {
    const from = dto.fromCountry.toUpperCase();
    const to = (dto.toCountry ?? 'KG').toUpperCase();
    const parcel: Parcel = { weightKg: dto.weightKg, dimensions: dto.dimensions };
    const courierFee =
      dto.deliveryMethod === DeliveryMethod.COURIER
        ? await this.settings.get('logistics.courierFee')
        : 0;

    const tariffs = await this.tariffs.find({
      where: {
        fromCountry: from,
        toCountry: to,
        isActive: true,
        ...(dto.method ? { method: dto.method } : {}),
      },
    });
    const options = tariffs.map((t) => {
      const { weight, price } = shippingPrice(t, parcel);
      return {
        method: t.method,
        chargeableWeightKg: weight,
        transportPrice: price,
        courierFee,
        total: money(price + courierFee),
        daysMin: t.daysMin,
        daysMax: t.daysMax,
        tariffId: t.id,
      };
    });
    if (!options.length && from === to) {
      // местный продавец без тарифа — только последняя миля
      options.push({
        method: ShippingMethod.LOCAL,
        chargeableWeightKg: 0,
        transportPrice: 0,
        courierFee,
        total: courierFee,
        daysMin: 0,
        daysMax: 2,
        tariffId: '',
      });
    }
    return options.sort((a, b) => a.total - b.total);
  }

  async quoteOne(p: {
    fromCountry: string;
    toCountry?: string;
    method?: ShippingMethod;
    deliveryMethod: DeliveryMethod;
    weightKg?: number | null;
  }) {
    const options = await this.quote({
      fromCountry: p.fromCountry,
      toCountry: p.toCountry,
      method: p.method,
      deliveryMethod: p.deliveryMethod,
      weightKg: p.weightKg ?? undefined,
    });
    if (!options.length)
      throw new BadRequestException(
        `Нет тарифа доставки ${p.fromCountry} → ${p.toCountry ?? 'KG'}${p.method ? ' (' + p.method + ')' : ''}`,
      );
    return options[0];
  }

  // ── Справочники ──

  pickupPoints(city?: string) {
    return this.warehouses.find({
      where: { type: WarehouseType.PICKUP_POINT, isActive: true, ...(city ? { city } : {}) },
      order: { city: 'ASC', name: 'ASC' },
    });
  }

  async assertPickupPoint(id: string) {
    const w = await this.warehouses.findOneBy({
      id,
      type: WarehouseType.PICKUP_POINT,
      isActive: true,
    });
    if (!w) throw new BadRequestException('Пункт выдачи не найден');
    return w;
  }

  listWarehouses(type?: WarehouseType) {
    return this.warehouses.find({
      where: type ? { type } : {},
      order: { country: 'ASC', city: 'ASC' },
    });
  }

  createWarehouse(dto: WarehouseDto) {
    return this.warehouses.save(
      this.warehouses.create({ ...dto, country: dto.country.toUpperCase() }),
    );
  }

  async updateWarehouse(id: string, dto: Partial<WarehouseDto>) {
    await this.warehouses.update(id, dto);
    return this.warehouses.findOneByOrFail({ id });
  }

  listTariffs() {
    return this.tariffs.find({ order: { fromCountry: 'ASC', method: 'ASC' } });
  }

  async upsertTariff(dto: TariffDto, actorId: string, id?: string) {
    const entity = id ? await this.tariffs.findOneByOrFail({ id }) : this.tariffs.create();
    Object.assign(entity, {
      ...dto,
      fromCountry: dto.fromCountry.toUpperCase(),
      toCountry: dto.toCountry.toUpperCase(),
    });
    const saved = await this.tariffs.save(entity);
    await this.audit.log(actorId, id ? 'tariff.update' : 'tariff.create', 'tariff', saved.id, {
      ...dto,
    });
    return saved;
  }

  // ── Отправки ──

  /** После оплаты заказа создаём отправку с внутренним трек-номером */
  @OnEvent('order.paid', { async: true, promisify: true })
  async createForOrder(p: { orderId: string }) {
    const exists = await this.shipments.findOneBy({ orderId: p.orderId });
    if (exists) return exists;
    const order = await this.orders.findOneByOrFail({ id: p.orderId });
    const crossBorder = order.shipFromCountry !== 'KG';
    const [origin, destination] = await Promise.all([
      crossBorder
        ? this.warehouses.findOne({
            where: {
              type: WarehouseType.CONSOLIDATION,
              country: order.shipFromCountry,
              isActive: true,
            },
            order: { createdAt: 'ASC' },
          })
        : null,
      this.warehouses.findOne({
        where: { type: WarehouseType.CONSOLIDATION, country: 'KG', isActive: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const shipment = await this.shipments.save(
      this.shipments.create({
        orderId: order.id,
        trackingNumber: randomCode('AP', 10),
        method: order.shippingMethod,
        fromCountry: order.shipFromCountry,
        toCountry: 'KG',
        originWarehouseId: origin?.id ?? null,
        destinationWarehouseId: destination?.id ?? null,
        deliveryMethod: order.deliveryMethod,
        pickupPointId: order.pickupPointId,
        weightKg: order.weightKg,
        cost: order.shippingAmount,
      }),
    );
    await this.addEvent(
      shipment.id,
      ShipmentStatus.PENDING,
      null,
      null,
      'Заказ оплачен, ожидаем передачи продавцом',
    );
    return shipment;
  }

  private addEvent(
    shipmentId: string,
    status: ShipmentStatus,
    actorId: string | null,
    location: string | null,
    note?: string | null,
    photos?: string[],
  ) {
    return this.shipmentEvents.save(
      this.shipmentEvents.create({
        shipmentId,
        status,
        actorId,
        location,
        note: note ?? null,
        photos: photos ?? [],
      }),
    );
  }

  async getShipment(id: string) {
    const s = await this.shipments.findOne({
      where: { id },
      relations: { events: true },
      order: { events: { createdAt: 'ASC' } },
    });
    if (!s) throw new NotFoundException('Отправка не найдена');
    return s;
  }

  forOrder(orderId: string) {
    return this.shipments.find({
      where: { orderId },
      relations: { events: true },
      order: { events: { createdAt: 'ASC' } },
    });
  }

  /**
   * Смена статуса (только вперёд). Заказ обновляется синхронно через событие shipment.status.
   */
  async setStatus(shipmentId: string, dto: ShipmentStatusDto, actorId: string | null) {
    const s = await this.shipments.findOneBy({ id: shipmentId });
    if (!s) throw new NotFoundException('Отправка не найдена');
    if (dto.status === ShipmentStatus.CANCELLED) {
      s.status = ShipmentStatus.CANCELLED;
    } else {
      const from = SHIPMENT_FLOW.indexOf(s.status);
      const to = SHIPMENT_FLOW.indexOf(dto.status);
      if (to <= from)
        throw new BadRequestException(`Нельзя перевести из ${s.status} в ${dto.status}`);
      s.status = dto.status;
    }
    if (dto.carrier) s.carrier = dto.carrier;
    if (dto.externalTrackingNumber) s.externalTrackingNumber = dto.externalTrackingNumber;
    await this.shipments.save(s);
    await this.addEvent(s.id, s.status, actorId, dto.location ?? null, dto.note, dto.photos);
    await this.events.emitAsync('shipment.status', {
      orderId: s.orderId,
      shipmentId: s.id,
      status: s.status,
      actorId,
    } satisfies ShipmentStatusEvent);
    return this.getShipment(s.id);
  }

  async setStatusByOrder(orderId: string, dto: ShipmentStatusDto, actorId: string | null) {
    const s = await this.shipments.findOneBy({ orderId });
    if (!s) throw new NotFoundException('Отправка по заказу не найдена');
    return this.setStatus(s.id, dto, actorId);
  }

  /** Приёмка на складе: взвешивание, габариты, фото, проверка комплектности */
  async receive(shipmentId: string, dto: ReceiveShipmentDto, actorId: string) {
    const w = await this.warehouses.findOneBy({ id: dto.warehouseId });
    if (!w) throw new BadRequestException('Склад не найден');
    const s = await this.shipments.findOneByOrFail({ id: shipmentId });
    s.weightKg = dto.weightKg ?? s.weightKg;
    s.dimensions = dto.dimensions ?? s.dimensions;
    await this.shipments.save(s);
    const status =
      w.country === s.toCountry
        ? ShipmentStatus.AT_DESTINATION_WAREHOUSE
        : ShipmentStatus.AT_ORIGIN_WAREHOUSE;
    const note = [dto.complete === false ? '⚠ Некомплект' : 'Комплектность проверена', dto.note]
      .filter(Boolean)
      .join('. ');
    return this.setStatus(
      s.id,
      { status, location: `${w.city}, ${w.name}`, note, photos: dto.photos },
      actorId,
    );
  }

  async list(q: ShipmentsQueryDto) {
    const where: FindOptionsWhere<Shipment> = {};
    if (q.status) where.status = q.status;
    if (q.consolidationId) where.consolidationId = q.consolidationId;
    if (q.originWarehouseId) where.originWarehouseId = q.originWarehouseId;
    const [items, total] = await this.shipments.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  // ── Консолидация ──

  async consolidate(dto: ConsolidateDto, actorId: string) {
    const list = await this.shipments.findBy({ id: In(dto.shipmentIds) });
    if (list.length !== dto.shipmentIds.length)
      throw new BadRequestException('Некоторые отправки не найдены');
    const wrong = list.filter(
      (s) => s.status !== ShipmentStatus.AT_ORIGIN_WAREHOUSE || s.consolidationId,
    );
    if (wrong.length)
      throw new BadRequestException(
        `Отправки не на складе или уже в консолидации: ${wrong.map((s) => s.trackingNumber).join(', ')}`,
      );

    const c = await this.consolidations.save(
      this.consolidations.create({
        code: randomCode('CN', 8),
        originWarehouseId: dto.originWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        method: dto.method,
        carrier: dto.carrier ?? null,
        trackingNumber: dto.trackingNumber ?? null,
      }),
    );
    await this.shipments.update({ id: In(dto.shipmentIds) }, { consolidationId: c.id });
    await this.audit.log(actorId, 'consolidation.create', 'consolidation', c.id, {
      shipments: dto.shipmentIds.length,
    });
    return c;
  }

  listConsolidations(q: PaginationQueryDto) {
    return this.consolidations
      .findAndCount({ order: { createdAt: 'DESC' }, skip: q.skip, take: q.limit })
      .then(([items, total]) => paginate(items, total, q));
  }

  /** Статус сборного груза каскадом применяется ко всем посылкам внутри */
  async setConsolidationStatus(id: string, dto: ShipmentStatusDto, actorId: string) {
    const c = await this.consolidations.findOneBy({ id });
    if (!c) throw new NotFoundException();
    c.status = dto.status;
    if (dto.status === ShipmentStatus.IN_TRANSIT && !c.shippedAt) c.shippedAt = new Date();
    if (dto.carrier) c.carrier = dto.carrier;
    if (dto.externalTrackingNumber) c.trackingNumber = dto.externalTrackingNumber;
    await this.consolidations.save(c);

    const items = await this.shipments.findBy({ consolidationId: id });
    const results = { updated: 0, skipped: 0 };
    for (const s of items) {
      if (SHIPMENT_FLOW.indexOf(dto.status) > SHIPMENT_FLOW.indexOf(s.status)) {
        await this.setStatus(
          s.id,
          { status: dto.status, location: dto.location, note: dto.note ?? `Груз ${c.code}` },
          actorId,
        );
        results.updated++;
      } else results.skipped++;
    }
    return { consolidation: c, ...results };
  }

  /** Массовая загрузка трек-номеров перевозчиков */
  async bulkTracking(dto: BulkTrackingDto, actorId: string) {
    let updated = 0;
    const notFound: string[] = [];
    for (const row of dto.items) {
      const res = await this.shipments.update(
        { trackingNumber: row.trackingNumber },
        {
          externalTrackingNumber: row.externalTrackingNumber,
          ...(row.carrier ? { carrier: row.carrier } : {}),
        },
      );
      if (res.affected) updated++;
      else notFound.push(row.trackingNumber);
    }
    await this.audit.log(actorId, 'tracking.bulk', 'shipment', null, {
      updated,
      notFound: notFound.length,
    });
    return { updated, notFound };
  }

  // ── Публичный трекинг (без персональных данных) ──

  async publicTracking(number: string) {
    const s = await this.shipments.findOne({
      where: [{ trackingNumber: number.toUpperCase() }, { externalTrackingNumber: number }],
      relations: { events: true },
      order: { events: { createdAt: 'ASC' } },
    });
    if (!s) throw new NotFoundException('Трек-номер не найден');
    return {
      trackingNumber: s.trackingNumber,
      status: s.status,
      statusLabel: STATUS_LABEL[s.status],
      method: s.method,
      route: `${s.fromCountry} → ${s.toCountry}`,
      events: (s.events ?? []).map((e) => ({
        status: e.status,
        label: STATUS_LABEL[e.status],
        location: e.location,
        at: e.createdAt,
      })),
    };
  }
}
