/**
 * E2E: основной сценарий ТЗ от регистрации до выплаты продавцу + споры, возвраты, блокировки.
 * Нужна PostgreSQL. База DB_NAME_E2E (по умолчанию autoparts_e2e) пересоздаётся перед прогоном.
 *   npm run test:e2e
 */
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_E2E ?? 'autoparts_e2e';
process.env.OTP_DEV_MODE = 'true';
process.env.VIN_DECODER_EXTERNAL = 'false';
process.env.PAYMENT_PROVIDER = 'mock';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import { io } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { runSeed } from '../src/database/seeds/seed';
import { configureApp } from '../src/main';

let app: NestExpressApplication;
let http: ReturnType<typeof request>;

const T: Record<string, string> = {}; // токены
const ids: Record<string, string> = {};

const login = async (phone: string) => {
  const r1 = await request(app.getHttpServer())
    .post('/api/auth/otp/request')
    .send({ phone })
    .expect(200);
  const r2 = await request(app.getHttpServer())
    .post('/api/auth/otp/verify')
    .send({ phone, code: r1.body.devCode })
    .expect(200);
  return r2.body as { accessToken: string; refreshToken: string; user: { id: string } };
};

const as = (who: string) => ({
  get: (url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${T[who]}`),
  post: (url: string) =>
    request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${T[who]}`),
  patch: (url: string) =>
    request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${T[who]}`),
});

const pngBuffer = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .png()
    .toBuffer();

const reconcileOk = async () => {
  const r = await as('admin').get('/api/admin/ledger/reconcile').expect(200);
  if (!r.body.ok) console.log(JSON.stringify(r.body, null, 2));
  expect(r.body.ok).toBe(true);
  return r.body;
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app);
  const ds = app.get(DataSource);
  await ds.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ds.runMigrations();
  await runSeed(ds, false);
  await app.listen(0);
  http = request(app.getHttpServer());
  void http;
});

afterAll(async () => {
  await app?.close();
});

describe('Маркетплейс запчастей — основной сценарий', () => {
  it('регистрация и вход по OTP, refresh-ротация', async () => {
    const admin = await login('+996700000000');
    T.admin = admin.accessToken;
    const client = await login('0555 000 001');
    T.client = client.accessToken;
    ids.client = client.user.id;
    T.seller = (await login('+996555000002')).accessToken;
    T.sellerCn = (await login('+996555000003')).accessToken;
    const lg = await login('+996555000004');
    T.logistics = lg.accessToken;
    ids.logisticsUser = lg.user.id;

    const r = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: client.refreshToken })
      .expect(200);
    expect(r.body.accessToken).toBeDefined();
    // повторное использование старого refresh-токена — отказ
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: client.refreshToken })
      .expect(401);
    T.client = r.body.accessToken;

    await as('admin')
      .patch(`/api/admin/users/${ids.logisticsUser}/roles`)
      .send({ roles: ['LOGISTICS'] })
      .expect(200);
    await as('client').get('/api/admin/stats').expect(403);
  });

  it('загрузка фото и гараж с VIN', async () => {
    const up = await as('client')
      .post('/api/files/upload')
      .attach('file', await pngBuffer(), 'part.png')
      .expect(201);
    expect(up.body.mimeType).toBe('image/webp');
    ids.photo = up.body.url;

    const vin = await as('client')
      .post('/api/vin/decode')
      .send({ vin: 'JTNBE46K073012345' })
      .expect(201);
    expect(vin.body.make).toBe('Toyota');
    expect(vin.body.year).toBe(2007);

    // модель VIN локально не определяется → без ручного ввода — ошибка
    const bad = await as('client')
      .post('/api/garage')
      .send({ vin: 'JTNBE46K073012345' })
      .expect(400);
    expect(bad.body.code).toBe('VIN_NOT_RECOGNIZED');
    const car = await as('client')
      .post('/api/garage')
      .send({ vin: 'JTNBE46K073012345', model: 'Camry' })
      .expect(201);
    expect(car.body).toMatchObject({ make: 'Toyota', model: 'Camry', year: 2007 });
    ids.vehicle = car.body.id;
  });

  it('продавцы: заявка, верификация админом, каталог', async () => {
    const doc = await as('seller')
      .post('/api/files/upload')
      .attach('file', await pngBuffer(), 'doc.png')
      .expect(201);
    const cats = await request(app.getHttpServer()).get('/api/reference/categories').expect(200);
    ids.brakes = cats.body.find((c: { slug: string }) => c.slug === 'brakes').id;

    const s1 = await as('seller')
      .post('/api/sellers/apply')
      .send({
        type: 'SHOP',
        displayName: 'АвтоМир',
        documents: [{ type: 'PATENT', url: doc.body.url }],
        store: { name: 'АвтоМир Дордой', country: 'KG', city: 'Бишкек' },
      })
      .expect(201);
    ids.seller = s1.body.id;
    ids.store = s1.body.stores[0].id;

    const doc2 = await as('sellerCn')
      .post('/api/files/upload')
      .attach('file', await pngBuffer(), 'doc.png')
      .expect(201);
    const s2 = await as('sellerCn')
      .post('/api/sellers/apply')
      .send({
        type: 'SCRAPYARD',
        displayName: 'Guangzhou Parts',
        documents: [{ type: 'OTHER', url: doc2.body.url }],
        store: { name: 'GZ Parts', country: 'CN', city: 'Гуанчжоу' },
      })
      .expect(201);
    ids.sellerCn = s2.body.id;
    ids.storeCn = s2.body.stores[0].id;

    // до верификации товары добавлять нельзя
    await as('seller')
      .post('/api/seller/parts')
      .send({ storeId: ids.store, name: 'x', price: 1 })
      .expect(403);

    for (const id of [ids.seller, ids.sellerCn]) {
      await as('admin')
        .patch(`/api/admin/sellers/${id}/verification`)
        .send({ status: 'VERIFIED' })
        .expect(200);
    }

    const part = await as('seller')
      .post('/api/seller/parts')
      .send({
        storeId: ids.store,
        name: 'Колодки тормозные передние',
        categoryId: ids.brakes,
        oemNumbers: ['04465-33450'],
        brand: 'Toyota',
        price: 3500,
        stock: 5,
        weightKg: 1.5,
        compatibility: [{ make: 'Toyota', model: 'Camry', yearFrom: 2006, yearTo: 2011 }],
      })
      .expect(201);
    ids.part = part.body.id;

    const byOem = await request(app.getHttpServer())
      .get('/api/catalog/parts')
      .query({ oem: '0446533450' })
      .expect(200);
    expect(byOem.body.total).toBe(1);
    const byCar = await as('client')
      .get('/api/catalog/parts/for-my-car')
      .query({ vehicleId: ids.vehicle })
      .expect(200);
    expect(byCar.body.items.map((p: { id: string }) => p.id)).toContain(ids.part);
    const wrongYear = await request(app.getHttpServer())
      .get('/api/catalog/parts')
      .query({ make: 'Toyota', model: 'Camry', year: 2015 })
      .expect(200);
    expect(wrongYear.body.total).toBe(0);
  });

  it('запрос с фото → лента продавца → офферы', async () => {
    const r = await as('client')
      .post('/api/requests')
      .send({
        vehicleId: ids.vehicle,
        title: 'Передние тормозные колодки',
        categoryId: ids.brakes,
        photos: [ids.photo],
      })
      .expect(201);
    expect(r.body.status).toBe('PUBLISHED');
    ids.request = r.body.id;

    // чужое фото подставить нельзя
    await as('seller')
      .post('/api/requests')
      .send({ make: 'Toyota', title: 'x', photos: [ids.photo] })
      .expect(400);

    const feed = await as('seller').get('/api/requests/feed').expect(200);
    const item = feed.body.items.find((i: { id: string }) => i.id === ids.request);
    expect(item.matchesAssortment).toBe(true);
    expect(item.clientId).toBeUndefined();

    const o1 = await as('seller')
      .post(`/api/requests/${ids.request}/offers`)
      .send({
        storeId: ids.store,
        partId: ids.part,
        price: 3500,
        condition: 'NEW',
        deliveryDays: 1,
        warrantyDays: 30,
      })
      .expect(201);
    ids.offerKg = o1.body.id;
    const o2 = await as('sellerCn')
      .post(`/api/requests/${ids.request}/offers`)
      .send({
        storeId: ids.storeCn,
        price: 200,
        currency: 'CNY',
        condition: 'NEW',
        origin: 'ANALOG',
        deliveryDays: 10,
        weightKg: 2,
      })
      .expect(201);
    ids.offerCn = o2.body.id;
    expect(o2.body.priceKgs).toBe(2420);

    // второй активный оффер от того же продавца — нельзя
    await as('seller')
      .post(`/api/requests/${ids.request}/offers`)
      .send({ storeId: ids.store, price: 1, condition: 'NEW', deliveryDays: 1 })
      .expect(400);

    const list = await as('client')
      .get(`/api/requests/${ids.request}/offers?sort=price`)
      .expect(200);
    expect(list.body.map((o: { id: string }) => o.id)).toEqual([ids.offerCn, ids.offerKg]);
    expect(list.body.every((o: { status: string }) => o.status === 'VIEWED')).toBe(true);

    // продавец видит только свой оффер
    const own = await as('seller').get(`/api/requests/${ids.request}/offers`).expect(200);
    expect(own.body).toHaveLength(1);
  });

  it('чат блокирует контакты и считает нарушения', async () => {
    const chat = await as('client')
      .post('/api/chats')
      .send({ requestId: ids.request, sellerId: ids.sellerCn })
      .expect(201);
    ids.chat = chat.body.id;

    const blocked = await as('client')
      .post(`/api/chats/${ids.chat}/messages`)
      .send({ text: 'пиши в ватсап 0555 12 34 56' })
      .expect(400);
    expect(blocked.body.code).toBe('CONTACTS_FORBIDDEN');
    expect(blocked.body.message).toBe('Передача контактов запрещена правилами сервиса');
    expect(blocked.body.violations).toBe(1);

    const ok = await as('sellerCn')
      .post(`/api/chats/${ids.chat}/messages`)
      .send({ text: 'Есть аналог, OEM 04465-33450, отправим за 10 дней' })
      .expect(201);
    expect(ok.body.status).toBe('SENT');

    const msgs = await as('client').get(`/api/chats/${ids.chat}/messages`).expect(200);
    const mine = msgs.body.find((m: { status: string }) => m.status === 'BLOCKED');
    expect(mine.originalText).toBeUndefined(); // оригинал не отдаётся пользователю
    const sellerView = await as('sellerCn').get(`/api/chats/${ids.chat}/messages`).expect(200);
    expect(sellerView.body.some((m: { status: string }) => m.status === 'BLOCKED')).toBe(false);

    // фильтры админских списков (раньше отклонялись валидацией)
    await as('admin').get('/api/admin/chats?type=REQUEST&limit=5').expect(200);
    await as('admin').get(`/api/admin/offers?requestId=${ids.request}`).expect(200);
    await as('admin').get('/api/admin/oem?search=0446').expect(200);
    const admin = await as('admin').get('/api/admin/chats/blocked-messages').expect(200);
    expect(admin.body.items[0].originalText).toContain('0555 12 34 56');
  });

  it('расчёт → заказ → оплата (эскроу) → приватность контактов', async () => {
    const pp = await request(app.getHttpServer())
      .get('/api/logistics/pickup-points?city=Бишкек')
      .expect(200);
    ids.pickup = pp.body[0].id;

    const quote = await as('client')
      .post('/api/orders/quote')
      .send({
        offerId: ids.offerCn,
        deliveryMethod: 'PICKUP_POINT',
        pickupPointId: ids.pickup,
        shippingMethod: 'AIR',
      })
      .expect(200);
    expect(quote.body).toMatchObject({
      goodsAmount: 2420,
      shippingAmount: 1400,
      totalAmount: 3820,
      exchangeRate: 12.1,
    });

    const order = await as('client')
      .post('/api/orders')
      .send({
        offerId: ids.offerCn,
        deliveryMethod: 'PICKUP_POINT',
        pickupPointId: ids.pickup,
        shippingMethod: 'AIR',
      })
      .expect(201);
    ids.order = order.body.id;
    expect(order.body).toMatchObject({
      status: 'PENDING_PAYMENT',
      totalAmount: 3820,
      commissionAmount: 242,
      sellerPayoutAmount: 2178,
    });

    // другой оффер по этому запросу уже не выбрать
    await as('client')
      .post('/api/orders')
      .send({ offerId: ids.offerKg, deliveryMethod: 'PICKUP_POINT', pickupPointId: ids.pickup })
      .expect(400);

    const pay = await as('client')
      .post(`/api/orders/${ids.order}/pay`)
      .send({ method: 'MBANK' })
      .expect(201);
    expect(pay.body.redirectUrl).toContain('/mock-confirm');
    await as('client').post(`/api/payments/${pay.body.payment.id}/mock-confirm`).expect(200);

    const paid = await as('client').get(`/api/orders/${ids.order}`).expect(200);
    expect(paid.body.status).toBe('PAID');

    const offers = await as('client').get(`/api/requests/${ids.request}/offers`).expect(200);
    expect(offers.body.find((o: { id: string }) => o.id === ids.offerKg).status).toBe('REJECTED');

    const bal = await as('sellerCn').get('/api/seller/balance').expect(200);
    expect(bal.body).toMatchObject({ hold: 2178, available: 0 });

    const sellerView = await as('sellerCn').get(`/api/seller/orders/${ids.order}`).expect(200);
    expect(sellerView.body.deliveryAddress).toEqual({ city: 'Бишкек' });
    const logView = await as('logistics').get(`/api/admin/orders/${ids.order}`).expect(403);
    void logView;

    await reconcileOk();
  });

  it('логистика: продавец → склад CN → консолидация → таможня → КР → курьер → доставлено', async () => {
    await as('sellerCn').post(`/api/seller/orders/${ids.order}/confirm`).expect(201);
    await as('sellerCn')
      .post(`/api/seller/orders/${ids.order}/ship`)
      .send({ carrier: 'Cargo GZ' })
      .expect(201);
    expect((await as('client').get(`/api/orders/${ids.order}`)).body.status).toBe('SHIPPED');

    const shipments = await as('logistics').get('/api/logistics/shipments').expect(200);
    const sh = shipments.body.items.find((s: { orderId: string }) => s.orderId === ids.order);
    ids.shipment = sh.id;
    ids.tracking = sh.trackingNumber;

    const whs = await as('logistics')
      .get('/api/logistics/warehouses?type=CONSOLIDATION')
      .expect(200);
    const gz = whs.body.find((w: { city: string }) => w.city === 'Гуанчжоу');
    const bishkek = whs.body.find((w: { country: string }) => w.country === 'KG');

    const recv = await as('logistics')
      .post(`/api/logistics/shipments/${ids.shipment}/receive`)
      .send({ warehouseId: gz.id, weightKg: 2.1, complete: true })
      .expect(201);
    expect(recv.body.status).toBe('AT_ORIGIN_WAREHOUSE');
    expect((await as('client').get(`/api/orders/${ids.order}`)).body.status).toBe('IN_TRANSIT');

    const cons = await as('logistics')
      .post('/api/logistics/consolidations')
      .send({
        shipmentIds: [ids.shipment],
        originWarehouseId: gz.id,
        destinationWarehouseId: bishkek.id,
        method: 'AIR',
      })
      .expect(201);
    for (const status of ['IN_TRANSIT', 'AT_CUSTOMS']) {
      await as('logistics')
        .post(`/api/logistics/consolidations/${cons.body.id}/status`)
        .send({ status })
        .expect(201);
    }
    await as('logistics')
      .post(`/api/logistics/shipments/${ids.shipment}/receive`)
      .send({ warehouseId: bishkek.id })
      .expect(201);
    // назад нельзя
    await as('logistics')
      .post(`/api/logistics/shipments/${ids.shipment}/status`)
      .send({ status: 'IN_TRANSIT' })
      .expect(400);
    await as('logistics')
      .post(`/api/logistics/shipments/${ids.shipment}/status`)
      .send({ status: 'HANDED_TO_COURIER' })
      .expect(201);
    await as('logistics')
      .post(`/api/logistics/shipments/${ids.shipment}/status`)
      .send({ status: 'DELIVERED' })
      .expect(201);

    expect((await as('client').get(`/api/orders/${ids.order}`)).body.status).toBe('DELIVERED');

    const track = await request(app.getHttpServer())
      .get(`/api/tracking/${ids.tracking}`)
      .expect(200);
    expect(track.body.events.map((e: { status: string }) => e.status)).toEqual([
      'PENDING',
      'HANDED_BY_SELLER',
      'AT_ORIGIN_WAREHOUSE',
      'IN_TRANSIT',
      'AT_CUSTOMS',
      'AT_DESTINATION_WAREHOUSE',
      'HANDED_TO_COURIER',
      'DELIVERED',
    ]);
  });

  it('подтверждение получения → выплата продавцу → отзыв → вывод', async () => {
    await as('client').post(`/api/orders/${ids.order}/confirm-receipt`).expect(201);
    const o = await as('client').get(`/api/orders/${ids.order}`).expect(200);
    expect(o.body.status).toBe('COMPLETED');

    let bal = await as('sellerCn').get('/api/seller/balance').expect(200);
    expect(bal.body).toMatchObject({ hold: 0, available: 2178 });

    await as('client')
      .post(`/api/orders/${ids.order}/review`)
      .send({ rating: 5, text: 'Всё отлично' })
      .expect(201);
    await as('client').post(`/api/orders/${ids.order}/review`).send({ rating: 1 }).expect(409);
    const profile = await request(app.getHttpServer())
      .get(`/api/sellers/${ids.sellerCn}`)
      .expect(200);
    expect(profile.body).toMatchObject({ rating: 5, reviewsCount: 1 });

    await as('sellerCn').post('/api/seller/payouts').send({ amount: 1500 }).expect(400); // нет реквизитов
    await as('sellerCn')
      .patch('/api/sellers/me')
      .send({
        payoutDetails: {
          method: 'BANK',
          bankName: 'Optima',
          accountNumber: '1234567890',
          recipientName: 'GZ Parts',
        },
      })
      .expect(200);
    await as('sellerCn').post('/api/seller/payouts').send({ amount: 5000 }).expect(400); // больше баланса
    const payout = await as('sellerCn')
      .post('/api/seller/payouts')
      .send({ amount: 1500 })
      .expect(201);
    await as('admin')
      .post(`/api/admin/payouts/${payout.body.id}/process`)
      .send({ decision: 'PAID', bankReference: 'PP-1' })
      .expect(201);

    bal = await as('sellerCn').get('/api/seller/balance').expect(200);
    expect(bal.body.available).toBe(678);

    const rec = await reconcileOk();
    const acc = Object.fromEntries(
      rec.balances.map((b: { account: string; balance: number }) => [b.account, b.balance]),
    );
    expect(acc['ESCROW']).toBe(0);
    expect(acc['PLATFORM:COMMISSION']).toBe(242);
    expect(acc['PLATFORM:LOGISTICS']).toBe(1400);
  });

  it('заказ из каталога → спор → частичный возврат', async () => {
    const order = await as('client')
      .post('/api/orders/from-part')
      .send({
        partId: ids.part,
        quantity: 2,
        deliveryMethod: 'COURIER',
        address: { city: 'Бишкек', address: 'ул. Киевская 1' },
      })
      .expect(201);
    expect(order.body).toMatchObject({
      goodsAmount: 7000,
      shippingAmount: 250,
      totalAmount: 7250,
      shippingMethod: 'LOCAL',
    });
    const pay = await as('client')
      .post(`/api/orders/${order.body.id}/pay`)
      .send({ method: 'BANK_TRANSFER' })
      .expect(201);
    expect(pay.body.instructions).toContain(order.body.number);
    await as('admin').post(`/api/admin/payments/${pay.body.payment.id}/confirm`).expect(201);

    const part = await request(app.getHttpServer())
      .get(`/api/catalog/parts/${ids.part}`)
      .expect(200);
    expect(part.body.stock).toBe(3);

    const dispute = await as('client')
      .post(`/api/orders/${order.body.id}/dispute`)
      .send({ reason: 'NOT_AS_DESCRIBED', description: 'Пришли не те колодки' })
      .expect(201);
    expect((await as('client').get(`/api/orders/${order.body.id}`)).body.status).toBe('DISPUTE');
    await as('seller')
      .post(`/api/disputes/${dispute.body.id}/evidence`)
      .send({ text: 'Отправили по OEM' })
      .expect(201);
    await as('admin').post(`/api/admin/disputes/${dispute.body.id}/review`).expect(201);
    const res = await as('admin')
      .post(`/api/admin/disputes/${dispute.body.id}/resolve`)
      .send({ resolution: 'REFUND_PARTIAL', refundAmount: 1000, comment: 'Компенсация' })
      .expect(201);
    expect(res.body.status).toBe('RESOLVED');

    const after = await as('client').get(`/api/orders/${order.body.id}`).expect(200);
    expect(after.body).toMatchObject({ status: 'COMPLETED', refundedAmount: 1000 });
    const bal = await as('seller').get('/api/seller/balance').expect(200);
    expect(bal.body.available).toBe(5400); // (7000-1000) − 10%
    await reconcileOk();
  });

  it('отмена оплаченного заказа → полный возврат; отмена неоплаченного → запрос снова открыт', async () => {
    const order = await as('client')
      .post('/api/orders/from-part')
      .send({ partId: ids.part, deliveryMethod: 'PICKUP_POINT', pickupPointId: ids.pickup })
      .expect(201);
    const pay = await as('client')
      .post(`/api/orders/${order.body.id}/pay`)
      .send({ method: 'ELCART' })
      .expect(201);
    await as('client').post(`/api/payments/${pay.body.payment.id}/mock-confirm`).expect(200);
    await as('client')
      .post(`/api/orders/${order.body.id}/cancel`)
      .send({ reason: 'Передумал' })
      .expect(201);
    const c = await as('client').get(`/api/orders/${order.body.id}`).expect(200);
    expect(c.body).toMatchObject({ status: 'CANCELLED', refundedAmount: 3500 });

    // новый запрос → оффер → заказ без оплаты → отмена → запрос снова принимает выбор
    const r = await as('client')
      .post('/api/requests')
      .send({ make: 'Toyota', model: 'Camry', title: 'Фара левая' })
      .expect(201);
    const off = await as('seller')
      .post(`/api/requests/${r.body.id}/offers`)
      .send({ storeId: ids.store, price: 9000, condition: 'USED', deliveryDays: 2 })
      .expect(201);
    const o = await as('client')
      .post('/api/orders')
      .send({ offerId: off.body.id, deliveryMethod: 'PICKUP_POINT', pickupPointId: ids.pickup })
      .expect(201);
    await as('client').post(`/api/orders/${o.body.id}/cancel`).send({}).expect(201);
    const req = await as('client').get(`/api/requests/${r.body.id}`).expect(200);
    expect(req.body.status).toBe('HAS_OFFERS');

    await reconcileOk();
  });

  it('админ: блокировка/разблокировка, комиссия с историей, статистика, аудит', async () => {
    await as('admin')
      .post(`/api/admin/users/${ids.client}/block`)
      .send({ reason: 'Тест', hours: 1 })
      .expect(201);
    const denied = await as('client').get('/api/requests/my').expect(403);
    expect(denied.body.code).toBe('USER_BLOCKED');
    await as('client').get('/api/users/me').expect(200);
    await as('client').get('/api/users/me/block').expect(200);
    await as('client').post('/api/users/me/block/appeal').send({ text: 'Ошибка' }).expect(201);
    await as('admin').post(`/api/admin/users/${ids.client}/unblock`).expect(201);
    await as('client').get('/api/requests/my').expect(200);

    const rules = await as('admin').get('/api/admin/commissions').expect(200);
    const global = rules.body.find((r: { scope: string }) => r.scope === 'GLOBAL');
    await as('admin').patch(`/api/admin/commissions/${global.id}`).send({ value: 8 }).expect(200);
    const history = await as('admin').get('/api/admin/commissions?history=true').expect(200);
    expect(history.body.filter((r: { scope: string }) => r.scope === 'GLOBAL')).toHaveLength(2);
    const preview = await as('admin').get('/api/admin/commissions/preview?amount=1000').expect(200);
    expect(preview.body.amount).toBe(80);

    const stats = await as('admin').get('/api/admin/stats').expect(200);
    expect(stats.body.ordersByStatus.COMPLETED).toBe(2);
    expect(stats.body.escrowBalance).toBe(0);

    const audit = await as('admin').get('/api/admin/audit').expect(200);
    const actions = audit.body.items.map((a: { action: string }) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'user.block',
        'user.unblock',
        'commission.update',
        'dispute.resolve',
      ]),
    );
  });

  it('конкурентность: двойное подтверждение оплаты и гонка выбора оффера', async () => {
    const r = await as('client')
      .post('/api/requests')
      .send({ make: 'Toyota', model: 'Camry', title: 'Радиатор' })
      .expect(201);
    const o1 = await as('seller')
      .post(`/api/requests/${r.body.id}/offers`)
      .send({ storeId: ids.store, price: 5000, condition: 'NEW', deliveryDays: 1 })
      .expect(201);
    const o2 = await as('sellerCn')
      .post(`/api/requests/${r.body.id}/offers`)
      .send({
        storeId: ids.storeCn,
        price: 300,
        currency: 'CNY',
        condition: 'NEW',
        deliveryDays: 9,
      })
      .expect(201);

    const body = (offerId: string) => ({
      offerId,
      deliveryMethod: 'PICKUP_POINT',
      pickupPointId: ids.pickup,
    });
    const [a, b] = await Promise.all([
      as('client').post('/api/orders').send(body(o1.body.id)),
      as('client').post('/api/orders').send(body(o2.body.id)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    const order = a.status === 201 ? a.body : b.body;

    const pay = await as('client')
      .post(`/api/orders/${order.id}/pay`)
      .send({ method: 'CARD' })
      .expect(201);
    const results = await Promise.all([
      as('client').post(`/api/payments/${pay.body.payment.id}/mock-confirm`),
      as('client').post(`/api/payments/${pay.body.payment.id}/mock-confirm`),
      as('client').post(`/api/payments/${pay.body.payment.id}/mock-confirm`),
    ]);
    expect(results.filter((x) => x.status === 200)).toHaveLength(1);
    await reconcileOk();
    const rec = await as('admin').get(`/api/admin/ledger?orderId=${order.id}`).expect(200);
    expect(
      rec.body.items.filter((e: { operation: string }) => e.operation === 'HOLD'),
    ).toHaveLength(2); // одна проводка из 2 строк
  });

  it('WebSocket: сообщение в чате приходит в реальном времени', async () => {
    const { port } = app.getHttpServer().address() as { port: number };
    const socket = io(`http://127.0.0.1:${port}/chat`, {
      auth: { token: T.client },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const joined = await socket.emitWithAck('chat:join', { chatId: ids.chat });
    expect(joined.ok).toBe(true);

    const received = new Promise<{ chatId: string; message: { text: string } }>((resolve) =>
      socket.on('message:new', resolve),
    );
    await as('sellerCn')
      .post(`/api/chats/${ids.chat}/messages`)
      .send({ text: 'Посылка уже у вас?' })
      .expect(201);
    const evt = await received;
    expect(evt.message.text).toBe('Посылка уже у вас?');

    // отправка через сокет тоже проходит фильтр
    const ack = await socket.emitWithAck('chat:send', {
      chatId: ids.chat,
      text: 'мой телеграм @ivan',
    });
    expect(ack.ok).toBe(false);
    expect(ack.error.code).toBe('CONTACTS_FORBIDDEN');
    socket.disconnect();
  });

  it('уведомления по ключевым событиям', async () => {
    const n = await as('client').get('/api/notifications?limit=100').expect(200);
    const types = new Set(n.body.items.map((x: { type: string }) => x.type));
    for (const t of [
      'OFFER_NEW',
      'ORDER_STATUS',
      'SHIPMENT_STATUS',
      'CHAT_MESSAGE',
      'CHAT_VIOLATION',
      'DISPUTE_RESOLVED',
    ]) {
      expect(types).toContain(t);
    }
    const s = await as('sellerCn').get('/api/notifications?limit=100').expect(200);
    const sTypes = new Set(s.body.items.map((x: { type: string }) => x.type));
    for (const t of ['SELLER_VERIFIED', 'ORDER_PAID_SELLER', 'REVIEW_NEW', 'PAYOUT_PROCESSED']) {
      expect(sTypes).toContain(t);
    }
    // новый запрос получают продавцы с подходящим ассортиментом (у seller есть колодки на Toyota)
    const k = await as('seller').get('/api/notifications?limit=100').expect(200);
    expect(k.body.items.map((x: { type: string }) => x.type)).toContain('REQUEST_NEW');
  });
});
