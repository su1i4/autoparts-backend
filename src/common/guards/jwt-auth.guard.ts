import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../auth-user';
import { ALLOW_BLOCKED_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const ok = (await super.canActivate(ctx)) as boolean;
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (user?.blocked && !this.reflector.getAllAndOverride<boolean>(ALLOW_BLOCKED_KEY, targets)) {
      throw new ForbiddenException({ code: 'USER_BLOCKED', message: 'Аккаунт заблокирован' });
    }
    return ok;
  }
}
