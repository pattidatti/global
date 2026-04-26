export type GameStatus = 'active' | 'frozen' | 'ended';

export interface GameMeta {
  teacherId: string;
  createdAt: number;
  status: GameStatus;
  startZones?: Record<string, string[]>;
  unFormed: boolean;
  nationCount: number;
  schemaVersion: number;
  lastMacroTickAt: number;
}

export interface RosterSlot {
  displayName: string;
  createdAt: number;
  joinedAt: number | null;
}

export interface ServerListEntry {
  name: string;
  teacherName: string;
  teacherId: string;
  status: GameStatus;
  playerCount: number;
  createdAt: number;
}
