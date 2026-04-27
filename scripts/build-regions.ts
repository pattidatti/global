/**
 * build-regions.ts
 *
 * Laster Natural Earth Admin-1 GeoJSON, filtrerer, tagger biom,
 * og produserer:
 *   public/geo/regions.geojson  — brukes av Leaflet
 *   public/geo/regions-meta.json — brukes av seed-firebase.ts
 *
 * Bruk:
 *   npx tsx scripts/build-regions.ts
 *   npx tsx scripts/build-regions.ts --input path/to/ne_10m_admin_1.geojson
 *
 * Uten --input lastes dataene ned automatisk fra Natural Earth.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';
import type { Feature, Geometry, GeoJsonProperties, FeatureCollection } from 'geojson';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'geo');

// Admin-1 (stater/provinser) for de 9 største landene — lokalt cachet
const ADMIN1_CACHE_PATH = path.join(ROOT, 'data', 'ne_admin1_raw.geojson');

// Full Admin-1-datasett (alle land) — for europeisk provinsnivå-dekning
const ADMIN1_FULL_PATH = path.join(ROOT, 'data', 'ne_admin1_full.geojson');

// Admin-0 (land-nivå, global dekning) — Natural Earth 110m
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/' +
  'ne_110m_admin_0_countries.geojson';
const COUNTRIES_CACHE_PATH = path.join(ROOT, 'data', 'ne_admin0_countries.geojson');

// ISO-koder som har admin-1-dekning fra det lille datasettet (de 9 største landene)
const ADMIN1_ISOS = new Set(['AUS', 'BRA', 'CAN', 'CHN', 'IDN', 'IND', 'RUS', 'USA', 'ZAF']);

// Land som skal bruke provinsnivå fra det fulle admin-1-datasettet
const EUROPEAN_ISOS = new Set([
  'NOR', 'SWE', 'DNK', 'FIN', 'ISL',
  'DEU', 'AUT', 'CHE',
  'FRA', 'BEL', 'NLD', 'LUX',
  'GBR', 'IRL',
  'ESP', 'PRT',
  'ITA', 'MLT',
  'POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR',
  'UKR', 'BLR', 'MDA',
  'SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'ALB', 'MKD', 'GRC', 'CYP',
  'EST', 'LVA', 'LTU',
  'TUR', 'GEO', 'ARM', 'AZE',
  // Øst-Asia og Midtøsten — provinsnivå for tilstrekkelig kulturgruppe-dekning
  'JPN', 'KOR', 'PRK', 'IRN',
]);

// Maks antall provinser per land for europeiske land (hindrer 96 franske departmenter)
const MAX_PROVINCES_EUROPE = 25;

type Biome = 'plains' | 'coast' | 'mountain' | 'desert' | 'arctic' | 'regnskog' | 'other';

interface RegionMeta {
  regionId: string;
  displayName: string;
  countryCode: string;
  biome: Biome;
  centroid: [number, number]; // [lng, lat]
  strategicValue: number;
  culturalGroup: string;
}

interface CulturalTagsFile {
  tags: Record<string, string>;
}

const CULTURAL_TAGS_PATH = path.join(ROOT, 'data', 'cultural-tags.json');

function loadCulturalTags(): Record<string, string> {
  if (!fs.existsSync(CULTURAL_TAGS_PATH)) {
    console.warn(`Advarsel: ${CULTURAL_TAGS_PATH} mangler — alle regioner får culturalGroup="other".`);
    return {};
  }
  const raw = fs.readFileSync(CULTURAL_TAGS_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as CulturalTagsFile;
  return parsed.tags ?? {};
}

// ---------------------------------------------------------------------------
// Biom-heuristikk basert på koordinater og regionegenskaper
// ---------------------------------------------------------------------------

function inferBiome(lat: number, lng: number, name: string, admin0: string): Biome {
  const lname = name.toLowerCase();
  const ladmin = admin0.toLowerCase();

  // Arktisk: > 65° N
  if (lat > 65) return 'arctic';

  // Regnskog: tropisk belte + høy nedbør (grov heuristikk)
  if (lat > -10 && lat < 10 && (lng > -80 && lng < -30)) return 'regnskog'; // Amazonas
  if (lat > -5 && lat < 5 && (lng > 10 && lng < 30)) return 'regnskog'; // Kongo
  if (lat > -10 && lat < 10 && (lng > 95 && lng < 140)) return 'regnskog'; // SEA

  // Ørken: Sahara/Midt-Østen/Arabia/Gobi
  if (lat > 15 && lat < 35 && lng > -20 && lng < 65) return 'desert';
  if (lat > 30 && lat < 50 && lng > 75 && lng < 120) return 'desert'; // Gobi/Taklamakan
  if (lat > -35 && lat < -15 && lng > 115 && lng < 135) return 'desert'; // Australsk ørken

  // Fjell/kyst via navn
  if (lname.includes('mountain') || lname.includes('sierra') || lname.includes('alp') ||
      lname.includes('andes') || lname.includes('himalaya') || lname.includes('kaukasus')) {
    return 'mountain';
  }

  // Kystregioner via land/navn-hint
  if (lname.includes('coast') || lname.includes('kyst') || lname.includes('litoral') ||
      lname.includes('maritime') || lname.includes('gulf') || lname.includes('bay')) {
    return 'coast';
  }

  // Skandinavia/Norge → fjell/kyst
  if (ladmin === 'norway' || ladmin === 'iceland' || ladmin === 'greenland') {
    return lat > 68 ? 'arctic' : 'coast';
  }

  // Storparter av Europa, Nordamerika, Asia: plains som default
  return 'plains';
}

// ---------------------------------------------------------------------------
// Slugify regionId
// ---------------------------------------------------------------------------

function slugify(name: string, iso: string, idx: number): string {
  const cleaned = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // fjern diakritikk
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);

  // Garanter unikhet med iso+index suffiks
  return `${cleaned}-${iso.toLowerCase()}-${idx}`;
}

// ---------------------------------------------------------------------------
// Last GeoJSON (lokal fil eller nedlasting)
// ---------------------------------------------------------------------------

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Følg redirect
        https.get(res.headers.location!, res2 => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function loadGeoJSON(inputPath?: string): Promise<FeatureCollection> {
  if (inputPath) {
    const raw = fs.readFileSync(inputPath, 'utf-8');
    return JSON.parse(raw) as FeatureCollection;
  }

  if (!fs.existsSync(path.join(ROOT, 'data'))) {
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  }

  // Last inn admin-1 for de 9 store landene (lokalt cachet)
  let admin1Features: Feature<Geometry, GeoJsonProperties>[] = [];
  if (fs.existsSync(ADMIN1_CACHE_PATH)) {
    console.log('Bruker cachet admin-1-data (9 store land):', ADMIN1_CACHE_PATH);
    const raw = fs.readFileSync(ADMIN1_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as FeatureCollection;
    // Merk admin-1-features slik at processFeatures kan bruke lavere arealgrense
    admin1Features = parsed.features.map(f => ({
      ...f,
      properties: { ...f.properties, _fromAdmin1: true },
    }));
    console.log(`  Leste ${admin1Features.length} admin-1-features.`);
  }

  // Last inn europeiske provinser fra fullt admin-1-datasett
  let europeanFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
  if (fs.existsSync(ADMIN1_FULL_PATH)) {
    console.log('Laster europeiske provinser fra:', ADMIN1_FULL_PATH);
    const fullRaw = fs.readFileSync(ADMIN1_FULL_PATH, 'utf-8');
    const fullFC = JSON.parse(fullRaw) as FeatureCollection;

    const byIso: Record<string, { f: Feature<Geometry, GeoJsonProperties>; area: number }[]> = {};
    for (const f of fullFC.features) {
      if (!f.geometry) continue;
      const iso: string = (f.properties?.['adm0_a3'] as string) ?? 'UNK';
      if (!EUROPEAN_ISOS.has(iso) || ADMIN1_ISOS.has(iso)) continue;
      let area = 0;
      try { area = turf.area(f as Feature<Geometry>) / 1_000_000; } catch { /* skip */ }
      if (area < 200) continue; // filtrer ut mikroregioner
      if (!byIso[iso]) byIso[iso] = [];
      byIso[iso].push({ f, area });
    }

    for (const items of Object.values(byIso)) {
      const top = items.sort((a, b) => b.area - a.area).slice(0, MAX_PROVINCES_EUROPE);
      for (const { f } of top) {
        europeanFeatures.push({
          ...f,
          properties: { ...f.properties, _fromAdmin1: true },
        });
      }
    }
    console.log(`  ${europeanFeatures.length} europeiske provinser lastet.`);
  }

  // Last ned land-nivå-data (global dekning, fallback for resten av verden)
  if (!fs.existsSync(COUNTRIES_CACHE_PATH)) {
    console.log(`Laster ned land-nivå GeoJSON fra:\n  ${COUNTRIES_URL}`);
    await downloadFile(COUNTRIES_URL, COUNTRIES_CACHE_PATH);
    console.log('Nedlasting ferdig.');
  } else {
    console.log('Bruker cachet land-data:', COUNTRIES_CACHE_PATH);
  }
  const rawCountries = fs.readFileSync(COUNTRIES_CACHE_PATH, 'utf-8');
  const countriesFC = JSON.parse(rawCountries) as FeatureCollection;

  // Admin-0 kun for land som ikke er i admin-1 eller europeisk gruppe
  const countriesFeatures = countriesFC.features.filter(f => {
    const iso: string = (f.properties?.['ADM0_A3'] ?? 'UNK') as string;
    return !ADMIN1_ISOS.has(iso) && !EUROPEAN_ISOS.has(iso) && iso !== 'UNK';
  });

  console.log(`  ${countriesFeatures.length} land-regioner fra admin-0 (resten av verden).`);

  return {
    type: 'FeatureCollection',
    features: [...admin1Features, ...europeanFeatures, ...countriesFeatures],
  };
}

// ---------------------------------------------------------------------------
// Behandle GeoJSON
// ---------------------------------------------------------------------------

function processFeatures(fc: FeatureCollection): {
  geojson: FeatureCollection;
  meta: RegionMeta[];
} {
  const culturalTags = loadCulturalTags();
  const meta: RegionMeta[] = [];
  const outFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
  const unmappedCodes = new Set<string>();

  // Arealgrenser: admin-1-provinser kan være mye mindre enn admin-0-land
  const MIN_AREA_ADMIN1_KM2 = 200;  // Tillater nederlandske/belgiske provinser
  const MIN_AREA_ADMIN0_KM2 = 3_000; // Filtrer ut mikronasjoner på landnivå

  let idx = 0;
  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === 'Point') continue;

    const isAdmin1 = !!(feature.properties?.['_fromAdmin1']);
    const minArea = isAdmin1 ? MIN_AREA_ADMIN1_KM2 : MIN_AREA_ADMIN0_KM2;

    // Arealsjekk
    try {
      const areaSqDeg = turf.area(feature as Feature) / 1_000_000; // m² → km²
      if (areaSqDeg < minArea) continue;
    } catch {
      // Kan ikke beregne areal — inkluder uansett
    }

    const props = feature.properties ?? {};
    const name: string = props['name'] ?? props['NAME'] ?? props['ADMIN'] ?? props['SOVEREIGNT'] ?? props['gn_name'] ?? `Region${idx}`;
    const admin0: string = props['admin'] ?? props['ADMIN'] ?? props['SOVEREIGNT'] ?? props['NAME'] ?? '';
    // ADM0_A3 er pålitelig i NE admin-0; adm0_a3 i admin-1
    const isoRaw: string = props['ADM0_A3'] ?? props['adm0_a3'] ?? props['ISO_A3'] ?? 'UNK';
    const iso: string = isoRaw === '-99' ? 'UNK' : isoRaw;

    // Beregn sentroid
    let centroidCoords: [number, number] = [0, 0];
    try {
      const c = turf.centroid(feature as Feature);
      centroidCoords = c.geometry.coordinates as [number, number];
    } catch {
      // Fallback: bruk bbox-midtpunkt
      const bbox = turf.bbox(feature as Feature);
      centroidCoords = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    }

    const [cLng, cLat] = centroidCoords;
    const biome = inferBiome(cLat, cLng, name, admin0);
    const regionId = slugify(name, iso, idx);
    const culturalGroup = culturalTags[iso] ?? 'other';
    if (!culturalTags[iso]) unmappedCodes.add(iso);

    const regionMeta: RegionMeta = {
      regionId,
      displayName: name,
      countryCode: iso,
      biome,
      centroid: [cLng, cLat],
      strategicValue: 1,
      culturalGroup,
    };
    meta.push(regionMeta);

    const outFeature: Feature<Geometry, GeoJsonProperties> = {
      ...feature,
      properties: {
        regionId,
        name,
        biome,
        iso,
        culturalGroup,
      },
    };
    outFeatures.push(outFeature);
    idx++;
  }

  if (unmappedCodes.size > 0) {
    console.warn(
      `Advarsel: ${unmappedCodes.size} landkoder mangler i cultural-tags.json (fikk culturalGroup="other"): ` +
        [...unmappedCodes].sort().join(', '),
    );
  }

  return {
    geojson: { type: 'FeatureCollection', features: outFeatures },
    meta,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : undefined;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Laster GeoJSON...');
  const raw = await loadGeoJSON(inputPath);
  console.log(`  Leste ${raw.features.length} features.`);

  console.log('Behandler features...');
  const { geojson, meta } = processFeatures(raw);
  console.log(`  Produserte ${meta.length} regioner.`);

  const geojsonPath = path.join(OUTPUT_DIR, 'regions.geojson');
  const metaPath = path.join(OUTPUT_DIR, 'regions-meta.json');

  fs.writeFileSync(geojsonPath, JSON.stringify(geojson));
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  console.log(`\nSkriv til:`);
  console.log(`  ${geojsonPath}  (${(fs.statSync(geojsonPath).size / 1024).toFixed(0)} KB)`);
  console.log(`  ${metaPath}  (${(fs.statSync(metaPath).size / 1024).toFixed(0)} KB)`);
  console.log('\nFerdig! Kjør nå:');
  console.log('  npx tsx scripts/compute-adjacency.ts');
}

main().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
