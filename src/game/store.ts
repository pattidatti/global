import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameMeta } from '../types/game';
import type { Region } from '../types/region';
import type { Player } from '../types/player';
import type { Nation } from '../types/nation';
import type { Diplomacy } from '../types/diplomacy';
import type { War, Unit } from '../types/war';

export type ActiveScreen = 'map' | 'market' | 'diplomacy' | 'war' | 'events';

interface GameStore {
  // Auth
  uid: string | null;
  slotId: string | null;
  isTeacher: boolean;
  displayName: string | null;

  // Game
  gameId: string | null;
  meta: GameMeta | null;

  // Data
  regions: Record<string, Region>;
  players: Record<string, Player>;
  nations: Record<string, Nation>;
  diplomacy: Record<string, Diplomacy>;
  wars: Record<string, War>;
  units: Record<string, Unit>;

  // UI
  activeScreen: ActiveScreen;
  selectedRegionId: string | null;
  schemaVersionMismatch: boolean;

  // Optimistisk UI — operasjoner som er in-flight
  pendingHarvests: Set<string>;   // buildingIds
  pendingBuilds: Set<string>;     // regionIds
  pendingExpansions: Set<string>; // regionIds

  // Actions
  setAuth: (uid: string, slotId: string, isTeacher: boolean, displayName?: string | null) => void;
  setGameId: (gameId: string) => void;
  setMeta: (meta: GameMeta) => void;
  setRegions: (regions: Record<string, Region>) => void;
  updateRegion: (regionId: string, region: Region) => void;
  setPlayers: (players: Record<string, Player>) => void;
  updatePlayer: (slotId: string, player: Player) => void;
  setNations: (nations: Record<string, Nation>) => void;
  setDiplomacy: (diplomacy: Record<string, Diplomacy>) => void;
  setWars: (wars: Record<string, War>) => void;
  setUnits: (units: Record<string, Unit>) => void;
  setActiveScreen: (screen: ActiveScreen) => void;
  setSelectedRegion: (regionId: string | null) => void;
  setSchemaVersionMismatch: (v: boolean) => void;
  setPendingHarvest: (buildingId: string, pending: boolean) => void;
  setPendingBuild: (regionId: string, pending: boolean) => void;
  setPendingExpansion: (regionId: string, pending: boolean) => void;
  reset: () => void;
}

const initialState = {
  uid: null,
  slotId: null,
  isTeacher: false,
  displayName: null,
  gameId: null,
  meta: null,
  regions: {},
  players: {},
  nations: {},
  diplomacy: {},
  wars: {},
  units: {},
  activeScreen: 'map' as ActiveScreen,
  selectedRegionId: null,
  schemaVersionMismatch: false,
  pendingHarvests: new Set<string>(),
  pendingBuilds: new Set<string>(),
  pendingExpansions: new Set<string>(),
};

export const useGameStore = create<GameStore>()(
  persist(
    set => ({
      ...initialState,

      setAuth: (uid, slotId, isTeacher, displayName) => set({ uid, slotId, isTeacher, displayName: displayName ?? null }),
      setGameId: gameId => set({ gameId }),
      setMeta: meta => set({ meta }),
      setRegions: regions => set({ regions }),
      updateRegion: (regionId, region) =>
        set(state => ({ regions: { ...state.regions, [regionId]: region } })),
      setPlayers: players => set({ players }),
      updatePlayer: (slotId, player) =>
        set(state => ({ players: { ...state.players, [slotId]: player } })),
      setNations: nations => set({ nations }),
      setDiplomacy: diplomacy => set({ diplomacy }),
      setWars: wars => set({ wars }),
      setUnits: units => set({ units }),
      setActiveScreen: activeScreen => set({ activeScreen }),
      setSelectedRegion: selectedRegionId => set({ selectedRegionId }),
      setSchemaVersionMismatch: schemaVersionMismatch => set({ schemaVersionMismatch }),
      setPendingHarvest: (buildingId, pending) =>
        set(state => {
          const next = new Set(state.pendingHarvests);
          if (pending) next.add(buildingId); else next.delete(buildingId);
          return { pendingHarvests: next };
        }),
      setPendingBuild: (regionId, pending) =>
        set(state => {
          const next = new Set(state.pendingBuilds);
          if (pending) next.add(regionId); else next.delete(regionId);
          return { pendingBuilds: next };
        }),
      setPendingExpansion: (regionId, pending) =>
        set(state => {
          const next = new Set(state.pendingExpansions);
          if (pending) next.add(regionId); else next.delete(regionId);
          return { pendingExpansions: next };
        }),
      reset: () => set(initialState),
    }),
    {
      name: 'geopolity-session',
      partialize: state => ({
        uid: state.uid,
        slotId: state.slotId,
        isTeacher: state.isTeacher,
        displayName: state.displayName,
        gameId: state.gameId,
      }),
    }
  )
);

