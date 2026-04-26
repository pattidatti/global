import type { PathOptions } from 'leaflet';
import { colors } from '../ui/tokens';

export type RegionState = 'npc' | 'owned' | 'mine' | 'neighbor' | 'contested';

export function zoomClassName(z: number): string {
  if (z <= 4) return 'zoom-world';
  if (z <= 7) return 'zoom-nation';
  if (z <= 10) return 'zoom-region';
  return 'zoom-building';
}

export function regionPathOptions(
  state: RegionState,
  empireColor?: string,
): PathOptions {
  switch (state) {
    case 'npc':
      return {
        fillColor:   colors.npc,
        fillOpacity: 0.88,
        color:       '#7a8a6a',
        weight:      1.2,
      };
    case 'owned':
      return {
        fillColor:   empireColor ?? colors.accent,
        fillOpacity: 0.88,
        color:       '#222',
        weight:      1.5,
      };
    case 'mine':
      return {
        fillColor:   empireColor ?? colors.accent,
        fillOpacity: 0.95,
        color:       '#fff',
        weight:      3,
      };
    case 'neighbor':
      return {
        fillColor:   colors.good,
        fillOpacity: 0.25,
        color:       colors.good,
        weight:      1.5,
        dashArray:   '2 2',
      };
    case 'contested':
      return {
        fillColor:   colors.danger,
        fillOpacity: 0.5,
        color:       colors.danger,
        weight:      2,
      };
  }
}
