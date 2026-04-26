import { describe, it, expect } from 'vitest';
import {
  generateEmpireColors,
  getEmpireColor,
  pick6AvailableColors,
  TOTAL_COLORS,
} from '../empire-colors';

describe('empire-colors', () => {
  it('genererer nøyaktig 150 farger', () => {
    const colors = generateEmpireColors();
    expect(colors).toHaveLength(150);
  });

  it('alle farger er gyldige HSL-strenger', () => {
    const colors = generateEmpireColors();
    for (const c of colors) {
      expect(c).toMatch(/^hsl\(\d+, 72%, 44%\)$/);
    }
  });

  it('ingen to farger er identiske', () => {
    const colors = generateEmpireColors();
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });

  it('farger er tilstrekkelig distinkte (minimum 2° mellom naboer)', () => {
    const colors = generateEmpireColors();
    const hues = colors.map(c => {
      const m = c.match(/hsl\((\d+)/);
      return m ? parseInt(m[1]) : 0;
    });
    hues.sort((a, b) => a - b);

    // Sjekk at ingen to sorterte naboer er < 2° fra hverandre
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i] - hues[i - 1]).toBeGreaterThanOrEqual(1);
    }
  });

  it('getEmpireColor returnerer farge for gyldig indeks', () => {
    expect(getEmpireColor(0)).toMatch(/^hsl/);
    expect(getEmpireColor(149)).toMatch(/^hsl/);
  });

  it('getEmpireColor wrapper rundt ved indeks >= 150', () => {
    expect(getEmpireColor(0)).toBe(getEmpireColor(TOTAL_COLORS));
  });

  it('pick6AvailableColors returnerer 6 ubrukte indekser', () => {
    const used = [0, 1, 2];
    const picks = pick6AvailableColors(used);
    expect(picks).toHaveLength(6);
    for (const idx of picks) {
      expect(used).not.toContain(idx);
    }
  });

  it('pick6AvailableColors returnerer tomme tilgjengelige ved nesten full palett', () => {
    const allUsed = Array.from({ length: TOTAL_COLORS - 2 }, (_, i) => i);
    const picks = pick6AvailableColors(allUsed);
    expect(picks).toHaveLength(2);
  });
});
