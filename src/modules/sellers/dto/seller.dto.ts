import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { SellerType, VerificationStatus } from '../../../common/enums';

export class StoreDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @Length(2, 2)
  country: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, string>;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SellerDocumentDto {
  @IsIn(['IP_CERT', 'LLC_CERT', 'PATENT', 'PASSPORT', 'OTHER'])
  type: string;

  @IsString()
  url: string;
}

export class ApplySellerDto {
  @IsEnum(SellerType)
  type: SellerType;

  @IsString()
  @MaxLength(200)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  inn?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SellerDocumentDto)
  documents: SellerDocumentDto[];

  /** Первый магазин/точка */
  @ValidateNested()
  @Type(() => StoreDto)
  store: StoreDto;
}

export class PayoutDetailsDto {
  @IsIn(['BANK', 'WALLET'])
  method: 'BANK' | 'WALLET';

  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @IsOptional() @IsString() @MaxLength(64) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(20) bik?: string;
}

export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayoutDetailsDto)
  payoutDetails?: PayoutDetailsDto;
}

export class VerifySellerDto {
  @IsEnum([VerificationStatus.VERIFIED, VerificationStatus.REJECTED])
  status: VerificationStatus.VERIFIED | VerificationStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SellerLimitsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offersPerDayLimit?: number | null;
}

export class SellersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
