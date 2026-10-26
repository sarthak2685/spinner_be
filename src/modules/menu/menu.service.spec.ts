import { BadRequestException } from '@nestjs/common';
import { MenuService, parseMenuCsv } from './menu.service';

describe('MenuService', () => {
  it('rejects a non-positive price', async () => {
    const service = new MenuService({ query: jest.fn() } as never);
    await expect(service.saveItem(1, { categoryId: '1', itemName: 'Tea', price: '0' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reads a menu csv and skips the header', () => {
    expect(parseMenuCsv('Category,Item,Price,Description\nStarters,"Paneer, Tikka",220,Spicy\n')).toEqual([
      { category: 'Starters', itemName: 'Paneer, Tikka', price: 220, halfPrice: undefined, fullPrice: undefined, description: 'Spicy' },
    ]);
  });

  it('reads half and full prices from csv headers', () => {
    expect(parseMenuCsv('Category,Item,Price,HalfPrice,FullPrice,Description\nMains,Butter Chicken,180,180,320,Creamy\nDrinks,Masala Chai,40,,,Hot\n')).toEqual([
      { category: 'Mains', itemName: 'Butter Chicken', price: 180, halfPrice: 180, fullPrice: 320, description: 'Creamy' },
      { category: 'Drinks', itemName: 'Masala Chai', price: 40, halfPrice: undefined, fullPrice: undefined, description: 'Hot' },
    ]);
  });
});
