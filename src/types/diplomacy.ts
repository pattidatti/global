export type DiplomacyStatus =
  | 'neutral'
  | 'alliance'
  | 'war'
  | 'trade'
  | 'pending-alliance';

export interface DiplomaticNote {
  fromSlotId: string;
  text: string;
  sentAt: number;
}

export interface Diplomacy {
  status: DiplomacyStatus;
  since: number;
  proposerId?: string | null;
  notes?: Record<string, DiplomaticNote>;
}

export interface Alliance {
  members: string[];
  formedAt: number;
}
