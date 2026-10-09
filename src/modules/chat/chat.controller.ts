import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ChatType, Role } from '../../common/enums';
import { ChatService } from './chat.service';
import { detectContacts } from './contact-filter';
import {
  AdminChatsQueryDto,
  CheckTextDto,
  MessagesQueryDto,
  OpenChatDto,
  SendMessageDto,
} from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PaginationQueryDto) {
    return this.chat.list(u, q);
  }

  /** Открыть чат по запросу (клиент указывает sellerId, продавец — нет) */
  @Post()
  open(@CurrentUser() u: AuthUser, @Body() dto: OpenChatDto) {
    return this.chat.openForRequest(u, dto);
  }

  /** Предпроверка текста на фронте до отправки (подсветить ошибку) */
  @Post('check')
  check(@Body() dto: CheckTextDto) {
    const r = detectContacts(dto.text);
    return { blocked: r.blocked, kinds: r.kinds };
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.getChatView(u, id);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: MessagesQueryDto,
  ) {
    return this.chat.listMessages(u, id, q);
  }

  /** Отправка. Контакты → 400 CONTACTS_FORBIDDEN + счётчик нарушений */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/messages')
  send(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.send(u, id, dto);
  }

  @Post(':id/read')
  read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.markRead(u, id);
  }
}

@ApiTags('Admin · Chats')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT)
@Controller('admin/chats')
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Query() q: AdminChatsQueryDto) {
    return this.chat.adminList(q);
  }

  /** Все заблокированные фильтром сообщения (с оригиналами) */
  @Get('blocked-messages')
  blocked(@Query() q: PaginationQueryDto) {
    return this.chat.adminBlockedMessages(q);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string, @Query() q: MessagesQueryDto) {
    return this.chat.adminMessages(id, q);
  }

  @Post('messages/:id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.chat.hideMessage(id, u);
  }

  @Post('users/:userId/reset-violations')
  reset(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() u: AuthUser) {
    return this.chat.resetViolations(userId, u.id);
  }
}
