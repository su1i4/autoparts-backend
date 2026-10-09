import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(3000) text?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) photos?: string[];
}

export class ReplyReviewDto {
  @IsString() @MaxLength(3000) text: string;
}
