import { BadRequestException } from '@nestjs/common';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  it('rejects a short customer password before insert', async () => {
    const db = { scalar: jest.fn(), one: jest.fn(), query: jest.fn() };
    const service = new RegistrationService(db as never, { sign: jest.fn() } as never);
    await expect(service.registerCustomer({ name: 'Asha', mobile: '9876543210', password: '123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.scalar).not.toHaveBeenCalled();
  });
});
