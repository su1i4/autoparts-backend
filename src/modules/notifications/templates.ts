import { Language } from '../../common/enums';

type T = { title: string; body: string };
type Templates = Record<string, { channels: string[]; ru: T; ky: T; en: T }>;

/** Шаблоны по умолчанию (переопределяются в админке через notification_templates) */
export const DEFAULT_TEMPLATES: Templates = {
  REQUEST_NEW: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Новый запрос: {{title}}', body: '{{car}}. Отправьте предложение цены.' },
    ky: { title: 'Жаңы суроо: {{title}}', body: '{{car}}. Баа сунуштаңыз.' },
    en: { title: 'New request: {{title}}', body: '{{car}}. Send your offer.' },
  },
  OFFER_NEW: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Новое предложение', body: '«{{title}}» — {{price}} сом' },
    ky: { title: 'Жаңы сунуш', body: '«{{title}}» — {{price}} сом' },
    en: { title: 'New offer', body: '"{{title}}" — {{price}} KGS' },
  },
  ORDER_STATUS: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Заказ {{number}}', body: '{{status}}' },
    ky: { title: 'Буйрутма {{number}}', body: '{{status}}' },
    en: { title: 'Order {{number}}', body: '{{status}}' },
  },
  ORDER_PAID_SELLER: {
    channels: ['PUSH', 'TELEGRAM', 'SMS'],
    ru: {
      title: 'Новый оплаченный заказ {{number}}',
      body: '«{{title}}». Подтвердите и передайте в доставку.',
    },
    ky: {
      title: 'Жаңы төлөнгөн буйрутма {{number}}',
      body: '«{{title}}». Ырастап, жеткирүүгө өткөрүңүз.',
    },
    en: {
      title: 'New paid order {{number}}',
      body: '"{{title}}". Confirm and hand over for shipping.',
    },
  },
  SHIPMENT_STATUS: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Доставка заказа {{number}}', body: '{{status}}' },
    ky: { title: '{{number}} буйрутманы жеткирүү', body: '{{status}}' },
    en: { title: 'Order {{number}} delivery', body: '{{status}}' },
  },
  CHAT_MESSAGE: {
    channels: ['PUSH'],
    ru: { title: 'Новое сообщение', body: '{{preview}}' },
    ky: { title: 'Жаңы билдирүү', body: '{{preview}}' },
    en: { title: 'New message', body: '{{preview}}' },
  },
  CHAT_VIOLATION: {
    channels: ['PUSH'],
    ru: {
      title: 'Предупреждение',
      body: 'Передача контактов запрещена правилами сервиса. Нарушений: {{violations}}.',
    },
    ky: {
      title: 'Эскертүү',
      body: 'Байланыш маалыматын берүүгө тыюу салынат. Бузуулар: {{violations}}.',
    },
    en: { title: 'Warning', body: 'Sharing contacts is prohibited. Violations: {{violations}}.' },
  },
  SELLER_VERIFIED: {
    channels: ['PUSH', 'TELEGRAM', 'SMS'],
    ru: { title: 'Верификация продавца', body: '{{status}}' },
    ky: { title: 'Сатуучуну текшерүү', body: '{{status}}' },
    en: { title: 'Seller verification', body: '{{status}}' },
  },
  PAYOUT_PROCESSED: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Выплата {{amount}} сом', body: '{{status}}' },
    ky: { title: 'Төлөм {{amount}} сом', body: '{{status}}' },
    en: { title: 'Payout {{amount}} KGS', body: '{{status}}' },
  },
  DISPUTE_OPENED: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: {
      title: 'Открыт спор по заказу',
      body: 'Поддержка рассмотрит обращение. Добавьте доказательства в споре.',
    },
    ky: { title: 'Буйрутма боюнча талаш ачылды', body: 'Колдоо кызматы карап чыгат.' },
    en: { title: 'Dispute opened', body: 'Support will review it. Add evidence to the dispute.' },
  },
  DISPUTE_RESOLVED: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Спор решён', body: '{{resolution}}' },
    ky: { title: 'Талаш чечилди', body: '{{resolution}}' },
    en: { title: 'Dispute resolved', body: '{{resolution}}' },
  },
  RETURN_DECIDED: {
    channels: ['PUSH', 'TELEGRAM'],
    ru: { title: 'Возврат', body: '{{status}}' },
    ky: { title: 'Кайтаруу', body: '{{status}}' },
    en: { title: 'Return', body: '{{status}}' },
  },
  REVIEW_NEW: {
    channels: ['PUSH'],
    ru: { title: 'Новый отзыв', body: 'Оценка: {{rating}} ★' },
    ky: { title: 'Жаңы пикир', body: 'Баа: {{rating}} ★' },
    en: { title: 'New review', body: 'Rating: {{rating}} ★' },
  },
  USER_BLOCKED: {
    channels: ['SMS'],
    ru: {
      title: 'Аккаунт заблокирован',
      body: 'Причина: {{reason}}. Вы можете обжаловать блокировку в приложении.',
    },
    ky: { title: 'Аккаунт бөгөттөлдү', body: 'Себеби: {{reason}}.' },
    en: { title: 'Account blocked', body: 'Reason: {{reason}}. You can appeal in the app.' },
  },
};

export const ORDER_STATUS_LABELS: Record<string, Record<Language, string>> = {
  PENDING_PAYMENT: { ru: 'Ожидает оплаты', ky: 'Төлөм күтүлүүдө', en: 'Awaiting payment' },
  PAID: { ru: 'Оплачен', ky: 'Төлөндү', en: 'Paid' },
  CONFIRMED: { ru: 'Подтверждён продавцом', ky: 'Сатуучу ырастады', en: 'Confirmed by seller' },
  SHIPPED: { ru: 'Отправлен', ky: 'Жөнөтүлдү', en: 'Shipped' },
  IN_TRANSIT: { ru: 'В пути', ky: 'Жолдо', en: 'In transit' },
  DELIVERED: { ru: 'Доставлен', ky: 'Жеткирилди', en: 'Delivered' },
  COMPLETED: { ru: 'Завершён', ky: 'Аяктады', en: 'Completed' },
  CANCELLED: { ru: 'Отменён', ky: 'Жокко чыгарылды', en: 'Cancelled' },
  DISPUTE: { ru: 'Открыт спор', ky: 'Талаш ачылды', en: 'In dispute' },
  RETURN: { ru: 'Оформлен возврат', ky: 'Кайтаруу', en: 'Return requested' },
  REFUNDED: { ru: 'Деньги возвращены', ky: 'Акча кайтарылды', en: 'Refunded' },
};

export const SHIPMENT_STATUS_LABELS: Record<string, Record<Language, string>> = {
  HANDED_BY_SELLER: {
    ru: 'Передано продавцом',
    ky: 'Сатуучу өткөрдү',
    en: 'Handed over by seller',
  },
  AT_ORIGIN_WAREHOUSE: {
    ru: 'На складе в Китае',
    ky: 'Кытайдагы складда',
    en: 'At warehouse in China',
  },
  IN_TRANSIT: { ru: 'В пути', ky: 'Жолдо', en: 'In transit' },
  AT_CUSTOMS: { ru: 'На таможне', ky: 'Бажыда', en: 'At customs' },
  AT_DESTINATION_WAREHOUSE: {
    ru: 'На складе в Бишкеке',
    ky: 'Бишкектеги складда',
    en: 'At Bishkek warehouse',
  },
  HANDED_TO_COURIER: { ru: 'Передано курьеру', ky: 'Курьерге берилди', en: 'Out for delivery' },
  DELIVERED: { ru: 'Доставлено', ky: 'Жеткирилди', en: 'Delivered' },
};

export function render(tpl: string, vars: Record<string, unknown>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] === undefined || vars[k] === null ? '' : String(vars[k]),
  );
}
