import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import {
  AdminOrdersQueryDto,
  AdminRefundDto,
  AdminStatusDto,
  CreateOrderFromOfferDto,
  CreateOrderFromPartDto,
  OrdersQueryDto,
  PayDto,
  QuoteOrderDto,
  ReasonDto,
  SellerShipDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Калькулятор до оплаты: товар + доставка = итого (KGS) */
  @Post('quote')
  @HttpCode(200)
  quote(@CurrentUser() u: AuthUser, @Body() dto: QuoteOrderDto) {
    return this.orders.quote(u, dto);
  }

  /** Выбор предложения → заказ (ожидает оплаты) */
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateOrderFromOfferDto) {
    return this.orders.createFromOffer(u, dto);
  }

  /** Быстрый заказ из каталога */
  @Post('from-part')
  fromPart(@CurrentUser() u: AuthUser, @Body() dto: CreateOrderFromPartDto) {
    return this.orders.createFromPart(u, dto);
  }

  @Get('my')
  my(@CurrentUser() u: AuthUser, @Query() q: OrdersQueryDto) {
    return this.orders.myOrders(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getForUser(u, id);
  }

  /** Единая лента статусов доставки + трек-номера */
  @Get(':id/tracking')
  tracking(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.tracking(u, id);
  }

  /** Оплата: создаёт платёж, возвращает redirectUrl/инструкции. Деньги удерживаются (эскроу). */
  @Post(':id/pay')
  pay(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayDto) {
    return this.orders.pay(u, id, dto.method);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.orders.clientCancel(u, id, dto.reason ?? '');
  }

  /** Клиент подтверждает получение → выплата продавцу */
  @Post(':id/confirm-receipt')
  confirm(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.confirmReceipt(u, id);
  }
}

@ApiTags('Seller · Orders')
@ApiBearerAuth()
@Roles(Role.SELLER)
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: OrdersQueryDto) {
    return this.orders.sellerOrders(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getForUser(u, id);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.sellerConfirm(u, id);
  }

  /** Передал в логистику (на склад консолидации / перевозчику) */
  @Post(':id/ship')
  ship(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SellerShipDto,
  ) {
    return this.orders.sellerShip(u, id, dto);
  }

  /** Отказ от заказа → полный возврат клиенту */
  @Post(':id/decline')
  decline(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.orders.sellerDecline(u, id, dto.reason ?? 'без причины');
  }
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentFlowController {
  constructor(private readonly orders: OrdersService) {}

  /** Вебхук платёжного провайдера (подпись проверяется провайдером) */
  @Public()
  @Post('webhook/:provider')
  @HttpCode(200)
  webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.orders.handleWebhook(provider, headers, body);
  }

  /** DEV: имитировать успешную оплату (PAYMENT_PROVIDER=mock) */
  @ApiBearerAuth()
  @Post(':id/mock-confirm')
  @HttpCode(200)
  mock(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.mockConfirm(u, id);
  }
}

@ApiTags('Admin · Orders')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT)
@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  list(@Query() q: AdminOrdersQueryDto) {
    return this.orders.adminList(q);
  }

  @Get('orders/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getForUser(u, id);
  }

  /** Ручная смена статуса (с записью в лог) */
  @Roles(Role.ADMIN)
  @Post('orders/:id/status')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminStatusDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.orders.adminSetStatus(id, dto.status, u.id, dto.note);
  }

  /** Возврат: полный (= total) или частичный */
  @Roles(Role.ADMIN)
  @Post('orders/:id/refund')
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminRefundDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.orders.refund(id, dto.amount, u.id, dto.reason ?? 'Возврат администратором');
  }

  /** Подтвердить поступление ручной оплаты (перевод/наличные/QR) */
  @Roles(Role.ADMIN)
  @Post('payments/:id/confirm')
  confirmPayment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.orders.confirmPayment(id, u.id);
  }
}
