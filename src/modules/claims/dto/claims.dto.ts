export class ClaimDto { token?: string; businessId?: string; amount!: string; coins?: string; invoiceNumber?: string; remarks?: string }
export class DecideClaimDto { action!: 'approve' | 'reject'; reason?: string }
