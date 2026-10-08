export const ORDER_STATUSES = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled', 'Rejected'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const COMMANDS: Record<string, OrderStatus> = {
  AcceptOrder: 'Accepted',
  PreparingOrder: 'Preparing',
  ReadyOrder: 'Ready',
  CompleteOrder: 'Completed',
  CancelOrder: 'Cancelled',
  RejectOrder: 'Rejected',
};

export function statusFromCommand(command: string): OrderStatus | null {
  return COMMANDS[command] ?? null;
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export interface CartLine {
  itemId: number;
  qty: number;
}

export function consolidateCart(items: CartLine[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const item of items || []) {
    if (!item || item.itemId <= 0 || item.qty <= 0) continue;
    map.set(item.itemId, (map.get(item.itemId) || 0) + item.qty);
  }
  return map;
}

export function assertQuantity(qty: number): string | null {
  if (qty <= 0 || qty > 100) return `Invalid quantity (${qty}) for item.`;
  return null;
}

export function whatsappOrderUrl(phone: string | null | undefined, message: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  const number = digits.length === 10 ? `91${digits}` : digits;
  if (number.length < 11) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildOrderNumber(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `RS-${y}${m}${d}-${String(sequence).padStart(6, '0')}`;
}
