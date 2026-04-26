import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGameStore } from '../game/store';
import { regionPathOptions } from './styles';
import type { Region } from '../types/region';
import type { MapMode } from './MapModeControl';

// Victoria 3-inspirert politisk kart-palett per kulturgruppe
const NPC_GROUP_COLORS: Record<string, string> = {
  'nordic':        '#7fbcd2',
  'germanic':      '#a8b8c8',
  'anglo':         '#5a9eb8',
  'slavic':        '#8ab87a',
  'latin':         '#e8c87a',
  'mediterranean': '#e0a870',
  'arabic':        '#d4b870',
  'north-african': '#d8c060',
  'sub-saharan':   '#9ac870',
  'ethiopian':     '#78b890',
  'sinitic':       '#d87070',
  'indochinese':   '#e8a070',
  'malay':         '#d8a860',
  'japanic':       '#e890a0',
  'korean':        '#a890c8',
  'indic':         '#e8d060',
  'persian':       '#b89050',
  'central-asian': '#a8b898',
  'turkic':        '#60b898',
  'andean':        '#9070b8',
  'polynesian':    '#60a8c0',
  'other':         '#a8a898',
};

interface RegionFeature extends GeoJSON.Feature<GeoJSON.Geometry> {
  properties: {
    regionId: string;
    culturalGroup?: string;
    name?: string;
    biome?: string;
  };
}

interface RegionLayerProps {
  geojson: GeoJSON.FeatureCollection;
  adjacency?: Record<string, string[]>;
  onRegionClick?: (regionId: string) => void;
  mapMode?: MapMode;
  regionColors?: Record<string, string>;
}

export function RegionLayer({ geojson, adjacency = {}, onRegionClick, mapMode, regionColors }: RegionLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const layerMapRef = useRef<Map<string, L.Path>>(new Map());
  // Lagrer kulturgruppe per regionId fra GeoJSON-properties (satt under onEachFeature)
  const culturalGroupRef = useRef<Map<string, string>>(new Map());
  const mapModeRef = useRef<MapMode>(mapMode ?? 'region');
  mapModeRef.current = mapMode ?? 'region';
  const regionColorsRef = useRef<Record<string, string>>(regionColors ?? {});
  regionColorsRef.current = regionColors ?? {};
  const { regions, slotId, selectedRegionId, nations } = useGameStore();

  function getState(_regionId: string, region: Region | undefined) {
    if (!region) return 'npc' as const;
    if (region.contestedAt) return 'contested' as const;
    if (region.ownerId === slotId) return 'mine' as const;
    if (region.ownerId) return 'owned' as const;
    return 'npc' as const;
  }

  function getEmpireColor(region: Region | undefined): string | undefined {
    if (!region?.ownerId) return undefined;
    const { players } = useGameStore.getState();
    return players[region.ownerId]?.empireColor;
  }

  function getNationOverlay(region: Region | undefined): { color: string; weight: number } | null {
    if (!region?.nationId) return null;
    const nation = nations[region.nationId];
    if (!nation) return null;
    return { color: nation.color, weight: 2.5 };
  }

  function getIntegrationColor(region: Region, empireColor: string): string {
    if (region.integration >= 100 || !region.integrationStartedAt) return empireColor;
    void (region.integration / 100);
    return empireColor;
  }

  // Slår opp kulturgruppe-farge for NPC-regioner
  function getNpcFillColor(regionId: string, region: Region | undefined): string {
    const group = region?.culturalGroup ?? culturalGroupRef.current.get(regionId);
    return NPC_GROUP_COLORS[group ?? 'other'] ?? NPC_GROUP_COLORS.other;
  }

  // Returnerer fyllfarge basert på aktiv kartmodus
  function getFillColor(
    regionId: string,
    region: Region | undefined,
    state: ReturnType<typeof getState>,
    empireColor: string | undefined,
  ): string {
    const mode = mapModeRef.current;
    const isOwned = state === 'mine' || state === 'owned';

    if (mode === 'culture') {
      return getNpcFillColor(regionId, region);
    }
    if (mode === 'empire' || mode === 'region') {
      if (isOwned && empireColor) return empireColor;
      if (mode === 'region') {
        return regionColorsRef.current[regionId] ?? getNpcFillColor(regionId, region);
      }
      return getNpcFillColor(regionId, region);
    }
    return getNpcFillColor(regionId, region);
  }

  useEffect(() => {
    const canvas = L.canvas();
    const layerMap = layerMapRef.current;
    layerMap.clear();
    culturalGroupRef.current.clear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      renderer: canvas,
      style: (feature: GeoJSON.Feature | undefined) => {
        const f = feature as RegionFeature;
        const regionId = f.properties.regionId;
        const region = regions[regionId];
        const state = getState(regionId, region);
        const empireColor = getEmpireColor(region);
        const nationOverlay = getNationOverlay(region);

        const resolvedEmpire = empireColor ? getIntegrationColor(region!, empireColor) : empireColor;
        const baseStyle = regionPathOptions(state, resolvedEmpire);
        baseStyle.fillColor = getFillColor(regionId, region, state, resolvedEmpire);

        let fillOpacity: number | undefined;
        if (region?.ownerId === slotId && region.integrationStartedAt !== null) {
          fillOpacity = 0.55 + (region.integration / 100) * 0.37;
        }

        return {
          ...baseStyle,
          ...(fillOpacity !== undefined ? { fillOpacity } : {}),
          ...(nationOverlay ?? {}),
        };
      },
      onEachFeature: (feature: GeoJSON.Feature, lyr: L.Layer) => {
        const f = feature as RegionFeature;
        const regionId = f.properties.regionId;
        // Lagre kulturgruppe for bruk i style-oppdateringer
        if (f.properties.culturalGroup) {
          culturalGroupRef.current.set(regionId, f.properties.culturalGroup);
        }
        lyr.on('click', () => onRegionClick?.(regionId));
        (lyr as L.Path).bindTooltip(f.properties.name ?? regionId, { sticky: true, className: 'region-tooltip' });
        layerMapRef.current.set(regionId, lyr as L.Path);
      },
    };

    const layer = L.geoJSON(geojson, options);
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layer.remove();
      layerMap.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geojson]);

  // Pulserende rød animasjon for omstridte regioner
  useEffect(() => {
    const contestedIds = Object.entries(regions)
      .filter(([, r]) => r.contestedAt != null)
      .map(([id]) => id);
    if (contestedIds.length === 0) return;

    const id = setInterval(() => {
      const t = Date.now() / 600;
      const opacity = 0.35 + 0.4 * Math.abs(Math.sin(t));
      for (const rid of contestedIds) {
        const lyr = layerMapRef.current.get(rid);
        if (lyr) lyr.setStyle({ fillOpacity: opacity });
      }
    }, 100);
    return () => clearInterval(id);
  }, [regions]);

  const styleSignature = useMemo(() => {
    const parts: string[] = [];
    for (const [id, r] of Object.entries(regions)) {
      parts.push(
        `${id}:${r.ownerId ?? ''}:${Math.floor(r.integration ?? 0)}:${r.integrationStartedAt ?? ''}:${r.contestedAt ?? ''}:${r.nationId ?? ''}`,
      );
    }
    return parts.join('|');
  }, [regions]);

  // Batched stil-oppdatering ved data-endringer
  useEffect(() => {
    if (!layerRef.current) return;

    const neighborIds = selectedRegionId ? new Set(adjacency[selectedRegionId] ?? []) : new Set<string>();

    layerMapRef.current.forEach((lyr, regionId) => {
      const region = regions[regionId];

      if (neighborIds.has(regionId)) {
        lyr.setStyle(regionPathOptions('neighbor'));
        return;
      }

      const state = getState(regionId, region);
      const empireColor = getEmpireColor(region);
      const nationOverlay = getNationOverlay(region);

      const baseStyle = regionPathOptions(state, empireColor);
      baseStyle.fillColor = getFillColor(regionId, region, state, empireColor);

      let fillOpacity: number | undefined;
      if (region?.ownerId === slotId && region.integrationStartedAt !== null) {
        fillOpacity = 0.55 + (region.integration / 100) * 0.37;
      }

      lyr.setStyle({
        ...baseStyle,
        ...(fillOpacity !== undefined ? { fillOpacity } : {}),
        ...(nationOverlay ?? {}),
      });
    });
  }, [styleSignature, slotId, selectedRegionId, adjacency, nations, mapMode, regionColors]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
