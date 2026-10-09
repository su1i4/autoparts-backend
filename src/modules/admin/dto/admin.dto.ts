import { ArrayMinSize, IsArray, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Role, UserStatus } from '../../../common/enums';
import { DEFAULT_SETTINGS } from '../../settings/settings.service';

export class AdminUsersQueryDto extends PaginationQueryDto {
  /** Телефон, email или имя */
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}

export class SetRolesDto {
  @IsArray() @ArrayMinSize(1) @IsEnum(Role, { each: true }) roles: Role[];
}

export class SetSettingDto {
  @IsIn(Object.keys(DEFAULT_SETTINGS)) key: keyof typeof DEFAULT_SETTINGS;
  value: unknown;
}

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsUUID() actorId?: string;
}
