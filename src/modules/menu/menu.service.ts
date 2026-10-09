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

export function parseMenuCsv(raw: string) {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: { category: string; itemName: string; price: number; description?: string }[] = [];
  lines.forEach((line, index) => {
    const [category, itemName, priceText, ...rest] = splitCsv(line);
    if (index === 0 && /category/i.test(category) && /item|name/i.test(itemName || '')) return;
    const price = Number(String(priceText || '').replace(/[^\d.]/g, ''));
    rows.push({ category: category || '', itemName: itemName || '', price, description: rest.join(', ').trim() || undefined });
  });
  return rows;
}

@Injectable()
export class MenuService {
  constructor(private readonly db: DatabaseService) {}

  private ensured = false;
  private async ensureImageColumn() {
    if (this.ensured) return;
    await this.db.query(`ALTER TABLE public."MenuItems" ADD COLUMN IF NOT EXISTS imagepath text`);
    this.ensured = true;
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
  async removeCategory(businessId: number, id: number) { await this.db.query(`DELETE FROM public."MenuCategories" WHERE categoryid=$1 AND businessid=$2`, [id, businessId]); return { ok: true }; }
  async items(businessId: number, categoryId?: number) {
    await this.ensureImageColumn();
    if (categoryId) return this.db.many(`SELECT * FROM public."MenuItems" WHERE businessid=$1 AND categoryid=$2 ORDER BY displayorder, itemname`, [businessId, categoryId]);
    return this.db.many(`SELECT * FROM public."MenuItems" WHERE businessid=$1 ORDER BY displayorder, itemname`, [businessId]);
  }
  async saveItem(businessId: number, input: ItemDto, file?: Express.Multer.File) {
    await this.ensureImageColumn();
    const price = Number(input.price);
    if (!(price > 0)) throw new BadRequestException('Price must be greater than zero.');
    const imageError = validateImage(file);
    if (imageError) throw new BadRequestException(imageError);
    const image = file?.size ? await saveUpload(file, 'menu') : null;
    if (input.id) {
      await this.db.query(
        `UPDATE public."MenuItems" SET categoryid=$1, itemname=$2, description=$3, price=$4, displayorder=$5, isavailable=$6, isactive=$7, imagepath=COALESCE($8, imagepath), updateddate=CURRENT_TIMESTAMP WHERE itemid=$9 AND businessid=$10`,
        [Number(input.categoryId), input.itemName, input.description || null, price, Number(input.displayOrder || 0), input.isAvailable !== 'false', input.isActive !== 'false', image, Number(input.id), businessId],
      );
      return { id: Number(input.id) };
    }
    const row = await this.db.one<{ itemid: number }>(
      `INSERT INTO public."MenuItems" (businessid, categoryid, itemname, description, price, displayorder, isavailable, isactive, imagepath) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING itemid`,
      [businessId, Number(input.categoryId), input.itemName, input.description || null, price, Number(input.displayOrder || 0), input.isAvailable !== 'false', input.isActive !== 'false', image],
    );
    return { id: row!.itemid };
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
      if (!itemName || !categoryName || !(row.price > 0)) { skipped += 1; continue; }
      let categoryId = byName.get(categoryName.toLowerCase());
      if (!categoryId) {
        const saved = await this.saveCategory(businessId, { categoryName, displayOrder: String(byName.size) });
        categoryId = saved.id;
        byName.set(categoryName.toLowerCase(), categoryId);
        categoriesCreated += 1;
      }
      await this.db.query(
        `INSERT INTO public."MenuItems" (businessid, categoryid, itemname, description, price, displayorder, isavailable, isactive) VALUES ($1,$2,$3,$4,$5,0,true,true)`,
        [businessId, categoryId, itemName, row.description || null, row.price],
      );
      created += 1;
    }
    if (!created) throw new BadRequestException('No valid rows. Use columns: Category, Item, Price, Description.');
    return { created, categoriesCreated, skipped };
  }
  async removeItem(businessId: number, id: number) { await this.db.query(`DELETE FROM public."MenuItems" WHERE itemid=$1 AND businessid=$2`, [id, businessId]); return { ok: true }; }
}
