import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BlacklistType, ReportStatus, ReportTarget } from '../../../common/enums';

export class BlockUserDto {
  @IsString()
  @MaxLength(500)
  reason: string;

  /** Срок в часах; не указан — бессрочно */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hours?: number;
}

export class AppealDto {
  @IsString()
  @MaxLength(2000)
  text: string;
}

export class AppealDecisionDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  response?: string;
}

export class BlacklistDto {
  @IsEnum(BlacklistType)
  type: BlacklistType;

  @IsString()
  @MaxLength(200)
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateReportDto {
  @IsEnum(ReportTarget)
  targetType: ReportTarget;

  @IsUUID()
  targetId: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ResolveReportDto {
  @IsEnum([ReportStatus.RESOLVED, ReportStatus.DISMISSED])
  status: ReportStatus.RESOLVED | ReportStatus.DISMISSED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}

export class ReportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTarget)
  targetType?: ReportTarget;
}
