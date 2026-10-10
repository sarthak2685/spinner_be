export class PlaceOrderDto {
  token!: string;
  items!: { itemId: number; qty: number; optionId?: number; addonIds?: number[] }[];
  remarks?: string;
  tableNumber?: string;
  deliveryAddress?: string;
  fulfillment?: string;
  customerName?: string;
  customerMobile?: string;
}
export class UpdateOrderDto { status!: string }
