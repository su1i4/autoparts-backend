import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { FileEntity } from './entities/file.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorageService, StorageService } from './storage.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.get<number>('MAX_UPLOAD_MB', 10) * 1024 * 1024, files: 1 },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, { provide: StorageService, useClass: LocalStorageService }],
  exports: [FilesService],
})
export class FilesModule {}
