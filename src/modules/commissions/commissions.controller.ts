import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { CommissionsService } from './commissions.service';
import {
  CreateCommissionDto,
  PreviewCommissionDto,
  UpdateCommissionDto,
} from './dto/commission.dto';

@ApiTags('Admin · Commission')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  /** history=true — включая закрытые версии */
  @Get()
  list(@Query('history') history?: string) {
    return this.commissions.list(history === 'true');
  }

  @Get('preview')
  preview(@Query() q: PreviewCommissionDto) {
    return this.commissions.calculate(q);
  }

  @Post()
  create(@Body() dto: CreateCommissionDto, @CurrentUser() u: AuthUser) {
    return this.commissions.create(dto, u.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.commissions.update(id, dto, u.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.commissions.deactivate(id, u.id);
  }
}
