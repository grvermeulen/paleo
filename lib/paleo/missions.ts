/**
 * Missions = the multiset of cards that make up a game's draw pool, plus the
 * tribe's starting kit and goals. Keeping this as data makes the game modular:
 * new scenarios are just new entries here.
 */

export interface Mission {
  id: string;
  name: string;
  blurb: string;
  /** Goal: paint this many cave-wall pieces to win. */
  paintingGoal: number;
  /** Lose when this many skulls pile up. */
  skullLimit: number;
  /** Starting tribe members. */
  startTribe: number;
  startStock: { wood: number; flint: number; food: number; ideas: number };
  /** The draw pool: card id -> number of copies. */
  pool: Record<string, number>;
}

export const FIRST_LIGHT: Mission = {
  id: "first-light",
  name: "Het eerste licht",
  blurb:
    "Verzamel, maak vuur en een fakkel, jaag samen en vereeuwig je stam op de grotwand — voor de duisternis jullie inhaalt.",
  paintingGoal: 5,
  skullLimit: 5,
  startTribe: 2,
  startStock: { wood: 2, flint: 2, food: 3, ideas: 0 },
  pool: {
    // gathering
    vlakte: 1,
    dichtbos: 1,
    boomgaard: 1,
    rivier: 1,
    moeras: 1,
    vuursteenader: 1,
    grot: 1,
    // crafting
    "maak-vuur": 1,
    "maak-speer": 1,
    "maak-bijl": 1,
    "maak-knots": 1,
    "maak-mand": 1,
    "maak-fakkel": 1,
    // hunting
    hert: 1,
    zwijn: 1,
    mammoet: 1,
    // painting (victory)
    rotswand: 2,
    handafdruk: 2,
    // people
    nomade: 1,
    // dangers
    wolven: 1,
    storm: 1,
    koorts: 1,
    // night
    kampvuur: 1,
    droom: 1,
  },
};

export const MISSIONS: Record<string, Mission> = {
  [FIRST_LIGHT.id]: FIRST_LIGHT,
};

export const DEFAULT_MISSION = FIRST_LIGHT;

/** Expand a mission's pool into a flat list of card ids (with copy suffixes). */
export function buildPool(mission: Mission): string[] {
  const out: string[] = [];
  for (const [cardId, count] of Object.entries(mission.pool)) {
    for (let i = 0; i < count; i++) out.push(cardId);
  }
  return out;
}
