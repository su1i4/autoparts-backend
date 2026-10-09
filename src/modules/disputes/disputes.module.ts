import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminDisputesController, DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { Dispute } from './entities/dispute.entity';
import { ReturnRequest } from './entities/return-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dispute, ReturnRequest]), OrdersModule, ChatModule],
  controllers: [DisputesController, AdminDisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
