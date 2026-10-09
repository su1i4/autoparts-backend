import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Загрузка фото/документа. Возвращает { url } — его передаёте в photos[] запросов, офферов, чата. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.files.upload(u.id, file);
  }
}
