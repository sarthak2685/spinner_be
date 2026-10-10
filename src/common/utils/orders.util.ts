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

export const FULFILLMENTS = ['DineIn', 'Delivery', 'Pickup'] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export interface CartLine {
  itemId: number;
  qty: number;
  optionId?: number;
  addonIds?: number[];
}

export function lineKey(item: CartLine) {
  const addons = [...(item.addonIds || [])].filter((id) => id > 0).sort((a, b) => a - b).join('.');
  return `${item.itemId}:${Number(item.optionId) || 0}:${addons}`;
}

export function consolidateCart(items: CartLine[]): Map<string, CartLine> {
  const map = new Map<string, CartLine>();
  for (const item of items || []) {
    if (!item || item.itemId <= 0 || item.qty <= 0) continue;
    const key = lineKey(item);
    const prev = map.get(key);
    const addonIds = [...(item.addonIds || [])].filter((id) => id > 0);
    if (prev) prev.qty += item.qty;
    else map.set(key, { itemId: item.itemId, qty: item.qty, optionId: Number(item.optionId) || undefined, addonIds });
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
