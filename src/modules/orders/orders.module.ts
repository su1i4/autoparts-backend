import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Part } from '../catalog/entities/part.entity';
import { CommissionsModule } from '../commissions/commissions.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { PaymentsModule } from '../payments/payments.module';
import { Offer } from '../requests/entities/offer.entity';
import { PartRequest } from '../requests/entities/part-request.entity';
import { Store } from '../sellers/entities/store.entity';
import { User } from '../users/entities/user.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import {
  AdminOrdersController,
  OrdersController,
  PaymentFlowController,
  SellerOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderStatusHistory, Offer, PartRequest, Part, Store, User]),
    PaymentsModule,
    CommissionsModule,
    LogisticsModule,
  ],
  controllers: [
    OrdersController,
    SellerOrdersController,
    PaymentFlowController,
    AdminOrdersController,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
