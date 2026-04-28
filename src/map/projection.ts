export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 2048;

const RAD = Math.PI / 180;

// lon/lat → world pixel (Web Mercator, same projection as Leaflet)
export function project(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * WORLD_WIDTH;
  const latR = Math.max(-89.9, Math.min(89.9, lat)) * RAD;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latR / 2));
  const y = WORLD_HEIGHT / 2 - (WORLD_WIDTH * mercN) / (2 * Math.PI);
  return { x, y };
}

export function unproject(x: number, y: number): { lon: number; lat: number } {
  const lon = (x / WORLD_WIDTH) * 360 - 180;
  const mercN = ((WORLD_HEIGHT / 2 - y) * 2 * Math.PI) / WORLD_WIDTH;
  const lat = ((2 * Math.atan(Math.exp(mercN))) - Math.PI / 2) / RAD;
  return { lon, lat };
}
