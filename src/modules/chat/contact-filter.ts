/**
 * Фильтр контактов в чате (п.5 ТЗ).
 *
 * Ловит: телефоны (в т.ч. словами на RU/KG/EN, с разделителями, эмодзи-цифрами, буквами вместо цифр),
 * email (включая «собака/точка», «at/dot»), ссылки и домены, @username, названия мессенджеров и соцсетей
 * (латиница, кириллица, транслит, смешанные алфавиты, разбивка по буквам «w h a t s a p p»).
 *
 * Не трогает: OEM-номера (90915-YZZD3, 04465-33450 и номера после слов «OEM/артикул»), VIN, цены, годы,
 * мощность ламп «55 ватт», обычные слова вроде «сапог», «инстанция», «телеграф».
 *
 * Чистая функция без зависимостей — покрыта тестами contact-filter.spec.ts.
 */

export type ContactKind = 'PHONE' | 'EMAIL' | 'LINK' | 'USERNAME' | 'MESSENGER';

export interface ContactFilterResult {
  blocked: boolean;
  kinds: ContactKind[];
  /** Текст с замаскированными фрагментами (для превью/логов) */
  masked: string;
}

export const CONTACT_WARNING = 'Передача контактов запрещена правилами сервиса';

// ───────────────────────── нормализация ─────────────────────────

const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿­️⃣]/g;

function normalize(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE, '').toLowerCase().replace(/ё/g, 'е');
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ң: 'n',
  ө: 'o',
  ү: 'u',
  і: 'i',
};

/** Кириллица → латиница + «фонетическая свёртка», чтобы whatsapp/ватсап/вацап/votsap совпадали */
export function fold(word: string): string {
  let s = '';
  for (const ch of word.toLowerCase()) s += TRANSLIT[ch] ?? ch;
  return s
    .replace(/[^a-z0-9]/g, '')
    .replace(/wh/g, 'v')
    .replace(/w/g, 'v')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/0/g, 'o')
    .replace(/o/g, 'a')
    .replace(/(.)\1+/g, '$1'); // двойные буквы
}

// ───────────────────────── мессенджеры ─────────────────────────

/** Длинные основы: совпадение по вхождению в слово (с исключениями) */
const LONG_STEMS = [
  'whatsapp',
  'watsap',
  'vatsap',
  'ватсап',
  'вацап',
  'вотсап',
  'уатсап',
  'вотсаб',
  'whatsap',
  'whatapp',
  'telegram',
  'телеграм',
  'telega',
  'телега',
  'телеге',
  'телегу',
  'телегой',
  'tlgrm',
  'тлгрм',
  'teleg',
  'instagram',
  'инстаграм',
  'insta',
  'инста',
  'инсте',
  'инсту',
  'insta',
  'viber',
  'вайбер',
  'вибер',
  'vaiber',
  'wechat',
  'вичат',
  'вийчат',
  'вэйчат',
  'weixin',
  'skype',
  'скайп',
  'discord',
  'дискорд',
  'facebook',
  'фейсбук',
  'фэйсбук',
  'vkontakte',
  'вконтакте',
  'odnoklassniki',
  'одноклассник',
  'tiktok',
  'тикток',
  'snapchat',
  'снапчат',
  'messenger',
  'мессенджер',
  'месенджер',
  'мессенжер',
  'gmail',
  'гмаил',
  'джимейл',
  'mailru',
  'майлру',
  'мейлру',
  'hotmail',
  'outlook',
  'icloud',
  'rambler',
  'inboxru',
  'yahoo',
].map(fold);

/** Короткие основы: только целое слово (с падежными окончаниями) */
const SHORT_STEMS = [
  'tg',
  'тг',
  'тгк',
  'тлг',
  'tlg',
  'vk',
  'вк',
  'ig',
  'инст',
  'imo',
  'имо',
  'ватс',
  'вотс',
  'whats',
  'fb',
].map(fold);

/** Ложные срабатывания: если свёрнутое слово содержит одну из этих основ — не мессенджер */
const STEM_EXCEPTIONS = ['instal', 'instan', 'telegraf', 'teleskap', 'teleskop'].map(fold);

const SHORT_ENDINGS = /^(?:[aeiu]|e|om|am|e|u|a|ka|ke|ku)?$/;

function matchesMessenger(folded: string): boolean {
  if (!folded) return false;
  if (STEM_EXCEPTIONS.some((e) => folded.includes(e))) return false;
  if (LONG_STEMS.some((s) => s.length >= 5 && folded.includes(s))) return true;
  return SHORT_STEMS.some(
    (s) => folded.startsWith(s) && SHORT_ENDINGS.test(folded.slice(s.length)),
  );
}

/** Слияние в пару/тройку слов: только точное совпадение с основой (+окончание), чтобы «вот сапог» не стал «вотсап» */
function matchesMessengerJoined(folded: string): boolean {
  if (STEM_EXCEPTIONS.some((e) => folded.includes(e))) return false;
  return LONG_STEMS.some(
    (s) => folded.startsWith(s) && /^[aeiu]?(?:m|i)?$/.test(folded.slice(s.length)),
  );
}

/** «w h a t s a p p», «т.е.л.е.г.р.а.м», «w-h-a-t-s» → склеиваем одиночные буквы */
function collapseSpelledOut(text: string): string {
  return text.replace(/(?:(?<![\p{L}\p{N}])\p{L}[\s.\-_*,|/\\+~:]+){2,}\p{L}(?![\p{L}])/gu, (m) =>
    m.replace(/[^\p{L}]/gu, ''),
  );
}

function detectMessengers(text: string): string[] {
  const collapsed = collapseSpelledOut(text);
  const words = collapsed.split(/[^\p{L}\p{N}_\-'`*.]+/u).filter(Boolean);
  const hits: string[] = [];
  const folded = words.map((w) => fold(w.replace(/[-_'`*.]/g, '')));
  folded.forEach((f, i) => {
    if (matchesMessenger(f)) hits.push(words[i]);
    else if (i + 1 < folded.length && matchesMessengerJoined(f + folded[i + 1]))
      hits.push(words[i], words[i + 1]);
    else if (
      i + 2 < folded.length &&
      f.length <= 4 &&
      matchesMessengerJoined(f + folded[i + 1] + folded[i + 2])
    )
      hits.push(words[i], words[i + 1], words[i + 2]);
  });
  return hits;
}

// ───────────────────────── цифры словами ─────────────────────────

const UNITS: Record<string, number> = {
  // ru
  ноль: 0,
  нуль: 0,
  один: 1,
  одна: 1,
  одну: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  // ky
  нөл: 0,
  нол: 0,
  бир: 1,
  эки: 2,
  үч: 3,
  уч: 3,
  төрт: 4,
  торт: 4,
  беш: 5,
  алты: 6,
  жети: 7,
  сегиз: 8,
  тогуз: 9,
  тогус: 9,
  // en
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const TEENS: Record<string, number> = {
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  жыйырма: 20,
  отуз: 30,
  кырк: 40,
  элүү: 50,
  элуу: 50,
  алтымыш: 60,
  жетимиш: 70,
  сексен: 80,
  токсон: 90,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const HUNDREDS: Record<string, number> = {
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
};

/** «ноль пятьсот пятьдесят пять двенадцать тридцать четыре» → «0 555 12 34» */
const NUMBER_WORDS = new Set([
  ...Object.keys(UNITS),
  ...Object.keys(TEENS),
  ...Object.keys(TENS),
  ...Object.keys(HUNDREDS),
]);

export function wordsToDigits(text: string): string {
  // «055five123456» → «055 five 123456»
  const spaced = text.replace(/\p{L}+/gu, (w) => (NUMBER_WORDS.has(w) ? ` ${w} ` : w));
  const tokens = spaced.split(/(\s+|[,.;:!?\-–—()]+)/);
  const out: string[] = [];
  let group: {
    h: number;
    t: number;
    u: number;
    has: { h: boolean; t: boolean; u: boolean };
  } | null = null;

  const flush = () => {
    if (!group) return;
    const { h, t, u, has } = group;
    // ноль/цифра без старших разрядов → одна цифра; иначе число целиком
    if (!has.h && !has.t) out.push(String(u));
    else out.push(String(h + t + u));
    group = null;
  };

  for (const tok of tokens) {
    const w = tok.trim();
    if (!w) {
      if (!group) out.push(tok);
      continue;
    }
    if (!/\p{L}/u.test(w)) {
      if (/\d/.test(w)) {
        flush();
        out.push(tok, ' ');
      } else if (!group) {
        out.push(tok);
      }
      // разделители между числами-словами не выводим, чтобы цифры склеились в один «номер»
      continue;
    }
    if (w === 'плюс' || w === 'plus') {
      flush();
      out.push('+');
      continue;
    }
    if (w in HUNDREDS) {
      flush();
      group = { h: HUNDREDS[w], t: 0, u: 0, has: { h: true, t: false, u: false } };
    } else if (w in TENS) {
      if (group && group.has.h && !group.has.t && !group.has.u) {
        group.t = TENS[w];
        group.has.t = true;
      } else {
        flush();
        group = { h: 0, t: TENS[w], u: 0, has: { h: false, t: true, u: false } };
      }
    } else if (w in TEENS) {
      if (group && group.has.h && !group.has.t && !group.has.u) {
        group.t = TEENS[w];
        group.has.t = true;
        group.has.u = true;
      } else {
        flush();
        group = { h: 0, t: TEENS[w], u: 0, has: { h: false, t: true, u: true } };
      }
    } else if (w in UNITS) {
      const v = UNITS[w];
      if (group && !group.has.u && (group.has.t || group.has.h) && v !== 0 && group.t % 10 === 0) {
        group.u = v;
        group.has.u = true;
      } else {
        flush();
        group = { h: 0, t: 0, u: v, has: { h: false, t: false, u: true } };
      }
    } else {
      flush();
      out.push(tok);
      continue;
    }
    out.push(' ');
  }
  flush();
  return out.join('').replace(/[ \t]{2,}/g, ' ');
}

// ───────────────────────── телефоны ─────────────────────────

const OEM_CONTEXT =
  /(oem|оем|артикул|арт\.?|каталожн\S*|кат\.?\s*номер|part\s*(?:no|number|#)|p\/n|номер\s+(?:детали|запчасти|оригинала)|кросс|аналог|vin|вин|frame|кузов)\s*[:№#-]?\s*$/i;

/** Цифро-подобные буквы внутри цифровых групп: «o7oo 12З 456» → «0700 123 456» */
function lettersToDigits(text: string): string {
  return text.replace(/[0-9oоlіiзб|]{3,}/g, (m) => {
    const digits = (m.match(/\d/g) ?? []).length;
    if (digits < 1) return m;
    return m
      .replace(/[oо]/g, '0')
      .replace(/[lіi|]/g, '1')
      .replace(/з/g, '3')
      .replace(/б/g, '6');
  });
}

function isPhoneDigits(d: string, hadPlus: boolean): boolean {
  if (hadPlus && d.length >= 9 && d.length <= 15) return true;
  if (/^996\d{9}$/.test(d)) return true; // КР
  if (/^0[23579]\d{8}$/.test(d)) return true; // КР локальный 0555 123456
  if (/^[2579]\d{8}$/.test(d)) return true; // КР без нуля 555123456
  if (/^[78]\d{10}$/.test(d)) return true; // РФ/КЗ
  if (/^(?:998|992|993|994|995)\d{9}$/.test(d)) return true; // UZ/TJ/TM/AZ/GE
  if (/^(?:86)?1[3-9]\d{9}$/.test(d)) return true; // Китай mobile
  return false;
}

interface Span {
  start: number;
  end: number;
}

/** OEM-шаблоны, которые нельзя путать с телефоном: Toyota 04465-33450, 90915-10003-01 */
const OEM_PATTERNS = /(?<!\d)\d{5}-\d{5}(?:-\d{2})?(?!\d)/g;

function detectPhones(text: string): Span[] {
  const prepared = lettersToDigits(wordsToDigits(text.replace(OEM_PATTERNS, ' oem ')));
  const spans: Span[] = [];
  // Цифры, «приклеенные» к латинице (VIN JTDBR32E720123456, OEM 1K0615301AA), — не телефон
  const re = /(?<![a-z\d])\+?\d(?:[\s\-.()/_*,|+~:]{0,3}\d)+(?![a-z\d])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prepared))) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9) continue;
    // OEM вида 04465-33450 или с префиксом «OEM:/артикул»
    const before = prepared.slice(Math.max(0, m.index - 25), m.index);
    if (OEM_CONTEXT.test(before)) continue;
    if (isPhoneDigits(digits, raw.startsWith('+'))) {
      spans.push({ start: m.index, end: m.index + raw.length });
      continue;
    }
    // длинная последовательность — проверяем все «окна», вдруг номер склеен с другим числом
    for (let len = 9; len <= 12 && len <= digits.length; len++) {
      let found = false;
      for (let i = 0; i + len <= digits.length; i++) {
        const sub = digits.slice(i, i + len);
        if (/^(?:996\d{9}|0[579]\d{8}|[78]9\d{9})$/.test(sub)) {
          spans.push({ start: m.index, end: m.index + raw.length });
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  // Спаны относятся к prepared-тексту; для маскировки достаточно знать, что телефон есть
  return spans;
}

// ───────────────────────── email / ссылки / username ─────────────────────────

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const EMAIL_OBFUSCATED_RE =
  /[a-z0-9._-]{2,}\s*(?:\(at\)|\[at\]|\{at\}|\s+at\s+|собак[аи]|собачк[аи]|@)\s*[a-z0-9-]{2,}\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+|точка|тчк)\s*(?:[a-z]{2,}|ру|ком|кг)\b/gi;
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const TLD =
  '(?:com|ru|kg|kz|uz|tj|by|ua|su|net|org|me|io|info|shop|site|online|store|app|link|ly|biz|pro|xyz|ws|to|gg|cn|cc|co|tv|рф|ком|ру|кг)';
const DOMAIN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])[a-zа-я0-9][a-zа-я0-9-]{0,62}\\s?(?:\\.|\\(dot\\)|\\[dot\\]|\\s(?:dot|точка|тчк)\\s)\\s?${TLD}(?![\\p{L}\\p{N}])(?:/\\S*)?`,
  'giu',
);
const USERNAME_RE = /(?<![a-z0-9._%+-])@[a-z0-9_][a-z0-9_.]{2,}/gi;

function collect(re: RegExp, text: string): Span[] {
  const out: Span[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

/** Домены вида «т.е.», «т.к.» и версии «2.0» отсекаются списком TLD; доп. исключения: */
const DOMAIN_FALSE_POSITIVES = /^(?:т\.?\s?к|т\.?\s?е|и\.?\s?т\.?\s?д)$/i;

// ───────────────────────── публичная функция ─────────────────────────

export function detectContacts(input: string): ContactFilterResult {
  const text = normalize(input ?? '');
  const kinds = new Set<ContactKind>();
  const maskSpans: Span[] = [];

  const emails = [...collect(EMAIL_RE, text), ...collect(EMAIL_OBFUSCATED_RE, text)];
  if (emails.length) kinds.add('EMAIL');
  maskSpans.push(...emails);

  const urls = collect(URL_RE, text);
  const domains = collect(DOMAIN_RE, text).filter(
    (s) => !DOMAIN_FALSE_POSITIVES.test(text.slice(s.start, s.end)),
  );
  if (urls.length || domains.length) kinds.add('LINK');
  maskSpans.push(...urls, ...domains);

  const users = collect(USERNAME_RE, text).filter(
    (u) => !emails.some((e) => u.start >= e.start && u.end <= e.end),
  );
  if (users.length) kinds.add('USERNAME');
  maskSpans.push(...users);

  if (detectPhones(text).length) kinds.add('PHONE');

  const messengerWords = detectMessengers(text);
  if (messengerWords.length) kinds.add('MESSENGER');

  // Маскировка: точные спаны для email/ссылок/@, плюс цифровые последовательности и слова-мессенджеры
  let masked = text;
  maskSpans
    .sort((a, b) => b.start - a.start)
    .forEach((s) => (masked = masked.slice(0, s.start) + '***' + masked.slice(s.end)));
  if (kinds.has('PHONE')) masked = masked.replace(/\+?\d(?:[\s\-.()/_*,|+~:]{0,3}\d){5,}/g, '***');
  for (const w of new Set(messengerWords)) {
    masked = masked.split(w).join('***');
  }

  return { blocked: kinds.size > 0, kinds: [...kinds], masked };
}
