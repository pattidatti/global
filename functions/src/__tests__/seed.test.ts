import { describe, it, expect, beforeEach } from 'vitest';
import { getRegionDefaults, _resetSeedCacheForTest } from '../_seed';

describe('getRegionDefaults', () => {
  beforeEach(() => {
    _resetSeedCacheForTest();
  });

  it('returnerer defaults for en kjent region fra regions-meta.json', () => {
    // 'western-australia-aus-0' er første region i regions-meta.json (biome: desert).
    const defaults = getRegionDefaults('western-australia-aus-0', 1_700_000_000_000);
    expect(defaults).not.toBeNull();
    expect(defaults).toMatchObject({
      ownerId: null,
      integration: 0,
      maxSlots: 1,
      population: 1000,
      satisfaction: 50,
      defense: 10,
      lastTickAt: 1_700_000_000_000,
      buildings: {},
      buildQueue: [],
      resources: {},
      countryCode: 'AUS',
      culturalGroup: 'anglo',
      strategicValue: 1,
      biome: 'desert',
    });
  });

  it('returnerer null for ukjent regionId', () => {
    expect(getRegionDefaults('does-not-exist', Date.now())).toBeNull();
  });

  it('alle nødvendige felt for byggevalidering er satt', () => {
    const defaults = getRegionDefaults('western-australia-aus-0', Date.now());
    expect(defaults).not.toBeNull();
    // maxSlots må være tall (ikke undefined) for at byggevalidering skal fungere
    expect(typeof defaults!.maxSlots).toBe('number');
    expect(defaults!.maxSlots).toBeGreaterThan(0);
    // satisfaction og defense må være tall for KontekstPanel
    expect(typeof defaults!.satisfaction).toBe('number');
    expect(typeof defaults!.defense).toBe('number');
    expect(typeof defaults!.population).toBe('number');
  });
});
