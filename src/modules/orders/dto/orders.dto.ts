export class PlaceOrderDto { token!: string; items!: { itemId: number; qty: number }[]; remarks?: string; tableNumber!: string; customerName?: string }
export class UpdateOrderDto { status!: string }
