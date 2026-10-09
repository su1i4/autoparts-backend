import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '../users/entities/user-device.entity';
import { User } from '../users/entities/user.entity';
import { ChannelSenders } from './channels';
import { NotificationTemplate } from './entities/notification-template.entity';
import { Notification } from './entities/notification.entity';
import { AdminNotificationsController, NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationTemplate, User, UserDevice])],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService, NotificationsListener, ChannelSenders],
  exports: [NotificationsService],
})
export class NotificationsModule {}
