import { describe, it, expect } from 'vitest';
import {
  matchOrderBook,
  aggregateTickStats,
  totalResourceForPlayer,
  planResourceDeduction,
  isTradable,
  TRADABLE_RESOURCES,
} from '../market-logic';
import type { TradeOrder, Region } from '../types';

function buy(id: string, q: number, p: number, postedAt = 0): TradeOrder & { id: string } {
  return {
    id,
    ownerId: 'b-' + id,
    resource: 'oil',
    side: 'buy',
    quantity: q,
    originalQuantity: q,
    pricePerUnit: p,
    postedAt,
    status: 'open',
  };
}

function sell(id: string, q: number, p: number, postedAt = 0): TradeOrder & { id: string } {
  return {
    id,
    ownerId: 's-' + id,
    resource: 'oil',
    side: 'sell',
    quantity: q,
    originalQuantity: q,
    pricePerUnit: p,
    postedAt,
    status: 'open',
  };
}

describe('matchOrderBook', () => {
  it('match @midpoint når buy 30 møter sell 28', () => {
    const matches = matchOrderBook([buy('b1', 10, 30)], [sell('s1', 10, 28)]);
    expect(matches).toHaveLength(1);
    expect(matches[0].fillQuantity).toBe(10);
    expect(matches[0].fillPrice).toBe(29); // (30 + 28) / 2
  });

  it('ingen match når sell-pris > buy-pris', () => {
    const matches = matchOrderBook([buy('b1', 10, 25)], [sell('s1', 10, 30)]);
    expect(matches).toHaveLength(0);
  });

  it('partial fill: buy=20 mot sell=10 → 10 fylt, buy gjenstår med 10', () => {
    const matches = matchOrderBook([buy('b1', 20, 30)], [sell('s1', 10, 28)]);
    expect(matches).toHaveLength(1);
    expect(matches[0].fillQuantity).toBe(10);
  });

  it('flere matcher i serie til best-buy < best-sell', () => {
    const buys = [buy('b1', 5, 30), buy('b2', 5, 25)];
    const sells = [sell('s1', 5, 28), sell('s2', 5, 32)];
    // b1 (30) møter s1 (28) → fill 5 @ 29
    // b2 (25) vs s2 (32) → ingen match
    const matches = matchOrderBook(buys, sells);
    expect(matches).toHaveLength(1);
    expect(matches[0].buy.id).toBe('b1');
    expect(matches[0].sell.id).toBe('s1');
  });

  it('FIFO-prioritering ved lik pris (eldst først)', () => {
    const buys = [buy('b1', 5, 30, 200), buy('b2', 5, 30, 100)];
    const sells = [sell('s1', 10, 28)];
    // b2 (eldst) skal matches først
    const matches = matchOrderBook(buys, sells);
    expect(matches[0].buy.id).toBe('b2');
    expect(matches[1].buy.id).toBe('b1');
  });

  it('hopper over closed/cancelled-orders', () => {
    const buyClosed = { ...buy('b1', 10, 30), status: 'cancelled' as const };
    const matches = matchOrderBook([buyClosed], [sell('s1', 10, 28)]);
    expect(matches).toHaveLength(0);
  });
});

describe('aggregateTickStats', () => {
  it('volum-vektet snitt på tvers av matcher', () => {
    const matches = [
      { fillQuantity: 10, fillPrice: 30 },
      { fillQuantity: 20, fillPrice: 24 },
    ] as Parameters<typeof aggregateTickStats>[0];
    const stats = aggregateTickStats(matches);
    expect(stats?.volume).toBe(30);
    // (10*30 + 20*24) / 30 = (300 + 480) / 30 = 26
    expect(stats?.avgPrice).toBe(26);
  });

  it('null ved ingen matcher', () => {
    expect(aggregateTickStats([])).toBeNull();
  });
});

function makeRegion(regionId: string, resources: Partial<Record<string, number>>): Region & { regionId: string } {
  return {
    regionId,
    ownerId: 'p1',
    integration: 100,
    integrationStartedAt: null,
    biome: 'plains',
    resources,
    buildQueue: [],
    buildings: {},
    maxSlots: 1,
    lastTickAt: 0,
    satisfaction: 50,
    population: 1000,
    defense: 10,
    nationId: null,
    contestedAt: null,
  };
}

describe('totalResourceForPlayer + planResourceDeduction', () => {
  it('aggregerer på tvers av regioner', () => {
    const regions = [
      makeRegion('r1', { oil: 100 }),
      makeRegion('r2', { oil: 50 }),
      makeRegion('r3', { oil: 0 }),
    ];
    expect(totalResourceForPlayer(regions, 'oil')).toBe(150);
  });

  it('greedy plan trekker fra rikeste region først', () => {
    const regions = [
      makeRegion('r1', { oil: 100 }),
      makeRegion('r2', { oil: 50 }),
    ];
    const { plan, shortfall } = planResourceDeduction(regions, 'oil', 30);
    expect(shortfall).toBe(0);
    expect(plan).toHaveLength(1);
    expect(plan[0].regionId).toBe('r1');
    expect(plan[0].deduct).toBe(30);
    expect(plan[0].remainingAfter).toBe(70);
  });

  it('plan distribueres når enkeltregion ikke holder', () => {
    const regions = [
      makeRegion('r1', { oil: 100 }),
      makeRegion('r2', { oil: 50 }),
    ];
    const { plan, shortfall } = planResourceDeduction(regions, 'oil', 130);
    expect(shortfall).toBe(0);
    expect(plan.map(p => p.deduct)).toEqual([100, 30]);
  });

  it('shortfall > 0 når totalt ikke nok', () => {
    const regions = [makeRegion('r1', { oil: 50 })];
    const { plan, shortfall } = planResourceDeduction(regions, 'oil', 100);
    expect(shortfall).toBe(50);
    expect(plan[0].deduct).toBe(50);
  });

  it('hopper over regioner uten ressursen', () => {
    const regions = [
      makeRegion('r1', { food: 100 }),
      makeRegion('r2', { oil: 50 }),
    ];
    const { plan } = planResourceDeduction(regions, 'oil', 30);
    expect(plan).toHaveLength(1);
    expect(plan[0].regionId).toBe('r2');
  });
});

describe('TRADABLE_RESOURCES', () => {
  it('food, oil, metal, trade er omsettelige', () => {
    expect(isTradable('food')).toBe(true);
    expect(isTradable('oil')).toBe(true);
    expect(isTradable('metal')).toBe(true);
    expect(isTradable('trade')).toBe(true);
  });

  it('military og influence er ikke omsettelige', () => {
    expect(isTradable('military')).toBe(false);
    expect(isTradable('influence')).toBe(false);
  });

  it('TRADABLE_RESOURCES inneholder akkurat 4 typer', () => {
    expect(TRADABLE_RESOURCES).toHaveLength(4);
  });
});
