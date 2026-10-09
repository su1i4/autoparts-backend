import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { SellersModule } from '../sellers/sellers.module';
import { User } from '../users/entities/user.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Offer } from './entities/offer.entity';
import { PartRequest } from './entities/part-request.entity';
import { OffersService } from './offers.service';
import {
  AdminRequestsController,
  OffersController,
  RequestsController,
} from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartRequest, Offer, Vehicle, User]),
    SellersModule,
    CatalogModule,
  ],
  controllers: [RequestsController, OffersController, AdminRequestsController],
  providers: [RequestsService, OffersService],
  exports: [RequestsService, OffersService, TypeOrmModule],
})
export class RequestsModule {}
