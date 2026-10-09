import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/auth-user';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { Order } from '../orders/entities/order.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { CreateReviewDto } from './dto/review.dto';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthUser, orderId: string, dto: CreateReviewDto) {
    const order = await this.orders.findOneBy({ id: orderId, clientId: user.id });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status !== OrderStatus.COMPLETED)
      throw new BadRequestException('Отзыв можно оставить после завершения заказа');
    if (await this.reviews.findOneBy({ orderId }))
      throw new ConflictException('Отзыв уже оставлен');
    await this.files.assertOwned(user.id, dto.photos);
    const review = await this.reviews.save(
      this.reviews.create({
        orderId,
        authorId: user.id,
        sellerId: order.sellerId,
        rating: dto.rating,
        text: dto.text ?? null,
        photos: dto.photos ?? [],
      }),
    );
    await this.recalc(order.sellerId);
    this.events.emit('review.created', {
      reviewId: review.id,
      sellerId: order.sellerId,
      rating: dto.rating,
    });
    return review;
  }

  /** Рейтинг = среднее по видимым отзывам */
  private async recalc(sellerId: string) {
    const [r] = await this.ds.query(
      `SELECT COALESCE(AVG(rating),0)::numeric(3,2) AS avg, COUNT(*)::int AS cnt FROM reviews WHERE "sellerId" = $1 AND "isHidden" = false`,
      [sellerId],
    );
    await this.ds
      .getRepository(Seller)
      .update(sellerId, { rating: Number(r.avg), reviewsCount: r.cnt });
  }

  async reply(user: AuthUser, id: string, text: string) {
    const r = await this.reviews.findOneBy({ id });
    if (!r || r.sellerId !== user.sellerId) throw new NotFoundException('Отзыв не найден');
    if (r.sellerReply) throw new BadRequestException('Ответ уже дан');
    r.sellerReply = text;
    r.sellerReplyAt = new Date();
    return this.reviews.save(r);
  }

  async forSeller(sellerId: string, q: PaginationQueryDto) {
    const [items, total] = await this.reviews.findAndCount({
      where: { sellerId, isHidden: false },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async setHidden(id: string, hidden: boolean, actorId: string) {
    const r = await this.reviews.findOneBy({ id });
    if (!r) throw new NotFoundException();
    r.isHidden = hidden;
    await this.reviews.save(r);
    await this.recalc(r.sellerId);
    await this.audit.log(actorId, hidden ? 'review.hide' : 'review.show', 'review', id);
    return r;
  }
}
