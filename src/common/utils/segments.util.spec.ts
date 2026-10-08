import { segmentSql } from './segments.util';

describe('campaign segments', () => {
  it('keeps each audience on its original query', () => {
    expect(segmentSql('All')).toMatch(/"Customers"/);
    expect(segmentSql('ScannedQR')).toMatch(/GamePlays/);
    expect(segmentSql('Registered')).toMatch(/passwordhash IS NOT NULL/);
    expect(segmentSql('WalletBalance')).toMatch(/totalcoins > 0/);
    expect(segmentSql('ExpiringCoins')).toMatch(/7 days/);
    expect(segmentSql('RedeemedRewards')).toMatch(/Approved/);
    expect(segmentSql('Inactive30Days')).toMatch(/30 days/);
    expect(segmentSql('PendingClaims')).toMatch(/PurchaseClaims/);
  });
});
