import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface RegionFeature extends GeoJSON.Feature<GeoJSON.Geometry> {
  properties: { regionId: string };
}

interface PickRegionLayerProps {
  geojson: GeoJSON.FeatureCollection;
  takenRegionIds: Set<string>;
  selectedRegionId: string | null;
  onRegionClick: (regionId: string) => void;
}

const COLOR_AVAILABLE = '#3da9fc';
const COLOR_TAKEN = '#3a3f2e';
const COLOR_SELECTED = '#4caf7d';

export function PickRegionLayer({ geojson, takenRegionIds, selectedRegionId, onRegionClick }: PickRegionLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    layerRef.current = L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const f = feature as RegionFeature;
        const regionId = f?.properties?.regionId;
        const taken = takenRegionIds.has(regionId);
        const selected = regionId === selectedRegionId;
        return {
          fillColor: selected ? COLOR_SELECTED : taken ? COLOR_TAKEN : COLOR_AVAILABLE,
          fillOpacity: selected ? 0.65 : taken ? 0.4 : 0.35,
          color: selected ? COLOR_SELECTED : taken ? '#5a6050' : '#2a8fd0',
          weight: selected ? 2 : 1,
          interactive: !taken,
        };
      },
      onEachFeature: (feature, layer) => {
        const f = feature as RegionFeature;
        const regionId = f?.properties?.regionId;
        if (!regionId || takenRegionIds.has(regionId)) return;

        layer.on({
          mouseover: (e) => {
            if (regionId === selectedRegionId) return;
            (e.target as L.Path).setStyle({ fillOpacity: 0.6, weight: 2 });
          },
          mouseout: (e) => {
            if (regionId === selectedRegionId) return;
            (e.target as L.Path).setStyle({ fillOpacity: 0.35, weight: 1 });
          },
          click: () => onRegionClick(regionId),
        });

        const name = (f.properties as Record<string, string>).name ?? regionId;
        layer.bindTooltip(name, { sticky: true, className: 'region-tooltip' });
      },
    });

    layerRef.current.addTo(map);

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [geojson, takenRegionIds, selectedRegionId, map, onRegionClick]);

  return null;
}
