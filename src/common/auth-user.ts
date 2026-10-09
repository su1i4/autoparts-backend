import { Role } from './enums';

/** То, что лежит в request.user после JwtStrategy */
export interface AuthUser {
  id: string;
  phone: string;
  roles: Role[];
  sellerId: string | null;
  blocked: boolean;
}

export const isStaff = (u: AuthUser) =>
  u.roles.some((r) => r === Role.ADMIN || r === Role.SUPPORT || r === Role.LOGISTICS);
