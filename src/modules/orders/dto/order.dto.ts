import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { DeliveryMethod, OrderStatus, PaymentMethod, ShippingMethod } from '../../../common/enums';

export class DeliveryAddressDto {
  @IsString() @MaxLength(100) city: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(150) recipientName?: string;
  @IsOptional() @IsString() @Matches(/^\+?[\d\s\-()]{9,20}$/) recipientPhone?: string;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class DeliveryDto {
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  /** Для PICKUP_POINT */
  @IsOptional()
  @IsUUID()
  pickupPointId?: string;

  /** Для COURIER */
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  address?: DeliveryAddressDto;

  /** Для товаров из-за рубежа: AIR / TRUCK / RAIL. Не указан — самый дешёвый */
  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;
}

/** Выбор предложения → оформление заказа */
export class CreateOrderFromOfferDto extends DeliveryDto {
  @IsUUID()
  offerId: string;
}

/** Быстрый заказ из каталога без запроса */
export class CreateOrderFromPartDto extends DeliveryDto {
  @IsUUID()
  partId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number = 1;
}

export class QuoteOrderDto extends DeliveryDto {
  @IsOptional() @IsUUID() offerId?: string;
  @IsOptional() @IsUUID() partId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity?: number;
}

export class PayDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

export class ReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SellerShipDto {
  @IsOptional() @IsString() @MaxLength(100) carrier?: string;
  @IsOptional() @IsString() @MaxLength(100) externalTrackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class OrdersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
}

export class AdminOrdersQueryDto extends OrdersQueryDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsString() number?: string;
}

export class AdminStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AdminRefundDto {
  /** Сумма возврата клиенту, KGS. 0 < amount ≤ total */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class MockWebhookDto {
  @IsOptional() @IsString() txId?: string;
}
