import { describe, it, expect } from 'vitest';
import {
  seededRng,
  terrainBonus,
  sumStrength,
  applyLosses,
  computeBattleStep,
  effectiveStrength,
  sumEffectiveStrength,
  UNIT_BASE_STRENGTH,
} from '../war-logic';
import type { Unit, UnitType } from '../types';

function unit(
  id: string,
  ownerId: string,
  strength: number,
  regionId = 'r1',
  type: UnitType = 'infantry',
): Unit & { id: string } {
  return {
    id,
    ownerId,
    regionId,
    type,
    strength,
    movedAt: 0,
  };
}

describe('seededRng', () => {
  it('samme seed gir samme sekvens', () => {
    const r1 = seededRng('war1:0');
    const r2 = seededRng('war1:0');
    for (let i = 0; i < 5; i++) {
      expect(r1.next()).toBe(r2.next());
    }
  });

  it('forskjellig seed gir forskjellig sekvens', () => {
    const r1 = seededRng('war1:0');
    const r2 = seededRng('war1:1');
    let same = 0;
    for (let i = 0; i < 5; i++) {
      if (r1.next() === r2.next()) same++;
    }
    expect(same).toBeLessThan(5);
  });

  it('verdier i [0, 1)', () => {
    const r = seededRng('test');
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('terrainBonus', () => {
  it('fjell gir defense-bonus', () => {
    expect(terrainBonus('mountain', 'defense')).toBeGreaterThan(1);
    expect(terrainBonus('mountain', 'attack')).toBeLessThan(1);
  });
  it('plains er angriperfordel', () => {
    expect(terrainBonus('plains', 'attack')).toBeGreaterThan(1);
    expect(terrainBonus('plains', 'defense')).toBeLessThan(1);
  });
  it('arctic gir mild defense-bonus', () => {
    expect(terrainBonus('arctic', 'defense')).toBeGreaterThan(1);
  });
  it('udefinert biom faller tilbake til 1.0', () => {
    expect(terrainBonus(undefined, 'attack')).toBe(1.0);
    expect(terrainBonus(undefined, 'defense')).toBe(1.0);
  });
});

describe('sumStrength', () => {
  it('summerer strength på tvers av enheter', () => {
    expect(sumStrength([unit('a', 'p1', 50), unit('b', 'p1', 30)])).toBe(80);
  });
  it('returnerer 0 ved tom liste', () => {
    expect(sumStrength([])).toBe(0);
  });
});

describe('applyLosses', () => {
  it('fordeler tap proporsjonalt med strength', () => {
    const us = [unit('a', 'p1', 100), unit('b', 'p1', 50)];
    const result = applyLosses(us, 30);
    // a får 2/3 av 30 = 20, b får 1/3 = 10
    expect(result[0].strength).toBe(80);
    expect(result[1].strength).toBe(40);
  });

  it('clamper på 0 (ingen negativ strength)', () => {
    const us = [unit('a', 'p1', 10)];
    const result = applyLosses(us, 100);
    expect(result[0].strength).toBe(0);
  });

  it('ingen endring ved tap=0', () => {
    const us = [unit('a', 'p1', 100)];
    const result = applyLosses(us, 0);
    expect(result[0].strength).toBe(100);
  });

  it('ikke muterer input', () => {
    const us = [unit('a', 'p1', 100)];
    applyLosses(us, 50);
    expect(us[0].strength).toBe(100);
  });
});

describe('computeBattleStep', () => {
  const baseArgs = {
    warId: 'war1',
    tickIdx: 0,
    regionId: 'r1',
    biome: 'plains' as const,
    regionDefense: 0,
  };

  it('jevn styrke → begge taper, ingen erobring', () => {
    const result = computeBattleStep({
      ...baseArgs,
      attackers: [unit('a1', 'att', 100)],
      defenders: [unit('d1', 'def', 100)],
    });
    expect(result.conquered).toBe(false);
  });

  it('defender = 0 → angriper erobrer umiddelbart', () => {
    const result = computeBattleStep({
      ...baseArgs,
      attackers: [unit('a1', 'att', 100)],
      defenders: [],
    });
    expect(result.conquered).toBe(true);
  });

  it('attacker = 0 men defender > 0 → ikke erobring', () => {
    const result = computeBattleStep({
      ...baseArgs,
      attackers: [],
      defenders: [unit('d1', 'def', 100)],
    });
    expect(result.conquered).toBe(false);
  });

  it('determinisme: samme input gir samme tap', () => {
    const a = [unit('a1', 'att', 200)];
    const d = [unit('d1', 'def', 100)];
    const r1 = computeBattleStep({ ...baseArgs, attackers: a, defenders: d });
    const r2 = computeBattleStep({ ...baseArgs, attackers: a, defenders: d });
    expect(r1.attackerLoss).toBe(r2.attackerLoss);
    expect(r1.defenderLoss).toBe(r2.defenderLoss);
  });

  it('forskjellig tickIdx gir forskjellig RNG-utfall', () => {
    const a = [unit('a1', 'att', 200)];
    const d = [unit('d1', 'def', 100)];
    const r0 = computeBattleStep({ ...baseArgs, tickIdx: 0, attackers: a, defenders: d });
    const r5 = computeBattleStep({ ...baseArgs, tickIdx: 5, attackers: a, defenders: d });
    // Med ulik RNG-seed forventer vi i hvert fall ett av tapene er forskjellig
    const sameLosses = r0.attackerLoss === r5.attackerLoss && r0.defenderLoss === r5.defenderLoss;
    expect(sameLosses).toBe(false);
  });

  it('region-defense gir defender ekstra kraft', () => {
    const a = [unit('a1', 'att', 100)];
    const d = [unit('d1', 'def', 100)];
    const noBonus = computeBattleStep({ ...baseArgs, regionDefense: 0, attackers: a, defenders: d });
    const withBonus = computeBattleStep({ ...baseArgs, regionDefense: 50, attackers: a, defenders: d });
    // Med høyere defendPower forventer vi høyere attackerLoss
    expect(withBonus.attackerLoss).toBeGreaterThanOrEqual(noBonus.attackerLoss);
  });

  it('mountain-biom favoriserer forsvareren', () => {
    const a = [unit('a1', 'att', 200)];
    const d = [unit('d1', 'def', 100)];
    const plains = computeBattleStep({ ...baseArgs, biome: 'plains', attackers: a, defenders: d });
    const mountain = computeBattleStep({ ...baseArgs, biome: 'mountain', attackers: a, defenders: d });
    // Defender mister mindre i fjell (lavere attackPower * 0.15)
    expect(mountain.defenderLoss).toBeLessThanOrEqual(plains.defenderLoss);
  });

  it('overveldende styrke → erobrer ofte over flere tikks', () => {
    let a = [unit('a1', 'att', 1000)];
    let d = [unit('d1', 'def', 50)];
    let conquered = false;
    for (let t = 0; t < 10; t++) {
      const r = computeBattleStep({ ...baseArgs, tickIdx: t, attackers: a, defenders: d });
      a = r.attackers;
      d = r.defenders;
      if (r.conquered) {
        conquered = true;
        break;
      }
    }
    expect(conquered).toBe(true);
  });
});

describe('effectiveStrength (enhet-type-asymmetri)', () => {
  it('infanteri har basis 1.0 attack/defense på sletter', () => {
    expect(effectiveStrength({ type: 'infantry', strength: 100 }, 'plains', 'attack')).toBe(100);
    expect(effectiveStrength({ type: 'infantry', strength: 100 }, 'plains', 'defense')).toBe(100);
  });

  it('panser har angrepsfordel på sletter', () => {
    expect(effectiveStrength({ type: 'armor', strength: 100 }, 'plains', 'attack')).toBeGreaterThan(
      effectiveStrength({ type: 'infantry', strength: 100 }, 'plains', 'attack'),
    );
  });

  it('panser er svekket i fjell', () => {
    expect(effectiveStrength({ type: 'armor', strength: 100 }, 'mountain', 'attack')).toBeLessThan(
      effectiveStrength({ type: 'infantry', strength: 100 }, 'mountain', 'attack'),
    );
  });

  it('marine er sterk i kyst, svak i fjell', () => {
    expect(effectiveStrength({ type: 'navy', strength: 100 }, 'coast', 'attack')).toBeGreaterThan(50);
    expect(effectiveStrength({ type: 'navy', strength: 100 }, 'mountain', 'attack')).toBeLessThan(50);
  });

  it('infanteri taper mot panser i likestilte tall på sletter (over flere tikker)', () => {
    // RNG kan gi enkelttikker der angriper-tap > forsvarer-tap. Test isteden
    // at panser oftere enn ikke gjør mer skade enn motparten tar.
    let armorWinsCount = 0;
    for (let t = 0; t < 20; t++) {
      const a = [unit('a1', 'att', 100, 'r1', 'armor')];
      const d = [unit('d1', 'def', 100, 'r1', 'infantry')];
      const r = computeBattleStep({
        warId: 'w1', tickIdx: t, regionId: 'r1', biome: 'plains', regionDefense: 0,
        attackers: a, defenders: d,
      });
      if (r.defenderLoss > r.attackerLoss) armorWinsCount++;
    }
    expect(armorWinsCount).toBeGreaterThan(10); // > halvparten
  });

  it('sumEffectiveStrength matcher sum av enkeltberegninger', () => {
    const us = [
      { type: 'infantry' as const, strength: 100 },
      { type: 'armor' as const, strength: 50 },
    ];
    const expected = effectiveStrength(us[0], 'plains', 'attack')
      + effectiveStrength(us[1], 'plains', 'attack');
    expect(sumEffectiveStrength(us, 'plains', 'attack')).toBeCloseTo(expected, 5);
  });
});

describe('konstanter', () => {
  it('UNIT_BASE_STRENGTH = 100', () => {
    expect(UNIT_BASE_STRENGTH).toBe(100);
  });
});
