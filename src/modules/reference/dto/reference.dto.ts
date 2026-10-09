import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Currency } from '../../../common/enums';
import { I18nText } from '../entities/category.entity';

export class CategoryDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(100)
  slug: string;

  /** { "ru": "Двигатель", "ky": "Кыймылдаткыч", "en": "Engine" } */
  @IsObject()
  name: I18nText;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CarMakeDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class CarModelDto {
  @IsUUID()
  makeId: string;

  @IsString()
  @MaxLength(80)
  name: string;
}

export class SetRateDto {
  @IsEnum(Currency)
  currency: Currency;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  rateToKgs: number;
}
