import { planGuestMerge } from './guest-merge.util';

describe('guest merge', () => {
  it('moves coins, plays, and wallet rows before deleting the guest', () => {
    const steps = planGuestMerge(9, 3);
    expect(steps?.[1]).toMatch(/DELETE/);
    expect(steps?.[2]).toMatch(/GamePlays/);
    expect(steps?.[3]).toMatch(/keptCoins/);
    expect(steps?.[4]).toMatch(/DELETE/);
    expect(planGuestMerge(3, 3)).toBeNull();
    expect(planGuestMerge(0, 3)).toBeNull();
  });
});
