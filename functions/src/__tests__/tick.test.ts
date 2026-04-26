import { describe, it, expect } from 'vitest';
import {
  tickRegionProduction,
  tickBuildQueue,
  tickIntegration,
  tickSatisfaction,
  tickPopulation,
} from '../tick';
import type { Region, Building } from '../types';

function makeRegion(overrides: Partial<Region> = {}): Region {
  return {
    ownerId: 'slot-1',
    integration: 0,
    integrationStartedAt: null,
    biome: 'plains',
    resources: {},
    buildQueue: [],
    buildings: {},
    maxSlots: 1,
    lastTickAt: Date.now() - 10 * 60_000,
    satisfaction: 50,
    population: 1000,
    defense: 10,
    ...overrides,
  };
}

function makeBuilding(type: Building['type'] = 'farm'): Building {
  return {
    type,
    builtAt: Date.now() - 100_000,
    pendingHarvest: {},
    lastHarvestedAt: null,
    maxStorage: 1000,
  };
}

// ---------------------------------------------------------------------------
// tickRegionProduction
// ---------------------------------------------------------------------------

describe('tickRegionProduction', () => {
  it('beregner riktig produksjon: farm på plains med 10 min delta', () => {
    const region = makeRegion({
      biome: 'plains',
      buildings: { b1: makeBuilding('farm') },
    });
    const result = tickRegionProduction(region, 10);
    // farm.output.food = 30, biomeMul.plains = 1.5, deltaMin/10 = 1.0
    // gain = 30 * 1.5 * 1.0 = 45
    expect(result['b1']?.food).toBeCloseTo(45, 1);
  });

  it('beregner riktig produksjon: farm på desert', () => {
    const region = makeRegion({
      biome: 'desert',
      buildings: { b1: makeBuilding('farm') },
    });
    const result = tickRegionProduction(region, 10);
    // farm.output.food = 30, biomeMul.desert = 0.3
    // gain = 30 * 0.3 * 1.0 = 9
    expect(result['b1']?.food).toBeCloseTo(9, 1);
  });

  it('klamper til maxStorage', () => {
    const building = makeBuilding('farm');
    building.pendingHarvest = { food: 998 };
    building.maxStorage = 1000;
    const region = makeRegion({
      biome: 'plains',
      buildings: { b1: building },
    });
    const result = tickRegionProduction(region, 10);
    // Ville produsert 45 mer, men klampes til 1000
    expect(result['b1']?.food).toBe(1000);
  });

  it('returnerer ingenting ved delta=0', () => {
    const region = makeRegion({
      biome: 'plains',
      buildings: { b1: makeBuilding('farm') },
    });
    const result = tickRegionProduction(region, 0);
    expect(result['b1']?.food ?? 0).toBeCloseTo(0, 5);
  });

  it('returnerer tom objekt ved ingen bygninger', () => {
    const region = makeRegion({ buildings: {} });
    const result = tickRegionProduction(region, 10);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('mine på mountain gir høy multiplikator', () => {
    const region = makeRegion({
      biome: 'mountain',
      buildings: { b1: makeBuilding('mine') },
    });
    const result = tickRegionProduction(region, 10);
    // mine.output.metal = 20, biomeMul.mountain = 1.8
    expect(result['b1']?.metal).toBeCloseTo(36, 1);
  });
});

// ---------------------------------------------------------------------------
// tickBuildQueue
// ---------------------------------------------------------------------------

describe('tickBuildQueue', () => {
  const now = Date.now();

  it('fullfører bygning som er ferdig (completesAt <= now)', () => {
    const region = makeRegion({
      buildQueue: [
        { buildingId: 'b1', type: 'farm', startedAt: now - 60_000, completesAt: now - 1 },
      ],
    });
    const { newBuildings, remainingQueue } = tickBuildQueue(region, now);
    expect(Object.keys(newBuildings)).toContain('b1');
    expect(remainingQueue).toHaveLength(0);
    expect(newBuildings['b1']?.type).toBe('farm');
  });

  it('beholder bygning som ikke er ferdig (completesAt > now)', () => {
    const region = makeRegion({
      buildQueue: [
        { buildingId: 'b1', type: 'mine', startedAt: now, completesAt: now + 60_000 },
      ],
    });
    const { newBuildings, remainingQueue } = tickBuildQueue(region, now);
    expect(Object.keys(newBuildings)).toHaveLength(0);
    expect(remainingQueue).toHaveLength(1);
  });

  it('splitter blanding riktig', () => {
    const region = makeRegion({
      buildQueue: [
        { buildingId: 'b1', type: 'farm', startedAt: now - 100, completesAt: now - 1 },
        { buildingId: 'b2', type: 'mine', startedAt: now, completesAt: now + 100 },
      ],
    });
    const { newBuildings, remainingQueue } = tickBuildQueue(region, now);
    expect(Object.keys(newBuildings)).toContain('b1');
    expect(remainingQueue.map(q => q.buildingId)).toContain('b2');
  });

  it('håndterer tom kø', () => {
    const region = makeRegion({ buildQueue: [] });
    const { newBuildings, remainingQueue } = tickBuildQueue(region, now);
    expect(Object.keys(newBuildings)).toHaveLength(0);
    expect(remainingQueue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tickIntegration
// ---------------------------------------------------------------------------

describe('tickIntegration', () => {
  it('returnerer null når integrationStartedAt er null', () => {
    const region = makeRegion({ integrationStartedAt: null });
    expect(tickIntegration(region, 10)).toBeNull();
  });

  it('10 min → ~0.69% fremgang', () => {
    const region = makeRegion({ integration: 0, integrationStartedAt: Date.now() });
    const result = tickIntegration(region, 10);
    expect(result).not.toBeNull();
    // 10/(24*60)*100 ≈ 0.694
    expect(result!.integration).toBeCloseTo(0.694, 2);
    expect(result!.integrationStartedAt).not.toBeNull();
  });

  it('setter integrationStartedAt=null når integration ≥ 100', () => {
    const region = makeRegion({ integration: 99.5, integrationStartedAt: Date.now() });
    const result = tickIntegration(region, 10);
    expect(result!.integration).toBe(100);
    expect(result!.integrationStartedAt).toBeNull();
  });

  it('klamper til 100 ved stort delta', () => {
    const region = makeRegion({ integration: 50, integrationStartedAt: Date.now() });
    const result = tickIntegration(region, 60); // maks tillatt delta
    expect(result!.integration).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// tickSatisfaction
// ---------------------------------------------------------------------------

describe('tickSatisfaction', () => {
  it('lav mat → negativ endring', () => {
    const region = makeRegion({ satisfaction: 50, resources: { food: 50 } });
    const result = tickSatisfaction(region, []);
    expect(result).toBeLessThan(50);
  });

  it('nok mat + naboer hos samme eier → positiv endring', () => {
    const region = makeRegion({ satisfaction: 50, ownerId: 'slot-1', resources: { food: 500 } });
    const neighbor = makeRegion({ ownerId: 'slot-1' });
    const result = tickSatisfaction(region, [neighbor]);
    expect(result).toBeGreaterThan(50);
  });

  it('klampes til [0, 100]', () => {
    const r1 = makeRegion({ satisfaction: 0, resources: { food: 0 } });
    const r2 = makeRegion({ satisfaction: 100, resources: { food: 9999 } });
    expect(tickSatisfaction(r1, [])).toBeGreaterThanOrEqual(0);
    expect(tickSatisfaction(r2, [])).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// tickPopulation
// ---------------------------------------------------------------------------

describe('tickPopulation', () => {
  it('vokser ved høy tilfredshet (>60)', () => {
    // Bruker stor befolkning for å unngå IEEE 754-avrundingsfeil (1000 * 1.001 = 1000.999...)
    const region = makeRegion({ satisfaction: 80, population: 10000 });
    expect(tickPopulation(region)).toBeGreaterThan(10000);
  });

  it('synker ved lav tilfredshet (<30)', () => {
    const region = makeRegion({ satisfaction: 20, population: 10000 });
    expect(tickPopulation(region)).toBeLessThan(10000);
  });

  it('holder stabil ved middels tilfredshet (30-60)', () => {
    const region = makeRegion({ satisfaction: 50, population: 1000 });
    expect(tickPopulation(region)).toBe(1000);
  });
});
