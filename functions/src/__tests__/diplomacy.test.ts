import { describe, it, expect } from 'vitest';
import {
  pairKey,
  canTransition,
  computeInfluenceGain,
  countAlliancesForSlot,
} from '../diplomacy-logic';

describe('pairKey', () => {
  it('symmetrisk uavhengig av rekkefølge', () => {
    expect(pairKey('alice', 'bob')).toBe('alice__bob');
    expect(pairKey('bob', 'alice')).toBe('alice__bob');
  });

  it('alfabetisk a < b', () => {
    expect(pairKey('z', 'a')).toBe('a__z');
  });

  it('kaster feil hvis a === b', () => {
    expect(() => pairKey('x', 'x')).toThrow();
  });
});

describe('canTransition', () => {
  it('neutral → pending-alliance er tillatt', () => {
    expect(canTransition('neutral', 'pending-alliance')).toBe(true);
  });
  it('pending-alliance → alliance er tillatt', () => {
    expect(canTransition('pending-alliance', 'alliance')).toBe(true);
  });
  it('pending-alliance → neutral er tillatt (avbryt)', () => {
    expect(canTransition('pending-alliance', 'neutral')).toBe(true);
  });
  it('alliance → neutral er tillatt (bryt)', () => {
    expect(canTransition('alliance', 'neutral')).toBe(true);
  });
  it('war → neutral er tillatt (våpenhvile)', () => {
    expect(canTransition('war', 'neutral')).toBe(true);
  });
  it('neutral → alliance er IKKE tillatt direkte (krever pending)', () => {
    expect(canTransition('neutral', 'alliance')).toBe(false);
  });
  it('alliance → pending-alliance er ugyldig', () => {
    expect(canTransition('alliance', 'pending-alliance')).toBe(false);
  });
});

describe('computeInfluenceGain', () => {
  it('base = floor(regionCount / 2)', () => {
    expect(computeInfluenceGain({ regionCount: 6, allianceCount: 0, hasNation: false })).toBe(3);
    expect(computeInfluenceGain({ regionCount: 7, allianceCount: 0, hasNation: false })).toBe(3);
  });
  it('+2 per allianse', () => {
    expect(computeInfluenceGain({ regionCount: 0, allianceCount: 3, hasNation: false })).toBe(6);
  });
  it('+3 hvis nasjon dannet', () => {
    expect(computeInfluenceGain({ regionCount: 0, allianceCount: 0, hasNation: true })).toBe(3);
  });
  it('kombinerer alle', () => {
    expect(computeInfluenceGain({ regionCount: 10, allianceCount: 2, hasNation: true })).toBe(5 + 4 + 3);
  });
});

describe('countAlliancesForSlot', () => {
  it('teller bare alliance-status og bare for relevante par', () => {
    const dipl = {
      'alice__bob':   { status: 'alliance' as const },
      'alice__chris': { status: 'pending-alliance' as const },
      'bob__chris':   { status: 'alliance' as const },
      'alice__dave':  { status: 'war' as const },
    };
    expect(countAlliancesForSlot('alice', dipl)).toBe(1);
    expect(countAlliancesForSlot('bob', dipl)).toBe(2);
    expect(countAlliancesForSlot('chris', dipl)).toBe(1);
    expect(countAlliancesForSlot('dave', dipl)).toBe(0);
  });

  it('returnerer 0 ved tom diplomacy', () => {
    expect(countAlliancesForSlot('alice', {})).toBe(0);
  });
});
