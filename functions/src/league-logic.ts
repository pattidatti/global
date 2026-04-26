/**
 * Pure helpers for league.ts — testbar uten RTDB-roundtrips.
 */

export function slugifyLeagueName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Avgjør om et leaveLeague-kall skal trigge full oppløsing av forbundet.
 * Returnerer true hvis nasjonen som forlater er grunnleggeren, eller
 * hvis det ikke ville være medlemmer igjen etter at den forlater.
 */
export function shouldAutoDissolveOnLeave(
  founderNationId: string,
  memberNationIds: string[],
  leavingNationId: string,
): boolean {
  if (leavingNationId === founderNationId) return true;
  const remaining = memberNationIds.filter(id => id !== leavingNationId);
  return remaining.length < 1;
}

/**
 * Validerer at en nasjon kan inviteres til et forbund.
 */
export function canInviteNation(args: {
  inviterIsFounder: boolean;
  targetExists: boolean;
  targetAlreadyMember: boolean;
  targetInOtherLeague: boolean;
}): { ok: true } | { ok: false; reason: 'not_founder' | 'target_not_found' | 'already_member' | 'target_in_league' } {
  if (!args.inviterIsFounder)   return { ok: false, reason: 'not_founder' };
  if (!args.targetExists)       return { ok: false, reason: 'target_not_found' };
  if (args.targetAlreadyMember) return { ok: false, reason: 'already_member' };
  if (args.targetInOtherLeague) return { ok: false, reason: 'target_in_league' };
  return { ok: true };
}
