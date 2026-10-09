import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { AppealStatus, BlacklistType, ReportStatus, UserStatus } from '../../common/enums';
import { normalizePhone } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { User } from '../users/entities/user.entity';
import {
  AppealDecisionDto,
  BlacklistDto,
  BlockUserDto,
  CreateReportDto,
  ReportsQueryDto,
  ResolveReportDto,
} from './dto/moderation.dto';
import { BlacklistEntry } from './entities/blacklist-entry.entity';
import { Report } from './entities/report.entity';
import { UserBlock } from './entities/user-block.entity';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserBlock) private readonly blocks: Repository<UserBlock>,
    @InjectRepository(BlacklistEntry) private readonly blacklist: Repository<BlacklistEntry>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Блокировки ──────────────────────────────────────────

  async blockUser(userId: string, dto: BlockUserDto, actorId: string | null) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const until = dto.hours ? new Date(Date.now() + dto.hours * 3600_000) : null;
    await this.blocks.update({ userId, isActive: true }, { isActive: false });
    const block = await this.blocks.save(
      this.blocks.create({ userId, reason: dto.reason, until, blockedById: actorId }),
    );
    await this.users.update(userId, { status: UserStatus.BLOCKED });
    await this.audit.log(actorId, 'user.block', 'user', userId, { reason: dto.reason, until });
    this.events.emit('user.blocked', { userId, reason: dto.reason, until });
    return block;
  }

  async unblockUser(userId: string, actorId: string | null) {
    await this.blocks.update({ userId, isActive: true }, { isActive: false });
    await this.users.update(userId, { status: UserStatus.ACTIVE });
    await this.audit.log(actorId, 'user.unblock', 'user', userId);
    return { ok: true };
  }

  /** Вызывается при логине / проверке токена: снимает истёкшие временные блоки */
  async refreshBlockState(user: User): Promise<User> {
    if (user.status !== UserStatus.BLOCKED) return user;
    const active = await this.blocks.findOne({ where: { userId: user.id, isActive: true } });
    if (active?.until && active.until < new Date()) {
      await this.blocks.update(active.id, { isActive: false });
      await this.users.update(user.id, { status: UserStatus.ACTIVE });
      user.status = UserStatus.ACTIVE;
    }
    return user;
  }

  activeBlock(userId: string) {
    return this.blocks.findOne({ where: { userId, isActive: true } });
  }

  userBlocks(userId: string) {
    return this.blocks.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async appeal(userId: string, text: string) {
    const block = await this.activeBlock(userId);
    if (!block) throw new BadRequestException('Нет активной блокировки');
    if (block.appealStatus === AppealStatus.PENDING)
      throw new BadRequestException('Обжалование уже на рассмотрении');
    block.appealText = text;
    block.appealStatus = AppealStatus.PENDING;
    return this.blocks.save(block);
  }

  async listAppeals(q: PaginationQueryDto) {
    const [items, total] = await this.blocks.findAndCount({
      where: { appealStatus: AppealStatus.PENDING },
      relations: { user: true },
      order: { updatedAt: 'ASC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async decideAppeal(blockId: string, dto: AppealDecisionDto, actorId: string) {
    const block = await this.blocks.findOneBy({ id: blockId });
    if (!block) throw new NotFoundException();
    block.appealStatus = dto.decision as AppealStatus;
    block.appealResponse = dto.response ?? null;
    await this.blocks.save(block);
    if (dto.decision === 'APPROVED') await this.unblockUser(block.userId, actorId);
    await this.audit.log(
      actorId,
      'user.appeal.' + dto.decision.toLowerCase(),
      'user',
      block.userId,
    );
    return block;
  }

  // ── Чёрный список ───────────────────────────────────────

  async isBlacklisted(phone?: string, deviceId?: string): Promise<boolean> {
    const checks: { type: BlacklistType; value: string }[] = [];
    if (phone) checks.push({ type: BlacklistType.PHONE, value: normalizePhone(phone) });
    if (deviceId) checks.push({ type: BlacklistType.DEVICE, value: deviceId });
    if (!checks.length) return false;
    return (await this.blacklist.count({ where: checks })) > 0;
  }

  async addToBlacklist(dto: BlacklistDto, actorId: string) {
    const value = dto.type === BlacklistType.PHONE ? normalizePhone(dto.value) : dto.value;
    await this.blacklist.upsert(
      { type: dto.type, value, reason: dto.reason ?? null, createdById: actorId },
      ['type', 'value'],
    );
    await this.audit.log(actorId, 'blacklist.add', 'blacklist', value, { type: dto.type });
    return this.blacklist.findOneBy({ type: dto.type, value });
  }

  async removeFromBlacklist(id: string, actorId: string) {
    await this.blacklist.delete(id);
    await this.audit.log(actorId, 'blacklist.remove', 'blacklist', id);
    return { ok: true };
  }

  async listBlacklist(q: PaginationQueryDto) {
    const [items, total] = await this.blacklist.findAndCount({
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  // ── Жалобы ──────────────────────────────────────────────

  async createReport(reporterId: string, dto: CreateReportDto) {
    const dup = await this.reports.findOneBy({
      reporterId,
      targetId: dto.targetId,
      status: ReportStatus.OPEN,
    });
    if (dup) return dup;
    return this.reports.save(this.reports.create({ ...dto, reporterId }));
  }

  async listReports(q: ReportsQueryDto) {
    const where: FindOptionsWhere<Report> = {};
    if (q.status) where.status = q.status;
    if (q.targetType) where.targetType = q.targetType;
    const [items, total] = await this.reports.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async resolveReport(id: string, dto: ResolveReportDto, actorId: string) {
    const r = await this.reports.findOneBy({ id });
    if (!r) throw new NotFoundException();
    if (r.status !== ReportStatus.OPEN) throw new ForbiddenException('Жалоба уже обработана');
    r.status = dto.status;
    r.resolution = dto.resolution ?? null;
    r.resolvedById = actorId;
    await this.audit.log(actorId, 'report.' + dto.status.toLowerCase(), 'report', id);
    return this.reports.save(r);
  }
}
