import { describe, it, expect } from 'vitest';
import {
  slugifyLeagueName,
  shouldAutoDissolveOnLeave,
  canInviteNation,
} from '../league-logic';

describe('slugifyLeagueName', () => {
  it('konverterer til lowercase og snake_case', () => {
    expect(slugifyLeagueName('Den Nordiske Pakt')).toBe('den_nordiske_pakt');
  });

  it('fjerner diakritiske tegn (åøæ)', () => {
    expect(slugifyLeagueName('Skånsk Allianse')).toBe('skansk_allianse');
  });

  it('kollapser tegn som ikke er a-z0-9 til underscore', () => {
    expect(slugifyLeagueName('NATO 2.0!!')).toBe('nato_2_0');
  });

  it('trimmer leading/trailing underscores', () => {
    expect(slugifyLeagueName('!!hello!!')).toBe('hello');
  });

  it('begrenser til 40 tegn', () => {
    const long = 'a'.repeat(60);
    expect(slugifyLeagueName(long).length).toBe(40);
  });
});

describe('shouldAutoDissolveOnLeave', () => {
  it('grunnlegger forlater → oppløs', () => {
    expect(shouldAutoDissolveOnLeave('n1', ['n1', 'n2', 'n3'], 'n1')).toBe(true);
  });

  it('vanlig medlem forlater når flere er igjen → ikke oppløs', () => {
    expect(shouldAutoDissolveOnLeave('n1', ['n1', 'n2', 'n3'], 'n2')).toBe(false);
  });

  it('siste medlem forlater (umulig hvis founder var med) — defensiv: oppløs', () => {
    expect(shouldAutoDissolveOnLeave('n1', ['n2'], 'n2')).toBe(true);
  });
});

describe('canInviteNation', () => {
  it('happy path → ok', () => {
    expect(canInviteNation({
      inviterIsFounder: true,
      targetExists: true,
      targetAlreadyMember: false,
      targetInOtherLeague: false,
    })).toEqual({ ok: true });
  });

  it('ikke grunnlegger → not_founder', () => {
    const r = canInviteNation({
      inviterIsFounder: false,
      targetExists: true,
      targetAlreadyMember: false,
      targetInOtherLeague: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_founder');
  });

  it('mål mangler → target_not_found', () => {
    const r = canInviteNation({
      inviterIsFounder: true,
      targetExists: false,
      targetAlreadyMember: false,
      targetInOtherLeague: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('target_not_found');
  });

  it('allerede medlem → already_member', () => {
    const r = canInviteNation({
      inviterIsFounder: true,
      targetExists: true,
      targetAlreadyMember: true,
      targetInOtherLeague: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already_member');
  });

  it('i annet forbund → target_in_league', () => {
    const r = canInviteNation({
      inviterIsFounder: true,
      targetExists: true,
      targetAlreadyMember: false,
      targetInOtherLeague: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('target_in_league');
  });
});
