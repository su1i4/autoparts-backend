import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Role, WarehouseType } from '../../common/enums';
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
import { LogisticsService } from './logistics.service';

@ApiTags('Logistics (public)')
@Controller()
export class LogisticsPublicController {
  constructor(private readonly logistics: LogisticsService) {}

  /** Калькулятор доставки: варианты (авиа/авто/ж-д) с ценой и сроком */
  @Public()
  @Post('logistics/calculate')
  calculate(@Body() dto: CalculateDto) {
    return this.logistics.quote(dto);
  }

  @Public()
  @ApiQuery({ name: 'city', required: false })
  @Get('logistics/pickup-points')
  pickupPoints(@Query('city') city?: string) {
    return this.logistics.pickupPoints(city);
  }

  /** Публичный трекинг по нашему или внешнему трек-номеру */
  @Public()
  @Get('tracking/:number')
  track(@Param('number') number: string) {
    return this.logistics.publicTracking(number);
  }
}

@ApiTags('Logistics (warehouse staff)')
@ApiBearerAuth()
@Roles(Role.LOGISTICS)
@Controller('logistics')
export class LogisticsStaffController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('shipments')
  list(@Query() q: ShipmentsQueryDto) {
    return this.logistics.list(q);
  }

  @Get('shipments/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.logistics.getShipment(id);
  }

  /** Приёмка на складе (CN или КР — определяется по стране склада) */
  @Post('shipments/:id/receive')
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveShipmentDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.logistics.receive(id, dto, u.id);
  }

  @Post('shipments/:id/status')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipmentStatusDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.logistics.setStatus(id, dto, u.id);
  }

  @Post('tracking/bulk')
  bulk(@Body() dto: BulkTrackingDto, @CurrentUser() u: AuthUser) {
    return this.logistics.bulkTracking(dto, u.id);
  }

  @Get('consolidations')
  consolidations(@Query() q: PaginationQueryDto) {
    return this.logistics.listConsolidations(q);
  }

  @Post('consolidations')
  consolidate(@Body() dto: ConsolidateDto, @CurrentUser() u: AuthUser) {
    return this.logistics.consolidate(dto, u.id);
  }

  @Post('consolidations/:id/status')
  consolidationStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipmentStatusDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.logistics.setConsolidationStatus(id, dto, u.id);
  }

  @ApiQuery({ name: 'type', enum: WarehouseType, required: false })
  @Get('warehouses')
  warehouses(@Query('type') type?: WarehouseType) {
    return this.logistics.listWarehouses(type);
  }
}

@ApiTags('Admin · Logistics')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/logistics')
export class AdminLogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Post('warehouses')
  createWarehouse(@Body() dto: WarehouseDto) {
    return this.logistics.createWarehouse(dto);
  }

  @Patch('warehouses/:id')
  updateWarehouse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WarehouseDto) {
    return this.logistics.updateWarehouse(id, dto);
  }

  @Get('tariffs')
  tariffs() {
    return this.logistics.listTariffs();
  }

  @Post('tariffs')
  createTariff(@Body() dto: TariffDto, @CurrentUser() u: AuthUser) {
    return this.logistics.upsertTariff(dto, u.id);
  }

  @Patch('tariffs/:id')
  updateTariff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TariffDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.logistics.upsertTariff(dto, u.id, id);
  }
}
