export class GameDto { name!: string }
export class PrizeDto { id?: string; configId!: string; prizeName!: string; coins?: string; winningPercentage?: string; isActive?: string }
export class PlayDto { token!: string; gameCode?: string }
