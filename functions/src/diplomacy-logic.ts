// Rene helpers for diplomati — ingen Firebase-import.

import type { DiplomacyStatus } from './types';

/**
 * Kanonisk nøkkel for et diplomati-par. Sortert alfabetisk slik at
 * (a, b) og (b, a) gir samme nøkkel. Brukes som RTDB-key under
 * /games/{gameId}/diplomacy/{key}.
 */
export function pairKey(a: string, b: string): string {
  if (a === b) throw new Error('pairKey krever to forskjellige slotIds');
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/**
 * Sjekk om en status-overgang er gyldig.
 *
 * Tillatte overganger:
 *   neutral        → pending-alliance, war
 *   pending-alliance → alliance, neutral (avbryt)
 *   alliance       → neutral (bryt), war (utenfor scope MVP)
 *   war            → neutral (våpenhvile)
 */
export function canTransition(from: DiplomacyStatus, to: DiplomacyStatus): boolean {
  switch (from) {
    case 'neutral':
      return to === 'pending-alliance' || to === 'war';
    case 'pending-alliance':
      return to === 'alliance' || to === 'neutral';
    case 'alliance':
      return to === 'neutral' || to === 'war';
    case 'war':
      return to === 'neutral';
    case 'trade':
      return to === 'neutral' || to === 'pending-alliance' || to === 'war';
  }
}

/**
 * Beregn passive influence-gain per makro-tikk for en spiller.
 *
 * Formula (forenklet for MVP):
 *   base    = floor(regionsCount / 2)
 *   bonus   = +2 per allianse
 *   nation  = +3 hvis spilleren er medlem av en nasjon
 *
 * Returnerer en mengde >= 0 å legge til player.influence.
 */
export function computeInfluenceGain(args: {
  regionCount: number;
  allianceCount: number;
  hasNation: boolean;
}): number {
  const base = Math.floor(args.regionCount / 2);
  const allyBonus = args.allianceCount * 2;
  const nationBonus = args.hasNation ? 3 : 0;
  return base + allyBonus + nationBonus;
}

/**
 * Tell antall aktive allianser en spiller har, gitt hele diplomacy-mappen.
 */
export function countAlliancesForSlot(
  slotId: string,
  diplomacy: Record<string, { status: DiplomacyStatus }>,
): number {
  let count = 0;
  for (const [key, d] of Object.entries(diplomacy)) {
    if (d.status !== 'alliance') continue;
    const [a, b] = key.split('__');
    if (a === slotId || b === slotId) count++;
  }
  return count;
}
