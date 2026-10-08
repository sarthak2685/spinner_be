export interface EarnRow {
  wallettransactionid: number;
  businessid: number;
  coins: number;
  coinsused: number;
}

export interface ExpiryAction {
  kind: 'deduct' | 'flag';
  txId: number;
  businessId?: number;
  unspent?: number;
}

export function planCoinExpiry(rows: EarnRow[]): ExpiryAction[] {
  return rows.map((row) => {
    const unspent = Number(row.coins) - Number(row.coinsused);
    if (unspent > 0) return { kind: 'deduct', txId: row.wallettransactionid, businessId: row.businessid, unspent };
    return { kind: 'flag', txId: row.wallettransactionid };
  });
}

export function planFifoUse(rows: { wallettransactionid: number; coins: number; coinsused: number }[], amount: number) {
  let remaining = amount;
  const updates: { txId: number; coinsused: number }[] = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const available = row.coins - row.coinsused;
    if (available >= remaining) {
      updates.push({ txId: row.wallettransactionid, coinsused: row.coinsused + remaining });
      remaining = 0;
    } else if (available > 0) {
      updates.push({ txId: row.wallettransactionid, coinsused: row.coins });
      remaining -= available;
    }
  }
  return updates;
}
