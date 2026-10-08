import { BadRequestException } from '@nestjs/common';
import { MenuService } from './menu.service';

describe('MenuService', () => {
  it('rejects a non-positive price', async () => {
    const service = new MenuService({ query: jest.fn() } as never);
    await expect(service.saveItem(1, { categoryId: '1', itemName: 'Tea', price: '0' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
