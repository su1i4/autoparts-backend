import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { Vin } from './entities/vin.entity';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VinDecoderService } from './vin-decoder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Vin])],
  controllers: [VehiclesController],
  providers: [VehiclesService, VinDecoderService],
  exports: [VehiclesService, VinDecoderService],
})
export class VehiclesModule {}
