import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import {
  AdminOffersQueryDto,
  AdminRequestsQueryDto,
  CloseRequestDto,
  CreateOfferDto,
  CreateRequestDto,
  FeedQueryDto,
  MyRequestsQueryDto,
  OffersQueryDto,
  SellerOffersQueryDto,
  UpdateOfferDto,
  UpdateRequestDto,
} from './dto/request.dto';
import { OffersService } from './offers.service';
import { RequestsService } from './requests.service';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly offers: OffersService,
  ) {}

  /** Создать запрос: авто (vehicleId или вручную) + название детали + фото (до 10). publish=false → черновик */
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateRequestDto) {
    return this.requests.create(u, dto);
  }

  @Get('my')
  my(@CurrentUser() u: AuthUser, @Query() q: MyRequestsQueryDto) {
    return this.requests.my(u, q);
  }

  /** Лента запросов для продавца: фильтры марка/категория/регион, флаг matchesAssortment */
  @Roles(Role.SELLER)
  @Get('feed')
  feed(@CurrentUser() u: AuthUser, @Query() q: FeedQueryDto) {
    return this.requests.feed(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.getForUser(u, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.requests.update(u, id, dto);
  }

  @Post(':id/publish')
  publish(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.publish(u, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.cancel(u, id);
  }

  /** Офферы по запросу. sort=price|delivery|rating|newest. Клиенту — все, продавцу — свой. */
  @Get(':id/offers')
  offersList(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: OffersQueryDto,
  ) {
    return this.offers.listForRequest(u, id, q);
  }

  /** Продавец отправляет предложение цены */
  @Roles(Role.SELLER)
  @Post(':id/offers')
  createOffer(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.create(u, id, dto);
  }
}

@ApiTags('Offers')
@ApiBearerAuth()
@Controller()
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Roles(Role.SELLER)
  @Get('seller/offers')
  mine(@CurrentUser() u: AuthUser, @Query() q: SellerOffersQueryDto) {
    return this.offers.sellerOffers(u, q);
  }

  @Get('offers/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.get(u, id);
  }

  /** Изменить своё предложение (до выбора клиентом) */
  @Roles(Role.SELLER)
  @Patch('offers/:id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offers.update(u, id, dto);
  }

  @Roles(Role.SELLER)
  @Post('offers/:id/withdraw')
  withdraw(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.withdraw(u, id);
  }

  /** Клиент отклоняет предложение */
  @Post('offers/:id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.reject(u, id);
  }
}

@ApiTags('Admin · Requests & Offers')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT)
@Controller('admin')
export class AdminRequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly offers: OffersService,
  ) {}

  @Get('requests')
  list(@Query() q: AdminRequestsQueryDto) {
    return this.requests.adminList(q);
  }

  @Post('requests/:id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseRequestDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.requests.adminClose(id, dto.reason, u.id);
  }

  @Get('offers')
  offersList(@Query() q: AdminOffersQueryDto) {
    return this.offers.adminList(q);
  }

  /** Удалить нарушающее правила предложение */
  @Post('offers/:id/remove')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseRequestDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.offers.adminRemove(id, dto.reason, u.id);
  }
}
