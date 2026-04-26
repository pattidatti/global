import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const TAGS_PATH = path.join(ROOT, 'data', 'cultural-tags.json');
const META_PATH = path.join(ROOT, 'public', 'geo', 'regions-meta.json');

interface CulturalTagsFile {
  _groups: string[];
  tags: Record<string, string>;
}

interface RegionMeta {
  regionId: string;
  countryCode: string;
  culturalGroup?: string;
}

describe('cultural-tags.json', () => {
  it('eksisterer og kan parses som JSON', () => {
    expect(fs.existsSync(TAGS_PATH)).toBe(true);
    const raw = fs.readFileSync(TAGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as CulturalTagsFile;
    expect(parsed.tags).toBeDefined();
    expect(Object.keys(parsed.tags).length).toBeGreaterThan(50);
  });

  it('alle tag-verdier er deklarert i _groups', () => {
    const tags = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf-8')) as CulturalTagsFile;
    const declaredGroups = new Set(tags._groups);
    const used = new Set(Object.values(tags.tags));
    for (const g of used) {
      expect(declaredGroups.has(g), `Gruppe "${g}" brukes i tags men finnes ikke i _groups`).toBe(true);
    }
  });

  it('ingen duplikat-landkoder', () => {
    const tags = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf-8')) as CulturalTagsFile;
    const codes = Object.keys(tags.tags);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('regions-meta.json — culturalGroup-dekning', () => {
  it('hver region har culturalGroup satt', () => {
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as RegionMeta[];
    expect(meta.length).toBeGreaterThan(0);
    const missing = meta.filter(r => !r.culturalGroup);
    expect(missing, `Regioner uten culturalGroup: ${missing.map(r => r.regionId).slice(0, 5).join(', ')}`).toHaveLength(0);
  });

  it('alle countryCodes i regions-meta er mappet i cultural-tags.json', () => {
    const tags = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf-8')) as CulturalTagsFile;
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as RegionMeta[];
    const usedCodes = [...new Set(meta.map(r => r.countryCode))];
    const unmapped = usedCodes.filter(c => !tags.tags[c]);
    expect(unmapped, `Landkoder uten kulturmapping: ${unmapped.join(', ')}`).toHaveLength(0);
  });

  it('hver gruppe brukt i regions-meta har minst 5 regioner (formNation-krav)', () => {
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as RegionMeta[];
    const counts: Record<string, number> = {};
    for (const r of meta) {
      const g = r.culturalGroup ?? 'undefined';
      counts[g] = (counts[g] ?? 0) + 1;
    }
    const tooSmall = Object.entries(counts).filter(([, n]) => n < 5);
    expect(
      tooSmall,
      `Grupper med <5 regioner kan aldri danne nasjon: ${tooSmall.map(([g, n]) => `${g}=${n}`).join(', ')}`,
    ).toHaveLength(0);
  });
});
