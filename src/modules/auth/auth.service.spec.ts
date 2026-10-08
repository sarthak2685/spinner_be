import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { RateLimitService } from '../../common/utils/rate-limit.service';

describe('AuthService login', () => {
  it('rejects a mobile that is not 10 digits before any database call', async () => {
    const db = { one: jest.fn(), many: jest.fn(), query: jest.fn(), tx: jest.fn() };
    const service = new AuthService(db as never, { sign: jest.fn() } as unknown as JwtService, new RateLimitService());
    await expect(service.login({ mobile: '123', password: 'secret' }, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.one).not.toHaveBeenCalled();
  });
});
