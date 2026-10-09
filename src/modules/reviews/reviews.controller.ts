import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { CreateReviewDto, ReplyReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Отзыв по завершённому заказу (1–5, текст, фото) */
  @ApiBearerAuth()
  @Post('orders/:id/review')
  create(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(u, id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.SELLER)
  @Post('reviews/:id/reply')
  reply(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviews.reply(u, id, dto.text);
  }

  @Public()
  @Get('sellers/:id/reviews')
  forSeller(@Param('id', ParseUUIDPipe) id: string, @Query() q: PaginationQueryDto) {
    return this.reviews.forSeller(id, q);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPPORT)
  @Post('admin/reviews/:id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.reviews.setHidden(id, true, u.id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPPORT)
  @Post('admin/reviews/:id/show')
  show(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.reviews.setHidden(id, false, u.id);
  }
}
