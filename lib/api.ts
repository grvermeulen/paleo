"use client";

import { supabase } from "./supabase";
import {
  type Action,
  type GameState,
  type PaleoPlayer,
  createLobbyState,
  reduce,
  makeInstances,
  dealDecks,
} from "./engine";
import { DEFAULT_MISSION, buildPool } from "./paleo/missions";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O for readability
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 1; // cooperative — solo is allowed

export function randomCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Create a new lobby and return its join code. */
export async function createGame(hostId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("paleo_games").insert({
      code,
      status: "lobby",
      state: createLobbyState(DEFAULT_MISSION.id),
      version: 0,
      host_id: hostId,
    });
    if (!error) return code;
    if (error.code !== "23505") throw error; // unique violation -> retry
  }
  throw new Error("Kon geen unieke code maken, probeer opnieuw.");
}

/**
 * Create a game and immediately join it as the first player. Used for the
 * phone-only mode: the creator both hosts (owns the start button via `host_id`)
 * and plays.
 */
export async function createGameAndJoin(
  playerId: string,
  name: string,
): Promise<string> {
  const code = await createGame(playerId);
  await joinGame(code, playerId, name);
  return code;
}

export async function findGameByCode(
  code: string,
): Promise<{ id: string; status: GameState["status"] } | null> {
  const { data } = await supabase
    .from("paleo_games")
    .select("id,status")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return data ?? null;
}

/** Join (or rejoin / rename) a lobby. Returns the game id. */
export async function joinGame(
  code: string,
  playerId: string,
  name: string,
): Promise<string> {
  const game = await findGameByCode(code);
  if (!game) throw new Error("Spel niet gevonden — check de code.");

  const { data: existing } = await supabase
    .from("paleo_players")
    .select("id")
    .eq("game_id", game.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (!existing && game.status !== "lobby") {
    throw new Error("Dit spel is al begonnen.");
  }

  if (!existing) {
    const { count } = await supabase
      .from("paleo_players")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id);
    if ((count ?? 0) >= MAX_PLAYERS) {
      throw new Error(`Spel zit vol (max ${MAX_PLAYERS} spelers).`);
    }
  }

  const { error } = await supabase.from("paleo_players").upsert(
    {
      game_id: game.id,
      player_id: playerId,
      name: name.trim().slice(0, 16) || "Speler",
      is_host: false,
      connected: true,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "game_id,player_id" },
  );
  if (error) throw error;
  return game.id;
}

/** Host starts the match: snapshots the roster and deals the deck. */
export async function startGame(gameId: string): Promise<void> {
  const { data: roster } = await supabase
    .from("paleo_players")
    .select("player_id,name,is_host,created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  const players: PaleoPlayer[] = (roster ?? [])
    .filter((r) => !r.is_host)
    .map((r) => ({ id: r.player_id, name: r.name, deck: [], active: null }));

  if (players.length < MIN_PLAYERS) {
    throw new Error("Minimaal 1 speler nodig om te starten.");
  }

  // Deal the mission's card pool into one deck per player (randomness here).
  const instances = makeInstances(buildPool(DEFAULT_MISSION));
  const decks = dealDecks(instances, players.length);

  let s = createLobbyState(DEFAULT_MISSION.id);
  s = { ...s, players };
  s = reduce(s, { type: "START", decks });

  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(Math.min(80 * 2 ** (attempt - 1), 1000));
    const { data: row, error: readErr } = await supabase
      .from("paleo_games")
      .select("version,status")
      .eq("id", gameId)
      .single();
    if (readErr || !row) throw readErr ?? new Error("Spel niet gevonden.");
    if (row.status !== "lobby") return; // already started

    const { data: updated, error } = await supabase
      .from("paleo_games")
      .update({ state: s, status: "playing", version: row.version + 1 })
      .eq("id", gameId)
      .eq("version", row.version)
      .select("id");
    if (error) throw error;
    if ((updated?.length ?? 0) > 0) return;
  }
  throw new Error("Kon het spel niet starten — probeer opnieuw.");
}

/**
 * Apply a game action with optimistic concurrency. Reads the current row, runs
 * the pure reducer, and writes back guarded by the version number. Retries on a
 * lost version race or a transient error; every action is a no-op when
 * re-applied to the state it already produced, so retries never double-apply.
 */
export async function applyAction(
  gameId: string,
  action: Action,
): Promise<number> {
  const MAX_ATTEMPTS = 8;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(Math.min(80 * 2 ** (attempt - 1), 1200));

    const { data, error } = await supabase
      .from("paleo_games")
      .select("state,version")
      .eq("id", gameId)
      .single();
    if (error || !data) {
      lastError = error ?? new Error("Spel niet gevonden.");
      continue;
    }

    const next = reduce(data.state as GameState, action);
    const nextVersion = data.version + 1;
    const { data: updated, error: upErr } = await supabase
      .from("paleo_games")
      .update({ state: next, status: next.status, version: nextVersion })
      .eq("id", gameId)
      .eq("version", data.version)
      .select("id");
    if (upErr) {
      lastError = upErr;
      continue;
    }
    if ((updated?.length ?? 0) === 0) {
      lastError = new Error("Schrijfconflict — probeer opnieuw.");
      continue;
    }
    return nextVersion;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Actie mislukt — probeer opnieuw.");
}

/**
 * Advance from night to a new day. The fresh decks are built from the current
 * discard pile (which holds every card after a full day + night), reshuffled and
 * redealt — so this reads state inside the version-guarded loop to deal from the
 * authoritative pile.
 */
export async function advanceNight(gameId: string): Promise<number> {
  const MAX_ATTEMPTS = 8;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(Math.min(80 * 2 ** (attempt - 1), 1200));

    const { data, error } = await supabase
      .from("paleo_games")
      .select("state,version")
      .eq("id", gameId)
      .single();
    if (error || !data) {
      lastError = error ?? new Error("Spel niet gevonden.");
      continue;
    }
    const state = data.state as GameState;
    if (state.phase !== "night") return data.version; // already advanced

    const decks = dealDecks(state.discard, state.players.length);
    const next = reduce(state, { type: "ADVANCE_NIGHT", decks });
    const nextVersion = data.version + 1;
    const { data: updated, error: upErr } = await supabase
      .from("paleo_games")
      .update({ state: next, status: next.status, version: nextVersion })
      .eq("id", gameId)
      .eq("version", data.version)
      .select("id");
    if (upErr) {
      lastError = upErr;
      continue;
    }
    if ((updated?.length ?? 0) === 0) {
      lastError = new Error("Schrijfconflict — probeer opnieuw.");
      continue;
    }
    return nextVersion;
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Kon de nacht niet doorlopen — probeer opnieuw.");
}

/** Refresh a player's presence heartbeat. */
export async function touchPresence(
  gameId: string,
  playerId: string,
): Promise<void> {
  await supabase
    .from("paleo_players")
    .update({ connected: true, last_seen: new Date().toISOString() })
    .eq("game_id", gameId)
    .eq("player_id", playerId);
}

/** Reset a finished game back to the lobby so the same group can replay. */
export async function resetToLobby(gameId: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(Math.min(80 * 2 ** (attempt - 1), 1000));
    const { data: row, error: readErr } = await supabase
      .from("paleo_games")
      .select("version,status")
      .eq("id", gameId)
      .single();
    if (readErr || !row) throw readErr ?? new Error("Spel niet gevonden.");
    if (row.status === "lobby") return;

    const { data: updated, error } = await supabase
      .from("paleo_games")
      .update({
        state: createLobbyState(DEFAULT_MISSION.id),
        status: "lobby",
        version: row.version + 1,
      })
      .eq("id", gameId)
      .eq("version", row.version)
      .select("id");
    if (error) throw error;
    if ((updated?.length ?? 0) > 0) return;
  }
}
