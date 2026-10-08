export function planGuestMerge(guestId: number, loginId: number): string[] | null {
  if (guestId <= 0 || guestId === loginId) return null;
  return [
    'SELECT totalcoins FROM public."Customers" WHERE customerid = $guest',
    'UPDATE public."Customers" SET totalcoins = totalcoins + $coins WHERE customerid = $login',
    'UPDATE public."GamePlays" SET customerid = $login WHERE customerid = $guest',
    'UPDATE public."WalletTransactions" SET customerid = $login WHERE customerid = $guest',
    'DELETE FROM public."Customers" WHERE customerid = $guest',
  ];
}
