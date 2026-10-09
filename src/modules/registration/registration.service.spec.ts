import { BadRequestException } from '@nestjs/common';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  it('rejects a short customer password before insert', async () => {
    const db = { scalar: jest.fn(), one: jest.fn(), query: jest.fn() };
    const service = new RegistrationService(db as never, { sign: jest.fn() } as never);
    await expect(service.registerCustomer({ name: 'Asha', mobile: '9876543210', password: '123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.scalar).not.toHaveBeenCalled();
  });

  it('seeds the built-in games when the Games catalog is absent', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ name: null }] };
        if (sql.includes('GameConfigurations')) return { rows: [{ gameconfigurationid: 1 }] };
        if (sql.includes('PrizeConfigurations')) return { rows: [] };
        throw new Error(sql);
      }),
    };
    const service = new RegistrationService({} as never, { sign: jest.fn() } as never);
    await (service as unknown as { seedGames: (db: typeof client, id: number) => Promise<void> }).seedGames(client, 9);
    const gameInserts = client.query.mock.calls.filter(([sql]) => String(sql).includes('GameConfigurations'));
    expect(gameInserts).toHaveLength(4);
  });
});
