/**
 * Начальные данные: админ, категории, марки/модели, комиссия, курсы, склады, тарифы.
 * Идемпотентно — можно запускать повторно.  npm run seed
 *
 * ⚠ Курсы валют и тарифы — ориентировочные плейсхолдеры, перед запуском задать актуальные в админке.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  CommissionScope,
  CommissionType,
  Currency,
  Role,
  ShippingMethod,
  WarehouseType,
} from '../../common/enums';
import { normalizePhone } from '../../common/utils/text';
import { CommissionRule } from '../../modules/commissions/entities/commission-rule.entity';
import { ShippingTariff } from '../../modules/logistics/entities/shipping-tariff.entity';
import { Warehouse } from '../../modules/logistics/entities/warehouse.entity';
import { CarMake } from '../../modules/reference/entities/car-make.entity';
import { CarModel } from '../../modules/reference/entities/car-model.entity';
import { Category } from '../../modules/reference/entities/category.entity';
import { ExchangeRate } from '../../modules/reference/entities/exchange-rate.entity';
import { User } from '../../modules/users/entities/user.entity';
import { buildTypeOrmOptions } from '../typeorm.config';

const CATEGORIES: [string, string, string, string][] = [
  ['engine', 'Двигатель', 'Кыймылдаткыч', 'Engine'],
  ['transmission', 'Трансмиссия и КПП', 'Трансмиссия', 'Transmission'],
  ['suspension', 'Подвеска и рулевое', 'Асма жана руль', 'Suspension & steering'],
  ['brakes', 'Тормозная система', 'Тормоз системасы', 'Brakes'],
  ['body', 'Кузовные детали', 'Кузов бөлүктөрү', 'Body parts'],
  ['optics', 'Оптика и фары', 'Оптика жана фаралар', 'Lights'],
  ['electrical', 'Электрика', 'Электр жабдуулары', 'Electrical'],
  ['cooling', 'Охлаждение и кондиционер', 'Муздатуу', 'Cooling & A/C'],
  ['fuel', 'Топливная система', 'Күйүүчү май системасы', 'Fuel system'],
  ['exhaust', 'Выхлопная система', 'Чыгаруу системасы', 'Exhaust'],
  ['filters', 'Фильтры и ТО', 'Чыпкалар жана ТО', 'Filters & service'],
  ['interior', 'Салон', 'Салон', 'Interior'],
  ['glass', 'Стёкла и зеркала', 'Айнектер жана күзгүлөр', 'Glass & mirrors'],
  ['wheels', 'Диски и шины', 'Дисктер жана дөңгөлөктөр', 'Wheels & tyres'],
  ['other', 'Прочее', 'Башка', 'Other'],
];

const MAKES: Record<string, string[]> = {
  Toyota: [
    'Camry',
    'Corolla',
    'RAV4',
    'Land Cruiser',
    'Land Cruiser Prado',
    'Highlander',
    'Alphard',
    'Estima',
    'Ipsum',
    'Prius',
    'Ist',
    'Vitz',
  ],
  Lexus: ['RX', 'GX', 'LX', 'ES', 'IS', 'NX'],
  Honda: ['Fit', 'CR-V', 'Accord', 'Civic', 'Odyssey', 'Stepwgn', 'Elysion', 'Stream'],
  Nissan: ['X-Trail', 'Qashqai', 'Teana', 'Murano', 'Patrol', 'Tiida', 'Note'],
  Mitsubishi: ['Pajero', 'Outlander', 'Delica', 'Lancer'],
  Mazda: ['CX-5', 'Mazda6', 'Mazda3', 'MPV', 'Demio'],
  Subaru: ['Forester', 'Outback', 'Legacy', 'Impreza'],
  Hyundai: ['Sonata', 'Tucson', 'Santa Fe', 'Elantra', 'Accent', 'Porter', 'Starex'],
  Kia: ['K5', 'Sportage', 'Sorento', 'Rio', 'Carnival', 'Morning'],
  Daewoo: ['Matiz', 'Nexia', 'Gentra', 'Damas', 'Lacetti'],
  Chevrolet: ['Cobalt', 'Spark', 'Malibu', 'Captiva', 'Tracker'],
  'Mercedes-Benz': ['E-Class', 'C-Class', 'S-Class', 'GLE', 'Sprinter', 'Vito'],
  BMW: ['3 Series', '5 Series', 'X5', 'X3', 'X6'],
  Audi: ['A4', 'A6', 'Q5', 'Q7'],
  Volkswagen: ['Passat', 'Golf', 'Tiguan', 'Touareg', 'Polo', 'Jetta'],
  Lada: ['Granta', 'Vesta', 'Niva', 'Priora', '2107'],
  BYD: ['Song Plus', 'Han', 'Qin Plus', 'Seal', 'Tang', 'Yuan Plus'],
  Chery: ['Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 8'],
  Geely: ['Monjaro', 'Coolray', 'Atlas', 'Tugella'],
  Haval: ['Jolion', 'H6', 'Dargo'],
  Changan: ['CS55 Plus', 'CS75 Plus', 'UNI-K', 'UNI-V'],
  Zeekr: ['001', '7X', '009'],
  'Li Auto': ['L7', 'L8', 'L9'],
};

export async function runSeed(ds: DataSource, verbose = true) {
  const log = (s: string) => verbose && console.log(`  ✓ ${s}`);

  // Админ
  const phone = normalizePhone(process.env.ADMIN_PHONE ?? '+996700000000');
  const users = ds.getRepository(User);
  const admin = await users.findOneBy({ phone });
  if (!admin) {
    await users.save(
      users.create({ phone, name: 'Администратор', roles: [Role.CLIENT, Role.ADMIN] }),
    );
  } else if (!admin.roles.includes(Role.ADMIN)) {
    admin.roles = [...admin.roles, Role.ADMIN];
    await users.save(admin);
  }
  log(`админ ${phone} (вход по OTP)`);

  // Категории
  const cats = ds.getRepository(Category);
  for (const [i, [slug, ru, ky, en]] of CATEGORIES.entries()) {
    await cats.upsert({ slug, name: { ru, ky, en }, sort: i * 10 }, ['slug']);
  }
  log(`категории: ${CATEGORIES.length}`);

  // Марки и модели
  const makes = ds.getRepository(CarMake);
  const models = ds.getRepository(CarModel);
  for (const [i, [name, list]] of Object.entries(MAKES).entries()) {
    await makes.upsert({ name, sort: i }, ['name']);
    const make = await makes.findOneByOrFail({ name });
    for (const m of list) await models.upsert({ makeId: make.id, name: m }, ['makeId', 'name']);
  }
  log(`марки: ${Object.keys(MAKES).length}`);

  // Комиссия по умолчанию
  const rules = ds.getRepository(CommissionRule);
  if (!(await rules.findOneBy({ scope: CommissionScope.GLOBAL, isActive: true }))) {
    await rules.save(
      rules.create({
        scope: CommissionScope.GLOBAL,
        type: CommissionType.PERCENT,
        value: 10,
        note: 'Базовая комиссия',
      }),
    );
  }
  log('комиссия GLOBAL 10%');

  // Курсы (плейсхолдеры!)
  const rates = ds.getRepository(ExchangeRate);
  if (!(await rates.count())) {
    await rates.save([
      rates.create({ currency: Currency.USD, rateToKgs: 87.5 }),
      rates.create({ currency: Currency.CNY, rateToKgs: 12.1 }),
      rates.create({ currency: Currency.RUB, rateToKgs: 1.05 }),
    ]);
  }
  log('курсы USD/CNY/RUB (ориентировочные — обновите в админке)');

  // Склады
  const wh = ds.getRepository(Warehouse);
  const warehouses: Partial<Warehouse>[] = [
    {
      name: 'Склад консолидации Урумчи',
      type: WarehouseType.CONSOLIDATION,
      country: 'CN',
      city: 'Урумчи',
      address: 'уточнить',
    },
    {
      name: 'Склад консолидации Гуанчжоу',
      type: WarehouseType.CONSOLIDATION,
      country: 'CN',
      city: 'Гуанчжоу',
      address: 'уточнить',
    },
    {
      name: 'Склад консолидации Иу',
      type: WarehouseType.CONSOLIDATION,
      country: 'CN',
      city: 'Иу',
      address: 'уточнить',
    },
    {
      name: 'Склад Бишкек',
      type: WarehouseType.CONSOLIDATION,
      country: 'KG',
      city: 'Бишкек',
      address: 'уточнить',
    },
    {
      name: 'ПВЗ Бишкек — Центр',
      type: WarehouseType.PICKUP_POINT,
      country: 'KG',
      city: 'Бишкек',
      address: 'уточнить',
    },
    {
      name: 'ПВЗ Бишкек — Восток',
      type: WarehouseType.PICKUP_POINT,
      country: 'KG',
      city: 'Бишкек',
      address: 'уточнить',
    },
    {
      name: 'ПВЗ Ош',
      type: WarehouseType.PICKUP_POINT,
      country: 'KG',
      city: 'Ош',
      address: 'уточнить',
    },
  ];
  for (const w of warehouses)
    if (!(await wh.findOneBy({ name: w.name! }))) await wh.save(wh.create(w));
  log(`склады и ПВЗ: ${warehouses.length}`);

  // Тарифы (плейсхолдеры!)
  const tr = ds.getRepository(ShippingTariff);
  const tariffs: Partial<ShippingTariff>[] = [
    {
      fromCountry: 'CN',
      toCountry: 'KG',
      method: ShippingMethod.AIR,
      pricePerKg: 700,
      minPrice: 700,
      volumetricDivisor: 5000,
      daysMin: 5,
      daysMax: 10,
    },
    {
      fromCountry: 'CN',
      toCountry: 'KG',
      method: ShippingMethod.TRUCK,
      pricePerKg: 250,
      minPrice: 500,
      volumetricDivisor: 6000,
      daysMin: 12,
      daysMax: 20,
    },
    {
      fromCountry: 'CN',
      toCountry: 'KG',
      method: ShippingMethod.RAIL,
      pricePerKg: 180,
      minPrice: 500,
      volumetricDivisor: 6000,
      daysMin: 18,
      daysMax: 30,
    },
    {
      fromCountry: 'KG',
      toCountry: 'KG',
      method: ShippingMethod.LOCAL,
      pricePerKg: 0,
      minPrice: 0,
      volumetricDivisor: 6000,
      daysMin: 0,
      daysMax: 2,
    },
  ];
  for (const t of tariffs) {
    if (
      !(await tr.findOneBy({
        fromCountry: t.fromCountry!,
        toCountry: t.toCountry!,
        method: t.method!,
      }))
    )
      await tr.save(tr.create(t));
  }
  log('тарифы CN→KG (авиа/авто/ж-д) и местная доставка (ориентировочные)');
}

async function main() {
  const ds = new DataSource(buildTypeOrmOptions((k) => process.env[k]));
  await ds.initialize();
  await runSeed(ds);
  await ds.destroy();
  console.log('Seed завершён');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
