import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Consolidation } from './entities/consolidation.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { Shipment } from './entities/shipment.entity';
import { ShippingTariff } from './entities/shipping-tariff.entity';
import { Warehouse } from './entities/warehouse.entity';
import {
  AdminLogisticsController,
  LogisticsPublicController,
  LogisticsStaffController,
} from './logistics.controller';
import { LogisticsService } from './logistics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Warehouse,
      ShippingTariff,
      Shipment,
      ShipmentEvent,
      Consolidation,
      Order,
    ]),
  ],
  controllers: [LogisticsPublicController, LogisticsStaffController, AdminLogisticsController],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
