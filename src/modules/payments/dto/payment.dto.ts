import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PaymentMethod, PaymentStatus, PayoutStatus } from '../../../common/enums';

export class PayOrderDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

export class RequestPayoutDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class ProcessPayoutDto {
  @IsIn(['PAID', 'REJECTED'])
  decision: 'PAID' | 'REJECTED';

  @IsOptional() @IsString() @MaxLength(120) bankReference?: string;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class PayoutsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(PayoutStatus) status?: PayoutStatus;
}

export class PaymentsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsString() orderId?: string;
}

export class LedgerQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() account?: string;
  @IsOptional() @IsString() orderId?: string;
}
