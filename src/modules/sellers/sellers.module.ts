import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerDocument } from './entities/seller-document.entity';
import { Seller } from './entities/seller.entity';
import { Store } from './entities/store.entity';
import { AdminSellersController, SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Seller, Store, SellerDocument])],
  controllers: [SellersController, AdminSellersController],
  providers: [SellersService],
  exports: [SellersService, TypeOrmModule],
})
export class SellersModule {}
