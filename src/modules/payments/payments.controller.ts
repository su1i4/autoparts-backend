import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import {
  LedgerQueryDto,
  PaymentsQueryDto,
  PayoutsQueryDto,
  ProcessPayoutDto,
  RequestPayoutDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Seller · Balance & Payouts')
@ApiBearerAuth()
@Roles(Role.SELLER)
@Controller('seller')
export class SellerBalanceController {
  constructor(private readonly payments: PaymentsService) {}

  /** Баланс: доступно, в холде, на выводе */
  @Get('balance')
  balance(@CurrentUser() u: AuthUser) {
    return this.payments.balance(u.sellerId!);
  }

  /** История начислений/списаний */
  @Get('balance/history')
  history(@CurrentUser() u: AuthUser, @Query() q: PaginationQueryDto) {
    return this.payments.sellerLedger(u.sellerId!, q);
  }

  @Get('payouts')
  payouts(@CurrentUser() u: AuthUser, @Query() q: PaginationQueryDto) {
    return this.payments.sellerPayouts(u.sellerId!, q);
  }

  /** Заявка на вывод (реквизиты — PATCH /sellers/me) */
  @Post('payouts')
  requestPayout(@CurrentUser() u: AuthUser, @Body() dto: RequestPayoutDto) {
    return this.payments.requestPayout(u, dto.amount);
  }
}

@ApiTags('Admin · Payments')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments')
  list(@Query() q: PaymentsQueryDto) {
    return this.payments.adminPayments(q);
  }

  @Get('ledger')
  ledger(@Query() q: LedgerQueryDto) {
    return this.payments.adminLedger(q);
  }

  /** Сверка: сальдо счетов, несбалансированные проводки, расхождения балансов продавцов */
  @Get('ledger/reconcile')
  reconcile() {
    return this.payments.reconcile();
  }

  @Get('payouts')
  payouts(@Query() q: PayoutsQueryDto) {
    return this.payments.adminPayouts(q);
  }

  /** Отметить выплату проведённой / отклонить (деньги вернутся на баланс продавца) */
  @Post('payouts/:id/process')
  process(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessPayoutDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.payments.processPayout(id, dto.decision, u.id, dto.bankReference, dto.comment);
  }
}
