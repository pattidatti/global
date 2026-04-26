import { describe, it, expect } from 'vitest';
import { computeMaintenanceCost, MAINTENANCE_TIERS } from '../maintenance-logic';

const ONE_DAY_MIN = 24 * 60;

describe('computeMaintenanceCost', () => {
  it('returnerer 0 for 0 regioner', () => {
    expect(computeMaintenanceCost(0, 60)).toBe(0);
  });

  it('returnerer 0 for negativ regioncount', () => {
    expect(computeMaintenanceCost(-1, 60)).toBe(0);
  });

  it('returnerer 0 for deltaMin = 0', () => {
    expect(computeMaintenanceCost(10, 0)).toBe(0);
  });

  it('1 region * 1 dag = 10 (tier 1)', () => {
    expect(computeMaintenanceCost(1, ONE_DAY_MIN)).toBeCloseTo(10, 5);
  });

  it('5 regioner * 1 dag = 50 (tier 1, øvre grense)', () => {
    expect(computeMaintenanceCost(5, ONE_DAY_MIN)).toBeCloseTo(50, 5);
  });

  it('6 regioner hopper til tier 2 (25/region/dag)', () => {
    // 6 * 25 = 150 (vs tier 1 ville gitt 6*10=60)
    expect(computeMaintenanceCost(6, ONE_DAY_MIN)).toBeCloseTo(150, 5);
  });

  it('11 regioner hopper til tier 3 (60/region/dag)', () => {
    expect(computeMaintenanceCost(11, ONE_DAY_MIN)).toBeCloseTo(11 * 60, 5);
  });

  it('21 regioner hopper til tier 4 (120/region/dag)', () => {
    expect(computeMaintenanceCost(21, ONE_DAY_MIN)).toBeCloseTo(21 * 120, 5);
  });

  it('36 regioner hopper til tier 5 (200/region/dag)', () => {
    expect(computeMaintenanceCost(36, ONE_DAY_MIN)).toBeCloseTo(36 * 200, 5);
  });

  it('skalerer lineært med deltaMin', () => {
    const half = computeMaintenanceCost(10, ONE_DAY_MIN / 2);
    const full = computeMaintenanceCost(10, ONE_DAY_MIN);
    expect(half * 2).toBeCloseTo(full, 5);
  });

  it('total kostnad er monotont ikke-synkende i regionCount', () => {
    let prev = 0;
    for (let n = 0; n <= 50; n++) {
      const cost = computeMaintenanceCost(n, ONE_DAY_MIN);
      expect(cost).toBeGreaterThanOrEqual(prev);
      prev = cost;
    }
  });

  it('per-makrotikk (10 min) ved 20 regioner er ca 8.3 (tier 3 grense)', () => {
    // 20 * 60 / 144 ticks/dag ≈ 8.33
    const cost = computeMaintenanceCost(20, 10);
    expect(cost).toBeCloseTo(20 * 60 / 144, 5);
  });

  it('MAINTENANCE_TIERS dekker alle høye verdier', () => {
    expect(MAINTENANCE_TIERS[MAINTENANCE_TIERS.length - 1].upTo).toBe(Infinity);
  });
});
