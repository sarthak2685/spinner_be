import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { CategoryDto, ItemDto } from './dto/menu.dto';
import { saveUpload } from '../../common/utils/files.util';
import { validateImage } from '../../common/utils/validation.util';

function splitCsv(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parsePricedList(raw?: string) {
  if (!raw || !raw.trim()) return [] as { name: string; price: number }[];
  let rows: unknown = [];
  try { rows = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const entry = row as { name?: string; price?: string | number };
    return { name: String(entry?.name || '').trim().slice(0, 80), price: Number(entry?.price) };
  }).filter((row) => row.name && row.price >= 0 && Number.isFinite(row.price));
}

function parseMoney(text?: string) {
  const value = Number(String(text || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

export type MenuCsvRow = {
  category: string;
  itemName: string;
  price: number;
  halfPrice?: number;
  fullPrice?: number;
  description?: string;
};

export function parseMenuCsv(raw: string) {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [] as MenuCsvRow[];

  const first = splitCsv(lines[0]);
  const hasHeader = /category/i.test(first[0] || '') && /item|name/i.test(first[1] || '');
  const headers = hasHeader ? first.map((cell) => cell.toLowerCase()) : [];
  const col = {
    category: hasHeader ? headers.findIndex((h) => /category/.test(h)) : 0,
    item: hasHeader ? headers.findIndex((h) => /item|name/.test(h)) : 1,
    price: hasHeader ? headers.findIndex((h) => /price/.test(h) && !/half|full/.test(h)) : 2,
    half: hasHeader ? headers.findIndex((h) => /half/.test(h)) : -1,
    full: hasHeader ? headers.findIndex((h) => /full/.test(h)) : -1,
    description: hasHeader ? headers.findIndex((h) => /desc/.test(h)) : 3,
  };

  const rows: MenuCsvRow[] = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = splitCsv(line);
    const category = cells[col.category] || '';
    const itemName = cells[col.item] || '';
    const halfPrice = col.half >= 0 ? parseMoney(cells[col.half]) : 0;
    const fullPrice = col.full >= 0 ? parseMoney(cells[col.full]) : 0;
    let price = col.price >= 0 ? parseMoney(cells[col.price]) : 0;
    if (halfPrice > 0 && fullPrice > 0 && !(price > 0)) price = Math.min(halfPrice, fullPrice);
    const description = col.description >= 0
      ? (cells[col.description] || '').trim() || undefined
      : cells.slice(3).join(', ').trim() || undefined;
    rows.push({
      category,
      itemName,
      price,
      halfPrice: halfPrice > 0 ? halfPrice : undefined,
      fullPrice: fullPrice > 0 ? fullPrice : undefined,
      description,
    });
  }
  return rows;
}

@Injectable()
export class MenuService {
  constructor(private readonly db: DatabaseService) {}

  private ensured = false;
  private async ensureImageColumn() {
    if (this.ensured) return;
    await this.db.query(`ALTER TABLE public."MenuItems" ADD COLUMN IF NOT EXISTS imagepath text`);
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."MenuItemOptions" (optionid SERIAL PRIMARY KEY, itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE CASCADE, optionname VARCHAR(80) NOT NULL, price NUMERIC(10,2) NOT NULL, displayorder INTEGER NOT NULL DEFAULT 0)`);
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."MenuItemAddons" (addonid SERIAL PRIMARY KEY, itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE CASCADE, addonname VARCHAR(80) NOT NULL, price NUMERIC(10,2) NOT NULL, displayorder INTEGER NOT NULL DEFAULT 0)`);
    this.ensured = true;
  }

  private async withExtras<T extends { itemid: number }>(items: T[]) {
    if (!items.length) return items.map((item) => ({ ...item, options: [], addons: [] }));
    const ids = items.map((item) => item.itemid);
    const [options, addons] = await Promise.all([
      this.db.many(`SELECT optionid, itemid, optionname, price, displayorder FROM public."MenuItemOptions" WHERE itemid = ANY($1::int[]) ORDER BY displayorder, optionid`, [ids]),
      this.db.many(`SELECT addonid, itemid, addonname, price, displayorder FROM public."MenuItemAddons" WHERE itemid = ANY($1::int[]) ORDER BY displayorder, addonid`, [ids]),
    ]);
    return items.map((item) => ({
      ...item,
      options: options.filter((row) => row.itemid === item.itemid),
      addons: addons.filter((row) => row.itemid === item.itemid),
    }));
  }

  private async replaceExtras(itemId: number, options: { name: string; price: number }[], addons: { name: string; price: number }[]) {
    await this.db.query(`DELETE FROM public."MenuItemOptions" WHERE itemid=$1`, [itemId]);
    await this.db.query(`DELETE FROM public."MenuItemAddons" WHERE itemid=$1`, [itemId]);
    for (const [index, option] of options.entries()) {
      if (!(option.price > 0)) throw new BadRequestException(`Option "${option.name}" needs a price above zero.`);
      await this.db.query(`INSERT INTO public."MenuItemOptions" (itemid, optionname, price, displayorder) VALUES ($1,$2,$3,$4)`, [itemId, option.name, option.price, index]);
    }
    for (const [index, addon] of addons.entries()) {
      await this.db.query(`INSERT INTO public."MenuItemAddons" (itemid, addonname, price, displayorder) VALUES ($1,$2,$3,$4)`, [itemId, addon.name, addon.price, index]);
    }
  }

  categories(businessId: number) { return this.db.many(`SELECT * FROM public."MenuCategories" WHERE businessid = $1 ORDER BY displayorder, categoryname`, [businessId]); }
  async saveCategory(businessId: number, input: CategoryDto) {
    if (input.id) {
      await this.db.query(`UPDATE public."MenuCategories" SET categoryname=$1, displayorder=$2, isactive=$3, updateddate=CURRENT_TIMESTAMP WHERE categoryid=$4 AND businessid=$5`, [input.categoryName, Number(input.displayOrder || 0), input.isActive !== 'false', Number(input.id), businessId]);
      return { id: Number(input.id) };
    }
    const row = await this.db.one<{ categoryid: number }>(`INSERT INTO public."MenuCategories" (businessid, categoryname, displayorder, isactive) VALUES ($1,$2,$3,$4) RETURNING categoryid`, [businessId, input.categoryName, Number(input.displayOrder || 0), input.isActive !== 'false']);
    return { id: row!.categoryid };
  }
  async removeCategory(businessId: number, id: number) {
    await this.keepOrderHistory();
    await this.db.query(`DELETE FROM public."MenuCategories" WHERE categoryid=$1 AND businessid=$2`, [id, businessId]);
    return { ok: true };
  }
  async items(businessId: number, categoryId?: number) {
    await this.ensureImageColumn();
    const rows = categoryId
      ? await this.db.many<{ itemid: number }>(`SELECT * FROM public."MenuItems" WHERE businessid=$1 AND categoryid=$2 ORDER BY displayorder, itemname`, [businessId, categoryId])
      : await this.db.many<{ itemid: number }>(`SELECT * FROM public."MenuItems" WHERE businessid=$1 ORDER BY displayorder, itemname`, [businessId]);
    return this.withExtras(rows);
  }
  async saveItem(businessId: number, input: ItemDto, file?: Express.Multer.File) {
    await this.ensureImageColumn();
    const options = parsePricedList(input.options);
    const addons = parsePricedList(input.addons);
    const price = options.length ? Math.min(...options.map((option) => option.price)) : Number(input.price);
    if (!(price > 0)) throw new BadRequestException('Price must be greater than zero.');
    const imageError = validateImage(file);
    if (imageError) throw new BadRequestException(imageError);
    const image = file?.size ? await saveUpload(file, 'menu') : null;
    let itemId = Number(input.id || 0);
    if (itemId) {
      const owned = await this.db.one(`SELECT itemid FROM public."MenuItems" WHERE itemid=$1 AND businessid=$2`, [itemId, businessId]);
      if (!owned) throw new BadRequestException('Menu item not found.');
      await this.db.query(
        `UPDATE public."MenuItems" SET categoryid=$1, itemname=$2, description=$3, price=$4, displayorder=$5, isavailable=$6, isactive=$7, imagepath=COALESCE($8, imagepath), updateddate=CURRENT_TIMESTAMP WHERE itemid=$9 AND businessid=$10`,
        [Number(input.categoryId), input.itemName, input.description || null, price, Number(input.displayOrder || 0), input.isAvailable !== 'false', input.isActive !== 'false', image, itemId, businessId],
      );
    } else {
      const row = await this.db.one<{ itemid: number }>(
        `INSERT INTO public."MenuItems" (businessid, categoryid, itemname, description, price, displayorder, isavailable, isactive, imagepath) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING itemid`,
        [businessId, Number(input.categoryId), input.itemName, input.description || null, price, Number(input.displayOrder || 0), input.isAvailable !== 'false', input.isActive !== 'false', image],
      );
      itemId = row!.itemid;
    }
    if (input.options !== undefined || input.addons !== undefined) await this.replaceExtras(itemId, options, addons);
    return { id: itemId };
  }
  async bulkItems(businessId: number, items: { categoryId: string | number; itemName: string; price: string | number; description?: string }[]) {
    await this.ensureImageColumn();
    if (!Array.isArray(items) || !items.length) throw new BadRequestException('Add at least one menu item.');
    let created = 0;
    for (const item of items) {
      const name = String(item.itemName || '').trim();
      const price = Number(item.price);
      const categoryId = Number(item.categoryId);
      if (!name || !(price > 0) || !categoryId) continue;
      await this.db.query(
        `INSERT INTO public."MenuItems" (businessid, categoryid, itemname, description, price, displayorder, isavailable, isactive) VALUES ($1,$2,$3,$4,$5,0,true,true)`,
        [businessId, categoryId, name, item.description || null, price],
      );
      created += 1;
    }
    if (!created) throw new BadRequestException('No valid items to insert. Check name, price, and category.');
    return { created };
  }
  async importFile(businessId: number, file?: Express.Multer.File) {
    await this.ensureImageColumn();
    const name = file?.originalname || '';
    if (!file?.buffer?.length) throw new BadRequestException('Choose a CSV file.');
    if (!/\.(csv|txt)$/i.test(name)) throw new BadRequestException('Upload a CSV file. In Excel, choose Save As and pick CSV.');
    const parsed = parseMenuCsv(file.buffer.toString('utf8'));
    const categories = await this.categories(businessId);
    const byName = new Map(categories.map((category) => [String(category.categoryname).trim().toLowerCase(), Number(category.categoryid)]));
    let created = 0;
    let categoriesCreated = 0;
    let skipped = 0;
    for (const row of parsed) {
      const itemName = row.itemName.trim();
      const categoryName = row.category.trim();
      const halfPrice = Number(row.halfPrice || 0);
      const fullPrice = Number(row.fullPrice || 0);
      const options = halfPrice > 0 && fullPrice > 0
        ? [{ name: 'Half', price: halfPrice }, { name: 'Full', price: fullPrice }]
        : [];
      const price = options.length ? Math.min(halfPrice, fullPrice) : row.price;
      if (!itemName || !categoryName || !(price > 0)) { skipped += 1; continue; }
      let categoryId = byName.get(categoryName.toLowerCase());
      if (!categoryId) {
        const saved = await this.saveCategory(businessId, { categoryName, displayOrder: String(byName.size) });
        categoryId = saved.id;
        byName.set(categoryName.toLowerCase(), categoryId);
        categoriesCreated += 1;
      }
      const inserted = await this.db.one<{ itemid: number }>(
        `INSERT INTO public."MenuItems" (businessid, categoryid, itemname, description, price, displayorder, isavailable, isactive) VALUES ($1,$2,$3,$4,$5,0,true,true) RETURNING itemid`,
        [businessId, categoryId, itemName, row.description || null, price],
      );
      if (options.length && inserted?.itemid) await this.replaceExtras(inserted.itemid, options, []);
      created += 1;
    }
    if (!created) throw new BadRequestException('No valid rows. Use columns: Category, Item, Price, HalfPrice, FullPrice, Description.');
    return { created, categoriesCreated, skipped };
  }
  async removeItem(businessId: number, id: number) {
    await this.keepOrderHistory();
    await this.db.query(`DELETE FROM public."MenuItems" WHERE itemid=$1 AND businessid=$2`, [id, businessId]);
    return { ok: true };
  }

  private historyReady: Promise<void> | null = null;
  private keepOrderHistory() {
    this.historyReady ??= (async () => {
      await this.db.query(`ALTER TABLE public."OrderItems" ALTER COLUMN itemid DROP NOT NULL`);
      await this.db.query(`ALTER TABLE public."OrderItems" DROP CONSTRAINT IF EXISTS "OrderItems_itemid_fkey"`);
      await this.db.query(`ALTER TABLE public."OrderItems" ADD CONSTRAINT "OrderItems_itemid_fkey" FOREIGN KEY (itemid) REFERENCES public."MenuItems"(itemid) ON DELETE SET NULL`);
    })().catch((err) => {
      this.historyReady = null;
      throw err;
    });
    return this.historyReady;
  }
}
