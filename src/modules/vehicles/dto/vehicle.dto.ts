import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export class DecodeVinDto {
  @IsString()
  @Matches(VIN_REGEX, { message: 'VIN — 17 символов, латиница и цифры (без I, O, Q)' })
  vin: string;
}

export class CreateVehicleDto {
  /** Если указан VIN — марка/модель/год подтянутся из расшифровки (поля ниже переопределяют) */
  @IsOptional()
  @IsString()
  @Matches(VIN_REGEX, { message: 'VIN — 17 символов, латиница и цифры (без I, O, Q)' })
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  frameNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @IsOptional() @IsString() @MaxLength(120) engine?: string;
  @IsOptional() @IsString() @MaxLength(80) transmission?: string;
  @IsOptional() @IsString() @MaxLength(80) drive?: string;
  @IsOptional() @IsString() @MaxLength(100) nickname?: string;
}
