import { project } from './projection';

export interface ProjectedFeature {
  regionId: string;
  name: string;
  culturalGroup: string;
  rings: number[][]; // outer rings, flat [x, y, x, y, ...] per polygon part
  centroid: { x: number; y: number };
}

function projectRing(coords: GeoJSON.Position[]): number[] {
  const flat: number[] = [];
  for (const [lon, lat] of coords) {
    const { x, y } = project(lon, lat);
    flat.push(x, y);
  }
  return flat;
}

function computeCentroid(rings: number[][]): { x: number; y: number } {
  if (rings.length === 0) return { x: 0, y: 0 };
  const ring = rings[0];
  let sumX = 0, sumY = 0, n = 0;
  for (let i = 0; i < ring.length; i += 2) {
    sumX += ring[i]; sumY += ring[i + 1]; n++;
  }
  return { x: sumX / n, y: sumY / n };
}

export function projectFeatures(geojson: GeoJSON.FeatureCollection): ProjectedFeature[] {
  const result: ProjectedFeature[] = [];

  for (const feature of geojson.features) {
    const p = feature.properties as {
      regionId?: string; name?: string; culturalGroup?: string;
    } | null;
    if (!p?.regionId) continue;

    const rings: number[][] = [];
    const geom = feature.geometry;
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) continue;

    if (geom.type === 'Polygon') {
      rings.push(projectRing((geom as GeoJSON.Polygon).coordinates[0]));
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of (geom as GeoJSON.MultiPolygon).coordinates) {
        rings.push(projectRing(poly[0]));
      }
    }

    result.push({
      regionId: p.regionId,
      name: p.name ?? p.regionId,
      culturalGroup: p.culturalGroup ?? 'other',
      rings,
      centroid: computeCentroid(rings),
    });
  }

  return result;
}
