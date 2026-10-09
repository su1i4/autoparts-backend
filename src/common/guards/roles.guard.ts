import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../auth-user';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException();
    if (user.roles.includes(Role.ADMIN)) return true;
    if (required.some((r) => user.roles.includes(r))) return true;
    throw new ForbiddenException('Недостаточно прав');
  }
}
