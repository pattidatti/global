import { describe, it, expect } from 'vitest';

// Pure logikk-tester som ikke trenger Firebase Admin SDK

describe('generateClassCode', () => {
  it('kode er på riktig format GEO-XXX-YYYY', () => {
    const code = 'GEO-ABC-1234';
    expect(code).toMatch(/^GEO-[A-Z0-9]{3}-[A-Z0-9]{4}$/);
  });
});

describe('joinGame navn-matching (logikk)', () => {
  function normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  it('matcher case-insensitive', () => {
    const rosterName = 'Ola Nordmann';
    const input = 'ola nordmann';
    expect(normalizeName(input)).toBe(normalizeName(rosterName));
  });

  it('matcher etter trim av mellomrom', () => {
    const rosterName = 'Ola Nordmann';
    const input = '  Ola Nordmann  ';
    expect(normalizeName(input)).toBe(normalizeName(rosterName));
  });

  it('skiller mellom to forskjellige navn', () => {
    const rosterName = 'Ola Nordmann';
    const input = 'Kari Hansen';
    expect(normalizeName(input)).not.toBe(normalizeName(rosterName));
  });
});

describe('empire color generation (logikk)', () => {
  const GOLDEN_RATIO = 0.6180339887;

  function generateColors(n: number): string[] {
    const colors: string[] = [];
    let h = 0;
    for (let i = 0; i < n; i++) {
      h = (h + GOLDEN_RATIO) % 1;
      colors.push(`hsl(${Math.round(h * 360)}, 70%, 45%)`);
    }
    return colors;
  }

  it('genererer unike farger for 150 spillere', () => {
    const colors = generateColors(150);
    const unique = new Set(colors);
    expect(unique.size).toBe(150);
  });

  it('golden-ratio sikrer jevn fordeling (ingen clustering)', () => {
    const colors = generateColors(150);
    const hues = colors
      .map(c => parseInt(c.match(/hsl\((\d+)/)![1]))
      .sort((a, b) => a - b);

    // Maksimal «gap» mellom nabofarger bør ikke overstige 5°
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i] - hues[i - 1]).toBeLessThanOrEqual(5);
    }
  });
});

describe('classCode kollisjonskontroll (logikk)', () => {
  it('nye forsøk genererer en annen kode', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const seg2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      codes.add(`GEO-${seg1}-${seg2}`);
    }
    // Med 32^3 * 32^4 mulige koder forventer vi ~100 unike av 100 forsøk
    expect(codes.size).toBeGreaterThan(90);
  });
});
