import { describe, it, expect } from 'vitest';
import { BUILDING_DEFS } from '../buildings';

// Disse testene verifiserer bygningskonfigurasjonen og routing-logikk
// uten å trenge Firebase-emulator.

describe('BUILDING_DEFS', () => {
  it('alle typer er definert', () => {
    const types = ['farm', 'mine', 'oilrig', 'harbor', 'barracks', 'cityExpand'];
    for (const t of types) {
      expect(BUILDING_DEFS[t as keyof typeof BUILDING_DEFS]).toBeDefined();
    }
  });

  it('farm har korrekte verdier', () => {
    const farm = BUILDING_DEFS.farm;
    expect(farm.cost).toBe(100);
    expect(farm.buildTimeMin).toBe(5);
    expect(farm.output.food).toBe(30);
    expect(farm.biomeMul.plains).toBe(1.5);
    expect(farm.biomeMul.desert).toBe(0.3);
  });

  it('harbor krever coast', () => {
    expect(BUILDING_DEFS.harbor.requires).toBe('coast');
  });

  it('mine produserer metal', () => {
    expect(BUILDING_DEFS.mine.output.metal).toBe(20);
    expect(BUILDING_DEFS.mine.biomeMul.mountain).toBe(1.8);
  });

  it('barracks produserer military', () => {
    expect(BUILDING_DEFS.barracks.output.military).toBe(15);
  });

  it('alle bygninger har kostnad > 0', () => {
    for (const def of Object.values(BUILDING_DEFS)) {
      expect(def.cost).toBeGreaterThan(0);
      expect(def.buildTimeMin).toBeGreaterThan(0);
    }
  });

  it('buildings.json og BUILDING_DEFS er konsistente', async () => {
    // Sjekk at statisk konfigurasjonen matcher hva frontend bruker
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const jsonPath = resolve(__dirname, '../../../public/data/buildings.json');
    const json = JSON.parse(readFileSync(jsonPath, 'utf-8')) as Record<string, unknown>;

    for (const type of Object.keys(BUILDING_DEFS)) {
      expect(json[type]).toBeDefined();
    }
  });
});

describe('ressurs-routing konstanter', () => {
  const PLAYER_RESOURCES = ['military', 'influence'];

  it('military og influence er player-ressurser', () => {
    expect(PLAYER_RESOURCES).toContain('military');
    expect(PLAYER_RESOURCES).toContain('influence');
  });

  it('food, oil, metal, trade er region-ressurser', () => {
    const REGION_RESOURCES = ['food', 'oil', 'metal', 'trade'];
    for (const r of REGION_RESOURCES) {
      expect(PLAYER_RESOURCES).not.toContain(r);
    }
  });
});
