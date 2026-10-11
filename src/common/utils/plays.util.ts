export const SHOP_PLAY_LIMIT = 2;

export function keptGuestPlays<T>(existingCount: number, plays: T[], limit = SHOP_PLAY_LIMIT) {
  const room = Math.max(0, limit - Math.max(0, Math.floor(existingCount)));
  return { keep: plays.slice(0, room), drop: plays.slice(room) };
}

export const PLAY_COUNT_SQL = `SELECT COUNT(1)::text FROM public."GamePlays" gp
 JOIN public."Customers" c ON c.customerid = gp.customerid
 WHERE gp.businessid = $1
   AND gp.customerid <> $4
   AND (
     c.customerid = $2
     OR ($3 <> '' AND RIGHT(regexp_replace(COALESCE(c.mobile, ''), '[^0-9]', '', 'g'), 10) = $3)
   )`;
