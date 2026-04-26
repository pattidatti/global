export interface LeaguePendingInvite {
  invitedAt: number;
  invitedBy: string;
}

export interface League {
  name: string;
  founderNationId: string;
  memberNationIds: string[];
  charter: 'defense_pact';
  formedAt: number;
  pendingInvites?: Record<string, LeaguePendingInvite>;
}
