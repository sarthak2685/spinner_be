import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('asks for a 10-digit mobile and a service type before looking up the menu', async () => {
    const db = { one: jest.fn() };
    const service = new OrdersService(db as never);
    await expect(service.place(null, { token: 'biz', items: [{ itemId: 1, qty: 1 }], tableNumber: '4', customerMobile: '98765' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.place(null, { token: 'biz', items: [{ itemId: 1, qty: 1 }], customerMobile: '9876543210' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.one).not.toHaveBeenCalled();
  });
});
