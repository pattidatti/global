// Golden-ratio HSL palette — 150 visually distinct empire colors
// Tuned for legibility on a cream/parchment background:
//   - lower lightness so colors don't wash out against bg #ede2c4
//   - higher saturation for crisp, ink-like recognizability
const GOLDEN_RATIO = 0.6180339887;
const TOTAL_COLORS = 150;
const SATURATION = 72;
const LIGHTNESS = 44;

export function generateEmpireColors(): string[] {
  const colors: string[] = [];
  let h = 0;
  for (let i = 0; i < TOTAL_COLORS; i++) {
    h = (h + GOLDEN_RATIO) % 1;
    colors.push(`hsl(${Math.round(h * 360)}, ${SATURATION}%, ${LIGHTNESS}%)`);
  }
  return colors;
}

const EMPIRE_COLORS = generateEmpireColors();

export function getEmpireColor(idx: number): string {
  return EMPIRE_COLORS[idx % EMPIRE_COLORS.length];
}

export function getAvailableColorIndices(usedIndices: number[]): number[] {
  const used = new Set(usedIndices);
  return Array.from({ length: TOTAL_COLORS }, (_, i) => i).filter(i => !used.has(i));
}

export function pick6AvailableColors(usedIndices: number[]): number[] {
  return getAvailableColorIndices(usedIndices).slice(0, 6);
}

export { EMPIRE_COLORS, TOTAL_COLORS };
