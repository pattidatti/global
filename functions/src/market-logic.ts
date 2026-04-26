// Rene helpers for marked-mekanikk — ingen Firebase-import slik at de
// kan unit-testes uten emulator/admin-SDK.

import type { TradeOrder, ResourceType, Region } from './types';

export const PRICE_HISTORY_MAX_ENTRIES = 200;

export interface MatchPair {
  buy: TradeOrder & { id: string };
  sell: TradeOrder & { id: string };
  fillQuantity: number;
  fillPrice: number; // midpoint
}

/**
 * Match-engine: tar buy- og sell-orders for én ressurs og returnerer
 * sekvens av matcher (FIFO, beste pris først). Modifiserer ikke input.
 *
 * Pris-konvensjon: midpoint mellom buy og sell (per IMPLEMENTATION_PLAN
 * åpent spørsmål 3, anbefalt valg).
 */
export function matchOrderBook(
  buys: Array<TradeOrder & { id: string }>,
  sells: Array<TradeOrder & { id: string }>,
): MatchPair[] {
  // Beste buy = høyeste pris; beste sell = laveste pris.
  // Ved likhet: eldst først (postedAt asc).
  const sortedBuys = [...buys]
    .filter(o => o.status === 'open' && o.quantity > 0)
    .sort((a, b) => b.pricePerUnit - a.pricePerUnit || a.postedAt - b.postedAt);
  const sortedSells = [...sells]
    .filter(o => o.status === 'open' && o.quantity > 0)
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit || a.postedAt - b.postedAt);

  // Lokale kopier av quantity for in-place matching
  const buyQ: Record<string, number> = {};
  const sellQ: Record<string, number> = {};
  for (const o of sortedBuys) buyQ[o.id] = o.quantity;
  for (const o of sortedSells) sellQ[o.id] = o.quantity;

  const matches: MatchPair[] = [];
  let bi = 0;
  let si = 0;

  while (bi < sortedBuys.length && si < sortedSells.length) {
    const buy = sortedBuys[bi];
    const sell = sortedSells[si];

    // Avbryt: ingen kryssing
    if (buy.pricePerUnit < sell.pricePerUnit) break;

    const fill = Math.min(buyQ[buy.id], sellQ[sell.id]);
    if (fill <= 0) {
      if (buyQ[buy.id] === 0) bi++;
      if (sellQ[sell.id] === 0) si++;
      continue;
    }

    const fillPrice = (buy.pricePerUnit + sell.pricePerUnit) / 2;

    matches.push({ buy, sell, fillQuantity: fill, fillPrice });

    buyQ[buy.id] -= fill;
    sellQ[sell.id] -= fill;
    if (buyQ[buy.id] === 0) bi++;
    if (sellQ[sell.id] === 0) si++;
  }

  return matches;
}

/**
 * Aggregér en sekvens av matcher til én priseflagg-oppføring (volum-vektet snitt).
 * Returnerer null hvis ingen handler.
 */
export function aggregateTickStats(
  matches: MatchPair[],
): { avgPrice: number; volume: number } | null {
  if (matches.length === 0) return null;
  let totalNotional = 0;
  let totalVolume = 0;
  for (const m of matches) {
    totalNotional += m.fillPrice * m.fillQuantity;
    totalVolume += m.fillQuantity;
  }
  if (totalVolume === 0) return null;
  return { avgPrice: totalNotional / totalVolume, volume: totalVolume };
}

/**
 * Sum av en ressurs på tvers av spillerens regioner.
 */
export function totalResourceForPlayer(
  regions: Region[],
  resource: ResourceType,
): number {
  let total = 0;
  for (const r of regions) {
    total += (r.resources?.[resource] ?? 0);
  }
  return total;
}

/**
 * Plan for å trekke en mengde av en ressurs fra spillerens regioner.
 * Strategi: trekk fra regionen med mest av ressursen først (greedy),
 * inntil ønsket mengde er trukket.
 *
 * Returnerer { plan: [{ regionId, deduct }], shortfall } der shortfall > 0
 * betyr at vi ikke fant nok ressurs på tvers av regionene.
 */
export function planResourceDeduction(
  regions: Array<Region & { regionId: string }>,
  resource: ResourceType,
  amount: number,
): {
  plan: Array<{ regionId: string; deduct: number; remainingAfter: number }>;
  shortfall: number;
} {
  const sorted = [...regions].sort(
    (a, b) => (b.resources?.[resource] ?? 0) - (a.resources?.[resource] ?? 0),
  );
  const plan: Array<{ regionId: string; deduct: number; remainingAfter: number }> = [];
  let remaining = amount;

  for (const r of sorted) {
    if (remaining <= 0) break;
    const have = r.resources?.[resource] ?? 0;
    if (have <= 0) continue;
    const take = Math.min(have, remaining);
    plan.push({
      regionId: r.regionId,
      deduct: take,
      remainingAfter: have - take,
    });
    remaining -= take;
  }

  return { plan, shortfall: remaining };
}

/**
 * Hvilke ressurstyper er omsettelige på markedet.
 * military og influence er IKKE omsettelige (per §6 — de er per-spiller-attributter).
 */
export const TRADABLE_RESOURCES: ResourceType[] = ['food', 'oil', 'metal', 'trade'];

export function isTradable(resource: ResourceType): boolean {
  return TRADABLE_RESOURCES.includes(resource);
}
