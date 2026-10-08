export class TemplateDto { id?: string; title!: string; message!: string; isActive?: string }
export class CampaignDto { title!: string; message!: string; segment!: string }
export class PushDto { token!: string; action?: string; businessId?: number }
