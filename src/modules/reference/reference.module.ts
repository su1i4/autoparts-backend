import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyService } from './currency.service';
import { CarMake } from './entities/car-make.entity';
import { CarModel } from './entities/car-model.entity';
import { Category } from './entities/category.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { AdminReferenceController, ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Category, CarMake, CarModel, ExchangeRate])],
  controllers: [ReferenceController, AdminReferenceController],
  providers: [ReferenceService, CurrencyService],
  exports: [ReferenceService, CurrencyService],
})
export class ReferenceModule {}
