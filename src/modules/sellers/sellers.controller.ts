import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import {
  ApplySellerDto,
  SellerDocumentDto,
  SellerLimitsDto,
  SellersQueryDto,
  StoreDto,
  UpdateSellerDto,
  VerifySellerDto,
} from './dto/seller.dto';
import { SellersService } from './sellers.service';

@ApiTags('Sellers')
@ApiBearerAuth()
@Controller()
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  /** Заявка на регистрацию продавцом (документы + первый магазин). Статус → PENDING до модерации. */
  @Post('sellers/apply')
  apply(@CurrentUser() u: AuthUser, @Body() dto: ApplySellerDto) {
    return this.sellers.apply(u, dto);
  }

  @Roles(Role.SELLER)
  @Get('sellers/me')
  me(@CurrentUser() u: AuthUser) {
    return this.sellers.getMine(u);
  }

  /** Реквизиты для выплат, название */
  @Roles(Role.SELLER)
  @Patch('sellers/me')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateSellerDto) {
    return this.sellers.updateMine(u, dto);
  }

  @Roles(Role.SELLER)
  @Post('sellers/me/documents')
  addDoc(@CurrentUser() u: AuthUser, @Body() dto: SellerDocumentDto) {
    return this.sellers.addDocument(u, dto.type, dto.url);
  }

  @Roles(Role.SELLER)
  @Get('sellers/me/stats')
  stats(@CurrentUser() u: AuthUser) {
    return this.sellers.stats(u);
  }

  @Roles(Role.SELLER)
  @Get('sellers/me/stores')
  myStores(@CurrentUser() u: AuthUser) {
    return this.sellers.myStores(u);
  }

  @Roles(Role.SELLER)
  @Post('sellers/me/stores')
  createStore(@CurrentUser() u: AuthUser, @Body() dto: StoreDto) {
    return this.sellers.createStore(u, dto);
  }

  @Roles(Role.SELLER)
  @Patch('sellers/me/stores/:id')
  updateStore(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StoreDto,
  ) {
    return this.sellers.updateStore(u, id, dto);
  }

  @Public()
  @Get('sellers/:id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.publicProfile(id);
  }

  @Public()
  @Get('stores/:id')
  store(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.publicStore(id);
  }
}

@ApiTags('Admin · Sellers')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT)
@Controller('admin/sellers')
export class AdminSellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  list(@Query() q: SellersQueryDto) {
    return this.sellers.adminList(q);
  }

  /** Верификация: VERIFIED / REJECTED + комментарий */
  @Roles(Role.ADMIN)
  @Patch(':id/verification')
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifySellerDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.sellers.verify(id, dto, u.id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/limits')
  limits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SellerLimitsDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.sellers.setLimits(id, dto, u.id);
  }
}
