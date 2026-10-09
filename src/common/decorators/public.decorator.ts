import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Эндпоинт без JWT */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ALLOW_BLOCKED_KEY = 'allowBlocked';
/** Эндпоинт доступен заблокированному пользователю (просмотр блокировки, обжалование, профиль) */
export const AllowBlocked = () => SetMetadata(ALLOW_BLOCKED_KEY, true);
