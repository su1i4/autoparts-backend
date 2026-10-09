import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

/** Настройки для CLI миграций и сида (сам Nest подключается в app.module.ts) */
export const buildTypeOrmOptions = (get: (k: string) => string | undefined): DataSourceOptions => ({
  type: 'postgres',
  host: get('DB_HOST'),
  port: parseInt(get('DB_PORT') ?? '5432', 10),
  username: get('DB_USERNAME'),
  password: get('DB_PASSWORD'),
  database: get('DB_NAME'),
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: get('DB_LOGGING') === 'true',
});