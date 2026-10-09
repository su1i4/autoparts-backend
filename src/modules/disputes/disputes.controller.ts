import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { DisputesService } from './disputes.service';
import {
  DecideReturnDto,
  DisputesQueryDto,
  EvidenceDto,
  OpenDisputeDto,
  RequestReturnDto,
  ResolveDisputeDto,
  ReturnReceivedDto,
  ReturnsQueryDto,
} from './dto/dispute.dto';

@ApiTags('Disputes & Returns')
@ApiBearerAuth()
@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  /** Открыть спор по заказу (клиент или продавец). Выплата продавцу замораживается. */
  @Post('orders/:id/dispute')
  open(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpenDisputeDto,
  ) {
    return this.disputes.open(u, id, dto);
  }

  @Get('disputes/my')
  my(@CurrentUser() u: AuthUser, @Query() q: DisputesQueryDto) {
    return this.disputes.my(u, q);
  }

  @Get('disputes/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.disputes.get(u, id);
  }

  /** Доказательства / ответ продавца */
  @Post('disputes/:id/evidence')
  evidence(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvidenceDto,
  ) {
    return this.disputes.addEvidence(u, id, dto);
  }

  /** Возврат доставленного товара (в пределах срока возврата) */
  @Post('orders/:id/return')
  requestReturn(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestReturnDto,
  ) {
    return this.disputes.requestReturn(u, id, dto);
  }

  @Get('returns/my')
  myReturns(@CurrentUser() u: AuthUser, @Query() q: ReturnsQueryDto) {
    return this.disputes.myReturns(u, q);
  }
}

@ApiTags('Admin · Disputes & Returns')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT)
@Controller('admin')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  /** Очередь споров */
  @Get('disputes')
  list(@Query() q: DisputesQueryDto) {
    return this.disputes.adminList(q);
  }

  @Post('disputes/:id/review')
  review(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.disputes.takeInReview(id, u);
  }

  /** REFUND_FULL / REFUND_PARTIAL (refundAmount) / PAYOUT_SELLER */
  @Post('disputes/:id/resolve')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.disputes.resolve(id, dto, u);
  }

  @Get('returns')
  returns(@Query() q: ReturnsQueryDto) {
    return this.disputes.adminReturns(q);
  }

  @Post('returns/:id/decide')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideReturnDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.disputes.decideReturn(id, dto, u);
  }

  @Roles(Role.ADMIN, Role.LOGISTICS)
  @Post('returns/:id/received')
  received(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnReceivedDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.disputes.returnReceived(id, dto, u);
  }
}
