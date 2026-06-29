/**
 * End-to-end integration test of the data-access layer + engine.
 *
 * The sandbox network blocks Supabase, so we substitute an in-memory double for
 * the Supabase client and drive a *full cooperative game* through the real
 * `api.ts` code path: create a board, two players join, host starts (deals the
 * deck), then a simple solver plays day/night rounds via `applyAction` /
 * `advanceNight` — version-guarded writes and all — until the game finishes.
 *
 * This exercises createGame, joinGame, startGame, applyAction, advanceNight and
 * their integration with the pure reducer and deck dealing, the way the real
 * client does, just without the network.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- in-memory Supabase double ------------------------------------------
interface Row {
  [k: string]: unknown;
}
const store: { paleo_games: Row[]; paleo_players: Row[] } = {
  paleo_games: [],
  paleo_players: [],
};
let idSeq = 1;

vi.mock("./supabase", () => {
  function makeBuilder(table: "paleo_games" | "paleo_players") {
    const filters: { col: string; val: unknown }[] = [];
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let payload: Row = {};
    let conflictKeys: string[] = [];
    let single = false;
    let maybeSingle = false;
    let countHead = false;
    let selectAfter = false;

    const rows = () => store[table];
    const match = (r: Row) => filters.every((f) => r[f.col] === f.val);

    function compute() {
      const data = store[table];
      if (op === "insert") {
        const row = { id: `id${idSeq++}`, ...payload };
        if (table === "paleo_games" && data.some((r) => r.code === row.code)) {
          return { data: null, error: { code: "23505" } };
        }
        data.push(row);
        return { data: null, error: null };
      }
      if (op === "upsert") {
        const existing = data.find((r) =>
          conflictKeys.every((k) => r[k] === payload[k]),
        );
        if (existing) Object.assign(existing, payload);
        else data.push({ id: `id${idSeq++}`, ...payload });
        return { data: null, error: null };
      }
      if (op === "update") {
        const matched = data.filter(match);
        matched.forEach((r) => Object.assign(r, payload));
        if (selectAfter) return { data: matched.map((r) => ({ id: r.id })), error: null };
        return { data: null, error: null };
      }
      // select
      const matched = rows().filter(match);
      if (countHead) return { count: matched.length, error: null };
      if (single)
        return matched[0]
          ? { data: matched[0], error: null }
          : { data: null, error: { message: "no rows" } };
      if (maybeSingle) return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    const builder: Record<string, unknown> = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (op === "update") selectAfter = true;
        else op = "select";
        if (opts?.head) countHead = true;
        return builder;
      },
      insert(vals: Row) {
        op = "insert";
        payload = vals;
        return builder;
      },
      update(vals: Row) {
        op = "update";
        payload = vals;
        return builder;
      },
      upsert(vals: Row, opts?: { onConflict?: string }) {
        op = "upsert";
        payload = vals;
        conflictKeys = (opts?.onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return builder;
      },
      order() {
        return builder;
      },
      single() {
        single = true;
        return builder;
      },
      maybeSingle() {
        maybeSingle = true;
        return builder;
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try {
          resolve(compute());
        } catch (e) {
          reject?.(e);
        }
      },
    };
    return builder;
  }

  return {
    supabase: {
      from: (table: "paleo_games" | "paleo_players") => makeBuilder(table),
    },
  };
});

// Import AFTER the mock is registered.
import {
  createGame,
  joinGame,
  startGame,
  applyAction,
  advanceNight,
  resetToLobby,
} from "./api";
import {
  type GameState,
  cardOf,
  optionStatus,
  createLobbyState,
  reduce,
} from "./engine";

function currentState(): GameState {
  return store.paleo_games[0].state as GameState;
}

// A solver that plays toward the cave painting: craft fire → torch, gather what
// it needs, paint when it can, and meet/give-up encounters sensibly.
function priorityForCard(base: string, s: GameState): number {
  const have = (t: string) => s.tools.includes(t as never);
  if ((base === "rotswand" || base === "handafdruk") && have("fakkel")) return 100;
  if (base === "mammoet" && have("fakkel")) return 90;
  if (base === "maak-vuur" && !have("vuur")) return 80;
  if (base === "maak-fakkel" && have("vuur") && !have("fakkel")) return 80;
  if (!have("vuur") && (base === "dichtbos" || base === "moeras" || base === "vuursteenader")) return 70; // ideas
  if (base === "rivier" || base === "vlakte" || base === "boomgaard") return 50;
  if (base === "vuursteenader") return 45;
  if (base === "maak-knots" || base === "maak-speer") return 40;
  if (base === "nomade") return 35;
  return 10;
}

function baseOf(inst: string): string {
  return inst.split("#")[0];
}
function bestPick(s: GameState, offer: string[]): string {
  return [...offer].sort(
    (a, b) => priorityForCard(baseOf(b), s) - priorityForCard(baseOf(a), s),
  )[0];
}

function chooseOption(s: GameState, active: string): number | null {
  const card = cardOf(active);
  let best = -1;
  let bestScore = -1;
  card.options.forEach((opt, i) => {
    const st = optionStatus(s, card, opt);
    if (!st.playable) return;
    let score = 1;
    if (opt.reward?.painting) score = 100;
    else if (opt.reward?.tools?.length) score = 80;
    else if (opt.reward?.ideas) score = 40;
    else if (opt.fight) score = st.fightWinnable ? 30 : 2;
    else score = 20;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best >= 0 ? best : null;
}

beforeEach(() => {
  store.paleo_games = [];
  store.paleo_players = [];
  idSeq = 1;
});

describe("integration: full game through the api layer", () => {
  it("creates, joins, starts and plays to a finished state", async () => {
    // Seed RNG so deck shuffles are deterministic and reproducible.
    let seed = 1337;
    const rng = vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });

    const code = await createGame("host-laptop");
    expect(code).toMatch(/^[A-Z]+$/);
    const gameId = store.paleo_games[0].id as string;

    await joinGame(code, "p1", "Oeg");
    await joinGame(code, "p2", "Ada");
    expect(store.paleo_players.length).toBe(2);

    await startGame(gameId);
    expect(currentState().status).toBe("playing");
    expect(currentState().players.length).toBe(2);

    const picksByPlayer: Record<string, number> = { p1: 0, p2: 0 };
    let craftedAtLeastOneTool = false;

    // Drive the game until it finishes (guaranteed: unmet dangers add skulls).
    for (let iter = 0; iter < 5000; iter++) {
      const s = currentState();
      if (s.status === "finished") break;

      if (s.phase === "night") {
        await advanceNight(gameId);
        continue;
      }

      let acted = false;
      for (const p of s.players) {
        if (p.deck.length === 0 && !p.active) continue;
        if (!p.active) {
          const pick = bestPick(s, p.deck.slice(0, 3));
          await applyAction(gameId, { type: "PICK", playerId: p.id, cardId: pick });
          picksByPlayer[p.id] = (picksByPlayer[p.id] ?? 0) + 1;
          acted = true;
          break;
        } else {
          const before = currentState();
          const beforeTools = before.tools.length;
          const opt = chooseOption(before, p.active);
          if (opt != null) {
            await applyAction(gameId, { type: "RESOLVE", playerId: p.id, optionIndex: opt });
          } else {
            await applyAction(gameId, { type: "GIVE_UP", playerId: p.id });
          }
          if (currentState().tools.length > beforeTools) craftedAtLeastOneTool = true;
          acted = true;
          break;
        }
      }
      if (!acted) break;
    }

    const final = currentState();
    rng.mockRestore();

    // The whole loop ran end to end through the api layer.
    expect(final.status).toBe("finished");
    expect(["won", "lost"]).toContain(final.phase);
    expect(picksByPlayer.p1).toBeGreaterThan(0);
    expect(picksByPlayer.p2).toBeGreaterThan(0);
    expect(craftedAtLeastOneTool).toBe(true);
    expect(store.paleo_games[0].version).toBeGreaterThan(10);

    // Surface the outcome for the test log.
    console.log(
      `Integration playthrough finished: ${final.phase} on day ${final.day} ` +
        `(painting ${final.painting}/${final.paintingGoal}, skulls ${final.skulls}/${final.skullLimit})`,
    );
  });

  it("advanceNight deals a fresh day via the api layer", async () => {
    // Build a state that has reached the night phase (decks emptied).
    let s = createLobbyState();
    s = { ...s, players: [{ id: "p1", name: "Oeg", deck: [], active: null }] };
    s = reduce(s, { type: "START", decks: [["vlakte#0"]] });
    s = reduce(s, { type: "PICK", playerId: "p1", cardId: "vlakte#0" });
    s = reduce(s, { type: "RESOLVE", playerId: "p1", optionIndex: 0 });
    expect(s.phase).toBe("night");

    store.paleo_games = [
      { id: "g1", code: "NGHT", status: s.status, state: s, version: 5 },
    ];

    const v = await advanceNight("g1");
    expect(v).toBe(6);
    const after = store.paleo_games[0].state as GameState;
    expect(after.phase).toBe("day");
    expect(after.day).toBe(2);
    // The resolved card was reshuffled back into the new day's deck.
    expect(after.players[0].deck).toEqual(["vlakte#0"]);
    expect(store.paleo_games[0].version).toBe(6);
  });

  it("resetToLobby returns the bumped version so peers can be notified", async () => {
    // A finished game row, the way the win/lose screen sees it.
    let s = createLobbyState();
    s = { ...s, status: "finished", phase: "won" };
    store.paleo_games = [
      { id: "g1", code: "DONE", status: "finished", state: s, version: 9 },
    ];

    const v = await resetToLobby("g1");

    // The new version is returned (not void) — the host broadcasts it via notify
    // so every phone leaves the win/lose screen for the fresh lobby.
    expect(v).toBe(10);
    expect(store.paleo_games[0].version).toBe(10);
    expect(store.paleo_games[0].status).toBe("lobby");
    const after = store.paleo_games[0].state as GameState;
    expect(after.status).toBe("lobby");
    expect(after.phase).not.toBe("won");

    // Idempotent: resetting an already-lobby game returns its current version.
    const again = await resetToLobby("g1");
    expect(again).toBe(10);
    expect(store.paleo_games[0].version).toBe(10);
  });
});
