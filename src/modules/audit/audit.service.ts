import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  log(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    payload?: Record<string, unknown>,
    em?: EntityManager,
  ) {
    const r = em ? em.getRepository(AuditLog) : this.repo;
    return r.save(r.create({ actorId, action, entityType, entityId, payload: payload ?? null }));
  }

  async list(q: PaginationQueryDto & { entityType?: string; entityId?: string; actorId?: string }) {
    const where: Record<string, string> = {};
    if (q.entityType) where.entityType = q.entityType;
    if (q.entityId) where.entityId = q.entityId;
    if (q.actorId) where.actorId = q.actorId;
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }
}
