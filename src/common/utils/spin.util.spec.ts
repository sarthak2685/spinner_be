import { pickPrizeIndex } from './spin.util';

describe('spin picker', () => {
  const prizes = [{ winningpercentage: 40 }, { winningpercentage: 30 }, { winningpercentage: 30 }];
  it('uses cumulative percentage bands and falls back to the first prize', () => {
    expect(pickPrizeIndex(prizes, 10)).toBe(0);
    expect(pickPrizeIndex(prizes, 40)).toBe(0);
    expect(pickPrizeIndex(prizes, 41)).toBe(1);
    expect(pickPrizeIndex(prizes, 71)).toBe(2);
    expect(pickPrizeIndex([{ winningpercentage: 10 }], 50)).toBe(0);
  });
});
