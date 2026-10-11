export function isDirectorySearch(query: Record<string, string>) {
  if ((query.search || '').trim()) return true;
  if ((query.place || '').trim()) return true;
  if (Number(query.stateId) || Number(query.countryId) || Number(query.districtId) || Number(query.cityId)) return true;
  if (query.near === '1' && Number.isFinite(Number(query.lat)) && Number.isFinite(Number(query.lng))) return true;
  if (query.category && query.category !== 'All') return true;
  if (query.game && query.game !== 'All') return true;
  return false;
}

/** Businesses this person already opened: a customer row, a play, an order, or a bill on the same mobile. */
export function visitedBusinessMatch(businessColumn: string, customerIdParam: string, mobileParam: string) {
  const person = `(c2.customerid = ${customerIdParam} OR (${mobileParam} <> '' AND RIGHT(regexp_replace(COALESCE(c2.mobile, ''), '[^0-9]', '', 'g'), 10) = ${mobileParam}))`;
  return `${businessColumn} IN (
    SELECT v.businessid FROM (
      SELECT c2.businessid FROM public."Customers" c2 WHERE c2.businessid IS NOT NULL AND ${person}
      UNION
      SELECT gp.businessid FROM public."GamePlays" gp INNER JOIN public."Customers" c2 ON c2.customerid = gp.customerid WHERE gp.businessid IS NOT NULL AND ${person}
      UNION
      SELECT o.businessid FROM public."Orders" o INNER JOIN public."Customers" c2 ON c2.customerid = o.customerid WHERE o.businessid IS NOT NULL AND ${person}
      UNION
      SELECT pc.businessid FROM public."PurchaseClaims" pc INNER JOIN public."Customers" c2 ON c2.customerid = pc.customerid WHERE pc.businessid IS NOT NULL AND ${person}
    ) v
  )`;
}
