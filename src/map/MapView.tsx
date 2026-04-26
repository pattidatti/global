import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { RegionLayer } from './RegionLayer';
import type { MapMode } from './MapModeControl';
import { ZoomController } from './ZoomController';
import { useGameStore } from '../game/store';

interface MapViewProps {
  geojson?: GeoJSON.FeatureCollection | null;
  adjacency?: Record<string, string[]>;
  flyTarget?: [number, number] | null;
  mapMode?: MapMode;
  regionColors?: Record<string, string>;
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function TileLayerWithFallback() {
  const [tilesFailed, setTilesFailed] = useState(false);
  if (tilesFailed) return null;
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      maxZoom={14}
      minZoom={2}
      eventHandlers={{ tileerror: () => setTilesFailed(true) }}
    />
  );
}

function FlyToTarget({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevKey = useRef('');
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (prevKey.current === key) return;
    prevKey.current = key;
    map.flyTo([lat, lng], 6, { duration: 1.5 });
  }, [map, lat, lng]);
  return null;
}

export function MapView({ geojson, adjacency = {}, flyTarget, mapMode, regionColors }: MapViewProps) {
  const setSelectedRegion = useGameStore(s => s.setSelectedRegion);

  return (
    <div className="relative w-full h-full" style={{ background: '#d9c89a' }}>
      <MapContainer
        center={[20, 0]}
        zoom={3}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={true}
        touchZoom={true}
        bounceAtZoomLimits={false}
        preferCanvas={true}
      >
        <TileLayerWithFallback />
        <ZoomControl position="bottomleft" />
        <ZoomController />
        <RegionLayer
          geojson={geojson ?? EMPTY_GEOJSON}
          adjacency={adjacency}
          onRegionClick={setSelectedRegion}
          mapMode={mapMode}
          regionColors={regionColors}
        />
        {flyTarget && <FlyToTarget lat={flyTarget[0]} lng={flyTarget[1]} />}
      </MapContainer>
    </div>
  );
}
