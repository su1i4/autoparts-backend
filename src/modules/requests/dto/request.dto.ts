import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  ConditionPreference,
  Currency,
  PartCondition,
  PartOrigin,
  RequestStatus,
} from '../../../common/enums';
import { VIN_REGEX } from '../../vehicles/dto/vehicle.dto';

export class CreateRequestDto {
  /** Авто из гаража. Либо vehicleId, либо make (+model/year/vin) вручную */
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional() @IsString() @Matches(VIN_REGEX) vin?: string;
  @IsOptional() @IsString() @MaxLength(30) frameNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) make?: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2100) year?: number;
  @IsOptional() @IsString() @MaxLength(120) engine?: string;

  /** Название детали */
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  oemNumber?: string;

  /** URL фото из /files/upload, до 10 */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ConditionPreference)
  condition?: ConditionPreference;

  @ApiPropertyOptional({ example: 'ANY', description: 'ANY или ISO-2 страны: CN, JP, KR...' })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  originCountry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  budget?: number;

  @IsOptional()
  @IsEnum(Currency)
  budgetCurrency?: Currency;

  @IsOptional()
  @IsDateString()
  desiredDate?: string;

  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;

  /** false — сохранить черновиком */
  @IsOptional()
  @IsBoolean()
  publish?: boolean = true;
}

export class UpdateRequestDto {
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) oemNumber?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(ConditionPreference) condition?: ConditionPreference;
  @IsOptional() @IsString() @Length(2, 3) originCountry?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() budget?: number;
  @IsOptional() @IsEnum(Currency) budgetCurrency?: Currency;
  @IsOptional() @IsDateString() desiredDate?: string;
}

export class MyRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}

export class FeedQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() q?: string;

  /** Только «подходит вашему ассортименту» */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  matchesOnly?: boolean;

  /** Скрыть запросы, на которые я уже ответил */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hideAnswered?: boolean;
}

export class AdminRequestsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(RequestStatus) status?: RequestStatus;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsUUID() clientId?: string;
}

export class CloseRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ───────── Offers ─────────

export class CreateOfferDto {
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsUUID()
  partId?: string;

  /** По умолчанию — название запроса */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsEnum(PartCondition)
  condition: PartCondition;

  @IsOptional()
  @IsEnum(PartOrigin)
  origin?: PartOrigin;

  @IsOptional() @IsString() @MaxLength(100) brand?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  deliveryDays: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  warrantyDays?: number;

  /** До 5 фото */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weightKg?: number;
}

export class UpdateOfferDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() price?: number;
  @IsOptional() @IsEnum(Currency) currency?: Currency;
  @IsOptional() @IsEnum(PartCondition) condition?: PartCondition;
  @IsOptional() @IsEnum(PartOrigin) origin?: PartOrigin;
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(180) deliveryDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) warrantyDays?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() weightKg?: number;
}

export class OffersQueryDto {
  @ApiPropertyOptional({ enum: ['price', 'delivery', 'rating', 'newest'] })
  @IsOptional()
  @IsIn(['price', 'delivery', 'rating', 'newest'])
  sort?: 'price' | 'delivery' | 'rating' | 'newest';
}

export class SellerOffersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(['SENT', 'VIEWED', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'REMOVED'])
  status?: string;
}

export class AdminOffersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID() requestId?: string;
  @IsOptional() @IsUUID() sellerId?: string;
}
