import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { DisputeResolution, DisputeStatus, ReturnStatus } from '../../../common/enums';

export const DISPUTE_REASONS = [
  'NOT_RECEIVED',
  'WRONG_ITEM',
  'DAMAGED',
  'NOT_AS_DESCRIBED',
  'COUNTERFEIT',
  'OTHER',
];

export class OpenDisputeDto {
  @IsIn(DISPUTE_REASONS) reason: string;
  @IsString() @MaxLength(5000) description: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
}

export class EvidenceDto {
  @IsOptional() @IsString() @MaxLength(5000) text?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
}

export class ResolveDisputeDto {
  @IsEnum(DisputeResolution) resolution: DisputeResolution;

  /** Для REFUND_PARTIAL */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  refundAmount?: number;

  @IsOptional() @IsString() @MaxLength(5000) comment?: string;
}

export class DisputesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(DisputeStatus) status?: DisputeStatus;
}

export class RequestReturnDto {
  @IsIn(['WRONG_ITEM', 'DAMAGED', 'NOT_AS_DESCRIBED', 'NOT_FIT', 'CHANGED_MIND', 'OTHER'])
  reason: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) photos?: string[];
  @IsOptional() @IsIn(['COURIER', 'DROP_OFF']) method?: string;
}

export class DecideReturnDto {
  @IsBoolean() approve: boolean;
  /** Стоимость обратной доставки, удерживается из возврата */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class ReturnReceivedDto {
  /** Сумма возврата; по умолчанию: итого заказа − стоимость обратной доставки */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount?: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class ReturnsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ReturnStatus) status?: ReturnStatus;
}
