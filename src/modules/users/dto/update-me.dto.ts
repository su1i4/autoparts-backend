import { IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Language } from '../../../common/enums';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramChatId?: string;
}

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(200)
  deviceId: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pushToken?: string;
}
