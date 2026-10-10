export class CategoryDto { id?: string; categoryName!: string; displayOrder?: string; isActive?: string }
export class ItemDto { id?: string; categoryId!: string; itemName!: string; description?: string; price!: string; displayOrder?: string; isAvailable?: string; isActive?: string; options?: string; addons?: string }
