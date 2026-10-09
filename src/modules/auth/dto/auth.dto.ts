import { IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Language } from '../../../common/enums';

export enum OtpChannel {
  SMS = 'SMS',
  TELEGRAM = 'TELEGRAM',
  WHATSAPP = 'WHATSAPP',
}

export class RequestOtpDto {
  /** +996700123456, 0700123456, +7..., +86... */
  @IsString()
  @Matches(/^\+?[\d\s\-()]{9,20}$/, { message: 'Некорректный номер телефона' })
  phone: string;

  @IsOptional()
  @IsEnum(OtpChannel)
  channel?: OtpChannel = OtpChannel.SMS;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[\d\s\-()]{9,20}$/, { message: 'Некорректный номер телефона' })
  phone: string;

  @IsString()
  @Length(4, 6)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
