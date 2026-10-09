import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowBlocked } from '../../common/decorators/public.decorator';
import { RegisterDeviceDto, UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @AllowBlocked()
  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.users.findById(u.id);
  }

  @Patch('me')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(u.id, dto);
  }

  /** Регистрация устройства (push-токен FCM/APNs) */
  @Post('me/devices')
  device(@CurrentUser() u: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.users.registerDevice(u.id, dto);
  }
}
