// Rene helpers for kamp-mekanikk (§13.1) — ingen Firebase-import.
// Deterministisk via seeded RNG: gitt (warId, tickIdx) gir samme utfall hver gang.

import type { Unit, Biome, UnitType } from './types';

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32 — fast, deterministisk, godt nok for spill-RNG)
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function seededRng(seed: string): { next: () => number } {
  let state = hashString(seed);
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

// ---------------------------------------------------------------------------
// Terrain-bonus
// ---------------------------------------------------------------------------

/**
 * Forsvars-bonus per biom per §13.1: fjell og øy (arctic) er forsvarbare,
 * ørken/regnskog er nøytrale, sletter er angripbare.
 *
 * Returnerer multiplikator: 1.0 = nøytralt, >1 = bonus, <1 = ulempe.
 */
export function terrainBonus(biome: Biome | undefined, side: 'attack' | 'defense'): number {
  const b = biome ?? 'other';
  if (side === 'defense') {
    switch (b) {
      case 'mountain': return 1.5;
      case 'arctic':   return 1.3;
      case 'regnskog': return 1.2;
      case 'coast':    return 1.0;
      case 'plains':   return 0.9;
      case 'desert':   return 1.0;
      default:         return 1.0;
    }
  }
  // angrep — invers: angripbart i sletter, vanskelig i fjell
  switch (b) {
    case 'mountain': return 0.7;
    case 'arctic':   return 0.8;
    case 'regnskog': return 0.85;
    case 'plains':   return 1.1;
    case 'desert':   return 1.0;
    case 'coast':    return 1.0;
    default:         return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Enhet-type-asymmetri
// ---------------------------------------------------------------------------
//
// Hver enhetstype har asymmetriske angreps- og forsvarsmodifikatorer som
// skalerer med biom. Tanken er at panser dominerer på sletter (og generelt i
// angrep), infanteri er allrounder med bonus i fjell/ulendt terreng, og
// marinen kun er nyttig på kyst.

interface UnitMul { attack: number; defense: number }
interface UnitMulMap {
  base: UnitMul;
  /** Per biom-overstyringer. Faller tilbake til `base`. */
  byBiome?: Partial<Record<Biome, Partial<UnitMul>>>;
}

export const UNIT_MULS: Record<UnitType, UnitMulMap> = {
  infantry: {
    base: { attack: 1.0, defense: 1.0 },
    byBiome: {
      mountain: { attack: 1.1, defense: 1.2 },
      regnskog: { attack: 1.05, defense: 1.1 },
    },
  },
  armor: {
    base: { attack: 1.4, defense: 0.8 },
    byBiome: {
      plains:   { attack: 1.6, defense: 0.9 },
      mountain: { attack: 0.7, defense: 0.6 },
      regnskog: { attack: 0.6, defense: 0.6 },
      arctic:   { attack: 0.7, defense: 0.7 },
    },
  },
  navy: {
    base: { attack: 0.4, defense: 0.4 },
    byBiome: {
      coast: { attack: 1.3, defense: 1.2 },
    },
  },
};

function unitMul(type: UnitType, biome: Biome | undefined, side: 'attack' | 'defense'): number {
  const cfg = UNIT_MULS[type];
  const base = cfg.base[side];
  if (!biome) return base;
  const override = cfg.byBiome?.[biome]?.[side];
  return typeof override === 'number' ? override : base;
}

/**
 * Effektiv kampstyrke for en enhet, justert for type + biom.
 */
export function effectiveStrength(
  unit: Pick<Unit, 'type' | 'strength'>,
  biome: Biome | undefined,
  side: 'attack' | 'defense',
): number {
  return unit.strength * unitMul(unit.type, biome, side);
}

// ---------------------------------------------------------------------------
// Kraft-summering og tap-fordeling
// ---------------------------------------------------------------------------

export function sumStrength(units: Unit[]): number {
  return units.reduce((sum, u) => sum + u.strength, 0);
}

/**
 * Sum av effektiv styrke for en gruppe enheter.
 */
export function sumEffectiveStrength(
  units: Array<Pick<Unit, 'type' | 'strength'>>,
  biome: Biome | undefined,
  side: 'attack' | 'defense',
): number {
  return units.reduce((sum, u) => sum + effectiveStrength(u, biome, side), 0);
}

/**
 * Fordel tap proporsjonalt mellom enheter (svakeste først, slik at svake
 * dør raskt og sterke består lengre — gir spillmessig mening).
 *
 * Returnerer ny array av enheter (input ikke mutert) med subtrahert strength.
 * Enheter som havner på 0 eller mindre, beholdes med strength=0 — caller
 * må filtrere disse ut og slette fra DB.
 */
export function applyLosses(
  units: Array<Unit & { id: string }>,
  totalLoss: number,
): Array<Unit & { id: string }> {
  if (totalLoss <= 0 || units.length === 0) return units.map(u => ({ ...u }));

  // Spread tap proporsjonalt med strength
  const total = sumStrength(units);
  if (total <= 0) return units.map(u => ({ ...u }));

  const result = units.map(u => {
    const share = (u.strength / total) * totalLoss;
    return { ...u, strength: Math.max(0, u.strength - Math.round(share)) };
  });
  return result;
}

// ---------------------------------------------------------------------------
// Battle step: én region, én tikk
// ---------------------------------------------------------------------------

export interface BattleStepResult {
  attackers: Array<Unit & { id: string }>; // oppdaterte attackers
  defenders: Array<Unit & { id: string }>; // oppdaterte defenders
  attackerLoss: number;                    // total styrke tapt
  defenderLoss: number;
  conquered: boolean;                      // true = angriper erobret regionen
}

export interface ComputeBattleArgs {
  warId: string;
  tickIdx: number;
  regionId: string;
  biome: Biome | undefined;
  regionDefense: number;
  attackers: Array<Unit & { id: string }>;
  defenders: Array<Unit & { id: string }>;
}

/**
 * Per §13.1 kampalgoritme:
 *
 *   attackPower = sumStrength(attackers) * terrainBonus(attack)
 *   defendPower = sumStrength(defenders) * terrainBonus(defense) + region.defense
 *
 *   attackerLoss = round(defendPower * 0.1 * rng())
 *   defenderLoss = round(attackPower * 0.15 * rng())
 *
 *   Erobring: defenders.sum < 1 OG attackers.sum > 0
 */
export function computeBattleStep(args: ComputeBattleArgs): BattleStepResult {
  const { warId, tickIdx, regionId, biome, regionDefense, attackers, defenders } = args;

  const attPower = sumEffectiveStrength(attackers, biome, 'attack') * terrainBonus(biome, 'attack');
  const defPower = sumEffectiveStrength(defenders, biome, 'defense') * terrainBonus(biome, 'defense') + (regionDefense ?? 0);

  const rng = seededRng(`${warId}:${tickIdx}:${regionId}`);
  const attackerLoss = Math.round(defPower * 0.1 * rng.next());
  const defenderLoss = Math.round(attPower * 0.15 * rng.next());

  const newAttackers = applyLosses(attackers, attackerLoss);
  const newDefenders = applyLosses(defenders, defenderLoss);

  const remainingDef = sumStrength(newDefenders);
  const remainingAtt = sumStrength(newAttackers);
  const conquered = remainingDef < 1 && remainingAtt > 0;

  return {
    attackers: newAttackers,
    defenders: newDefenders,
    attackerLoss,
    defenderLoss,
    conquered,
  };
}

// ---------------------------------------------------------------------------
// Konstanter for unit-cost (brukes av deployUnits)
// ---------------------------------------------------------------------------

export const UNIT_BASE_STRENGTH = 100;
export const UNIT_COST_MILITARY = 25; // hvor mye player.military trekkes per enhet
