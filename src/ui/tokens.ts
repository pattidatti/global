// Parchment / atlas palette — warm cream backgrounds, sepia ink, copper accents
export const colors = {
  bg:        '#ede2c4',  // warm parchment
  panel:     '#fbf6e9',  // lighter parchment (card surface)
  panelEdge: '#a08562',  // sepia/brown border
  ink:       '#2a1f12',  // deep brown (primary text)
  inkLo:     '#6b5a45',  // warm grey (secondary text)
  accent:    '#a85a2a',  // copper (links, primary action)
  good:      '#3f6b3f',  // forest green
  warn:      '#c47e1f',  // amber
  danger:    '#9a2a2a',  // wax-seal red
  npc:       '#8a8a6a',  // muted sage
  // Legacy aliases — keep so feature code referencing textHi/textLo doesn't break
  textHi:    '#2a1f12',
  textLo:    '#6b5a45',
} as const;

export const fonts = {
  serif: '"EB Garamond", Georgia, serif',
  sans:  'Lato, system-ui, sans-serif',
  mono:  'JetBrains Mono, monospace',
} as const;

export const spacing = {
  topBarH:    '48px',
  bottomNavH: '56px',
  panelW:     '280px',
} as const;
