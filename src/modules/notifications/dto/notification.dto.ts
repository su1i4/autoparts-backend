import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Language } from '../../../common/enums';

export class NotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;
}

export class TemplateDto {
  @IsString() @MaxLength(40) type: string;
  @IsEnum(Language) language: Language;
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(2000) body: string;
  @IsOptional() @IsArray() @IsString({ each: true }) channels?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
