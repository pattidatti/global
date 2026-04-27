// Ingen Firebase-import — testbar uten emulator
import type { BuildingType, BuildingDef } from './types';

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  farm: {
    cost: 100,
    buildTimeMin: 5,
    output: { food: 30 },
    biomeMul: { plains: 1.5, coast: 1.0, regnskog: 1.2, desert: 0.3, arctic: 0.2, others: 0.7 },
  },
  mine: {
    cost: 200,
    buildTimeMin: 15,
    output: { metal: 20 },
    biomeMul: { mountain: 1.8, arctic: 1.2, plains: 0.5, others: 0.6 },
  },
  oilrig: {
    cost: 250,
    buildTimeMin: 20,
    output: { oil: 25 },
    biomeMul: { desert: 1.6, arctic: 1.4, others: 0.4 },
  },
  harbor: {
    cost: 400,
    buildTimeMin: 30,
    output: { trade: 10 },
    biomeMul: { coast: 1.0 },
    requires: 'coast',
    unlocks: 'seaAdjacency',
  },
  barracks: {
    cost: 300,
    buildTimeMin: 20,
    output: { military: 15 },
    biomeMul: { others: 1.0 },
  },
  cityExpand: {
    cost: 800,
    buildTimeMin: 60,
    output: { influence: 5 },
    biomeMul: { others: 1.0 },
    requires: 'city',
  },
};
