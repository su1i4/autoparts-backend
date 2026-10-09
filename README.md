# AutoParts Marketplace — Backend

Маркетплейс запчастей «под заказ по VIN» (КР и СНГ): клиент публикует запрос (VIN + фото), продавцы присылают предложения цены, клиент выбирает, платит через платформу (эскроу), доставку из Китая организует платформа.

**Стек:** NestJS 11 · TypeScript · PostgreSQL 16 · TypeORM 0.3 (миграции) · Swagger · Socket.IO · Jest

---

## Быстрый старт

```bash
cp .env.example .env          # при необходимости поправьте DB_*
npm install
npm run migration:run         # схема БД
npm run seed                  # админ, категории, марки, склады, тарифы, комиссия 10%
npm run start:dev
```

- API: `http://localhost:3000/api`
- **Swagger:** `http://localhost:3000/api/docs`
- WebSocket: `ws://localhost:3000/chat` (socket.io)

**Вход:** `POST /api/auth/otp/request { phone }` → в dev-режиме код приходит в ответе (`devCode`) и в логе → `POST /api/auth/otp/verify { phone, code }` → `accessToken` вставить в Swagger «Authorize».
Админ из сида: телефон `ADMIN_PHONE` (по умолчанию `+996700000000`).

### Docker

```bash
cp .env.example .env   # смените все change-me секреты (в production проверяется на старте)
docker compose up -d --build
docker compose exec api npm run seed:prod
```

### Скрипты

| Команда | Что делает |
|---|---|
| `npm run start:dev` | dev-сервер с hot reload |
| `npm run migration:generate --name=AddX` | сгенерировать миграцию по изменениям сущностей |
| `npm run migration:run` / `migration:revert` | применить / откатить |
| `npm run seed` | начальные данные (идемпотентно) |
| `npm test` | юнит-тесты (фильтр контактов, комиссии, проводки, доставка, статусы) |
| `npm run test:e2e` | полный сценарий на живой БД `autoparts_e2e` (создайте её заранее, пересоздаётся при прогоне) |

---

## Структура

```
src/
  common/            enums (все статусы — одно место для синхронизации с фронтом), guards, decorators, utils
  config/            валидация .env (Joi)
  database/          data-source, миграции, сиды
  modules/
    auth/            OTP по телефону, JWT access + refresh с ротацией
    users/           профиль, устройства (push-токены)
    moderation/      блокировки (сроки, обжалование), чёрный список телефонов/устройств, жалобы
    reference/       категории (ru/ky/en), марки/модели, курсы валют
    files/           загрузка фото (сжатие в webp 1600px) и PDF
    sellers/         заявка продавца, документы, верификация, магазины, статистика
    vehicles/        гараж, расшифровка VIN (локальная WMI-таблица + NHTSA), номер кузова для JDM
    catalog/         товары, OEM + кросс-номера, применимость, импорт Excel/CSV, история цен
    requests/        запросы клиентов и офферы продавцов, лента продавца
    chat/            чаты + фильтр контактов + WebSocket
    commissions/     правила комиссии с версионированием
    payments/        платежи, эскроу, журнал проводок (double-entry), выплаты, сверка
    orders/          заказы, машина состояний, оплата, автозавершение
    logistics/       склады, тарифы, калькулятор, отправки, консолидация, трекинг
    disputes/        споры и возвраты
    reviews/         отзывы (только по завершённым заказам) и рейтинг
    notifications/   in-app + push/Telegram/SMS/email, шаблоны ru/ky/en
    admin/           пользователи, роли, настройки, статистика, аудит-лог
    settings/        настройки без деплоя (пороги нарушений, сроки, мин. выплата)
    audit/           аудит-лог действий персонала
```

Роли: `CLIENT`, `SELLER`, `ADMIN`, `LOGISTICS` (склад), `SUPPORT` (споры, чаты, блокировки). `ADMIN` проходит любую проверку ролей.

---

## Основной сценарий через API

| Шаг | Кто | Эндпоинт |
|---|---|---|
| Вход | все | `POST /auth/otp/request` → `POST /auth/otp/verify` |
| Авто в гараж | клиент | `POST /vin/decode`, `POST /garage` |
| Фото | все | `POST /files/upload` → `url` |
| Запрос | клиент | `POST /requests { vehicleId, title, photos[], categoryId }` |
| Лента | продавец | `GET /requests/feed?matchesOnly=true` |
| Оффер | продавец | `POST /requests/:id/offers` |
| Сравнение | клиент | `GET /requests/:id/offers?sort=price\|delivery\|rating` |
| Чат | оба | `POST /chats`, `POST /chats/:id/messages` или WS `chat:send` |
| Расчёт | клиент | `POST /orders/quote` (товар + доставка = итого) |
| Заказ | клиент | `POST /orders { offerId, deliveryMethod, pickupPointId \| address, shippingMethod }` |
| Оплата | клиент | `POST /orders/:id/pay` → (dev) `POST /payments/:paymentId/mock-confirm` |
| Отправка | продавец | `POST /seller/orders/:id/confirm`, `/ship` |
| Склад | логистика | `POST /logistics/shipments/:id/receive`, `/consolidations`, `/status` |
| Трекинг | все | `GET /orders/:id/tracking`, публично `GET /tracking/:number` |
| Получение | клиент | `POST /orders/:id/confirm-receipt` → выплата продавцу |
| Отзыв | клиент | `POST /orders/:id/review` |
| Вывод | продавец | `PATCH /sellers/me { payoutDetails }`, `POST /seller/payouts` |

Каталог без запроса: `GET /catalog/parts?oem=&vehicleId=` → `POST /orders/from-part`.

---

## Ключевые решения

### Деньги: эскроу + журнал проводок
- Все суммы заказа в **KGS**; цена оффера может быть в USD/CNY/RUB — курс **фиксируется в заказе**.
- Комиссия удерживается из товарной части: `sellerPayoutAmount = goodsAmount − commission`.
- Каждая операция — проводка с суммой 0 по счетам `EXTERNAL`, `ESCROW`, `SELLER:<id>:AVAILABLE`, `SELLER:<id>:PAYOUT_PENDING`, `PLATFORM:COMMISSION`, `PLATFORM:LOGISTICS`.
- Частичный возврат уменьшает сначала товарную часть, комиссия пересчитывается пропорционально.
- `GET /admin/ledger/reconcile` — сверка: сумма по всем счетам = 0, нет несбалансированных проводок, кэш-балансы продавцов совпадают с журналом.
- Заказ блокируется `SELECT … FOR UPDATE` — двойное подтверждение оплаты и гонка выбора оффера покрыты e2e-тестом.

### Фильтр контактов в чате
`src/modules/chat/contact-filter.ts` — чистая функция. Ловит телефоны (КР/РФ/КЗ/КНР/УЗ, с разделителями, словами на RU/KG/EN, эмодзи-цифрами, буквами вместо цифр), email (вкл. «собака/точка»), ссылки и домены, `@username`, мессенджеры (латиница/кириллица/транслит/смешанные алфавиты/«w h a t s a p p»).
Не трогает OEM (`04465-33450`, номера после «OEM/артикул»), VIN, цены, годы.
**Тесты: 99,3% блокировки на 136 кейсах, 0 ложных срабатываний на 55 обычных сообщениях** (на отложенной выборке до доработок — 95,9%).
Нарушение → сообщение не доставляется, счётчик +1 → предупреждение → ограничение чата → автоблок (пороги — `PATCH /admin/settings`). Оригинал видит только модератор.
Известное ограничение: 10-значный артикул без префикса, похожий на номер КР (например Bosch `0986…`), будет заблокирован. Пишите `артикул 0986…`.

### Приватность
Продавцу в заказе виден только город клиента; адрес и телефон получателя — клиенту, логистике и админу (п.5.7 ТЗ). Публичный трекинг — без персональных данных.

### WebSocket (`/chat`)
```js
const s = io(`${API}/chat`, { auth: { token: accessToken } });
s.emit('chat:join', { chatId });
s.on('message:new', ({ chatId, message }) => …);
s.on('notification:new', (n) => …);
s.on('offer:new', ({ requestId, offerId }) => …);
s.on('order:status', ({ orderId, status }) => …);
s.emitWithAck('chat:send', { chatId, text }); // { ok, message } | { ok:false, error }
```

### Кроны
Истечение запросов (10 мин), отмена неоплаченных заказов (`orders.paymentTimeoutHours`), автозавершение через `orders.autoCompleteDays` после доставки → выплата продавцу.

---

## Что заглушено и требует подключения

| Что | Сейчас | Что сделать |
|---|---|---|
| Платёжные провайдеры (MBank, O!Деньги, Элкарт, Optima, QR) | `mock` (dev) и `manual` (админ подтверждает поступление) | реализовать `PaymentProvider` в `payments/payment-providers.ts` после договоров |
| SMS для OTP | лог | реализовать `OtpSender` (Nikita.kg / SMSPRO / Telegram Gateway) |
| Push FCM/APNs, SMS, email | лог | `notifications/channels.ts` (firebase-admin, SMTP) |
| Telegram-бот | работает при `TELEGRAM_BOT_TOKEN` | нужна привязка `telegramChatId` (бот с /start) |
| Хранилище файлов | локальный диск `/uploads` | `S3StorageService` в `files/storage.service.ts` + CDN |
| VIN-декодер | WMI-таблица + NHTSA (слаб для JDM/Китая) | платный декодер / каталог уровня TecDoc |
| Курсы валют и тарифы доставки в сиде | **ориентировочные** | задать актуальные в админке |
| Адреса складов/ПВЗ | «уточнить» | `PATCH /admin/logistics/warehouses/:id` |
| Очереди (Redis/BullMQ), Meilisearch | не используются | рассылка уведомлений и поиск пока синхронно через Postgres (pg_trgm + GIN) |
| OCR фото в чате, Google/Apple вход, таможенные документы, фискализация | — | фаза 2 по ТЗ |

## Покрытие ТЗ (MVP + часть фазы 2)

- ✅ Регистрация по OTP, роли, блокировки с обжалованием, чёрный список
- ✅ Гараж, VIN-декодирование, ручной ввод, номер кузова
- ✅ Запросы с фото (до 10), офферы (до 5 фото), изменение/отзыв до выбора, сравнение и сортировка
- ✅ Каталог: поиск по OEM с кросс-номерами, названию, категории, совместимости; импорт Excel/CSV; быстрый заказ
- ✅ Чат с фильтром контактов, счётчиком нарушений и жалобами; WebSocket
- ✅ Заказ, эскроу, комиссия по правилам, мультивалюта с фиксацией курса
- ✅ Логистика: калькулятор (объёмный вес), склады, приёмка, консолидация, массовая загрузка треков, все статусы из п.7
- ✅ Баланс продавца, выплаты, споры (полный/частичный возврат/выплата), возвраты, отзывы и рейтинг
- ✅ Админка: пользователи, продавцы, запросы, офферы, заказы (ручная смена статуса, лог), платежи и сверка, споры, комиссия с историей, логистика, справочники, шаблоны уведомлений, настройки, аналитика, аудит-лог
- ✅ Уведомления по ключевым событиям (in-app + каналы), i18n ru/ky/en в справочниках и шаблонах
- ⏳ Соцсеть, продвижение, OCR, API для продавцов — фаза 3
