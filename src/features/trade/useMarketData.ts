import { useEffect, useState } from 'react';
import { useGameStore } from '../../game/store';
import {
  subscribeToMarketOrders,
  subscribeToMarketHistory,
} from '../../firebase/db';
import type {
  TradeOrder,
  PriceHistoryEntry,
  ResourceType,
} from '../../types/trade';

export interface MarketData {
  buys: Record<string, TradeOrder>;
  sells: Record<string, TradeOrder>;
  history: Record<string, PriceHistoryEntry>;
}

/**
 * Abonnér på marked-data for én valgt ressurs (DETAIL-tier per §11).
 */
export function useMarketData(resource: ResourceType): MarketData {
  const gameId = useGameStore(s => s.gameId);
  const [buys, setBuys] = useState<Record<string, TradeOrder>>({});
  const [sells, setSells] = useState<Record<string, TradeOrder>>({});
  const [history, setHistory] = useState<Record<string, PriceHistoryEntry>>({});

  useEffect(() => {
    if (!gameId) return;
    const unsubBuy = subscribeToMarketOrders(gameId, resource, 'buy', orders =>
      setBuys(orders ?? {}),
    );
    const unsubSell = subscribeToMarketOrders(gameId, resource, 'sell', orders =>
      setSells(orders ?? {}),
    );
    const unsubHist = subscribeToMarketHistory(gameId, resource, hist =>
      setHistory(hist ?? {}),
    );
    return () => {
      unsubBuy();
      unsubSell();
      unsubHist();
    };
  }, [gameId, resource]);

  return { buys, sells, history };
}
