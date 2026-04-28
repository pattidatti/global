// Returns Leaflet [lat, lng] positions for N buildings spread in a circle around a region centroid.
// centroidLngLat: [lng, lat] from regions-meta.json (GeoJSON order — reversed here for Leaflet)
export function getBuildingPositions(
  centroidLngLat: [number, number],
  count: number
): [number, number][] {
  if (count === 0) return [];
  const [lng, lat] = centroidLngLat;
  const radius = 0.22;

  if (count === 1) {
    return [[lat + radius * 0.4, lng]];
  }

  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return [lat + Math.cos(angle) * radius, lng + Math.sin(angle) * radius] as [number, number];
  });
}
