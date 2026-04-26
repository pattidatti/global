import { describe, it, expect } from 'vitest';
import { validateAgenda, summarizeVotes } from '../un-logic';

describe('validateAgenda', () => {
  it('happy path med 3 alternativer', () => {
    const r = validateAgenda('Skal vi sanksjonere?', ['Ja', 'Nei', 'Avstå']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.agenda).toBe('Skal vi sanksjonere?');
      expect(r.options).toEqual(['Ja', 'Nei', 'Avstå']);
    }
  });

  it('trimmer whitespace', () => {
    const r = validateAgenda('  Hei du  ', ['  Ja  ', 'Nei']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.agenda).toBe('Hei du');
      expect(r.options[0]).toBe('Ja');
    }
  });

  it('agenda < 5 tegn → too_short', () => {
    const r = validateAgenda('Hei', ['a', 'b']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('agenda_too_short');
  });

  it('agenda > 500 tegn → too_long', () => {
    const r = validateAgenda('a'.repeat(501), ['a', 'b']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('agenda_too_long');
  });

  it('< 2 alternativer → too_few', () => {
    const r = validateAgenda('Hei du', ['kun ett']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_few_options');
  });

  it('> 4 alternativer → too_many', () => {
    const r = validateAgenda('Hei du', ['a', 'b', 'c', 'd', 'e']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_many_options');
  });

  it('tomt alternativ → option_invalid', () => {
    const r = validateAgenda('Hei du', ['ja', '']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('option_invalid');
  });

  it('alternativ > 80 tegn → option_invalid', () => {
    const r = validateAgenda('Hei du', ['ja', 'a'.repeat(81)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('option_invalid');
  });

  it('options ikke array → too_few', () => {
    const r = validateAgenda('Hei du', 'not array');
    expect(r.ok).toBe(false);
  });
});

describe('summarizeVotes', () => {
  it('teller stemmer korrekt', () => {
    const r = summarizeVotes({ n1: 0, n2: 0, n3: 1 }, 3);
    expect(r.counts).toEqual([2, 1, 0]);
    expect(r.total).toBe(3);
    expect(r.winningIndex).toBe(0);
  });

  it('ingen stemmer → winningIndex = -1', () => {
    const r = summarizeVotes(undefined, 3);
    expect(r.counts).toEqual([0, 0, 0]);
    expect(r.total).toBe(0);
    expect(r.winningIndex).toBe(-1);
  });

  it('ignorerer ugyldig optionIndex', () => {
    const r = summarizeVotes({ n1: 0, n2: 99, n3: -1 }, 3);
    expect(r.total).toBe(1);
    expect(r.counts).toEqual([1, 0, 0]);
  });

  it('uavgjort tar første høyeste', () => {
    const r = summarizeVotes({ n1: 0, n2: 1 }, 3);
    expect(r.winningIndex).toBe(0);
  });
});
