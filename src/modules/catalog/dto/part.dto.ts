import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Currency, PartCondition, PartOrigin } from '../../../common/enums';

export class CompatibilityDto {
  @IsString() @MaxLength(80) make: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) yearFrom?: number;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) yearTo?: number;
  @IsOptional() @IsString() @MaxLength(120) engine?: string;
  @IsOptional() @IsString() @MaxLength(17) vinMask?: string;
}

export class CreatePartDto {
  @IsUUID()
  storeId: string;

  @IsString()
  @MaxLength(300)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** OEM-номера в любом формате — нормализуются */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  oemNumbers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsEnum(PartCondition)
  condition?: PartCondition;

  @IsOptional()
  @IsEnum(PartOrigin)
  origin?: PartOrigin;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photos?: string[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weightKg?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CompatibilityDto)
  compatibility?: CompatibilityDto[];
}

export class UpdatePartDto {
  @IsOptional() @IsString() @MaxLength(300) name?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) oemNumbers?: string[];
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsOptional() @IsEnum(PartCondition) condition?: PartCondition;
  @IsOptional() @IsEnum(PartOrigin) origin?: PartOrigin;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() price?: number;
  @IsOptional() @IsEnum(Currency) currency?: Currency;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() weightKg?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CompatibilityDto)
  compatibility?: CompatibilityDto[];
}

export class PartsQueryDto extends PaginationQueryDto {
  /** Поиск по названию / бренду / OEM */
  @IsOptional() @IsString() q?: string;

  /** Точный поиск по OEM с учётом кросс-номеров */
  @IsOptional() @IsString() oem?: string;

  @IsOptional() @IsUUID() categoryId?: string;

  /** Авто из гаража — фильтр совместимости */
  @IsOptional() @IsUUID() vehicleId?: string;

  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;

  @IsOptional() @IsEnum(PartCondition) condition?: PartCondition;
  @IsOptional() @IsEnum(PartOrigin) origin?: PartOrigin;
  @IsOptional() @IsUUID() storeId?: string;
  @IsOptional() @IsUUID() sellerId?: string;

  /** Страна магазина: KG, CN... */
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ enum: ['price_asc', 'price_desc', 'newest'] })
  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'newest'])
  sort?: 'price_asc' | 'price_desc' | 'newest';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStock?: boolean;
}

export class OemDto {
  @IsString() @MaxLength(80) number: string;
  @IsString() @MaxLength(100) brand: string;
  @IsOptional() @IsString() @MaxLength(300) name?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) crossNumbers?: string[];
}

export class ImportPartsDto {
  @IsUUID()
  storeId: string;
}
