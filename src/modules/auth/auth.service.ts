import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Language, Role } from '../../common/enums';
import { normalizePhone } from '../../common/utils/text';
import { ModerationService } from '../moderation/moderation.service';
import { User } from '../users/entities/user.entity';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { OtpCode } from './entities/otp-code.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { OtpSender } from './providers/sms.provider';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OtpCode) private readonly otps: Repository<OtpCode>,
    @InjectRepository(RefreshSession) private readonly sessions: Repository<RefreshSession>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sender: OtpSender,
    private readonly moderation: ModerationService,
  ) {}

  private hashOtp(phone: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow('OTP_SECRET'))
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  async requestOtp(dto: RequestOtpDto) {
    const phone = normalizePhone(dto.phone);
    if (await this.moderation.isBlacklisted(phone, dto.deviceId)) {
      throw new ForbiddenException('Регистрация с этого номера/устройства запрещена');
    }

    // не чаще 1 кода в минуту на номер
    const recent = await this.otps.findOne({
      where: { phone, createdAt: MoreThan(new Date(Date.now() - 60_000)) },
    });
    if (recent)
      throw new HttpException(
        'Повторная отправка возможна через минуту',
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const code = String(randomInt(0, 10000)).padStart(4, '0');
    const ttl = this.config.get<number>('OTP_TTL_SECONDS', 300);
    await this.otps.update({ phone, consumedAt: IsNull() }, { consumedAt: new Date() }); // гасим старые
    await this.otps.save(
      this.otps.create({
        phone,
        codeHash: this.hashOtp(phone, code),
        channel: dto.channel ?? 'SMS',
        expiresAt: new Date(Date.now() + ttl * 1000),
      }),
    );
    await this.sender.send(phone, code, dto.channel ?? 'SMS');

    // код в ответе — только в dev, даже если OTP_DEV_MODE случайно включён в проде
    const devMode =
      this.config.get<boolean>('OTP_DEV_MODE') && this.config.get('NODE_ENV') !== 'production';
    return { sent: true, phone, expiresIn: ttl, ...(devMode ? { devCode: code } : {}) };
  }

  async verifyOtp(dto: VerifyOtpDto, userAgent?: string) {
    const phone = normalizePhone(dto.phone);
    const otp = await this.otps.findOne({
      where: { phone, consumedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!otp) throw new BadRequestException('Код истёк или не запрашивался');

    const max = this.config.get<number>('OTP_MAX_ATTEMPTS', 5);
    if (otp.attempts >= max)
      throw new BadRequestException('Превышено число попыток, запросите новый код');

    const a = Buffer.from(otp.codeHash);
    const b = Buffer.from(this.hashOtp(phone, dto.code));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.otps.increment({ id: otp.id }, 'attempts', 1);
      throw new BadRequestException('Неверный код');
    }
    await this.otps.update(otp.id, { consumedAt: new Date() });

    let user = await this.users.findOne({ where: { phone }, relations: { seller: true } });
    const isNew = !user;
    if (!user) {
      user = await this.users.save(
        this.users.create({ phone, roles: [Role.CLIENT], language: dto.language ?? Language.RU }),
      );
    }
    await this.users.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.issueTokens(user, dto.deviceId, userAgent);
    return { ...tokens, isNew, user };
  }

  private async issueTokens(user: User, deviceId?: string, userAgent?: string) {
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    const secret = randomBytes(32).toString('hex');
    const days = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: sha256(secret),
        deviceId: deviceId ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
        expiresAt: new Date(Date.now() + days * 86400_000),
      }),
    );
    return { accessToken, refreshToken: `${session.id}.${secret}` };
  }

  /** Ротация refresh-токена: старая сессия гасится, выдаётся новая пара */
  async refresh(refreshToken: string, userAgent?: string) {
    const [id, secret] = refreshToken.split('.');
    if (!id || !secret) throw new UnauthorizedException();
    const session = await this.sessions.findOne({ where: { id } }).catch(() => null);
    if (!session || session.revokedAt || session.expiresAt < new Date())
      throw new UnauthorizedException();
    if (session.tokenHash !== sha256(secret)) {
      // повторное использование старого токена — гасим все сессии пользователя
      await this.sessions.update(
        { userId: session.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException();
    }
    await this.sessions.update(session.id, { revokedAt: new Date() });
    const user = await this.users.findOneByOrFail({ id: session.userId });
    return this.issueTokens(user, session.deviceId ?? undefined, userAgent);
  }

  async logout(refreshToken: string) {
    const [id] = refreshToken.split('.');
    if (id) await this.sessions.update({ id }, { revokedAt: new Date() }).catch(() => undefined);
    return { ok: true };
  }
}
