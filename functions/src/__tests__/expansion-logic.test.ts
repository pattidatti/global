import { describe, it, expect } from 'vitest';
import {
  computeAttractiveness,
  attractivenessThreshold,
  computeSatisfactionAvg,
  computeDominantCulture,
  evaluateNpcDefection,
  DEFECTION_STREAK_REQUIRED,
  DEFECTION_THRESHOLD,
  DEFECTION_LOW_SAT_THRESHOLD,
  DEFECTION_LOW_SAT_TRIGGER,
} from '../expansion-logic';
import type { Region, Player } from '../types';

function makeRegion(overrides: Partial<Region> = {}): Region {
  return {
    ownerId: null,
    integration: 0,
    integrationStartedAt: null,
    biome: 'plains',
    resources: {},
    buildQueue: [],
    buildings: {},
    maxSlots: 4,
    lastTickAt: 0,
    satisfaction: 100,
    population: 1000,
    defense: 0,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    displayName: 'p',
    empireColor: '#fff',
    empireColorIdx: 0,
    treasury: 0,
    influence: 0,
    military: 0,
    regionIds: [],
    nationId: null,
    joinedAt: 0,
    lastSeenAt: 0,
    ...overrides,
  };
}

describe('computeAttractiveness', () => {
  it('returnerer 0 ved alle null-input', () => {
    expect(computeAttractiveness({
      satisfactionAvg: 0, tradeBond: 0, warCount: 5, culturalMatch: 0, influence: 0,
    })).toBe(0);
  });

  it('returnerer ~1 ved alle perfekte verdier', () => {
    const score = computeAttractiveness({
      satisfactionAvg: 100, tradeBond: 1, warCount: 0, culturalMatch: 1, influence: 1000,
    });
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('peace-komponent faller med antall kriger', () => {
    const peaceful = computeAttractiveness({
      satisfactionAvg: 0, tradeBond: 0, warCount: 0, culturalMatch: 0, influence: 0,
    });
    const warring = computeAttractiveness({
      satisfactionAvg: 0, tradeBond: 0, warCount: 5, culturalMatch: 0, influence: 0,
    });
    expect(peaceful).toBeGreaterThan(warring);
    expect(peaceful).toBeCloseTo(0.2, 5);
  });

  it('vekt på satisfaction er 0.3', () => {
    const s = computeAttractiveness({
      satisfactionAvg: 100, tradeBond: 0, warCount: 5, culturalMatch: 0, influence: 0,
    });
    expect(s).toBeCloseTo(0.3, 5);
  });
});

describe('attractivenessThreshold', () => {
  it('returnerer normal terskel ved tilfreds NPC', () => {
    expect(attractivenessThreshold(80)).toBe(DEFECTION_THRESHOLD);
  });
  it('returnerer lav terskel når NPC har lav tilfredshet', () => {
    expect(attractivenessThreshold(DEFECTION_LOW_SAT_TRIGGER - 1)).toBe(DEFECTION_LOW_SAT_THRESHOLD);
  });
  it('grenseverdi nøyaktig', () => {
    expect(attractivenessThreshold(DEFECTION_LOW_SAT_TRIGGER)).toBe(DEFECTION_THRESHOLD);
  });
});

describe('computeSatisfactionAvg', () => {
  it('returnerer 50 når spilleren ikke har regioner', () => {
    expect(computeSatisfactionAvg(makePlayer({ regionIds: [] }), {})).toBe(50);
  });
  it('snitter satisfaction over eide regioner', () => {
    const regions = {
      a: makeRegion({ satisfaction: 80 }),
      b: makeRegion({ satisfaction: 40 }),
    };
    expect(computeSatisfactionAvg(makePlayer({ regionIds: ['a', 'b'] }), regions)).toBe(60);
  });
});

describe('computeDominantCulture', () => {
  it('returnerer hyppigste kulturgruppe', () => {
    const regions = {
      a: makeRegion({ culturalGroup: 'nordic' }),
      b: makeRegion({ culturalGroup: 'nordic' }),
      c: makeRegion({ culturalGroup: 'germanic' }),
    };
    const p = makePlayer({ regionIds: ['a', 'b', 'c'] });
    expect(computeDominantCulture(p, regions)).toBe('nordic');
  });
  it('returnerer null når ingen regioner har kultur-tag', () => {
    const regions = { a: makeRegion() };
    expect(computeDominantCulture(makePlayer({ regionIds: ['a'] }), regions)).toBeNull();
  });
});

describe('evaluateNpcDefection', () => {
  it('NPC uten naboer-eier får ingen streak', () => {
    const regions = {
      npc1: makeRegion({ ownerId: null }),
      p1home: makeRegion({ ownerId: 'p1' }),
    };
    const players = { p1: makePlayer({ regionIds: ['p1home'] }) };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: {}, warDefenders: {}, warStatuses: {},
      adjacency: { npc1: [], p1home: [] },
      tradeBonds: {}, streaks: {},
    });
    expect(result.defections).toEqual([]);
  });

  it('streak økes når attractiveness over terskel', () => {
    const regions = {
      npc1: makeRegion({ ownerId: null, satisfaction: 100, culturalGroup: 'nordic' }),
      p1home: makeRegion({ ownerId: 'p1', satisfaction: 100, culturalGroup: 'nordic' }),
    };
    const players = { p1: makePlayer({ regionIds: ['p1home'], influence: 1000 }) };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: {}, warDefenders: {}, warStatuses: {},
      adjacency: { npc1: ['p1home'], p1home: ['npc1'] },
      tradeBonds: { npc1: { p1: 1 } },
      streaks: {},
    });
    expect(result.defections).toEqual([]); // første tikk
    expect(result.newStreaks.npc1.p1).toBe(1);
  });

  it('defection skjer når streak når terskel', () => {
    const regions = {
      npc1: makeRegion({ ownerId: null, satisfaction: 100, culturalGroup: 'nordic' }),
      p1home: makeRegion({ ownerId: 'p1', satisfaction: 100, culturalGroup: 'nordic' }),
    };
    const players = { p1: makePlayer({ regionIds: ['p1home'], influence: 1000 }) };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: {}, warDefenders: {}, warStatuses: {},
      adjacency: { npc1: ['p1home'] },
      tradeBonds: { npc1: { p1: 1 } },
      streaks: { npc1: { p1: DEFECTION_STREAK_REQUIRED - 1 } },
    });
    expect(result.defections).toHaveLength(1);
    expect(result.defections[0].regionId).toBe('npc1');
    expect(result.defections[0].newOwnerSlotId).toBe('p1');
    expect(result.defections[0].newRegionIds).toEqual(['p1home', 'npc1']);
  });

  it('lavere terskel når NPC-satisfaction er lav', () => {
    // Konfigurasjon der vanlig terskel ikke nås, men lav-sat-terskel gjør
    const regions = {
      // satisfactionAvg 100 → 0.3, tradeBond 0 → 0, peace 1 (krig=0) → 0.2
      // culturalMatch 0 (ingen tag) → 0, influence 0 → 0  =>  total 0.5
      npc1: makeRegion({ ownerId: null, satisfaction: 10 }), // lav-sat → terskel 0.4
      p1home: makeRegion({ ownerId: 'p1', satisfaction: 100 }),
    };
    const players = { p1: makePlayer({ regionIds: ['p1home'] }) };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: {}, warDefenders: {}, warStatuses: {},
      adjacency: { npc1: ['p1home'] },
      tradeBonds: {},
      streaks: {},
    });
    // 0.5 ≥ 0.4 → streak økes
    expect(result.newStreaks.npc1.p1).toBe(1);
  });

  it('streak nullstilles når kandidat faller under terskel', () => {
    const regions = {
      npc1: makeRegion({ ownerId: null, satisfaction: 100 }), // høy-sat → terskel 0.7
      p1home: makeRegion({ ownerId: 'p1', satisfaction: 0 }), // lav avg → lavt bidrag
    };
    const players = { p1: makePlayer({ regionIds: ['p1home'] }) };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: {}, warDefenders: {}, warStatuses: {},
      adjacency: { npc1: ['p1home'] },
      tradeBonds: {},
      streaks: { npc1: { p1: 3 } },
    });
    expect(result.defections).toEqual([]);
    expect(result.newStreaks.npc1).toEqual({});
  });

  it('flere kandidater — best vinner', () => {
    const regions = {
      npc1: makeRegion({ ownerId: null, satisfaction: 100, culturalGroup: 'nordic' }),
      p1home: makeRegion({ ownerId: 'p1', satisfaction: 100, culturalGroup: 'nordic' }),
      p2home: makeRegion({ ownerId: 'p2', satisfaction: 50, culturalGroup: 'germanic' }),
    };
    const players = {
      p1: makePlayer({ regionIds: ['p1home'], influence: 1000 }),
      p2: makePlayer({ regionIds: ['p2home'], influence: 100 }),
    };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: {}, warDefenders: {}, warStatuses: {},
      adjacency: { npc1: ['p1home', 'p2home'] },
      tradeBonds: {},
      streaks: {},
    });
    expect(Object.keys(result.newStreaks.npc1)).toEqual(['p1']);
  });

  it('aktive kriger reduserer attractiveness', () => {
    const regions = {
      npc1: makeRegion({ ownerId: null, satisfaction: 100 }),
      p1home: makeRegion({ ownerId: 'p1', satisfaction: 100 }),
    };
    const players = { p1: makePlayer({ regionIds: ['p1home'] }) };
    const result = evaluateNpcDefection({
      regions, players,
      warAttackers: { w1: 'p1', w2: 'p1', w3: 'p1', w4: 'p1', w5: 'p1' },
      warDefenders: { w1: 'x', w2: 'x', w3: 'x', w4: 'x', w5: 'x' },
      warStatuses: { w1: 'active', w2: 'active', w3: 'active', w4: 'active', w5: 'active' },
      adjacency: { npc1: ['p1home'] },
      tradeBonds: {},
      streaks: {},
    });
    // 5 kriger → peace = 0; satAvg=100 → 0.3 + 0 + 0 + 0 + 0 = 0.3 < 0.7
    expect(result.defections).toEqual([]);
    expect(result.newStreaks.npc1).toEqual({});
  });
});
