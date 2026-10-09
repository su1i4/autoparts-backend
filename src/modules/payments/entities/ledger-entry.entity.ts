import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { moneyColumn } from '../../../common/utils/money';

/**
 * Журнал проводок (double-entry). Каждая операция = группа записей с общим txId, сумма = 0.
 * Счета:
 *   EXTERNAL                    — внешний мир (карты клиентов, банковские счета продавцов)
 *   ESCROW                      — удержанные платформой деньги клиентов
 *   SELLER:<id>:AVAILABLE       — доступно продавцу к выводу
 *   SELLER:<id>:PAYOUT_PENDING  — заявки на вывод в обработке
 *   PLATFORM:COMMISSION         — доход платформы (комиссия)
 *   PLATFORM:LOGISTICS          — доход/покрытие логистики
 */
@Entity('ledger_entries')
@Index(['account', 'createdAt'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  txId: string;

  @Column({ length: 80 })
  account: string;

  /** + приход на счёт, − расход */
  @Column(moneyColumn)
  amount: number;

  @Column({ length: 40 })
  operation: string; // HOLD | SETTLE | PAYOUT_REQUEST | PAYOUT_PAID | PAYOUT_REJECTED

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  payoutId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
