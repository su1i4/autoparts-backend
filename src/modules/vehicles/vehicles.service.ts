import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/vehicle.dto';
import { Vehicle } from './entities/vehicle.entity';
import { VinDecoderService } from './vin-decoder.service';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly decoder: VinDecoderService,
  ) {}

  list(userId: string) {
    return this.vehicles.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async get(userId: string, id: string) {
    const v = await this.vehicles.findOne({ where: { id, userId }, relations: { vinData: true } });
    if (!v) throw new NotFoundException('Авто не найдено в гараже');
    return v;
  }

  /** VIN → автодекодирование; если не распознан — нужен ручной ввод make/model */
  async create(userId: string, dto: CreateVehicleDto) {
    const vin = dto.vin?.toUpperCase();
    const decoded = vin ? await this.decoder.decode(vin) : null;

    const make = dto.make ?? decoded?.make;
    const model = dto.model ?? decoded?.model;
    if (!make || !model) {
      throw new BadRequestException({
        code: 'VIN_NOT_RECOGNIZED',
        message: 'Не удалось определить марку/модель — укажите вручную',
        decoded,
      });
    }

    if (vin && (!decoded?.recognized || !decoded.model)) {
      await this.decoder.saveManual(vin, {
        make,
        model,
        year: dto.year ?? decoded?.year ?? null,
        engine: dto.engine ?? null,
      });
    }

    return this.vehicles.save(
      this.vehicles.create({
        userId,
        vin: vin ?? null,
        frameNumber: dto.frameNumber ?? null,
        make,
        model,
        year: dto.year ?? decoded?.year ?? null,
        engine: dto.engine ?? decoded?.engine ?? null,
        transmission: dto.transmission ?? decoded?.transmission ?? null,
        drive: dto.drive ?? decoded?.drive ?? null,
        nickname: dto.nickname ?? null,
      }),
    );
  }

  async update(userId: string, id: string, dto: CreateVehicleDto) {
    const v = await this.get(userId, id);
    const { vin: _vin, ...rest } = dto;
    void _vin;
    Object.assign(v, rest);
    return this.vehicles.save(v);
  }

  async remove(userId: string, id: string) {
    const v = await this.get(userId, id);
    await this.vehicles.remove(v);
    return { ok: true };
  }
}
