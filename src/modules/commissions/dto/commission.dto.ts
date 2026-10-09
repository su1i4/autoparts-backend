import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { CommissionScope, CommissionType } from '../../../common/enums';

export class CreateCommissionDto {
  @IsEnum(CommissionScope)
  scope: CommissionScope;

  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;

  @IsEnum(CommissionType)
  type: CommissionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class UpdateCommissionDto {
  @IsOptional() @IsEnum(CommissionType) type?: CommissionType;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value?: number;
  @IsOptional() @IsDateString() validTo?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class PreviewCommissionDto {
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() country?: string;
  @Type(() => Number) @IsNumber() @Min(0) amount: number;
}
