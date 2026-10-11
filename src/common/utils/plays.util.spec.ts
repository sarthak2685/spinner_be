import { keptGuestPlays } from './plays.util';

describe('shop play limit', () => {
  it('keeps guest plays only while the account still has a free turn', () => {
    expect(keptGuestPlays(0, ['a', 'b', 'c']).keep).toEqual(['a', 'b']);
    expect(keptGuestPlays(1, ['a', 'b']).keep).toEqual(['a']);
    expect(keptGuestPlays(2, ['a']).keep).toEqual([]);
    expect(keptGuestPlays(2, ['a']).drop).toEqual(['a']);
  });
});
