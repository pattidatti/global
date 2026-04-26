export interface Player {
  displayName: string;
  empireColor: string;
  empireColorIdx: number;
  treasury: number;
  influence: number;
  military: number;
  regionIds: string[];
  nationId: string | null;
  joinedAt: number;
  lastSeenAt: number;
  /** Vedlikeholdskostnad trukket i siste makrotikk. UI viser dette som indikator. */
  lastMaintenanceCost?: number;
}

export interface UsedColors {
  [colorIdx: string]: string; // colorIdx → slotId
}
