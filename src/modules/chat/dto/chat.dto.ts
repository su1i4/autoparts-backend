import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ChatType } from '../../../common/enums';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class OpenChatDto {
  @IsUUID()
  requestId: string;

  /** Обязателен для клиента (с каким продавцом), продавцу не нужен */
  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photos?: string[];
}

export class MessagesQueryDto {
  /** Курсор: сообщения раньше этой даты */
  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class CheckTextDto {
  @IsString()
  @MaxLength(4000)
  text: string;
}

export class AdminChatsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ChatType) type?: ChatType;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() orderId?: string;
}
