import { colors } from '../ui/tokens';

export type RegionState = 'npc' | 'owned' | 'mine' | 'neighbor' | 'contested';

export function zoomClassName(z: number): string {
  if (z <= 4) return 'zoom-world';
  if (z <= 7) return 'zoom-nation';
  if (z <= 10) return 'zoom-region';
  return 'zoom-building';
}

// Kept for potential future use — returns design-token color strings per region state
export function regionStateColor(state: RegionState, empireColor?: string): string {
  switch (state) {
    case 'npc':      return colors.npc;
    case 'owned':    return empireColor ?? colors.accent;
    case 'mine':     return empireColor ?? colors.accent;
    case 'neighbor': return colors.good;
    case 'contested':return colors.danger;
  }
}
