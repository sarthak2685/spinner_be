import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('requires a station before looking up the menu', async () => {
    const db = { one: jest.fn() };
    const service = new OrdersService(db as never);
    await expect(service.place({ id: 1, role: 'Customer', name: 'A', businessId: 1, businessToken: null, kind: 'customer' }, { token: 'biz', items: [{ itemId: 1, qty: 1 }], tableNumber: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.place(null, { token: 'biz', items: [{ itemId: 1, qty: 1 }], tableNumber: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.one).not.toHaveBeenCalled();
  });
});
