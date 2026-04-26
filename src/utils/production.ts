import type { Region, BuildingType } from '../types/region';

interface BuildingDefLite {
  output: Partial<Record<string, number>>;
  biomeMul: Partial<Record<string, number>>;
}

// Speiler BUILDING_DEFS fra functions — kun for klient-side UI-estimater
const DEFS: Record<BuildingType, BuildingDefLite> = {
  farm:       { output: { food: 30 },     biomeMul: { plains: 1.5, coast: 1.0, regnskog: 1.2, desert: 0.3, arctic: 0.2, others: 0.7 } },
  mine:       { output: { metal: 20 },    biomeMul: { mountain: 1.8, arctic: 1.2, plains: 0.5, others: 0.6 } },
  oilrig:     { output: { oil: 25 },      biomeMul: { desert: 1.6, arctic: 1.4, others: 0.4 } },
  harbor:     { output: { trade: 10 },    biomeMul: { coast: 1.0 } },
  barracks:   { output: { military: 15 }, biomeMul: { others: 1.0 } },
  cityExpand: { output: { influence: 5 }, biomeMul: { others: 1.0 } },
};

/** Estimert produksjon per 10-minutters tikk for en gitt region */
export function estimateOutput(region: Region): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const building of Object.values(region.buildings ?? {})) {
    const def = DEFS[building.type];
    if (!def) continue;
    const biome = region.biome ?? 'plains';
    const factor = def.biomeMul[biome] ?? def.biomeMul['others'] ?? 0.5;
    for (const [res, base] of Object.entries(def.output)) {
      totals[res] = (totals[res] ?? 0) + (base ?? 0) * factor;
    }
  }
  return totals;
}

/** Totalt estimert output per 10-tikk på tvers av alle gitte regioner */
export function estimateTotalOutput(regions: Record<string, Region>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const region of Object.values(regions)) {
    const out = estimateOutput(region);
    for (const [res, val] of Object.entries(out)) {
      totals[res] = (totals[res] ?? 0) + val;
    }
  }
  return totals;
}
