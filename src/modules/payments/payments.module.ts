import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seller } from '../sellers/entities/seller.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Payment } from './entities/payment.entity';
import { Payout } from './entities/payout.entity';
import {
  ManualPaymentProvider,
  MockPaymentProvider,
  PaymentProviderRegistry,
} from './payment-providers';
import { AdminPaymentsController, SellerBalanceController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, LedgerEntry, Payout, Seller])],
  controllers: [SellerBalanceController, AdminPaymentsController],
  providers: [PaymentsService, PaymentProviderRegistry, MockPaymentProvider, ManualPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
