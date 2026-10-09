import { detectContacts, fold, wordsToDigits } from './contact-filter';

/** Должно блокироваться (критерий приёмки: ≥ 95%) */
const MUST_BLOCK: string[] = [
  // телефоны КР
  '+996 555 123 456',
  '+996555123456',
  '0555 123 456',
  '0555123456',
  '0700-12-34-56',
  '(0700) 12 34 56',
  '0 7 0 0 1 2 3 4 5 6',
  '0.555.12.34.56',
  'звони 0772 112233',
  'мой номер 555 12 34 56',
  '555123456',
  '996 700 112 233',
  '0555*12*34*56',
  '0555_12_34_56',
  'номер: 0222 33 44 55',
  'o7oo 12З 456',
  '0️⃣5️⃣5️⃣5️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣',
  '０５５５１２３４５６',
  // словами
  'ноль пятьсот пятьдесят пять двенадцать тридцать четыре пятьдесят шесть',
  'ноль семь ноль ноль один два три четыре пять шесть',
  'ноль 555 двенадцать 34 56',
  'нөл беш беш беш бир эки үч төрт беш алты',
  'zero five five five one two three four five six',
  'плюс 996 семьсот семьдесят семь 12 34 56',
  // РФ/КЗ/Китай/УЗ
  '+7 701 123 45 67',
  '8 (912) 345-67-89',
  '89123456789',
  '+86 138 0013 8000',
  '13800138000',
  '+998 90 123 45 67',
  // email
  'ivan.petrov@gmail.com',
  'пишите на parts_kg@mail.ru',
  'ivan собака gmail точка com',
  'ivan (at) mail (dot) ru',
  'ivan at gmail dot com',
  'мой gmail ivanparts',
  'почта на mail.ru',
  // ссылки
  'https://t.me/autoparts_kg',
  'www.avtozapchasti.kg',
  'смотри на сайте zapchasti.kg',
  'zapchasti . kg',
  't.me/ivan',
  'wa.me/996555123456',
  'instagram.com/autoparts',
  'сайт запчасти точка кг',
  'vk.com/id123',
  'bit.ly/abc',
  'наш сайт avto-parts.ru',
  // @username
  '@autoparts_kg',
  'пиши мне @ivan_parts',
  'ник в тг @ivan',
  // мессенджеры
  'пиши в ватсап',
  'напиши в whatsapp',
  'WhatsApp',
  'есть вацап?',
  'скинь в вотсап',
  'го в телегу',
  'в телеге напиши',
  'телеграм есть?',
  'telegram',
  'пиши в тг',
  'в tg напиши',
  'w h a t s a p p',
  'т е л е г р а м',
  'w.h.a.t.s.a.p.p',
  'whats app',
  'ват сап',
  'теле грам',
  'tелеграм', // смешанный алфавит
  'вaтсaп', // латинские а
  'инстаграм',
  'в инсте',
  'insta',
  'вайбер',
  'viber',
  'вичат',
  'wechat',
  'skype',
  'фейсбук',
  'в вк найди',
  'одноклассники',
  'мессенджер',
  'vatsap',
  'telega',
  'имо есть?',
  'вотсапе',
  'в ватсапе напишу',
  // отложенная выборка (проверялась отдельно, до доработок)

  'мой номерок 0 500 98 76 54',
  'тел 0-550-11-22-33',
  'тел.: +996(509)112233',
  'ватсапп',
  'вацапе',
  'вотс ап',
  'Whats App',
  'тележка? нет, телега',
  'TELEGRAM: ivan',
  'инстаграмм',
  'insta: autoparts',
  'пишите в директ инсты',
  'семь семь семь один два три четыре пять шесть',
  'ноль девятьсот девяносто девять 12 34 56',
  'eight nine one two three four five six seven eight nine',
  'ivan[at]gmail[dot]com',
  'ivan@yandex.ru',
  'мой ящик ivan_parts на гугл почте gmail',
  'zapchasti.kz',
  'https://wa.me/996700000000',
  'youtube.com/@parts',
  'vatsap 0555',
  'teleg: @parts',
  'добавь в вайбере',
  'вибер есть?',
  'скайп: ivan.parts',
  'дискорд',
  'tiktok @autoparts',
  '0 5 0 0 9 8 7 6 5 4',
  '+7-777-123-45-67',
  'ноль пять пять пять 12 34 56',
  '055five123456',
  'zero seven zero zero 123 456',
  'звоните: 0(555)123-456',
  '@parts.kg',
  'whatsapp: +996 555 12 34 56',
  'tg: autoparts_kg',
  'тгк autoparts',
  'пиши в телеграмме',
  'Т Е Л Е Г А',
  'v.a.t.s.a.p',
  'в-а-т-с-а-п',
  'сайт: autoparts kg ком',
  'ok.ru/profile/1',
  'фб найди меня',
  'mail.ru ivan',
  'Gmail: ivan.parts',
  'my email is ivan dot parts at gmail dot com',
  'позвони на ноль семьсот 12 34 56',
];

/** Нормальные сообщения — не должны блокироваться */
const MUST_PASS: string[] = [
  'Здравствуйте, есть передний бампер на Camry 40?',
  'Цена 15 000 сом, доставка 7-10 дней',
  'Стоимость 1 500 000 сом',
  'OEM 04465-33450, оригинал Toyota',
  'Артикул 04465-33450 и 04465-33471',
  'артикул: 0986494525',
  'OEM: 90915-YZZD3',
  'кросс номер 1K0615301AA',
  'VIN JTDBR32E720123456',
  'Мой VIN: WVWZZZ1KZ6W123456',
  'Подходит на 2008, 2009, 2010 года',
  'Года выпуска 2010-2015',
  'Лампа 55 ватт, H4',
  'Сапог ШРУСа порван, вот сапог на фото',
  'Деталь б/у, состояние 4 из 5',
  'Гарантия 14 дней, т.е. две недели',
  'Двигатель 2.4 л, 2AZ-FE',
  'Mercedes A 204 820 01 59',
  'Отправим в течение 3 дней, т.к. товар на складе в Урумчи',
  'Есть две штуки, одна новая, одна б/у',
  'Это инструмент для снятия ступицы',
  'Через телеграф раньше отправляли, сейчас только через платформу',
  'Привезём из Гуанчжоу, вес 12 кг',
  'Размер 205/55 R16',
  'Пробег 120 000 км',
  'Делаем по номеру кузова GX110-6012345',
  'Да, оригинал. Можете оплатить через платформу',
  'Ок, спасибо',
  'Инстанция по спорам — служба поддержки',
  'Есть ли в наличии фара левая? И правая тоже нужна.',

  'Отправка из Иу через 5 дней',
  'Цена 12 500 сом за комплект',
  'Фара на Lexus RX 2016 года',
  'Номер детали 81150-48B70',
  'Каталожный номер 4F0 941 003 BH',
  'Пыльник рулевой рейки, 2 шт',
  'Масса 3,5 кг, габариты 40х30х20',
  'Сборка 2019 года, пробег 85 тыс',
  'Двигатель 1ZZ-FE 1.8',
  'Скидка 10% при заказе от 3 шт',
  'Перезвонить не могу, пишите здесь',
  'Без проблем, оформляйте заказ',
  'Тормозные колодки Brembo P83 076',
  'Свечи NGK 6458 комплект 4 шт',
  'Аккумулятор 75 Ач 680 А',
  'Ремень ГРМ 13568-09130',
  'Фильтр масляный 15208-65F0C',
  'Привод левый, ABS есть',
  'Инструкция по установке в комплекте',
  'Телевизор не продаём :)',
  'Сигнал звуковой Bosch 12V',
  'В Урумчи склад работает с 9 до 18',
  'Курс 1 юань = 12.3 сома',
  'Оплата через платформу, эскроу',
  'Деталь 2 из 3 уже приехала',
];

describe('contact filter', () => {
  it('blocks ≥ 95% of contact attempts', () => {
    const missed = MUST_BLOCK.filter((t) => !detectContacts(t).blocked);
    const rate = (MUST_BLOCK.length - missed.length) / MUST_BLOCK.length;
    if (missed.length) console.log('Missed:', missed);
    console.log(`Detection rate: ${(rate * 100).toFixed(1)}% (${MUST_BLOCK.length} cases)`);
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  it('does not block normal auto-parts messages', () => {
    const falsePositives = MUST_PASS.filter((t) => detectContacts(t).blocked).map((t) => [
      t,
      detectContacts(t).kinds,
    ]);
    if (falsePositives.length) console.log('False positives:', falsePositives);
    expect(falsePositives).toEqual([]);
  });

  it('returns kinds and masks the contact', () => {
    const r = detectContacts('пиши на ivan@gmail.com или в ватсап');
    expect(r.kinds).toEqual(expect.arrayContaining(['EMAIL', 'MESSENGER']));
    expect(r.masked).not.toContain('ivan@gmail.com');
  });

  it('converts number words to digits', () => {
    expect(wordsToDigits('ноль пятьсот пятьдесят пять').replace(/\s/g, '')).toBe('0555');
    expect(wordsToDigits('двенадцать тридцать четыре').replace(/\s/g, '')).toBe('1234');
  });

  it('folds spelling variants together', () => {
    expect(fold('WhatsApp')).toBe(fold('ватсап'));
    expect(fold('вацап')).toBe(fold('вотсап'));
  });
});
