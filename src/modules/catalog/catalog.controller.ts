import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto, SearchQueryDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { CatalogService } from './catalog.service';
import {
  CreatePartDto,
  ImportPartsDto,
  OemDto,
  PartsQueryDto,
  UpdatePartDto,
} from './dto/part.dto';
import { IMPORT_COLUMNS, PartsImportService } from './parts-import.service';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Поиск: по названию/OEM/категории, фильтр совместимости (vehicleId требует токен) */
  @Public()
  @Get('parts')
  search(@Query() q: PartsQueryDto, @CurrentUser() u?: AuthUser) {
    return this.catalog.search(q, u?.id);
  }

  /** Поиск по garage-авто — тот же поиск, но с авторизацией */
  @ApiBearerAuth()
  @Get('parts/for-my-car')
  forMyCar(@Query() q: PartsQueryDto, @CurrentUser() u: AuthUser) {
    return this.catalog.search(q, u.id);
  }

  @Public()
  @Get('parts/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getPublic(id);
  }

  @Public()
  @Get('parts/:id/price-history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.priceHistory(id);
  }

  /** Кросс-номера по OEM */
  @Public()
  @Get('oem/:number/cross')
  cross(@Param('number') number: string) {
    return this.catalog.expandOem(number);
  }
}

@ApiTags('Seller · Catalog')
@ApiBearerAuth()
@Roles(Role.SELLER)
@Controller('seller/parts')
export class SellerCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly importer: PartsImportService,
  ) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PaginationQueryDto) {
    return this.catalog.listMine(u, q);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreatePartDto) {
    return this.catalog.create(u, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartDto,
  ) {
    return this.catalog.update(u, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.remove(u, id);
  }

  @Get('import/columns')
  columns() {
    return { columns: IMPORT_COLUMNS, required: ['name', 'price'] };
  }

  /** Импорт Excel (.xlsx) или CSV. Колонки — см. GET import/columns */
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  import(
    @CurrentUser() u: AuthUser,
    @Body() dto: ImportPartsDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.importer.import(u, dto.storeId, file);
  }
}

@ApiTags('Admin · OEM')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/oem')
export class AdminOemController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() q: SearchQueryDto) {
    return this.catalog.listOem(q);
  }

  /** Создать/обновить OEM с кросс-номерами */
  @Post()
  upsert(@Body() dto: OemDto) {
    return this.catalog.upsertOem(dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.catalog.deleteOem(id, u);
  }
}
