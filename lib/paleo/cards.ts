/**
 * Paleo — card & tool data (original content).
 *
 * This is an original cooperative stone-age game inspired by the *mechanics* of
 * the genre (day/night cycle, choose 1 of 3 face-down cards, gather resources,
 * craft tools, fight dangers, paint the cave wall). All card titles, texts and
 * art are original — no published card content is reproduced.
 *
 * The data here is static and pure, so the engine that reads it stays a pure,
 * deterministic reducer.
 */

export type Resource = "wood" | "flint" | "food";
export const RESOURCES: Resource[] = ["wood", "flint", "food"];

export type ToolId =
  | "vuur" // campfire — warmth & light, unlocks the torch
  | "speer" // spear — strongest weapon
  | "knots" // club — light weapon
  | "bijl" // axe — fells big trees, light weapon
  | "mand" // basket — gather more
  | "fakkel"; // torch — light, lets you paint the cave wall

export interface Tool {
  id: ToolId;
  name: string;
  emoji: string;
  /** Weapon strength this tool adds to the tribe. */
  strength: number;
  blurb: string;
}

export const TOOLS: Record<ToolId, Tool> = {
  vuur: { id: "vuur", name: "Vuur", emoji: "🔥", strength: 0, blurb: "Warmte en licht. Nodig voor de fakkel." },
  speer: { id: "speer", name: "Speer", emoji: "🗡️", strength: 2, blurb: "Het sterkste jachtwapen." },
  knots: { id: "knots", name: "Knots", emoji: "🏏", strength: 1, blurb: "Eenvoudig maar doeltreffend." },
  bijl: { id: "bijl", name: "Bijl", emoji: "🪓", strength: 1, blurb: "Velt dikke bomen en verdedigt." },
  mand: { id: "mand", name: "Mand", emoji: "🧺", strength: 0, blurb: "Draag meer voedsel mee naar huis." },
  fakkel: { id: "fakkel", name: "Fakkel", emoji: "🕯️", strength: 0, blurb: "Licht in de grot — schilder de muur." },
};

/** What a card option costs (consumed when resolved). */
export interface Cost {
  wood?: number;
  flint?: number;
  food?: number;
  ideas?: number;
}

/** Hard gate: an option can only be chosen if these hold. */
export interface Requirement {
  /** Tools the tribe must already own (not consumed). */
  tools?: ToolId[];
  /** Tribe members that must be present. */
  people?: number;
}

/** What a resolved option grants. */
export interface Reward {
  wood?: number;
  flint?: number;
  food?: number;
  ideas?: number;
  tribe?: number;
  painting?: number;
  /** Tools gained (added to the tribe's shelf; duplicates are no-ops). */
  tools?: ToolId[];
}

export interface CardOption {
  label: string;
  cost?: Cost;
  requires?: Requirement;
  /** A danger to overcome: needs this much weapon strength, else it wounds. */
  fight?: number;
  reward?: Reward;
}

export type Hint = "forest" | "water" | "hunt" | "cave" | "camp" | "people" | "danger";

export interface Card {
  id: string;
  title: string;
  hint: Hint;
  /** Short original flavour shown when the card is revealed. */
  text: string;
  /** Night card: set aside when picked, resolved automatically at night. */
  night?: boolean;
  options: CardOption[];
  /** Penalty if nobody can/will resolve the card and it's given up. */
  giveUpSkulls?: number;
}

export const CARDS: Card[] = [
  // ---- Forest: wood, food, ideas ----------------------------------------
  {
    id: "vlakte",
    title: "Open vlakte",
    hint: "forest",
    text: "Gras zover je kijkt, met struiken vol bessen aan de rand.",
    options: [
      { label: "Sprokkel hout", reward: { wood: 2 } },
      { label: "Pluk bessen", reward: { food: 2 } },
    ],
  },
  {
    id: "dichtbos",
    title: "Dicht bos",
    hint: "forest",
    text: "Hoge bomen, knerpende takken. Met het juiste gereedschap valt hier veel te halen.",
    options: [
      { label: "Breek een tak af", reward: { wood: 1, ideas: 1 } },
      { label: "Vel een grote stam", requires: { tools: ["bijl"] }, reward: { wood: 3 } },
    ],
  },
  {
    id: "boomgaard",
    title: "Wilde boomgaard",
    hint: "forest",
    text: "Rijpe vruchten hangen laag. Een mand zou goed van pas komen.",
    options: [
      { label: "Pluk wat je dragen kunt", reward: { food: 2 } },
      { label: "Vul de mand", requires: { tools: ["mand"] }, reward: { food: 4 } },
    ],
  },
  // ---- Water: food, flint ------------------------------------------------
  {
    id: "rivier",
    title: "Aan de rivier",
    hint: "water",
    text: "Helder water, glinsterende kiezels op de bodem.",
    options: [
      { label: "Vang vis", reward: { food: 2 } },
      { label: "Raap vuursteen", reward: { flint: 2 } },
    ],
  },
  {
    id: "moeras",
    title: "Stil moeras",
    hint: "water",
    text: "Riet en modder. Wie geduld heeft, vindt hier van alles.",
    options: [
      { label: "Snijd riet", reward: { wood: 1, ideas: 1 } },
      { label: "Zoek schelpen", reward: { food: 1, flint: 1 } },
    ],
  },
  // ---- Cave / flint ------------------------------------------------------
  {
    id: "vuursteenader",
    title: "Vuursteenader",
    hint: "cave",
    text: "Een ader van scherpe steen breekt door de rotswand.",
    options: [
      { label: "Breek vuursteen", reward: { flint: 2 } },
      { label: "Bewerk fijne splinters", reward: { flint: 1, ideas: 1 } },
    ],
  },
  {
    id: "grot",
    title: "Diepe grot",
    hint: "cave",
    text: "Het wordt snel donker. Zonder licht is dit gevaarlijk.",
    options: [
      { label: "Verken met fakkel", requires: { tools: ["fakkel"] }, reward: { flint: 2, ideas: 1 } },
      { label: "Tast in het donker", fight: 2, reward: { flint: 1 } },
    ],
    giveUpSkulls: 0,
  },
  // ---- Crafting (spend ideas + resources for a tool) ---------------------
  {
    id: "maak-vuur",
    title: "Ontsteek het vuur",
    hint: "camp",
    text: "Droog hout en een vonk — het begin van alles.",
    options: [
      { label: "Maak vuur (🪵2 + 💡1)", cost: { wood: 2, ideas: 1 }, reward: { tools: ["vuur"], ideas: 0 } },
    ],
    giveUpSkulls: 0,
  },
  {
    id: "maak-speer",
    title: "Slijp een speerpunt",
    hint: "camp",
    text: "Een scherpe punt op een rechte schacht.",
    options: [
      { label: "Maak speer (🪵1 + 🔪1 + 💡1)", cost: { wood: 1, flint: 1, ideas: 1 }, reward: { tools: ["speer"] } },
    ],
    giveUpSkulls: 0,
  },
  {
    id: "maak-bijl",
    title: "Smeed een bijl",
    hint: "camp",
    text: "Steen aan steel — voor hout én verdediging.",
    options: [
      { label: "Maak bijl (🪵1 + 🔪1 + 💡1)", cost: { wood: 1, flint: 1, ideas: 1 }, reward: { tools: ["bijl"] } },
    ],
    giveUpSkulls: 0,
  },
  {
    id: "maak-knots",
    title: "Snijd een knots",
    hint: "camp",
    text: "Een zware tak doet wonderen tegen roofdieren.",
    options: [
      { label: "Maak knots (🪵1)", cost: { wood: 1 }, reward: { tools: ["knots"] } },
    ],
    giveUpSkulls: 0,
  },
  {
    id: "maak-mand",
    title: "Vlecht een mand",
    hint: "camp",
    text: "Met riet en geduld draag je veel meer.",
    options: [
      { label: "Maak mand (🪵1 + 💡1)", cost: { wood: 1, ideas: 1 }, reward: { tools: ["mand"] } },
    ],
    giveUpSkulls: 0,
  },
  {
    id: "maak-fakkel",
    title: "Vlecht een fakkel",
    hint: "camp",
    text: "Hars en hout, ontstoken aan het vuur.",
    options: [
      { label: "Maak fakkel (🪵1) — 🔥 nodig", requires: { tools: ["vuur"] }, cost: { wood: 1 }, reward: { tools: ["fakkel"] } },
    ],
    giveUpSkulls: 0,
  },
  // ---- Hunting (fight for food) -----------------------------------------
  {
    id: "hert",
    title: "Hert in het kreupelhout",
    hint: "hunt",
    text: "Een schichtig hert graast tussen de varens.",
    options: [{ label: "Jaag op het hert", fight: 2, reward: { food: 3 } }],
    giveUpSkulls: 0,
  },
  {
    id: "zwijn",
    title: "Wild zwijn",
    hint: "hunt",
    text: "Een woest zwijn met scherpe slagtanden.",
    options: [{ label: "Versla het zwijn", fight: 3, reward: { food: 3, ideas: 1 } }],
    giveUpSkulls: 0,
  },
  {
    id: "mammoet",
    title: "De grote mammoet",
    hint: "hunt",
    text: "De reus van de toendra. Alleen samen versla je hem — en zijn beeld siert de wand.",
    options: [
      { label: "Verschalk hem (samen, 👥2)", requires: { people: 2 }, fight: 4, reward: { food: 4, painting: 1 } },
    ],
    giveUpSkulls: 0,
  },
  // ---- Cave painting (victory) ------------------------------------------
  {
    id: "rotswand",
    title: "Gladde rotswand",
    hint: "cave",
    text: "Een glad vlak, perfect voor een tekening — met licht en oker.",
    options: [
      { label: "Schilder een dier (🕯️ + 🔪1)", requires: { tools: ["fakkel"] }, cost: { flint: 1 }, reward: { painting: 1 } },
    ],
    giveUpSkulls: 0,
  },
  {
    id: "handafdruk",
    title: "Handafdruk in oker",
    hint: "cave",
    text: "Leg je hand tegen de steen en blaas de verf eromheen.",
    options: [
      { label: "Zet je teken (🕯️ + 🪵1)", requires: { tools: ["fakkel"] }, cost: { wood: 1 }, reward: { painting: 1 } },
    ],
    giveUpSkulls: 0,
  },
  // ---- People ------------------------------------------------------------
  {
    id: "nomade",
    title: "Verdwaalde nomade",
    hint: "people",
    text: "Een eenzame zwerver zoekt onderdak bij jullie vuur.",
    options: [
      { label: "Verwelkom in de stam (🍖1)", cost: { food: 1 }, reward: { tribe: 1 } },
      { label: "Wijs de weg en leer", reward: { ideas: 1 } },
    ],
  },
  // ---- Dangers (penalty if unmet) ---------------------------------------
  {
    id: "wolven",
    title: "Hongerige wolven",
    hint: "danger",
    text: "Gele ogen in het donker, dichterbij en dichterbij.",
    options: [{ label: "Verjaag de roedel", fight: 2, reward: { ideas: 1 } }],
    giveUpSkulls: 1,
  },
  {
    id: "storm",
    title: "Plotse storm",
    hint: "danger",
    text: "Striemende regen en wind. Zonder vuur wordt het een koude, gevaarlijke nacht.",
    options: [{ label: "Schuil bij het vuur", requires: { tools: ["vuur"] }, reward: { ideas: 1 } }],
    giveUpSkulls: 1,
  },
  {
    id: "koorts",
    title: "Koortsnacht",
    hint: "danger",
    text: "Een stamlid gloeit van de koorts en heeft verzorging nodig.",
    options: [{ label: "Genees met kruiden (🍖1)", cost: { food: 1 }, reward: { ideas: 1 } }],
    giveUpSkulls: 1,
  },
  // ---- Night cards (resolved automatically at night) --------------------
  {
    id: "kampvuur",
    title: "Verhalen bij het vuur",
    hint: "camp",
    text: "Bij het knetterend vuur komen de beste ideeën.",
    night: true,
    options: [{ label: "Luister naar de oudste", reward: { ideas: 1 } }],
  },
  {
    id: "droom",
    title: "Heldere droom",
    hint: "camp",
    text: "Je droomt van nieuwe werktuigen en ontwaakt met een plan.",
    night: true,
    options: [{ label: "Onthoud de droom", reward: { ideas: 1 } }],
  },
];

export const CARD_MAP: Record<string, Card> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);

export function getCard(id: string): Card {
  const c = CARD_MAP[id];
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}
