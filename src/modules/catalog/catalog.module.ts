import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellersModule } from '../sellers/sellers.module';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import {
  AdminOemController,
  CatalogController,
  SellerCatalogController,
} from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Oem } from './entities/oem.entity';
import { PartCompatibility } from './entities/part-compatibility.entity';
import { Part } from './entities/part.entity';
import { PriceHistory } from './entities/price-history.entity';
import { PartsImportService } from './parts-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Part, PartCompatibility, Oem, PriceHistory, Vehicle]),
    SellersModule,
  ],
  controllers: [CatalogController, SellerCatalogController, AdminOemController],
  providers: [CatalogService, PartsImportService],
  exports: [CatalogService],
})
export class CatalogModule {}
