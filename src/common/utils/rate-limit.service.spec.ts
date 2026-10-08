import { RateLimitService } from './rate-limit.service';

describe('rate limit', () => {
  it('allows the budget then blocks the IP for 15 minutes', () => {
    const svc = new RateLimitService();
    const now = 1_000_000;
    expect(svc.check('1.1.1.1', 'LoginAttempt', 2, 5, now)).toBe(false);
    expect(svc.check('1.1.1.1', 'LoginAttempt', 2, 5, now)).toBe(false);
    expect(svc.check('1.1.1.1', 'LoginAttempt', 2, 5, now)).toBe(true);
    expect(svc.isBlocked('1.1.1.1', now)).toBe(true);
  });
});
