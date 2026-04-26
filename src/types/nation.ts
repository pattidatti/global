export type NationType = 'historical' | 'custom';

export interface NationBonus {
  production?: number;
  prestige?: number;
}

export interface Nation {
  founderId: string;
  name: string;
  flag: string;
  type: NationType;
  cultureMatch: number;
  dominantCulture: string;
  color: string;
  bonus: NationBonus;
  members: string[];
  formedAt: number;
  /** Forbund-medlemskap. En nasjon kan være i maks ett forbund. */
  leagueId?: string | null;
}
