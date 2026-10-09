import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { In, Repository } from 'typeorm';
import { FileEntity } from './entities/file.entity';
import { StorageService } from './storage.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DOC_TYPES = ['application/pdf'];

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity) private readonly files: Repository<FileEntity>,
    private readonly storage: StorageService,
  ) {}

  /** Фото сжимаются в webp (макс. 1600px), PDF сохраняются как есть (документы продавцов) */
  async upload(ownerId: string, file: Express.Multer.File): Promise<FileEntity> {
    if (!file) throw new BadRequestException('Файл не передан');
    const month = new Date().toISOString().slice(0, 7);

    if (IMAGE_TYPES.includes(file.mimetype)) {
      const img = sharp(file.buffer, { failOn: 'error' }).rotate().resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      });
      const { data, info } = await img.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
      const key = `img/${month}/${randomUUID()}.webp`;
      const url = await this.storage.put(key, data, 'image/webp');
      return this.files.save(
        this.files.create({
          ownerId,
          url,
          key,
          mimeType: 'image/webp',
          size: data.length,
          width: info.width,
          height: info.height,
        }),
      );
    }

    if (DOC_TYPES.includes(file.mimetype)) {
      const key = `doc/${month}/${randomUUID()}.pdf`;
      const url = await this.storage.put(key, file.buffer, file.mimetype);
      return this.files.save(
        this.files.create({
          ownerId,
          url,
          key,
          mimeType: file.mimetype,
          size: file.size,
          width: null,
          height: null,
        }),
      );
    }

    throw new BadRequestException('Разрешены только изображения (jpeg, png, webp, heic) и PDF');
  }

  /** Проверка, что URL-ы — загруженные этим пользователем файлы (не чужие и не внешние ссылки) */
  async assertOwned(ownerId: string, urls?: string[] | null) {
    if (!urls?.length) return;
    const unique = [...new Set(urls)];
    const count = await this.files.count({ where: { ownerId, url: In(unique) } });
    if (count !== unique.length)
      throw new BadRequestException('Неизвестные файлы: загрузите фото через /files/upload');
  }
}
