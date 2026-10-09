/** Нормализация OEM-номера: только буквы/цифры, верхний регистр. "90915-YZZD3" → "90915YZZD3" */
export const normalizeOem = (s: string): string => s.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

/** Нормализация телефона в E.164-подобный вид: "+996 (700) 12-34-56" → "+996700123456" */
export const normalizePhone = (s: string): string => {
  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '996' + digits.slice(1); // 0700123456
  if (digits.length === 9) digits = '996' + digits; // 700123456
  return '+' + digits;
};

export const randomCode = (prefix: string, len = 8): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}${out}`;
};
