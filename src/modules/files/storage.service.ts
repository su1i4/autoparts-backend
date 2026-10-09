import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

/**
 * Хранилище файлов. Сейчас — локальный диск (раздаётся по /uploads).
 * Для прода: реализовать S3StorageService (@aws-sdk/client-s3, MinIO/Yandex/Cloudflare R2)
 * с тем же интерфейсом и CDN-доменом в publicUrl.
 */
export abstract class StorageService {
  abstract put(key: string, data: Buffer, mimeType: string): Promise<string>;
}

@Injectable()
export class LocalStorageService extends StorageService {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async put(key: string, data: Buffer): Promise<string> {
    const dir = this.config.get<string>('UPLOAD_DIR', 'uploads');
    const full = join(process.cwd(), dir, key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    return `${this.config.get('APP_URL')}/uploads/${key}`;
  }
}
