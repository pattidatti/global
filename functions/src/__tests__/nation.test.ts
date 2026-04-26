import { describe, it, expect } from 'vitest';
import {
  isContiguous,
  computeCultureMatch,
  slugifyNationName,
  MIN_REGIONS_FOR_NATION,
  MIN_CULTURE_MATCH,
} from '../nation-logic';

describe('isContiguous', () => {
  // Et lite, kjent geografi-utsnitt — adjacency er en symmetrisk graf
  const adjacency: Record<string, string[]> = {
    a: ['b'],
    b: ['a', 'c'],
    c: ['b', 'd'],
    d: ['c'],
    e: ['f'], // helt isolert komponent
    f: ['e'],
  };

  it('5 sammenhengende regioner returnerer true', () => {
    // a-b-c-d danner kjede, så ekstra noden e+f ville bryte. Gjør 4 sammenhengende.
    expect(isContiguous(['a', 'b', 'c', 'd'], adjacency)).toBe(true);
  });

  it('regioner i to atskilte komponenter returnerer false', () => {
    expect(isContiguous(['a', 'b', 'e', 'f'], adjacency)).toBe(false);
  });

  it('én region er trivielt sammenhengende', () => {
    expect(isContiguous(['a'], adjacency)).toBe(true);
  });

  it('tom liste regnes som ikke-sammenhengende', () => {
    expect(isContiguous([], adjacency)).toBe(false);
  });
});

describe('computeCultureMatch', () => {
  it('alle samme kultur → 100 % match', () => {
    const r = [
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
    ];
    const { dominantCulture, matchPct } = computeCultureMatch(r);
    expect(dominantCulture).toBe('nordic');
    expect(matchPct).toBe(1);
  });

  it('4 av 5 samme kultur → 80 % match', () => {
    const r = [
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
      { culturalGroup: 'germanic' },
    ];
    const { dominantCulture, matchPct } = computeCultureMatch(r);
    expect(dominantCulture).toBe('nordic');
    expect(matchPct).toBe(0.8);
  });

  it('3 av 5 samme kultur → under terskel', () => {
    const r = [
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
      { culturalGroup: 'nordic' },
      { culturalGroup: 'germanic' },
      { culturalGroup: 'slavic' },
    ];
    const { matchPct } = computeCultureMatch(r);
    expect(matchPct).toBe(0.6);
    expect(matchPct).toBeLessThan(MIN_CULTURE_MATCH);
  });

  it('manglende culturalGroup faller tilbake til "other"', () => {
    const r = [{ culturalGroup: undefined }, { culturalGroup: undefined }];
    const { dominantCulture, matchPct } = computeCultureMatch(r);
    expect(dominantCulture).toBe('other');
    expect(matchPct).toBe(1);
  });

  it('tom liste returnerer 0', () => {
    expect(computeCultureMatch([])).toEqual({ dominantCulture: 'other', matchPct: 0 });
  });
});

describe('slugifyNationName', () => {
  it('lowercase + bindestrek mellom ord', () => {
    expect(slugifyNationName('Norge')).toBe('norge');
    expect(slugifyNationName('Det norske rike')).toBe('det-norske-rike');
  });

  it('fjerner spesialtegn', () => {
    expect(slugifyNationName('Côte d\'Ivoire!')).toBe('cote-divoire');
  });

  it('trimmer mellomrom', () => {
    expect(slugifyNationName('  Sverige  ')).toBe('sverige');
  });

  it('to nasjoner med samme navn → samme slug (sjekkes som duplikat i transaction)', () => {
    expect(slugifyNationName('Norge')).toBe(slugifyNationName('NORGE'));
    expect(slugifyNationName('Norge')).toBe(slugifyNationName('  norge '));
  });
});

describe('konstanter', () => {
  it('MIN_REGIONS_FOR_NATION = 5 (per IMPLEMENTATION_PLAN §0)', () => {
    expect(MIN_REGIONS_FOR_NATION).toBe(5);
  });

  it('MIN_CULTURE_MATCH = 0.7 (per IMPLEMENTATION_PLAN §0)', () => {
    expect(MIN_CULTURE_MATCH).toBeCloseTo(0.7);
  });
});
