/**
 * Lærer-varsler skrives av Cloud Functions til /games/{gameId}/teacher/log/{pushId}.
 * Discriminated union på `type` slik at UI kan rendere passende ikon/tekst per variant.
 */

export interface TeacherLogBase {
  /** Tidspunkt for hendelsen (Date.now()). */
  ts: number;
}

export interface WarDeclaredEntry extends TeacherLogBase {
  type: 'war_declared';
  attacker: string;
  defender: string;
  warId: string;
  contestedRegionIds: string[];
}

export interface NationFormedEntry extends TeacherLogBase {
  type: 'nation_formed';
  slotId: string;
  nationId: string;
  name: string;
  flag: string;
}

export interface NationDissolvedEntry extends TeacherLogBase {
  type: 'nation_dissolved';
  slotId: string;
  nationId: string;
  name: string;
}

export interface LeagueFormedEntry extends TeacherLogBase {
  type: 'league_formed';
  leagueId: string;
  name: string;
  founderNationId: string;
}

export interface LeagueDissolvedEntry extends TeacherLogBase {
  type: 'league_dissolved';
  leagueId: string;
  name: string;
}

export interface LeagueMemberJoinedEntry extends TeacherLogBase {
  type: 'league_member_joined';
  leagueId: string;
  leagueName: string;
  nationId: string;
  nationName: string;
}

export interface LeagueMemberLeftEntry extends TeacherLogBase {
  type: 'league_member_left';
  leagueId: string;
  leagueName: string;
  nationId: string;
  nationName: string;
}

export interface LeagueThreatenedEntry extends TeacherLogBase {
  type: 'league_threatened';
  leagueId: string;
  leagueName: string;
  attackerSlotId: string;
  defenderSlotId: string;
  defenderNationName: string;
  warId: string;
}

export interface UnMeetingClosedEntry extends TeacherLogBase {
  type: 'un_meeting_closed';
  meetingId: string;
  agenda: string;
  winningOptionIndex: number;
  winningOption: string;
  voteCounts: number[];
  totalVotes: number;
}

export type TeacherLogEntry =
  | WarDeclaredEntry
  | NationFormedEntry
  | NationDissolvedEntry
  | LeagueFormedEntry
  | LeagueDissolvedEntry
  | LeagueMemberJoinedEntry
  | LeagueMemberLeftEntry
  | LeagueThreatenedEntry
  | UnMeetingClosedEntry;
