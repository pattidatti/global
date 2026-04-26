const REGION_PALETTE = [
  '#7fbcd2',
  '#8ab87a',
  '#e8c87a',
  '#d4826a',
  '#9b8dc8',
  '#60b898',
  '#e890a0',
  '#a8b8c8',
];

export function computeGraphColoring(
  adjacency: Record<string, string[]>,
): Record<string, string> {
  const coloring: Record<string, string> = {};
  for (const regionId of Object.keys(adjacency).sort()) {
    const usedColors = new Set(
      (adjacency[regionId] ?? []).map(n => coloring[n]).filter(Boolean)
    );
    coloring[regionId] = REGION_PALETTE.find(c => !usedColors.has(c)) ?? REGION_PALETTE[0];
  }
  return coloring;
}
