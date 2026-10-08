import { planCoinExpiry, planFifoUse } from './coins.util';

describe('coins', () => {
  it('plans expiry and FIFO spend', () => {
    expect(planCoinExpiry([
      { wallettransactionid: 1, businessid: 4, coins: 50, coinsused: 20 },
      { wallettransactionid: 2, businessid: 4, coins: 10, coinsused: 10 },
    ])).toEqual([
      { kind: 'deduct', txId: 1, businessId: 4, unspent: 30 },
      { kind: 'flag', txId: 2 },
    ]);
    expect(planFifoUse([
      { wallettransactionid: 1, coins: 10, coinsused: 4 },
      { wallettransactionid: 2, coins: 20, coinsused: 0 },
    ], 10)).toEqual([
      { txId: 1, coinsused: 10 },
      { txId: 2, coinsused: 4 },
    ]);
  });
});
