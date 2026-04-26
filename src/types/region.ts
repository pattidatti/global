export interface GeoJsonMeta {
  name: string;
  biome: string;
  iso: string;
  culturalGroup: string;
}

export type Biome =
  | 'plains'
  | 'coast'
  | 'mountain'
  | 'desert'
  | 'arctic'
  | 'regnskog'
  | 'other';

export type BuildingType =
  | 'farm'
  | 'mine'
  | 'oilrig'
  | 'harbor'
  | 'barracks'
  | 'cityExpand';

export interface Building {
  type: BuildingType;
  builtAt: number;
  pendingHarvest: Partial<Record<string, number>>;
  lastHarvestedAt: number;
  maxStorage: number;
}

export interface BuildQueueItem {
  buildingId: string;
  type: BuildingType;
  startedAt: number;
  completesAt: number;
}

export interface RegionResources {
  food?: number;
  oil?: number;
  metal?: number;
  trade?: number;
}

export interface Region {
  ownerId: string | null;
  nationId: string | null;
  population: number;
  satisfaction: number;
  defense: number;
  resources: RegionResources;
  buildQueue: BuildQueueItem[];
  maxSlots: number;
  integration: number;
  integrationStartedAt: number | null;
  contestedAt: number | null;
  lastTickAt: number;
  buildings?: Record<string, Building>;
  // Static geo data (from GeoJSON properties)
  biome?: Biome;
  strategicValue?: number;
  culturalGroup?: string;
  historicalNation?: string;
  cityTag?: string;
  iso?: string;
  /** Trade-bond per slot — bygges opp av investInRegion. */
  tradeBond?: Record<string, number>;
  /** Streak-teller for NPC-defection per slot. */
  defectionStreak?: Record<string, number>;
}
