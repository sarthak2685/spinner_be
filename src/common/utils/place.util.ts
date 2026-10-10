import { BadRequestException } from '@nestjs/common';
import { QueryResult, QueryResultRow } from 'pg';

type PlaceDb = {
  one: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<T | null>;
  scalar: <T = unknown>(text: string, params?: unknown[]) => Promise<T | null>;
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

let columnReady: Promise<void> | null = null;

export function businessSlug(name: string) {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'shop';
}

export function ensurePlaceColumn(db: PlaceDb) {
  columnReady ??= db.query(`ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS publicslug VARCHAR(80)`)
    .then(() => db.query(`CREATE UNIQUE INDEX IF NOT EXISTS businesses_publicslug_lower ON public."Businesses" (lower(publicslug)) WHERE publicslug IS NOT NULL AND publicslug <> ''`))
    .then(() => undefined);
  return columnReady;
}

export async function uniqueBusinessSlug(db: PlaceDb, name: string, excludeBusinessId?: number | null) {
  await ensurePlaceColumn(db);
  const base = businessSlug(name);
  for (let i = 0; i < 40; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`.slice(0, 48);
    const taken = await db.scalar(
      `SELECT 1 FROM public."Businesses" WHERE (lower(businesstoken) = lower($1) OR lower(COALESCE(publicslug, '')) = lower($1)) AND ($2::int IS NULL OR businessid <> $2)`,
      [slug, excludeBusinessId ?? null],
    );
    if (!taken) return slug;
  }
  throw new BadRequestException('Could not make a link from this business name.');
}

export async function findBusinessByPlace<T extends QueryResultRow = QueryResultRow>(db: PlaceDb, token: string) {
  await ensurePlaceColumn(db);
  const key = decodeURIComponent(String(token || '')).trim();
  if (!key) return null;
  return db.one<T>(
    `SELECT * FROM public."Businesses"
     WHERE lower(businesstoken) = lower($1) OR lower(COALESCE(publicslug, '')) = lower($1)
     LIMIT 1`,
    [key],
  );
}
