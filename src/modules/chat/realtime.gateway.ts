import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Server, Socket } from 'socket.io';
import { AuthUser } from '../../common/auth-user';
import { UserStatus } from '../../common/enums';
import { UsersService } from '../users/users.service';
import { ChatMessageEvent, ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

/**
 * WebSocket (socket.io, namespace /chat).
 * Подключение: io(`${API}/chat`, { auth: { token: accessToken } })
 * Клиент → сервер: chat:join {chatId}, chat:leave {chatId}, chat:send {chatId, text, photos}, chat:read {chatId}
 * Сервер → клиент: message:new, notification:new, offer:new, order:status
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly chat: ChatService,
  ) {}

  /**
   * Авторизация в middleware handshake: соединение не устанавливается, пока токен не проверен,
   * поэтому первые события клиента никогда не приходят от «анонимного» сокета.
   */
  afterInit(ns: Namespace) {
    ns.use((socket, next) => {
      this.authenticate(socket)
        .then((user) => {
          socket.data.user = user;
          next();
        })
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  private async authenticate(socket: Socket): Promise<AuthUser> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
    const user = await this.users.findForAuth(sub);
    if (!user || user.status !== UserStatus.ACTIVE) throw new Error('inactive');
    return {
      id: user.id,
      phone: user.phone,
      roles: user.roles,
      sellerId: user.seller?.id ?? null,
      blocked: false,
    };
  }

  async handleConnection(socket: Socket) {
    const user = socket.data.user as AuthUser | undefined;
    if (!user) return socket.disconnect(true);
    await socket.join(`user:${user.id}`);
  }

  @SubscribeMessage('chat:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { chatId: string }) {
    if (!(await this.chat.canAccess(socket.data.user, body.chatId))) return { ok: false };
    await socket.join(`chat:${body.chatId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: { chatId: string }) {
    await socket.leave(`chat:${body.chatId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async send(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: SendMessageDto & { chatId: string },
  ) {
    try {
      const message = await this.chat.send(socket.data.user, body.chatId, {
        text: body.text,
        photos: body.photos,
      });
      return { ok: true, message };
    } catch (e) {
      const err = e as { getResponse?: () => unknown; message: string };
      return { ok: false, error: err.getResponse?.() ?? err.message };
    }
  }

  @SubscribeMessage('chat:read')
  async read(@ConnectedSocket() socket: Socket, @MessageBody() body: { chatId: string }) {
    return this.chat.markRead(socket.data.user, body.chatId);
  }

  // ── доставка событий ──

  @OnEvent('chat.message')
  onMessage({ chat, message }: ChatMessageEvent) {
    const targets = [`chat:${chat.id}`, `user:${chat.clientId}`];
    if (chat.sellerUserId) targets.push(`user:${chat.sellerUserId}`);
    this.server?.to(targets).emit('message:new', { chatId: chat.id, message });
  }

  @OnEvent('realtime.user')
  toUser(p: { userId: string; event: string; data: unknown }) {
    this.server?.to(`user:${p.userId}`).emit(p.event, p.data);
  }
}
