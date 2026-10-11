import { ForbiddenException } from '@nestjs/common';
import { QueryResult, QueryResultRow } from 'pg';

type TermDb = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

export const SHOP_CLOSED = 'This shop period has ended. Ask the platform to renew it.';

let termReady: Promise<void> | null = null;

export function shopIsClosed(activeto: unknown) {
  if (!activeto) return false;
  const time = new Date(activeto as string).getTime();
  return Number.isFinite(time) && time < Date.now();
}

export function assertShopOpen(row: { activeto?: unknown } | null | undefined) {
  if (row && shopIsClosed(row.activeto)) throw new ForbiddenException(SHOP_CLOSED);
}

export function ensureTermColumn(db: TermDb) {
  termReady ??= db.query(`ALTER TABLE public."Businesses" ADD COLUMN IF NOT EXISTS activeto TIMESTAMP`)
    .then(() => db.query(`UPDATE public."Businesses" SET activeto = CURRENT_TIMESTAMP + INTERVAL '7 days' WHERE activeto IS NULL`))
    .then(() => undefined);
  return termReady;
}

export function activeDays(value: unknown, fallback = 7) {
  const days = Math.round(Number(value ?? fallback));
  if (!Number.isFinite(days)) return fallback;
  return Math.min(3650, Math.max(1, days));
}
