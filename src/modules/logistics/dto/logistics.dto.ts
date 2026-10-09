import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  DeliveryMethod,
  ShipmentStatus,
  ShippingMethod,
  WarehouseType,
} from '../../../common/enums';

export class DimensionsDto {
  @Type(() => Number) @IsNumber() @IsPositive() l: number;
  @Type(() => Number) @IsNumber() @IsPositive() w: number;
  @Type(() => Number) @IsNumber() @IsPositive() h: number;
}

export class CalculateDto {
  @IsString() @Length(2, 2) fromCountry: string;
  @IsOptional() @IsString() @Length(2, 2) toCountry?: string;
  @IsOptional() @IsEnum(ShippingMethod) method?: ShippingMethod;
  @IsEnum(DeliveryMethod) deliveryMethod: DeliveryMethod;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() weightKg?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions?: DimensionsDto;
}

export class WarehouseDto {
  @IsString() @MaxLength(150) name: string;
  @IsEnum(WarehouseType) type: WarehouseType;
  @IsString() @Length(2, 2) country: string;
  @IsString() @MaxLength(100) city: string;
  @IsString() @MaxLength(300) address: string;
  @IsOptional() @IsObject() workingHours?: Record<string, string>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TariffDto {
  @IsString() @Length(2, 2) fromCountry: string;
  @IsString() @Length(2, 2) toCountry: string;
  @IsEnum(ShippingMethod) method: ShippingMethod;
  @Type(() => Number) @IsNumber() @Min(0) pricePerKg: number;
  @Type(() => Number) @IsNumber() @Min(0) minPrice: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) volumetricDivisor?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) surchargePercent?: number;
  @Type(() => Number) @IsInt() @Min(0) daysMin: number;
  @Type(() => Number) @IsInt() @Min(0) daysMax: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ShipmentStatusDto {
  @IsEnum(ShipmentStatus) status: ShipmentStatus;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsString() @MaxLength(100) carrier?: string;
  @IsOptional() @IsString() @MaxLength(100) externalTrackingNumber?: string;
}

export class ReceiveShipmentDto {
  @IsUUID() warehouseId: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() weightKg?: number;
  @IsOptional() @ValidateNested() @Type(() => DimensionsDto) dimensions?: DimensionsDto;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
  /** false — некомплект (фиксируется в ленте статусов) */
  @IsOptional() @IsBoolean() complete?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ConsolidateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  shipmentIds: string[];
  @IsUUID() originWarehouseId: string;
  @IsUUID() destinationWarehouseId: string;
  @IsEnum(ShippingMethod) method: ShippingMethod;
  @IsOptional() @IsString() @MaxLength(100) carrier?: string;
  @IsOptional() @IsString() @MaxLength(100) trackingNumber?: string;
}

export class TrackingRowDto {
  /** Наш внутренний трек AP... */
  @IsString() trackingNumber: string;
  @IsString() @MaxLength(100) externalTrackingNumber: string;
  @IsOptional() @IsString() @MaxLength(100) carrier?: string;
}

export class BulkTrackingDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => TrackingRowDto)
  items: TrackingRowDto[];
}

export class ShipmentsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ShipmentStatus) status?: ShipmentStatus;
  @IsOptional() @IsUUID() consolidationId?: string;
  @IsOptional() @IsUUID() originWarehouseId?: string;
}
