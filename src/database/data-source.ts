// DataSource для CLI TypeORM (миграции): npm run migration:generate --name=Init
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm.config';

export default new DataSource(buildTypeOrmOptions((k) => process.env[k]));
