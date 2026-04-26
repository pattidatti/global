/**
 * Vedlikeholdskostnad per spiller per makrotikk.
 *
 * Per design.md §8.2 oppgis kostnader som "per region per dag". Vi normaliserer
 * til per-makrotikk (10 min) ved å dele på 144 (antall makrotikk per dag),
 * og lar deltaMin skalere lineært slik at en tikk med større deltaMin
 * (etter pause/freeze) tar igjen riktig mengde — clampet av MAX_TICK_DELTA_MIN
 * i kalleren.
 */

export interface MaintenanceTier {
  /** Inkludert øvre grense for antall regioner i denne tieren. */
  upTo: number;
  /** Kostnad per region per dag. */
  perRegionPerDay: number;
}

export const MAINTENANCE_TIERS: readonly MaintenanceTier[] = [
  { upTo: 5,        perRegionPerDay: 10 },
  { upTo: 10,       perRegionPerDay: 25 },
  { upTo: 20,       perRegionPerDay: 60 },
  { upTo: 35,       perRegionPerDay: 120 },
  { upTo: Infinity, perRegionPerDay: 200 },
] as const;

const MIN_PER_DAY = 24 * 60;

/**
 * Kostnad per region per dag for en gitt tier-størrelse.
 */
function tierRateForRegionCount(regionCount: number): number {
  for (const tier of MAINTENANCE_TIERS) {
    if (regionCount <= tier.upTo) return tier.perRegionPerDay;
  }
  return MAINTENANCE_TIERS[MAINTENANCE_TIERS.length - 1].perRegionPerDay;
}

/**
 * Total vedlikeholdskostnad for en spiller over deltaMin minutter.
 * Returnerer alltid et ikke-negativt tall.
 */
export function computeMaintenanceCost(regionCount: number, deltaMin: number): number {
  if (regionCount <= 0 || deltaMin <= 0) return 0;
  const ratePerRegionPerMin = tierRateForRegionCount(regionCount) / MIN_PER_DAY;
  return regionCount * ratePerRegionPerMin * deltaMin;
}
