import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Currency, Role } from '../../common/enums';
import { CurrencyService } from './currency.service';
import { CarMakeDto, CarModelDto, CategoryDto, SetRateDto } from './dto/reference.dto';
import { ReferenceService } from './reference.service';

@ApiTags('Reference (справочники)')
@Controller('reference')
export class ReferenceController {
  constructor(
    private readonly ref: ReferenceService,
    private readonly currency: CurrencyService,
  ) {}

  @Public()
  @Get('categories')
  categories() {
    return this.ref.listCategories();
  }

  @Public()
  @ApiQuery({ name: 'search', required: false })
  @Get('makes')
  makes(@Query('search') search?: string) {
    return this.ref.listMakes(search);
  }

  @Public()
  @Get('makes/:id/models')
  models(@Param('id', ParseUUIDPipe) id: string) {
    return this.ref.listModels(id);
  }

  @Public()
  @Get('exchange-rates')
  rates() {
    return this.currency.current();
  }
}

@ApiTags('Admin · Reference')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/reference')
export class AdminReferenceController {
  constructor(
    private readonly ref: ReferenceService,
    private readonly currency: CurrencyService,
  ) {}

  @Get('categories')
  categories() {
    return this.ref.listCategories(true);
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto, @CurrentUser() u: AuthUser) {
    return this.ref.createCategory(dto, u.id);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoryDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.ref.updateCategory(id, dto, u.id);
  }

  @Post('makes')
  createMake(@Body() dto: CarMakeDto) {
    return this.ref.createMake(dto);
  }

  @Delete('makes/:id')
  deleteMake(@Param('id', ParseUUIDPipe) id: string) {
    return this.ref.deleteMake(id);
  }

  @Post('models')
  createModel(@Body() dto: CarModelDto) {
    return this.ref.createModel(dto);
  }

  @Post('exchange-rates')
  setRate(@Body() dto: SetRateDto, @CurrentUser() u: AuthUser) {
    return this.currency.setRate(dto.currency, dto.rateToKgs, u.id);
  }

  @ApiQuery({ name: 'currency', enum: Currency, required: false })
  @Get('exchange-rates/history')
  history(@Query('currency') currency?: Currency) {
    return this.currency.history(currency);
  }
}
