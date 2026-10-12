export function planGuestMerge(guestId: number, loginId: number): string[] | null {
  if (guestId <= 0 || guestId === loginId) return null;
  return [
    'SELECT GamePlays for $guest and count plays of that game already on $login',
    'DELETE guest GamePlays that would pass two plays of one game',
    'UPDATE public."GamePlays" SET customerid = $login WHERE customerid = $guest',
    'UPDATE public."Customers" SET totalcoins = totalcoins + $keptCoins WHERE customerid = $login',
    'DELETE FROM public."Customers" WHERE customerid = $guest',
  ];
}
