import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowBlocked } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { NotificationsQueryDto, TemplateDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly n: NotificationsService) {}

  @AllowBlocked()
  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: NotificationsQueryDto) {
    return this.n.list(u.id, q);
  }

  @AllowBlocked()
  @Get('unread-count')
  unread(@CurrentUser() u: AuthUser) {
    return this.n.unreadCount(u.id);
  }

  @Post('read-all')
  readAll(@CurrentUser() u: AuthUser) {
    return this.n.markAllRead(u.id);
  }

  @Post(':id/read')
  read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.n.markRead(u.id, id);
  }
}

@ApiTags('Admin · Notification templates')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/notification-templates')
export class AdminNotificationsController {
  constructor(private readonly n: NotificationsService) {}

  @Get()
  list() {
    return this.n.listTemplates();
  }

  @Put()
  upsert(@Body() dto: TemplateDto) {
    return this.n.upsertTemplate(dto);
  }
}
