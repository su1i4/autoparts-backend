import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { User } from '../users/entities/user.entity';
import { AdminUsersQueryDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(q: AdminUsersQueryDto) {
    const qb = this.users.createQueryBuilder('u').leftJoinAndSelect('u.seller', 's');
    if (q.search)
      qb.andWhere('(u.phone ILIKE :s OR u.email ILIKE :s OR u.name ILIKE :s)', {
        s: `%${q.search}%`,
      });
    if (q.role) qb.andWhere(':role = ANY(u.roles)', { role: q.role });
    if (q.status) qb.andWhere('u.status = :st', { st: q.status });
    const [items, total] = await qb
      .orderBy('u.createdAt', 'DESC')
      .skip(q.skip)
      .take(q.limit)
      .getManyAndCount();
    return paginate(items, total, q);
  }

  /** Профиль + история: запросы, заказы, споры, блокировки, нарушения */
  async userProfile(id: string) {
    const user = await this.users.findOne({
      where: { id },
      relations: { seller: true, devices: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const [stats] = await this.ds.query(
      `SELECT
        (SELECT COUNT(*) FROM requests WHERE "clientId" = $1)::int AS requests,
        (SELECT COUNT(*) FROM orders WHERE "clientId" = $1)::int AS orders,
        (SELECT COUNT(*) FROM orders WHERE "clientId" = $1 AND status = 'COMPLETED')::int AS "ordersCompleted",
        (SELECT COUNT(*) FROM disputes WHERE "clientId" = $1)::int AS disputes,
        (SELECT COUNT(*) FROM messages WHERE "senderId" = $1 AND status = 'BLOCKED')::int AS "blockedMessages"`,
      [id],
    );
    const blocks = await this.moderation.userBlocks(id);
    return { user, stats, blocks };
  }

  async setRoles(id: string, roles: Role[], actorId: string) {
    const user = await this.users.findOne({ where: { id }, relations: { seller: true } });
    if (!user) throw new NotFoundException();
    if (roles.includes(Role.SELLER) && !user.seller)
      throw new BadRequestException('Роль SELLER выдаётся через заявку продавца');
    if (id === actorId && !roles.includes(Role.ADMIN))
      throw new BadRequestException('Нельзя снять с себя роль ADMIN');
    const unique = [...new Set([Role.CLIENT, ...roles])];
    await this.users.update(id, { roles: unique });
    await this.audit.log(actorId, 'user.roles', 'user', id, { from: user.roles, to: unique });
    return this.users.findOneBy({ id });
  }

  /** Дашборд: пользователи, продавцы, запросы, заказы по статусам, GMV, доход */
  async stats() {
    const [row] = await this.ds.query(`
      SELECT
        (SELECT COUNT(*) FROM users)::int AS users,
        (SELECT COUNT(*) FROM users WHERE "createdAt" > now() - interval '1 day')::int AS "usersToday",
        (SELECT COUNT(*) FROM sellers WHERE "verificationStatus" = 'VERIFIED')::int AS "sellersVerified",
        (SELECT COUNT(*) FROM sellers WHERE "verificationStatus" = 'PENDING')::int AS "sellersPending",
        (SELECT COUNT(*) FROM requests WHERE status IN ('PUBLISHED','HAS_OFFERS'))::int AS "requestsOpen",
        (SELECT COUNT(*) FROM requests WHERE "createdAt" > now() - interval '1 day')::int AS "requestsToday",
        (SELECT COUNT(*) FROM offers WHERE "createdAt" > now() - interval '1 day')::int AS "offersToday",
        (SELECT COALESCE(AVG("offersCount"),0)::numeric(6,2) FROM requests WHERE status <> 'DRAFT') AS "avgOffersPerRequest",
        (SELECT COALESCE(SUM("totalAmount"),0) FROM orders WHERE status = 'COMPLETED') AS gmv,
        (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE account = 'PLATFORM:COMMISSION') AS "commissionRevenue",
        (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE account = 'ESCROW') AS "escrowBalance",
        (SELECT COUNT(*) FROM disputes WHERE status <> 'RESOLVED')::int AS "disputesOpen",
        (SELECT COUNT(*) FROM payouts WHERE status = 'REQUESTED')::int AS "payoutsPending",
        (SELECT COUNT(*) FROM messages WHERE status = 'BLOCKED' AND "createdAt" > now() - interval '7 days')::int AS "blockedMessages7d"`);
    const byStatus: { status: string; count: number }[] = await this.ds.query(
      `SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status ORDER BY status`,
    );
    return {
      ...row,
      gmv: Number(row.gmv),
      commissionRevenue: Number(row.commissionRevenue),
      escrowBalance: Number(row.escrowBalance),
      avgOffersPerRequest: Number(row.avgOffersPerRequest),
      ordersByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
    };
  }
}
