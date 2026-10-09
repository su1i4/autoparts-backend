import { MigrationInterface, QueryRunner } from 'typeorm';

/** Индексы для поиска по каталогу: OEM (GIN по массиву) и названию (триграммы для ILIKE) */
export class SearchIndexes1791354095491 implements MigrationInterface {
  name = 'SearchIndexes1791354095491';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_parts_oem_gin" ON "parts" USING GIN ("oemNumbers")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_parts_name_trgm" ON "parts" USING GIN ("name" gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_oems_cross_gin" ON "oems" USING GIN ("crossNumbers")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_requests_title_trgm" ON "requests" USING GIN ("title" gin_trgm_ops)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_requests_title_trgm"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_oems_cross_gin"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_parts_name_trgm"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_parts_oem_gin"`);
  }
}
