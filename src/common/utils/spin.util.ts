export interface PrizeSlice {
  winningpercentage: number;
}

export function pickPrizeIndex(prizes: PrizeSlice[], roll: number): number {
  if (!prizes.length) return -1;
  let cumulative = 0;
  for (let i = 0; i < prizes.length; i++) {
    cumulative += Number(prizes[i].winningpercentage);
    if (roll <= cumulative) return i;
  }
  return 0;
}

export function defaultPrizes(gameCode: string): { name: string; coins: number; percentage: number }[] {
  const table: Record<string, { name: string; coins: number; percentage: number }[]> = {
    SpinWheel: [
      { name: 'Better Luck Next Time', coins: 0, percentage: 40 },
      { name: '10 Coins', coins: 10, percentage: 30 },
      { name: '50 Coins', coins: 50, percentage: 30 },
    ],
    ScratchCard: [
      { name: 'Better Luck Next Time', coins: 0, percentage: 50 },
      { name: '15 Coins', coins: 15, percentage: 30 },
      { name: '100 Coins', coins: 100, percentage: 20 },
    ],
    MysteryGiftBox: [
      { name: 'Better Luck Next Time', coins: 0, percentage: 30 },
      { name: '20 Coins', coins: 20, percentage: 50 },
      { name: '200 Coins', coins: 200, percentage: 20 },
    ],
    SlotMachine: [
      { name: 'Better Luck Next Time', coins: 0, percentage: 60 },
      { name: '25 Coins', coins: 25, percentage: 30 },
      { name: '500 Coins', coins: 500, percentage: 10 },
    ],
  };
  return table[gameCode] || [
    { name: 'Try Again', coins: 0, percentage: 50 },
    { name: '10 Coins', coins: 10, percentage: 30 },
    { name: '25 Coins', coins: 25, percentage: 20 },
  ];
}

export const GAME_CODES = ['SpinWheel', 'ScratchCard', 'MysteryGiftBox', 'SlotMachine'] as const;
