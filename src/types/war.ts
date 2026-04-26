export type UnitType = 'infantry' | 'armor' | 'navy';

export interface Unit {
  ownerId: string;
  regionId: string;
  type: UnitType;
  strength: number;
  movedAt: number;
}

export type WarStatus = 'active' | 'ceasefire' | 'ended';

export interface BattleLogEntry {
  tick: number;
  regionId: string;
  attackerLoss: number;
  defenderLoss: number;
  ts: number;
}

export interface War {
  attacker: string;
  defender: string;
  startedAt: number;
  contestedRegionIds: string[];
  battleLog: BattleLogEntry[];
  status: WarStatus;
  endedAt: number | null;
  ceasefireProposedBy?: string | null;
}
