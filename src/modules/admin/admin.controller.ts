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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import {
  AppealDecisionDto,
  BlacklistDto,
  BlockUserDto,
  ReportsQueryDto,
  ResolveReportDto,
} from '../moderation/dto/moderation.dto';
import { ModerationService } from '../moderation/moderation.service';
import { SettingsService } from '../settings/settings.service';
import { AdminService } from './admin.service';
import { AdminUsersQueryDto, AuditQueryDto, SetRolesDto, SetSettingDto } from './dto/admin.dto';

@ApiTags('Admin · Users & Blocks')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT)
@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly admin: AdminService,
    private readonly moderation: ModerationService,
  ) {}

  @Get('users')
  users(@Query() q: AdminUsersQueryDto) {
    return this.admin.listUsers(q);
  }

  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.userProfile(id);
  }

  /** Блокировка: причина + срок в часах (без срока — бессрочно) */
  @Post('users/:id/block')
  block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.moderation.blockUser(id, dto, u.id);
  }

  @Post('users/:id/unblock')
  unblock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.moderation.unblockUser(id, u.id);
  }

  /** Роли и права (ADMIN / SUPPORT / LOGISTICS) */
  @Roles(Role.ADMIN)
  @Patch('users/:id/roles')
  roles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolesDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.admin.setRoles(id, dto.roles, u.id);
  }

  @Get('appeals')
  appeals(@Query() q: PaginationQueryDto) {
    return this.moderation.listAppeals(q);
  }

  @Post('appeals/:blockId')
  decideAppeal(
    @Param('blockId', ParseUUIDPipe) id: string,
    @Body() dto: AppealDecisionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.moderation.decideAppeal(id, dto, u.id);
  }

  /** Чёрный список телефонов/устройств */
  @Get('blacklist')
  blacklist(@Query() q: PaginationQueryDto) {
    return this.moderation.listBlacklist(q);
  }

  @Post('blacklist')
  addBlacklist(@Body() dto: BlacklistDto, @CurrentUser() u: AuthUser) {
    return this.moderation.addToBlacklist(dto, u.id);
  }

  @Delete('blacklist/:id')
  removeBlacklist(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.moderation.removeFromBlacklist(id, u.id);
  }

  /** Жалобы на сообщения/запросы/офферы/пользователей */
  @Get('reports')
  reports(@Query() q: ReportsQueryDto) {
    return this.moderation.listReports(q);
  }

  @Post('reports/:id/resolve')
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.moderation.resolveReport(id, dto, u.id);
  }
}

@ApiTags('Admin · System')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminSystemController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Аналитика для дашборда */
  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  /** Настройки: пороги нарушений чата, сроки, минимальная выплата, тарифы курьера */
  @Get('settings')
  getSettings() {
    return this.settings.all();
  }

  @Patch('settings')
  async setSetting(@Body() dto: SetSettingDto, @CurrentUser() u: AuthUser) {
    await this.audit.log(u.id, 'settings.update', 'setting', dto.key, { value: dto.value });
    return this.settings.set(dto.key, dto.value);
  }

  /** Аудит-лог всех действий персонала */
  @Get('audit')
  auditLog(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }
}
