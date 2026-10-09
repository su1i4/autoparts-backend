import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/auth-user';
import { UserStatus } from '../../common/enums';
import { ModerationService } from '../moderation/moderation.service';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly moderation: ModerationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findForAuth(payload.sub);
    if (!user || user.status === UserStatus.DELETED) throw new UnauthorizedException();
    await this.moderation.refreshBlockState(user);
    return {
      id: user.id,
      phone: user.phone,
      roles: user.roles,
      sellerId: user.seller?.id ?? null,
      blocked: user.status === UserStatus.BLOCKED,
    };
  }
}
