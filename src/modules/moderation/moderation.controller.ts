import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowBlocked } from '../../common/decorators/public.decorator';
import { AppealDto, CreateReportDto } from './dto/moderation.dto';
import { ModerationService } from './moderation.service';

@ApiTags('Moderation (user side)')
@ApiBearerAuth()
@Controller()
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  /** «Пожаловаться» — на сообщение, запрос, оффер или пользователя */
  @Post('reports')
  report(@CurrentUser() u: AuthUser, @Body() dto: CreateReportDto) {
    return this.moderation.createReport(u.id, dto);
  }

  /** Текущая блокировка (доступно и заблокированному пользователю) */
  @AllowBlocked()
  @Get('users/me/block')
  myBlock(@CurrentUser() u: AuthUser) {
    return this.moderation.activeBlock(u.id);
  }

  /** Обжалование блокировки */
  @AllowBlocked()
  @Post('users/me/block/appeal')
  appeal(@CurrentUser() u: AuthUser, @Body() dto: AppealDto) {
    return this.moderation.appeal(u.id, dto.text);
  }
}
