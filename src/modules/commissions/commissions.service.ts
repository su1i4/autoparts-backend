import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionScope } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { calcCommission, CommissionContext } from './commission.calc';
import { CreateCommissionDto, UpdateCommissionDto } from './dto/commission.dto';
import { CommissionRule } from './entities/commission-rule.entity';

@Injectable()
export class CommissionsService {
  constructor(
    @InjectRepository(CommissionRule) private readonly rules: Repository<CommissionRule>,
    private readonly audit: AuditService,
  ) {}

  async calculate(ctx: CommissionContext) {
    const active = await this.rules.find({ where: { isActive: true } });
    return calcCommission(active, ctx);
  }

  list(includeHistory = false) {
    return this.rules.find({
      where: includeHistory ? {} : { isActive: true },
      order: { scope: 'ASC', createdAt: 'DESC' },
    });
  }

  private validateScope(dto: CreateCommissionDto) {
    if (dto.scope === CommissionScope.SELLER && !dto.sellerId)
      throw new BadRequestException('Нужен sellerId');
    if (dto.scope === CommissionScope.CATEGORY && !dto.categoryId)
      throw new BadRequestException('Нужен categoryId');
    if (dto.scope === CommissionScope.COUNTRY && !dto.country)
      throw new BadRequestException('Нужен country');
  }

  async create(dto: CreateCommissionDto, actorId: string) {
    this.validateScope(dto);
    const rule = await this.rules.save(
      this.rules.create({
        scope: dto.scope,
        categoryId: dto.scope === CommissionScope.CATEGORY ? dto.categoryId : null,
        sellerId: dto.scope === CommissionScope.SELLER ? dto.sellerId : null,
        country: dto.scope === CommissionScope.COUNTRY ? dto.country!.toUpperCase() : null,
        type: dto.type,
        value: dto.value,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        note: dto.note ?? null,
        createdById: actorId,
      }),
    );
    await this.audit.log(actorId, 'commission.create', 'commission', rule.id, { ...dto });
    return rule;
  }

  /** Изменение = закрыть текущую версию и создать новую */
  async update(id: string, dto: UpdateCommissionDto, actorId: string) {
    const old = await this.rules.findOneBy({ id, isActive: true });
    if (!old) throw new NotFoundException('Активное правило не найдено');
    const now = new Date();
    await this.rules.update(id, { isActive: false, validTo: now });
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = old;
    void _id;
    void _c;
    void _u;
    const next = await this.rules.save(
      this.rules.create({
        ...rest,
        type: dto.type ?? old.type,
        value: dto.value ?? old.value,
        validFrom: now,
        validTo: dto.validTo ? new Date(dto.validTo) : old.validTo,
        note: dto.note ?? old.note,
        isActive: true,
        previousId: old.id,
        createdById: actorId,
      }),
    );
    await this.audit.log(actorId, 'commission.update', 'commission', next.id, {
      previousId: old.id,
      from: { type: old.type, value: old.value },
      to: { type: next.type, value: next.value },
    });
    return next;
  }

  async deactivate(id: string, actorId: string) {
    await this.rules.update(id, { isActive: false, validTo: new Date() });
    await this.audit.log(actorId, 'commission.deactivate', 'commission', id);
    return { ok: true };
  }
}
