/**
 * Paleo game engine — pure & deterministic.
 *
 * An original cooperative stone-age game. Randomness (deck shuffles) is injected:
 * the caller shuffles and splits the card pool and passes the resulting decks
 * into `START` / `ADVANCE_NIGHT`, so every state transition (`reduce`) is a pure
 * function and fully unit-testable.
 *
 * Loop:
 *  - Day (simultaneous): each player looks at the backs of the top 3 cards of
 *    their personal deck, PICKs one to reveal, and RESOLVEs one of its options
 *    (or gives it up). Options cost shared resources/ideas, may require tools or
 *    people, and some are fights that wound the tribe (skulls) if too weak.
 *  - Night: when every deck is empty, the tribe is fed (food = members, else a
 *    skull each), night cards resolve, then the whole pool is reshuffled and
 *    redealt for a new day.
 *  - Win: paint `paintingGoal` cave-wall pieces. Lose: reach `skullLimit` skulls.
 */

import {
  type Card,
  type CardOption,
  type Cost,
  type Reward,
  type Requirement,
  type ToolId,
  TOOLS,
  getCard,
} from "./paleo/cards";
import { MISSIONS, DEFAULT_MISSION } from "./paleo/missions";

export type GameStatus = "lobby" | "playing" | "finished";
export type Phase = "day" | "night" | "won" | "lost";

export interface Stock {
  wood: number;
  flint: number;
  food: number;
  ideas: number;
  bones: number; // night-only resource, gathered in the night round
}

export interface PaleoPlayer {
  id: string;
  name: string;
  /** Remaining card instances in this player's deck; index 0 is the top. */
  deck: string[];
  /** The revealed card instance this player is resolving, if any. */
  active: string | null;
}

export type EventKind =
  | "pick"
  | "gather"
  | "craft"
  | "hunt"
  | "fail"
  | "paint"
  | "recruit"
  | "danger"
  | "night"
  | "dawn"
  | "win"
  | "lose"
  // Per-roll cues during a shared dice hunt (synced so spectators hear them).
  | "hit"
  | "dodge";

export interface GameEvent {
  kind: EventKind;
  by?: string; // player id
  text?: string;
}

export interface LogEntry {
  day: number;
  text: string;
}

export type Difficulty = "easy" | "normal" | "hard";

/** An in-progress shared dice hunt: players take turns rolling against a prey. */
export interface HuntState {
  cardId: string;
  optionIndex: number;
  initiatorId: string;
  preyHp: number;
  preyMaxHp: number;
  tribeHp: number; // shared "stamina" for this fight
  tribeMaxHp: number;
  order: string[]; // player ids in turn order (initiator first)
  turn: number; // index into order
  step: "attack" | "dodge";
  seq: number; // monotonic — orders rolls and makes them idempotent/retry-safe
  lastRoll?: {
    by: string;
    kind: "attack" | "dodge";
    dice: [number, number];
    total: number;
    ok: boolean;
    dmg?: number;
  };
  // Once the hunt is decided it lingers (done=true) to show a result screen,
  // until a HUNT_DISMISS clears it and the day continues.
  done?: boolean;
  result?: { outcome: "win" | "lose"; skulls?: number };
}

export interface GameState {
  status: GameStatus;
  phase: Phase;
  missionId: string;
  stock: Stock;
  tools: ToolId[]; // every tool the tribe owns (knows how to use)
  /** The carried subset (≤ CARRY_MAX) that counts for combat strength. */
  activeTools: ToolId[];
  tribe: number;
  skulls: number;
  painting: number;
  paintingGoal: number;
  skullLimit: number;
  players: PaleoPlayer[];
  nightPile: string[];
  discard: string[];
  day: number;
  log: LogEntry[];
  lastEvent: GameEvent | null;
  /** Chosen in the lobby; scales how punishing the hunt dice are. */
  difficulty: Difficulty;
  /** Set while a shared dice hunt is in progress (takes over the UI). */
  hunt?: HuntState;
  /** Set during a day↔night transition: pick which tools to carry. */
  transition?: { to: "night" | "day" };
}

/** Max number of tools you can carry (count toward combat) at once. */
export const CARRY_MAX = 4;

export type Action =
  | { type: "START"; decks: string[][] }
  | { type: "PICK"; playerId: string; cardId: string }
  | { type: "RESOLVE"; playerId: string; optionIndex: number }
  // RESOLVE_HUNT carries the outcome of the phone mini-game for a fight option.
  // The reducer trusts the carried outcome (it never replays the mini-game), so
  // every peer reduces to the same state — exactly like deck shuffles, the
  // skill/chance lives in the caller and only the result rides the action.
  | { type: "RESOLVE_HUNT"; playerId: string; optionIndex: number; outcome: "win" | "lose" }
  // Shared dice hunt: START opens it, ROLL is one player's turn (the two dice
  // ride the action so every peer reduces identically), FLEE aborts it early.
  | { type: "START_HUNT"; playerId: string; optionIndex: number }
  | { type: "HUNT_ROLL"; playerId: string; seq: number; dice: [number, number] }
  | { type: "HUNT_FLEE"; playerId: string }
  | { type: "HUNT_DISMISS"; playerId: string }
  | { type: "SET_DIFFICULTY"; difficulty: Difficulty }
  | { type: "GIVE_UP"; playerId: string }
  // Day↔night cycle: pick which tools to carry across a transition, then start
  // the next round (decks dealt caller-side from the right pool).
  | { type: "SELECT_CARRY"; tools: ToolId[] }
  | { type: "START_NIGHT"; decks: string[][] }
  | { type: "START_DAY"; decks: string[][] }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Card-instance helpers (pure; randomness injected)
// ---------------------------------------------------------------------------

/** A card instance id is `<cardId>#<n>`; the base is the card id. */
export function baseId(instance: string): string {
  return instance.split("#")[0];
}

export function cardOf(instance: string): Card {
  return getCard(baseId(instance));
}

/** Turn a flat pool of card ids into unique, stable instance ids. */
export function makeInstances(pool: string[]): string[] {
  return pool.map((id, i) => `${id}#${i}`);
}

/** Fisher–Yates shuffle (pure given `rng`). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle `items` and split them into `count` decks of near-equal size. */
export function dealDecks(
  items: string[],
  count: number,
  rng: () => number = Math.random,
): string[][] {
  const decks: string[][] = Array.from({ length: Math.max(1, count) }, () => []);
  const shuffled = shuffle(items, rng);
  shuffled.forEach((it, i) => decks[i % decks.length].push(it));
  return decks;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createLobbyState(missionId: string = DEFAULT_MISSION.id): GameState {
  const m = MISSIONS[missionId] ?? DEFAULT_MISSION;
  return {
    status: "lobby",
    phase: "day",
    missionId: m.id,
    stock: { ...m.startStock },
    tools: [],
    activeTools: [],
    tribe: m.startTribe,
    skulls: 0,
    painting: 0,
    paintingGoal: m.paintingGoal,
    skullLimit: m.skullLimit,
    players: [],
    nightPile: [],
    discard: [],
    day: 1,
    log: [],
    lastEvent: null,
    difficulty: "normal",
  };
}

// ---------------------------------------------------------------------------
// Selectors (pure, derived)
// ---------------------------------------------------------------------------

export function weaponStrength(state: GameState): number {
  // Only carried tools count; by night fire & torch shine (nightStrength).
  const night = state.phase === "night";
  return state.activeTools.reduce((s, t) => {
    const tool = TOOLS[t];
    if (!tool) return s;
    return s + (night ? tool.nightStrength ?? tool.strength : tool.strength);
  }, 0);
}

// ---- Dice-hunt tuning (exported so the UI can show the same math) ----------
// 2d6 per roll. Attack adds your weapons and subtracts prey strength (low stats
// → minpunten); you must reach the hit target to wound it. Dodge adds your tribe
// size and must reach 6 + prey strength. Tuned "pittig"; difficulty nudges it.
const DIFF_MOD: Record<Difficulty, { preyHp: number; tribeHp: number; hit: number; dodge: number }> = {
  easy: { preyHp: -1, tribeHp: 2, hit: -1, dodge: -1 },
  normal: { preyHp: 0, tribeHp: 0, hit: 0, dodge: 0 },
  hard: { preyHp: 2, tribeHp: -1, hit: 1, dodge: 1 },
};

export const huntPreyMaxHp = (fight: number, diff: Difficulty = "normal") =>
  Math.max(1, 2 + fight + DIFF_MOD[diff].preyHp);
export const huntTribeMaxHp = (tribe: number, diff: Difficulty = "normal") =>
  Math.max(1, 3 + tribe + DIFF_MOD[diff].tribeHp);
export const huntHitTarget = (diff: Difficulty = "normal") => 7 + DIFF_MOD[diff].hit;
export const huntDodgeTarget = (fight: number, diff: Difficulty = "normal") =>
  6 + fight + DIFF_MOD[diff].dodge;
export const huntBite = (fight: number) => Math.max(1, Math.ceil(fight / 2));
export const huntAttackTotal = (dice: [number, number], strength: number, fight: number) =>
  dice[0] + dice[1] + strength - fight;
export const huntAttackDamage = (total: number, diff: Difficulty = "normal") =>
  total >= huntHitTarget(diff) + 4 ? 2 : total >= huntHitTarget(diff) ? 1 : 0;
export const huntDodgeTotal = (dice: [number, number], tribe: number) =>
  dice[0] + dice[1] + tribe;

/** The top-3 card instances a player may choose between this turn. */
export function offer(player: PaleoPlayer): string[] {
  return player.deck.slice(0, 3);
}

export function findPlayer(state: GameState, playerId: string): PaleoPlayer | null {
  return state.players.find((p) => p.id === playerId) ?? null;
}

export function canAfford(stock: Stock, cost?: Cost): boolean {
  if (!cost) return true;
  return (
    stock.wood >= (cost.wood ?? 0) &&
    stock.flint >= (cost.flint ?? 0) &&
    stock.food >= (cost.food ?? 0) &&
    stock.ideas >= (cost.ideas ?? 0) &&
    stock.bones >= (cost.bones ?? 0)
  );
}

export function meetsRequirement(state: GameState, req?: Requirement): boolean {
  if (!req) return true;
  if (req.people && state.tribe < req.people) return false;
  if (req.tools && !req.tools.every((t) => state.tools.includes(t))) return false;
  return true;
}

/** Tool(s) this option would grant that the tribe doesn't yet own. */
function newToolsFrom(state: GameState, reward?: Reward): ToolId[] {
  if (!reward?.tools) return [];
  return reward.tools.filter((t) => !state.tools.includes(t));
}

export interface OptionStatus {
  playable: boolean;
  /** Short reason it's blocked, for the UI (empty when playable). */
  reason: string;
  /** For fight options: whether the tribe is currently strong enough. */
  fightWinnable?: boolean;
}

export function optionStatus(
  state: GameState,
  card: Card,
  opt: CardOption,
): OptionStatus {
  // A craft option whose tool(s) are already owned is pointless — hide it.
  if (opt.reward?.tools && newToolsFrom(state, opt.reward).length === 0) {
    return { playable: false, reason: "Al gemaakt" };
  }
  if (!meetsRequirement(state, opt.requires)) {
    const need: string[] = [];
    if (opt.requires?.tools)
      for (const t of opt.requires.tools)
        if (!state.tools.includes(t)) need.push(TOOLS[t].name);
    if (opt.requires?.people && state.tribe < opt.requires.people)
      need.push(`${opt.requires.people} stamleden`);
    return { playable: false, reason: `Nodig: ${need.join(", ")}` };
  }
  if (!canAfford(state.stock, opt.cost)) {
    return { playable: false, reason: "Te weinig grondstoffen" };
  }
  const status: OptionStatus = { playable: true, reason: "" };
  if (opt.fight != null) status.fightWinnable = weaponStrength(state) >= opt.fight;
  return status;
}

export function isDayOver(state: GameState): boolean {
  return state.players.every((p) => p.deck.length === 0 && p.active === null);
}

export function isFinished(state: GameState): boolean {
  return state.phase === "won" || state.phase === "lost";
}

// ---------------------------------------------------------------------------
// Mutation helpers (return fresh state)
// ---------------------------------------------------------------------------

function clampStock(s: Stock): Stock {
  return {
    wood: Math.max(0, s.wood),
    flint: Math.max(0, s.flint),
    food: Math.max(0, s.food),
    ideas: Math.max(0, s.ideas),
    bones: Math.max(0, s.bones),
  };
}

function payCost(stock: Stock, cost?: Cost): Stock {
  if (!cost) return { ...stock };
  return clampStock({
    wood: stock.wood - (cost.wood ?? 0),
    flint: stock.flint - (cost.flint ?? 0),
    food: stock.food - (cost.food ?? 0),
    ideas: stock.ideas - (cost.ideas ?? 0),
    bones: stock.bones - (cost.bones ?? 0),
  });
}

interface Applied {
  stock: Stock;
  tools: ToolId[];
  activeTools: ToolId[];
  tribe: number;
  painting: number;
}

function grantReward(state: GameState, reward?: Reward): Applied {
  const stock = { ...state.stock };
  let tools = [...state.tools];
  let activeTools = [...state.activeTools];
  let tribe = state.tribe;
  let painting = state.painting;
  if (reward) {
    stock.wood += reward.wood ?? 0;
    stock.flint += reward.flint ?? 0;
    stock.food += reward.food ?? 0;
    stock.ideas += reward.ideas ?? 0;
    stock.bones += reward.bones ?? 0;
    tribe += reward.tribe ?? 0;
    painting += reward.painting ?? 0;
    if (reward.tools) {
      for (const t of reward.tools) {
        if (!tools.includes(t)) tools = [...tools, t];
        // Auto-equip a freshly crafted tool while there's room, so day play is
        // unchanged until you exceed the carry limit (then you swap at a transition).
        if (!activeTools.includes(t) && activeTools.length < CARRY_MAX) activeTools = [...activeTools, t];
      }
    }
  }
  return { stock: clampStock(stock), tools, activeTools, tribe, painting };
}

/** Resolve win/loss after a mutation; returns a finished state or the input. */
function settle(state: GameState): GameState {
  if (state.painting >= state.paintingGoal) {
    return {
      ...state,
      phase: "won",
      status: "finished",
      lastEvent: { kind: "win" },
      log: pushLog(state, "🎉 De grotwand is af — de stam leeft voort!"),
    };
  }
  if (state.skulls >= state.skullLimit) {
    return {
      ...state,
      phase: "lost",
      status: "finished",
      lastEvent: { kind: "lose" },
      log: pushLog(state, "💀 Te veel verloren — de stam sterft uit."),
    };
  }
  return state;
}

function pushLog(state: GameState, text: string): LogEntry[] {
  return [...state.log.slice(-40), { day: state.day, text }];
}

/** Clear an in-progress hunt and discard the initiator's hunt card. */
function closeHunt(state: GameState, hunt: HuntState): GameState {
  const initiator = state.players.find((p) => p.id === hunt.initiatorId);
  const players = state.players.map((p) =>
    p.id === hunt.initiatorId ? { ...p, active: null } : p,
  );
  const discard = initiator?.active
    ? [...state.discard, initiator.active]
    : [...state.discard];
  return { ...state, players, discard, hunt: undefined };
}

/**
 * Apply a hunt's win reward or lose penalty onto `base` (active already cleared,
 * hunt already closed). Shared by RESOLVE_HUNT (quick-resolve) and the dice hunt
 * so both paths grant/penalise identically. Caller runs settle/night after.
 */
function applyHuntOutcome(
  base: GameState,
  opt: CardOption,
  outcome: "win" | "lose",
  byId: string,
  byName: string,
  title: string,
): GameState {
  if (outcome === "win") {
    const a = grantReward(base, opt.reward);
    return {
      ...base,
      stock: payCost(a.stock, opt.cost),
      tools: a.tools,
      activeTools: a.activeTools,
      tribe: a.tribe,
      painting: a.painting,
      lastEvent: { kind: opt.reward?.painting ? "paint" : "hunt", by: byId },
      log: pushLog(base, `🗡️ ${byName}: ${title} — gevangen!`),
    };
  }
  // A fumble always costs ≥1; a strong tribe stays low-risk.
  const wound = Math.max(1, (opt.fight ?? 1) - weaponStrength(base));
  return {
    ...base,
    skulls: base.skulls + wound,
    lastEvent: { kind: "fail", by: byId },
    log: pushLog(base, `💢 ${byName}: ${title} — ontsnapt! → ${wound} 💀.`),
  };
}

/** Feed the tribe and resolve night cards; advance to the `night` phase. */
function enterNight(state: GameState): GameState {
  let skulls = state.skulls;
  const pay = Math.min(state.stock.food, state.tribe);
  const shortage = state.tribe - pay;
  let stock = clampStock({ ...state.stock, food: state.stock.food - pay });
  let tools = state.tools;
  let tribe = state.tribe;
  let painting = state.painting;
  const log = [...state.log];

  log.push({ day: state.day, text: `🌙 Nacht ${state.day}: de stam eet (${pay} 🍖).` });
  if (shortage > 0) {
    skulls += shortage;
    log.push({ day: state.day, text: `😟 ${shortage} stamlid had honger → ${shortage} 💀.` });
  }

  // Resolve set-aside night cards (their single option, free of cost).
  let activeTools = state.activeTools;
  const discard = [...state.discard];
  for (const inst of state.nightPile) {
    const card = cardOf(inst);
    const applied = grantReward({ ...state, stock, tools, activeTools, tribe, painting }, card.options[0]?.reward);
    stock = applied.stock;
    tools = applied.tools;
    activeTools = applied.activeTools;
    tribe = applied.tribe;
    painting = applied.painting;
    log.push({ day: state.day, text: `✨ ${card.title}.` });
    discard.push(inst);
  }

  // Don't deal the night deck yet: first the tribe packs (the carry screen).
  const night: GameState = {
    ...state,
    phase: "night",
    stock,
    tools,
    activeTools,
    tribe,
    painting,
    skulls,
    nightPile: [],
    discard,
    transition: { to: "night" },
    log: log.slice(-40),
    lastEvent: { kind: "night" },
  };
  return settle(night);
}

/**
 * After an action, fold into the next round when every deck is exhausted:
 * day → night (feed + transition), or night → day (transition). The actual deck
 * deal happens caller-side via START_NIGHT / START_DAY after the carry screen.
 */
function maybeEndRound(state: GameState): GameState {
  if (state.status !== "playing" || state.transition || state.hunt) return state;
  if (!isDayOver(state)) return state;
  if (state.phase === "day") return enterNight(state);
  if (state.phase === "night") {
    return {
      ...state,
      transition: { to: "day" },
      log: pushLog(state, "🌅 De nacht loopt ten einde — pak in voor de dag."),
    };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
      if (state.players.length === 0) return state;
      const m = MISSIONS[state.missionId] ?? DEFAULT_MISSION;
      const players: PaleoPlayer[] = state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        deck: action.decks[i] ?? [],
        active: null,
      }));
      return {
        ...createLobbyState(m.id),
        status: "playing",
        phase: "day",
        players,
        day: 1,
        log: [{ day: 1, text: "☀️ Dag 1 breekt aan." }],
        lastEvent: { kind: "dawn" },
        difficulty: state.difficulty, // carry the lobby choice into the game
      };
    }

    case "SET_DIFFICULTY": {
      if (state.status !== "lobby") return state; // only before the game starts
      return { ...state, difficulty: action.difficulty };
    }

    case "PICK": {
      if (state.status !== "playing" || (state.phase !== "day" && state.phase !== "night") || state.transition) return state;
      if (state.hunt) return state; // paused while a shared hunt runs
      const player = findPlayer(state, action.playerId);
      if (!player) return state;
      if (player.active !== null) return state; // already holding a card
      const top3 = offer(player);
      if (!top3.includes(action.cardId)) return state; // must be one of the 3
      const card = cardOf(action.cardId);

      // Instance ids are unique, so removing by value drops exactly this card.
      const deck = player.deck.filter((c) => c !== action.cardId);
      const players = state.players.map((p) =>
        p.id === player.id
          ? { ...p, deck, active: card.night ? null : action.cardId }
          : p,
      );

      let next: GameState = {
        ...state,
        players,
        lastEvent: { kind: "pick", by: player.id },
      };

      // Night cards are set aside for the night instead of resolved now.
      if (card.night) {
        next = {
          ...next,
          nightPile: [...state.nightPile, action.cardId],
          log: pushLog(state, `🌙 ${player.name} legt "${card.title}" opzij voor de nacht.`),
        };
        return maybeEndRound(next);
      }
      return next;
    }

    case "RESOLVE": {
      if (state.status !== "playing" || (state.phase !== "day" && state.phase !== "night") || state.transition) return state;
      if (state.hunt) return state; // paused while a shared hunt runs
      const player = findPlayer(state, action.playerId);
      if (!player || player.active === null) return state;
      const card = cardOf(player.active);
      const opt = card.options[action.optionIndex];
      if (!opt) return state;
      if (!optionStatus(state, card, opt).playable) return state;

      const discardCard = player.active;
      const players = state.players.map((p) =>
        p.id === player.id ? { ...p, active: null } : p,
      );
      let next: GameState = {
        ...state,
        players,
        discard: [...state.discard, discardCard],
      };

      if (opt.fight != null) {
        const strength = weaponStrength(state);
        if (strength >= opt.fight) {
          const a = grantReward(next, opt.reward);
          next = {
            ...next,
            stock: payCost(a.stock, opt.cost),
            tools: a.tools,
            activeTools: a.activeTools,
            tribe: a.tribe,
            painting: a.painting,
            lastEvent: { kind: opt.reward?.painting ? "paint" : "hunt", by: player.id },
            log: pushLog(state, `🗡️ ${player.name}: ${card.title} — gelukt! (kracht ${strength}/${opt.fight})`),
          };
        } else {
          const wound = opt.fight - strength;
          next = {
            ...next,
            skulls: state.skulls + wound,
            lastEvent: { kind: "fail", by: player.id },
            log: pushLog(state, `💢 ${player.name}: ${card.title} — te zwak (${strength}/${opt.fight}) → ${wound} 💀.`),
          };
        }
      } else {
        const a = grantReward(next, opt.reward);
        const gainedTool = newToolsFrom(state, opt.reward)[0];
        next = {
          ...next,
          stock: payCost(a.stock, opt.cost),
          tools: a.tools,
          activeTools: a.activeTools,
          tribe: a.tribe,
          painting: a.painting,
          lastEvent: {
            kind: opt.reward?.painting
              ? "paint"
              : opt.reward?.tribe
                ? "recruit"
                : gainedTool
                  ? "craft"
                  : "gather",
            by: player.id,
          },
          log: pushLog(
            state,
            `${player.name}: ${card.title} — ${opt.label}.`,
          ),
        };
      }

      next = settle(next);
      if (isFinished(next)) return next;
      return maybeEndRound(next);
    }

    case "RESOLVE_HUNT": {
      // Quick-resolve path: the carried outcome (from the toggle / reduced
      // motion) is applied directly, no dice arena.
      if (state.status !== "playing" || (state.phase !== "day" && state.phase !== "night") || state.transition) return state;
      if (state.hunt) return state; // a shared hunt is already running
      if (action.outcome !== "win" && action.outcome !== "lose") return state;
      const player = findPlayer(state, action.playerId);
      if (!player || player.active === null) return state;
      const card = cardOf(player.active);
      const opt = card.options[action.optionIndex];
      if (!opt || opt.fight == null) return state; // only fight options hunt
      if (!optionStatus(state, card, opt).playable) return state;

      const base: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === player.id ? { ...p, active: null } : p,
        ),
        discard: [...state.discard, player.active],
      };
      let next = applyHuntOutcome(base, opt, action.outcome, player.id, player.name, card.title);
      next = settle(next);
      if (isFinished(next)) return next;
      return maybeEndRound(next);
    }

    case "START_HUNT": {
      if (state.status !== "playing" || (state.phase !== "day" && state.phase !== "night") || state.transition) return state;
      if (state.hunt) return state; // one hunt at a time
      const player = findPlayer(state, action.playerId);
      if (!player || player.active === null) return state;
      const card = cardOf(player.active);
      const opt = card.options[action.optionIndex];
      if (!opt || opt.fight == null) return state;
      if (!optionStatus(state, card, opt).playable) return state;

      // Turn order = all players, initiator first.
      const ids = state.players.map((p) => p.id);
      const start = Math.max(0, ids.indexOf(player.id));
      const order = [...ids.slice(start), ...ids.slice(0, start)];
      return {
        ...state,
        hunt: {
          cardId: card.id,
          optionIndex: action.optionIndex,
          initiatorId: player.id,
          preyHp: huntPreyMaxHp(opt.fight, state.difficulty),
          preyMaxHp: huntPreyMaxHp(opt.fight, state.difficulty),
          tribeHp: huntTribeMaxHp(state.tribe, state.difficulty),
          tribeMaxHp: huntTribeMaxHp(state.tribe, state.difficulty),
          order,
          turn: 0,
          step: "attack",
          seq: 0,
        },
        lastEvent: { kind: "danger", by: player.id },
        log: pushLog(state, `⚔️ ${player.name} begint de jacht op ${card.title}.`),
      };
    }

    case "HUNT_ROLL": {
      const hunt = state.hunt;
      if (!hunt || hunt.done) return state;
      if (action.seq !== hunt.seq) return state; // stale / duplicate roll
      if (action.playerId !== hunt.order[hunt.turn]) return state; // not your turn
      const d = action.dice;
      if (!Array.isArray(d) || d.length !== 2) return state;

      const card = cardOf(`${hunt.cardId}#0`);
      const opt = card.options[hunt.optionIndex];
      if (!opt || opt.fight == null) return state;
      const F = opt.fight;
      const roller = findPlayer(state, action.playerId);
      const name = roller?.name ?? "Speler";

      // End the hunt but keep it on screen (done=true) as a result summary; the
      // reward/penalty is applied now, the day resumes only on HUNT_DISMISS.
      const closeWith = (outcome: "win" | "lose"): GameState => {
        const initiator = state.players.find((p) => p.id === hunt.initiatorId);
        const cleared: GameState = {
          ...state,
          players: state.players.map((p) =>
            p.id === hunt.initiatorId ? { ...p, active: null } : p,
          ),
          discard: initiator?.active ? [...state.discard, initiator.active] : [...state.discard],
        };
        const skulls = outcome === "lose" ? Math.max(1, F - weaponStrength(state)) : undefined;
        let next = applyHuntOutcome(cleared, opt, outcome, action.playerId, name, card.title);
        next = { ...next, hunt: { ...hunt, done: true, result: { outcome, skulls } } };
        return settle(next); // whole-game win/lose still resolves; night waits for dismiss
      };

      if (hunt.step === "attack") {
        const total = huntAttackTotal(d, weaponStrength(state), F);
        const dmg = huntAttackDamage(total, state.difficulty);
        const preyHp = Math.max(0, hunt.preyHp - dmg);
        if (preyHp <= 0) return closeWith("win");
        return {
          ...state,
          hunt: {
            ...hunt,
            preyHp,
            step: "dodge",
            seq: hunt.seq + 1,
            lastRoll: { by: action.playerId, kind: "attack", dice: d, total, ok: dmg > 0, dmg },
          },
          lastEvent: { kind: dmg > 0 ? "hit" : "pick", by: action.playerId },
          log: pushLog(
            state,
            dmg > 0
              ? `🎲 ${name} gooit ${d[0]}+${d[1]} → raak! prooi −${dmg}`
              : `🎲 ${name} gooit ${d[0]}+${d[1]} → mis`,
          ),
        };
      }

      // dodge step
      const total = huntDodgeTotal(d, state.tribe);
      const ok = total >= huntDodgeTarget(F, state.difficulty);
      const nextTurn = (hunt.turn + 1) % hunt.order.length;
      if (!ok) {
        const bite = huntBite(F);
        const tribeHp = Math.max(0, hunt.tribeHp - bite);
        if (tribeHp <= 0) return closeWith("lose");
        return {
          ...state,
          hunt: {
            ...hunt,
            tribeHp,
            turn: nextTurn,
            step: "attack",
            seq: hunt.seq + 1,
            lastRoll: { by: action.playerId, kind: "dodge", dice: d, total, ok: false, dmg: bite },
          },
          lastEvent: { kind: "hit", by: action.playerId },
          log: pushLog(state, `🎲 ${name} gooit ${d[0]}+${d[1]} → geraakt! stam −${bite}`),
        };
      }
      return {
        ...state,
        hunt: {
          ...hunt,
          turn: nextTurn,
          step: "attack",
          seq: hunt.seq + 1,
          lastRoll: { by: action.playerId, kind: "dodge", dice: d, total, ok: true },
        },
        lastEvent: { kind: "dodge", by: action.playerId },
        log: pushLog(state, `🎲 ${name} ontwijkt (${d[0]}+${d[1]})`),
      };
    }

    case "HUNT_FLEE": {
      const hunt = state.hunt;
      if (!hunt) return state;
      if (action.playerId !== hunt.initiatorId) return state;
      if (hunt.seq !== 0) return state; // only before the first roll
      let next = closeHunt(state, hunt);
      next = {
        ...next,
        lastEvent: { kind: "pick", by: hunt.initiatorId },
        log: pushLog(next, `🏃 ${findPlayer(state, hunt.initiatorId)?.name ?? "Speler"} blaast de jacht af.`),
      };
      next = settle(next);
      if (isFinished(next)) return next;
      return maybeEndRound(next);
    }

    case "HUNT_DISMISS": {
      // Close the result screen of a decided hunt and let the day continue.
      const hunt = state.hunt;
      if (!hunt || !hunt.done) return state;
      const next = settle({ ...state, hunt: undefined });
      if (isFinished(next)) return next;
      return maybeEndRound(next);
    }

    case "GIVE_UP": {
      if (state.status !== "playing" || (state.phase !== "day" && state.phase !== "night") || state.transition) return state;
      if (state.hunt) return state; // paused while a shared hunt runs
      const player = findPlayer(state, action.playerId);
      if (!player || player.active === null) return state;
      const card = cardOf(player.active);
      const discardCard = player.active;
      const players = state.players.map((p) =>
        p.id === player.id ? { ...p, active: null } : p,
      );
      const penalty = card.giveUpSkulls ?? 0;
      let next: GameState = {
        ...state,
        players,
        discard: [...state.discard, discardCard],
        skulls: state.skulls + penalty,
        lastEvent: { kind: penalty > 0 ? "danger" : "pick", by: player.id },
        log: pushLog(
          state,
          penalty > 0
            ? `⚠️ ${player.name} laat "${card.title}" lopen → ${penalty} 💀.`
            : `${player.name} slaat "${card.title}" over.`,
        ),
      };
      next = settle(next);
      if (isFinished(next)) return next;
      return maybeEndRound(next);
    }

    case "SELECT_CARRY": {
      // Only during a transition: choose ≤ CARRY_MAX owned tools to carry.
      if (!state.transition) return state;
      const picked = action.tools.filter((t) => state.tools.includes(t)).slice(0, CARRY_MAX);
      return { ...state, activeTools: picked };
    }

    case "START_NIGHT": {
      // Confirm the carry choice and deal the night deck.
      if (state.status !== "playing" || state.transition?.to !== "night") return state;
      const players: PaleoPlayer[] = state.players.map((p, i) => ({
        ...p,
        deck: action.decks[i] ?? [],
        active: null,
      }));
      return {
        ...state,
        phase: "night",
        players,
        discard: [],
        transition: undefined,
        lastEvent: { kind: "night" },
        log: pushLog(state, `🌙 De stam trekt de nacht in.`),
      };
    }

    case "START_DAY": {
      if (state.status !== "playing" || state.transition?.to !== "day") return state;
      const players: PaleoPlayer[] = state.players.map((p, i) => ({
        ...p,
        deck: action.decks[i] ?? [],
        active: null,
      }));
      return {
        ...state,
        phase: "day",
        day: state.day + 1,
        players,
        discard: [],
        nightPile: [],
        transition: undefined,
        lastEvent: { kind: "dawn" },
        log: pushLog(state, `☀️ Dag ${state.day + 1} breekt aan.`),
      };
    }

    case "RESET": {
      return createLobbyState(state.missionId);
    }

    default:
      return state;
  }
}
