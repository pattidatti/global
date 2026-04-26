export type ResourceType = 'food' | 'oil' | 'metal' | 'trade' | 'military' | 'influence';

export type TradeSide = 'buy' | 'sell';

export type TradeStatus = 'open' | 'filled' | 'cancelled' | 'partial';

export interface TradeOrder {
  ownerId: string;
  resource: ResourceType;
  side: TradeSide;
  quantity: number;
  originalQuantity: number;
  pricePerUnit: number;
  postedAt: number;
  status: TradeStatus;
  filledAt?: number;
  cancelledAt?: number;
}

export interface PriceHistoryEntry {
  avgPrice: number;
  volume: number;
  ts: number;
}
