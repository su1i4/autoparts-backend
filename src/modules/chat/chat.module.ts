import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from '../requests/entities/offer.entity';
import { PartRequest } from '../requests/entities/part-request.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AdminChatController, ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message, PartRequest, Offer, Seller, User]),
    UsersModule,
  ],
  controllers: [ChatController, AdminChatController],
  providers: [ChatService, RealtimeGateway],
  exports: [ChatService],
})
export class ChatModule {}
