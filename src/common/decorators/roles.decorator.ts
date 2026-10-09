import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export const ROLES_KEY = 'roles';
/** Доступ, если у пользователя есть ХОТЯ БЫ ОДНА из ролей. ADMIN проходит всегда. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
