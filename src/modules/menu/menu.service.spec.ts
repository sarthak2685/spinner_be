import { BadRequestException } from '@nestjs/common';
import { MenuService, parseMenuCsv } from './menu.service';

describe('MenuService', () => {
  it('rejects a non-positive price', async () => {
    const service = new MenuService({ query: jest.fn() } as never);
    await expect(service.saveItem(1, { categoryId: '1', itemName: 'Tea', price: '0' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reads a menu csv and skips the header', () => {
    expect(parseMenuCsv('Category,Item,Price,Description\nStarters,"Paneer, Tikka",220,Spicy\n')).toEqual([
      { category: 'Starters', itemName: 'Paneer, Tikka', price: 220, description: 'Spicy' },
    ]);
  });
});
