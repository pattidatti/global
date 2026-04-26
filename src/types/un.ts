export type UnMeetingStatus = 'open' | 'closed';

export interface UnMeeting {
  agenda: string;
  options: string[];
  startedAt: number;
  startedBy: string;
  status: UnMeetingStatus;
  closedAt?: number;
  votes?: Record<string, number>;
}
