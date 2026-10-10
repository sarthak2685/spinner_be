import { assertQuantity, buildOrderNumber, consolidateCart, statusFromCommand, whatsappOrderUrl } from './orders.util';

describe('orders', () => {
  it('maps commands, merges the cart, and formats order numbers', () => {
    expect(statusFromCommand('AcceptOrder')).toBe('Accepted');
    expect(statusFromCommand('RejectOrder')).toBe('Rejected');
    expect(statusFromCommand('Nope')).toBeNull();
    const cart = consolidateCart([
      { itemId: 2, qty: 1 },
      { itemId: 2, qty: 3 },
      { itemId: 0, qty: 5 },
      { itemId: 2, qty: 1, optionId: 9 },
    ]);
    expect(cart.get('2:0:')?.qty).toBe(4);
    expect(cart.get('2:9:')?.qty).toBe(1);
    expect(assertQuantity(101)).toMatch(/Invalid quantity/);
    expect(assertQuantity(2)).toBeNull();
    expect(buildOrderNumber(new Date(2026, 9, 5), 7)).toBe('RS-20261005-000007');
    expect(whatsappOrderUrl('9876543210', 'Order 1')).toContain('https://wa.me/919876543210?text=');
    expect(whatsappOrderUrl('', 'Order 1')).toBeNull();
  });
});
