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
  | "lose";

export interface GameEvent {
  kind: EventKind;
  by?: string; // player id
  text?: string;
}

export interface LogEntry {
  day: number;
  text: string;
}

export interface GameState {
  status: GameStatus;
  phase: Phase;
  missionId: string;
  stock: Stock;
  tools: ToolId[];
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
}

export type Action =
  | { type: "START"; decks: string[][] }
  | { type: "PICK"; playerId: string; cardId: string }
  | { type: "RESOLVE"; playerId: string; optionIndex: number }
  // RESOLVE_HUNT carries the outcome of the phone mini-game for a fight option.
  // The reducer trusts the carried outcome (it never replays the mini-game), so
  // every peer reduces to the same state — exactly like deck shuffles, the
  // skill/chance lives in the caller and only the result rides the action.
  | { type: "RESOLVE_HUNT"; playerId: string; optionIndex: number; outcome: "win" | "lose" }
  | { type: "GIVE_UP"; playerId: string }
  | { type: "ADVANCE_NIGHT"; decks: string[][] }
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
  };
}

// ---------------------------------------------------------------------------
// Selectors (pure, derived)
// ---------------------------------------------------------------------------

export function weaponStrength(state: GameState): number {
  return state.tools.reduce((s, t) => s + (TOOLS[t]?.strength ?? 0), 0);
}

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
    stock.ideas >= (cost.ideas ?? 0)
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
  };
}

function payCost(stock: Stock, cost?: Cost): Stock {
  if (!cost) return { ...stock };
  return clampStock({
    wood: stock.wood - (cost.wood ?? 0),
    flint: stock.flint - (cost.flint ?? 0),
    food: stock.food - (cost.food ?? 0),
    ideas: stock.ideas - (cost.ideas ?? 0),
  });
}

interface Applied {
  stock: Stock;
  tools: ToolId[];
  tribe: number;
  painting: number;
}

function grantReward(state: GameState, reward?: Reward): Applied {
  const stock = { ...state.stock };
  let tools = [...state.tools];
  let tribe = state.tribe;
  let painting = state.painting;
  if (reward) {
    stock.wood += reward.wood ?? 0;
    stock.flint += reward.flint ?? 0;
    stock.food += reward.food ?? 0;
    stock.ideas += reward.ideas ?? 0;
    tribe += reward.tribe ?? 0;
    painting += reward.painting ?? 0;
    if (reward.tools) {
      for (const t of reward.tools) if (!tools.includes(t)) tools = [...tools, t];
    }
  }
  return { stock: clampStock(stock), tools, tribe, painting };
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
  const discard = [...state.discard];
  for (const inst of state.nightPile) {
    const card = cardOf(inst);
    const applied = grantReward({ ...state, stock, tools, tribe, painting }, card.options[0]?.reward);
    stock = applied.stock;
    tools = applied.tools;
    tribe = applied.tribe;
    painting = applied.painting;
    log.push({ day: state.day, text: `✨ ${card.title}.` });
    discard.push(inst);
  }

  const night: GameState = {
    ...state,
    phase: "night",
    stock,
    tools,
    tribe,
    painting,
    skulls,
    nightPile: [],
    discard,
    log: log.slice(-40),
    lastEvent: { kind: "night" },
  };
  return settle(night);
}

/** After a day action, fold into night when every deck is exhausted. */
function maybeEnterNight(state: GameState): GameState {
  if (state.status === "playing" && state.phase === "day" && isDayOver(state)) {
    return enterNight(state);
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
      };
    }

    case "PICK": {
      if (state.status !== "playing" || state.phase !== "day") return state;
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
        return maybeEnterNight(next);
      }
      return next;
    }

    case "RESOLVE": {
      if (state.status !== "playing" || state.phase !== "day") return state;
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
      return maybeEnterNight(next);
    }

    case "RESOLVE_HUNT": {
      // Same shape as RESOLVE's fight branch, but the win/lose verdict comes
      // from the mini-game on the player's phone instead of the strength check.
      if (state.status !== "playing" || state.phase !== "day") return state;
      if (action.outcome !== "win" && action.outcome !== "lose") return state;
      const player = findPlayer(state, action.playerId);
      if (!player || player.active === null) return state;
      const card = cardOf(player.active);
      const opt = card.options[action.optionIndex];
      if (!opt || opt.fight == null) return state; // only fight options hunt
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

      if (action.outcome === "win") {
        const a = grantReward(next, opt.reward);
        next = {
          ...next,
          stock: payCost(a.stock, opt.cost),
          tools: a.tools,
          tribe: a.tribe,
          painting: a.painting,
          lastEvent: { kind: opt.reward?.painting ? "paint" : "hunt", by: player.id },
          log: pushLog(state, `🗡️ ${player.name}: ${card.title} — gevangen!`),
        };
      } else {
        // A fumble always costs ≥1 (a strong tribe stays low-risk, never free).
        const wound = Math.max(1, opt.fight - weaponStrength(state));
        next = {
          ...next,
          skulls: state.skulls + wound,
          lastEvent: { kind: "fail", by: player.id },
          log: pushLog(state, `💢 ${player.name}: ${card.title} — ontsnapt! → ${wound} 💀.`),
        };
      }

      next = settle(next);
      if (isFinished(next)) return next;
      return maybeEnterNight(next);
    }

    case "GIVE_UP": {
      if (state.status !== "playing" || state.phase !== "day") return state;
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
      return maybeEnterNight(next);
    }

    case "ADVANCE_NIGHT": {
      if (state.status !== "playing" || state.phase !== "night") return state;
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
