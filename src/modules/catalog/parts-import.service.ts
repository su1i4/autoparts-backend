import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { AuthUser } from '../../common/auth-user';
import { Currency, PartCondition, PartOrigin } from '../../common/enums';
import { ReferenceService } from '../reference/reference.service';
import { SellersService } from '../sellers/sellers.service';
import { CatalogService } from './catalog.service';

/**
 * Импорт каталога из Excel/CSV. Первая строка — заголовки (регистр не важен):
 *   name*, price*, currency, oem (через запятую), brand, category (slug), condition (NEW/USED),
 *   origin (ORIGINAL/ANALOG), stock, weight, make, model, yearFrom, yearTo, description
 * Строка с make/model создаёт запись применимости.
 */
export const IMPORT_COLUMNS = [
  'name',
  'price',
  'currency',
  'oem',
  'brand',
  'category',
  'condition',
  'origin',
  'stock',
  'weight',
  'make',
  'model',
  'yearFrom',
  'yearTo',
  'description',
];

@Injectable()
export class PartsImportService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly sellers: SellersService,
    private readonly reference: ReferenceService,
  ) {}

  async import(user: AuthUser, storeId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не передан');
    await this.sellers.assertVerified(user.sellerId);
    await this.sellers.assertStoreOwner(user, storeId);

    const wb = new ExcelJS.Workbook();
    const isCsv = file.originalname.toLowerCase().endsWith('.csv') || file.mimetype.includes('csv');
    if (isCsv) await wb.csv.read(Readable.from(file.buffer));
    else await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Пустой файл');

    const header: Record<number, string> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const key = String(cell.value ?? '')
        .trim()
        .toLowerCase();
      const match = IMPORT_COLUMNS.find((c) => c.toLowerCase() === key);
      if (match) header[col] = match;
    });
    if (!Object.values(header).includes('name') || !Object.values(header).includes('price')) {
      throw new BadRequestException(
        `Нужны колонки name и price. Поддерживаются: ${IMPORT_COLUMNS.join(', ')}`,
      );
    }

    const categories = await this.reference.listCategories(true);
    const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
    const errors: { row: number; error: string }[] = [];
    let imported = 0;

    const rows: { idx: number; data: Record<string, string> }[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const data: Record<string, string> = {};
      row.eachCell((cell, col) => {
        if (header[col])
          data[header[col]] = String(
            (cell.value as { text?: string })?.text ?? cell.value ?? '',
          ).trim();
      });
      if (Object.keys(data).length) rows.push({ idx, data });
    });
    if (rows.length > 5000) throw new BadRequestException('Не более 5000 строк за один импорт');

    for (const { idx, data } of rows) {
      try {
        const price = Number(String(data.price).replace(',', '.').replace(/\s/g, ''));
        if (!data.name) throw new Error('пустое name');
        if (!(price > 0)) throw new Error('некорректная цена');
        const currency = (data.currency?.toUpperCase() || 'KGS') as Currency;
        if (!Object.values(Currency).includes(currency)) throw new Error('неизвестная валюта');
        const condition = (data.condition?.toUpperCase() || 'NEW') as PartCondition;
        if (!Object.values(PartCondition).includes(condition))
          throw new Error('condition: NEW или USED');
        const origin = (data.origin?.toUpperCase() || 'ORIGINAL') as PartOrigin;
        if (!Object.values(PartOrigin).includes(origin))
          throw new Error('origin: ORIGINAL или ANALOG');

        await this.catalog.create(user, {
          storeId,
          name: data.name,
          description: data.description || undefined,
          price,
          currency,
          condition,
          origin,
          brand: data.brand || undefined,
          categoryId: data.category ? bySlug.get(data.category) : undefined,
          oemNumbers: data.oem
            ? data.oem
                .split(/[,;]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          stock: data.stock ? Number(data.stock) : 1,
          weightKg: data.weight ? Number(data.weight.replace(',', '.')) : undefined,
          compatibility: data.make
            ? [
                {
                  make: data.make,
                  model: data.model || undefined,
                  yearFrom: data.yearFrom ? Number(data.yearFrom) : undefined,
                  yearTo: data.yearTo ? Number(data.yearTo) : undefined,
                },
              ]
            : undefined,
        });
        imported++;
      } catch (e) {
        errors.push({ row: idx, error: (e as Error).message });
      }
    }
    return { total: rows.length, imported, failed: errors.length, errors: errors.slice(0, 200) };
  }
}
