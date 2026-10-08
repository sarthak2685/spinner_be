export function segmentSql(segment: string): string {
  switch (segment) {
    case 'ScannedQR':
      return 'SELECT DISTINCT gp.customerid FROM public."GamePlays" gp WHERE gp.businessid = $1';
    case 'Registered':
      return 'SELECT customerid FROM public."Customers" WHERE businessid = $1 AND passwordhash IS NOT NULL';
    case 'WalletBalance':
      return 'SELECT customerid FROM public."Customers" WHERE businessid = $1 AND totalcoins > 0';
    case 'ExpiringCoins':
      return `SELECT DISTINCT wt.customerid FROM public."WalletTransactions" wt
        WHERE wt.businessid = $1 AND wt.transactiontype = 'Earn' AND wt.isexpired = false
          AND wt.expirydate >= CURRENT_TIMESTAMP AND wt.expirydate <= CURRENT_TIMESTAMP + INTERVAL '7 days'
          AND (wt.coins - wt.coinsused) > 0`;
    case 'RedeemedRewards':
      return `SELECT DISTINCT rr.customerid FROM public."RewardRedemptions" rr WHERE rr.businessid = $1 AND rr.status = 'Approved'`;
    case 'Inactive30Days':
      return `SELECT c.customerid FROM public."Customers" c WHERE c.businessid = $1
          AND NOT EXISTS (SELECT 1 FROM public."GamePlays" gp WHERE gp.customerid = c.customerid AND gp.createddate >= CURRENT_DATE - INTERVAL '30 days')
          AND NOT EXISTS (SELECT 1 FROM public."WalletTransactions" wt WHERE wt.customerid = c.customerid AND wt.createddate >= CURRENT_DATE - INTERVAL '30 days')
          AND c.createddate < CURRENT_DATE - INTERVAL '30 days'`;
    case 'PendingClaims':
      return `SELECT DISTINCT pc.customerid FROM public."PurchaseClaims" pc WHERE pc.businessid = $1 AND pc.status = 'Pending'`;
    default:
      return 'SELECT customerid FROM public."Customers" WHERE businessid = $1';
  }
}
