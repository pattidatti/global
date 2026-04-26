// Rene helpers for NPC frivillig tilslutning og diplomatisk/økonomisk
// overtakelse. Ingen Firebase-import — testbare uten emulator.
//
// Spec: IMPLEMENTATION_PLAN.md §2 «Detaljer: NPC frivillig tilslutning»

import type { Region, Player } from './types';

export const DEFECTION_THRESHOLD = 0.7;
export const DEFECTION_STREAK_REQUIRED = 5;
export const DEFECTION_LOW_SAT_THRESHOLD = 0.4;
export const DEFECTION_LOW_SAT_TRIGGER = 30;

export const INVEST_COST = 50;
export const INVEST_SAT_GAIN = 5;
export const INVEST_TRADE_BOND_GAIN = 0.05;
export const INVEST_MAX_SAT = 100;

export const DIPLO_TAKEOVER_INFLUENCE_COST = 200;

export interface AttractivenessContext {
  /** Spillerens snitt-tilfredshet på tvers av egne regioner (0-100). */
  satisfactionAvg: number;
  /** Trade-bond for denne (region, spiller)-kombinasjonen (0-1). */
  tradeBond: number;
  /** Antall aktive kriger spilleren er involvert i. */
  warCount: number;
  /** 1 hvis spillerens dominante kultur matcher NPC-region, ellers 0. */
  culturalMatch: number;
  /** Spillerens influence-score. */
  influence: number;
}

/**
 * Attractiveness-formel fra IMPLEMENTATION_PLAN.md §2:
 *   0.3·sat + 0.2·tradeBond + 0.2·peace + 0.2·culture + 0.1·influence
 * Returnerer verdi i [0, 1+].
 */
export function computeAttractiveness(ctx: AttractivenessContext): number {
  const sat = Math.max(0, Math.min(1, ctx.satisfactionAvg / 100));
  const trade = Math.max(0, Math.min(1, ctx.tradeBond));
  const peace = Math.max(0, 1 - ctx.warCount / 5);
  const culture = Math.max(0, Math.min(1, ctx.culturalMatch));
  const influence = Math.max(0, Math.min(1, ctx.influence / 1000));

  return 0.3 * sat + 0.2 * trade + 0.2 * peace + 0.2 * culture + 0.1 * influence;
}

/**
 * Terskel for tilslutning. Lavere når NPC-region har lav tilfredshet
 * (utilfredse innbyggere lar seg lettere overbevise).
 */
export function attractivenessThreshold(npcSatisfaction: number): number {
  return npcSatisfaction < DEFECTION_LOW_SAT_TRIGGER
    ? DEFECTION_LOW_SAT_THRESHOLD
    : DEFECTION_THRESHOLD;
}

/**
 * Beregner spillerens snitt-tilfredshet (på tvers av eide regioner).
 * 50 hvis ingen regioner.
 */
export function computeSatisfactionAvg(
  player: Pick<Player, 'regionIds'>,
  regions: Record<string, Region>,
): number {
  const ids = player.regionIds ?? [];
  if (ids.length === 0) return 50;

  let sum = 0;
  let n = 0;
  for (const rid of ids) {
    const r = regions[rid];
    if (r) {
      sum += r.satisfaction ?? 0;
      n += 1;
    }
  }
  return n === 0 ? 50 : sum / n;
}

/**
 * Beregner spillerens dominante kulturgruppe ved å telle eide regioner.
 */
export function computeDominantCulture(
  player: Pick<Player, 'regionIds'>,
  regions: Record<string, Region>,
): string | null {
  const counts: Record<string, number> = {};
  for (const rid of player.regionIds ?? []) {
    const r = regions[rid];
    const g = r?.culturalGroup;
    if (g) counts[g] = (counts[g] ?? 0) + 1;
  }
  let best: string | null = null;
  let max = 0;
  for (const [g, n] of Object.entries(counts)) {
    if (n > max) {
      best = g;
      max = n;
    }
  }
  return best;
}

export interface DefectionDecision {
  regionId: string;
  newOwnerSlotId: string;
  newRegionIds: string[]; // for spilleren — eksisterende + denne
}

export interface NpcDefectionInput {
  regions: Record<string, Region>;
  players: Record<string, Player>;
  /** /games/{id}/wars/{warId} — for å telle aktive kriger per spiller. */
  warAttackers: Record<string, string>; // warId → attackerSlotId
  warDefenders: Record<string, string>; // warId → defenderSlotId
  warStatuses: Record<string, string>;  // warId → status
  /** adjacency[regionId] = [naboId] */
  adjacency: Record<string, string[]>;
  /** trade-bond per (regionId, slotId) */
  tradeBonds: Record<string, Record<string, number>>;
  /** streak-teller per (regionId, slotId) */
  streaks: Record<string, Record<string, number>>;
}

export interface NpcDefectionResult {
  /** Regioner som faktisk skifter eier denne tikken. */
  defections: DefectionDecision[];
  /** Oppdaterte streak-tellere som skal skrives tilbake. */
  newStreaks: Record<string, Record<string, number>>;
}

function countActiveWars(
  slotId: string,
  warAttackers: Record<string, string>,
  warDefenders: Record<string, string>,
  warStatuses: Record<string, string>,
): number {
  let n = 0;
  for (const wid of Object.keys(warAttackers)) {
    if (warStatuses[wid] !== 'active') continue;
    if (warAttackers[wid] === slotId || warDefenders[wid] === slotId) n += 1;
  }
  return n;
}

/**
 * Vurderer alle NPC-regioner. For hver NPC-region som er nabo til minst
 * én spiller-region: regn ut attractiveness for hver kandidat-spiller,
 * velg høyeste, og oppdater streak. Når streak ≥ 5 → defection.
 */
export function evaluateNpcDefection(input: NpcDefectionInput): NpcDefectionResult {
  const {
    regions, players, warAttackers, warDefenders, warStatuses,
    adjacency, tradeBonds, streaks,
  } = input;

  const newStreaks: Record<string, Record<string, number>> = {};
  const defections: DefectionDecision[] = [];

  // Cache per spiller (for å unngå re-beregning av satisfactionAvg + dominantCulture)
  const playerCache: Record<string, {
    satisfactionAvg: number;
    dominantCulture: string | null;
    warCount: number;
  }> = {};

  function getPlayerCtx(slotId: string) {
    if (!playerCache[slotId]) {
      const p = players[slotId];
      playerCache[slotId] = {
        satisfactionAvg: computeSatisfactionAvg(p, regions),
        dominantCulture: computeDominantCulture(p, regions),
        warCount: countActiveWars(slotId, warAttackers, warDefenders, warStatuses),
      };
    }
    return playerCache[slotId];
  }

  for (const [regionId, region] of Object.entries(regions)) {
    if (region.ownerId !== null) continue; // kun NPC

    const neighborIds = adjacency[regionId] ?? [];
    if (neighborIds.length === 0) continue;

    // Finn unike eiere av nabo-regioner
    const candidateSlots = new Set<string>();
    for (const nid of neighborIds) {
      const owner = regions[nid]?.ownerId;
      if (owner) candidateSlots.add(owner);
    }
    if (candidateSlots.size === 0) continue;

    // Beregn attractiveness per kandidat
    let bestSlot: string | null = null;
    let bestScore = 0;
    for (const slotId of candidateSlots) {
      const player = players[slotId];
      if (!player) continue;
      const cache = getPlayerCtx(slotId);
      const score = computeAttractiveness({
        satisfactionAvg: cache.satisfactionAvg,
        tradeBond: tradeBonds[regionId]?.[slotId] ?? 0,
        warCount: cache.warCount,
        culturalMatch: cache.dominantCulture && cache.dominantCulture === region.culturalGroup ? 1 : 0,
        influence: player.influence ?? 0,
      });
      if (score > bestScore) {
        bestScore = score;
        bestSlot = slotId;
      }
    }

    const threshold = attractivenessThreshold(region.satisfaction ?? 100);
    const prevStreaks = streaks[regionId] ?? {};
    const updated: Record<string, number> = {};

    if (bestSlot && bestScore >= threshold) {
      const prev = prevStreaks[bestSlot] ?? 0;
      const next = prev + 1;
      updated[bestSlot] = next;
      // Andre kandidater nullstilles automatisk (ikke kopiert inn)
      if (next >= DEFECTION_STREAK_REQUIRED) {
        const winner = players[bestSlot];
        defections.push({
          regionId,
          newOwnerSlotId: bestSlot,
          newRegionIds: [...(winner.regionIds ?? []), regionId],
        });
      }
      newStreaks[regionId] = updated;
    } else {
      // Ingen leder over terskel — null streak helt
      newStreaks[regionId] = {};
    }
  }

  return { defections, newStreaks };
}
