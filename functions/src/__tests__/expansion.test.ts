import { describe, it, expect } from 'vitest';

// Tester ekspansjons-logikk som pure functions uten Firebase-kall

const EXPAND_MILITARY_COST = 25;

function canExpand(params: {
  targetOwnerId: string | null;
  playerMilitary: number;
  playerRegionIds: string[];
  adjacency: string[];
}): { ok: true } | { ok: false; error: string } {
  const { targetOwnerId, playerMilitary, playerRegionIds, adjacency } = params;

  if (targetOwnerId !== null) {
    return { ok: false, error: 'already-owned' };
  }

  // Sjekk naboregion (kun ved ikke-tom adjacency)
  if (adjacency.length > 0) {
    const ownsNeighbor = playerRegionIds.some(id => adjacency.includes(id));
    if (!ownsNeighbor) {
      return { ok: false, error: 'no-neighbor' };
    }
  }

  if (playerMilitary < EXPAND_MILITARY_COST) {
    return { ok: false, error: 'insufficient-military' };
  }

  return { ok: true };
}

describe('ekspansjons-validering', () => {
  it('gyldig ekspansjon: NPC-region + spiller eier nabo + nok militær', () => {
    const result = canExpand({
      targetOwnerId: null,
      playerMilitary: 50,
      playerRegionIds: ['norway-1'],
      adjacency: ['norway-1', 'sweden-1'],
    });
    expect(result.ok).toBe(true);
  });

  it('feil: regionen er allerede okkupert', () => {
    const result = canExpand({
      targetOwnerId: 'annen-spiller',
      playerMilitary: 50,
      playerRegionIds: ['norway-1'],
      adjacency: ['norway-1'],
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe('already-owned');
  });

  it('feil: spiller eier ingen naboregion', () => {
    const result = canExpand({
      targetOwnerId: null,
      playerMilitary: 50,
      playerRegionIds: ['far-away-1'],
      adjacency: ['norway-1', 'sweden-1'],
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe('no-neighbor');
  });

  it('feil: ikke nok militærstyrke', () => {
    const result = canExpand({
      targetOwnerId: null,
      playerMilitary: 10,
      playerRegionIds: ['norway-1'],
      adjacency: ['norway-1'],
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe('insufficient-military');
  });

  it('hopper over adjacency-sjekk ved tom adjacency-liste', () => {
    // Brukes når adjacency.json ikke er generert ennå
    const result = canExpand({
      targetOwnerId: null,
      playerMilitary: 50,
      playerRegionIds: [],
      adjacency: [], // tom → ingen validering
    });
    expect(result.ok).toBe(true);
  });

  it('militærkostnad er nøyaktig 25', () => {
    const exactLimit = canExpand({
      targetOwnerId: null,
      playerMilitary: 25,
      playerRegionIds: ['norway-1'],
      adjacency: ['norway-1'],
    });
    expect(exactLimit.ok).toBe(true);

    const oneLess = canExpand({
      targetOwnerId: null,
      playerMilitary: 24,
      playerRegionIds: ['norway-1'],
      adjacency: ['norway-1'],
    });
    expect(oneLess.ok).toBe(false);
  });
});
