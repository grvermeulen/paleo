"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type GameRow, type PlayerRow } from "./supabase";
import type { GameState } from "./engine";

export interface GameSnapshot {
  loading: boolean;
  error: string | null;
  gameId: string | null;
  state: GameState | null;
  version: number;
  status: GameState["status"] | null;
  roster: PlayerRow[];
  hostId: string | null;
}

export interface GameChannel extends GameSnapshot {
  /** Broadcast that the game advanced to `version`, so peers refresh at once. */
  notify: (version: number) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Subscribes a client to a game by code and keeps it in sync.
 *
 * Hot path is a lightweight Realtime broadcast: whoever commits an action sends
 * a tiny `{version}` ping (via `notify`), and peers fetch the authoritative row
 * only when the version actually advanced. A version-first poll is the fallback,
 * and a full resync runs on (re)subscribe and on tab focus/reconnect. The roster
 * rides realtime `postgres_changes` (joins + presence heartbeats).
 */
export function useGame(code: string): GameChannel {
  const [snap, setSnap] = useState<GameSnapshot>({
    loading: true,
    error: null,
    gameId: null,
    state: null,
    version: 0,
    status: null,
    roster: [],
    hostId: null,
  });

  const versionRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    versionRef.current = snap.version;
  }, [snap.version]);

  useEffect(() => {
    if (!code) return;
    let active = true;
    const upperCode = code.toUpperCase();
    let gameId: string | null = null;

    const applyGame = (game: GameRow) => {
      if (!active) return;
      setSnap((s) => {
        if (s.gameId === game.id && game.version < s.version) return s;
        return {
          ...s,
          loading: false,
          error: null,
          gameId: game.id,
          state: game.state,
          version: game.version,
          status: game.status,
          hostId: game.host_id,
        };
      });
    };

    const fetchGame = async () =>
      supabase.from("paleo_games").select("*").eq("code", upperCode).maybeSingle<GameRow>();

    const fetchRoster = async (id: string) => {
      const { data } = await supabase
        .from("paleo_players")
        .select("*")
        .eq("game_id", id)
        .order("created_at", { ascending: true });
      if (active && data) setSnap((s) => ({ ...s, roster: data as PlayerRow[] }));
    };

    const resyncGame = async () => {
      if (!gameId) return;
      const { data } = await supabase
        .from("paleo_games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle<GameRow>();
      if (data) applyGame(data);
    };

    const resync = async () => {
      await resyncGame();
      if (gameId) void fetchRoster(gameId);
    };

    async function boot() {
      let game: GameRow | null = null;
      for (let attempt = 0; attempt < 5 && active; attempt++) {
        const { data, error } = await fetchGame();
        if (!active) return;
        if (data) {
          game = data;
          break;
        }
        if (!error && data === null && attempt >= 1) break;
        await sleep(300 * (attempt + 1));
      }

      if (!active) return;
      if (!game) {
        setSnap((s) => ({ ...s, loading: false, error: "Spel niet gevonden." }));
        return;
      }

      gameId = game.id;
      applyGame(game);
      void fetchRoster(game.id);

      const channel = supabase
        .channel(`paleo:${game.id}`, { config: { broadcast: { self: true } } })
        .on("broadcast", { event: "bump" }, ({ payload }) => {
          const v = (payload as { version?: number } | undefined)?.version;
          if (typeof v === "number" && v > versionRef.current) void resyncGame();
        })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "paleo_players", filter: `game_id=eq.${game.id}` },
          () => void fetchRoster(game.id),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void resync();
        });

      channelRef.current = channel;
      cleanup = () => {
        channelRef.current = null;
        supabase.removeChannel(channel);
      };
    }

    let cleanup = () => {};
    void boot();

    const onWake = () => {
      if (document.visibilityState === "visible") void resync();
    };
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      active = false;
      cleanup();
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [code]);

  // Version-first polling fallback (broadcasts can be missed on a flaky link).
  useEffect(() => {
    const gameId = snap.gameId;
    if (!gameId) return;
    // Keep polling while "finished" too: a host can reset back to the lobby from
    // the win/lose screen, and broadcasts can be missed — this is the fallback
    // that lets every peer notice the new round.
    if (snap.status == null) return;
    const inLobby = snap.status === "lobby";
    let active = true;
    let n = 0;

    const tick = async () => {
      n += 1;
      const wantRoster = inLobby || n % 3 === 0;

      const probe = await supabase
        .from("paleo_games")
        .select("version")
        .eq("id", gameId)
        .maybeSingle<{ version: number }>();
      if (!active) return;

      let game: GameRow | null = null;
      if (probe.data && probe.data.version > versionRef.current) {
        const full = await supabase
          .from("paleo_games")
          .select("*")
          .eq("id", gameId)
          .maybeSingle<GameRow>();
        if (!active) return;
        game = full.data ?? null;
      }

      const rosterRes = wantRoster
        ? await supabase
            .from("paleo_players")
            .select("*")
            .eq("game_id", gameId)
            .order("created_at", { ascending: true })
        : { data: null };
      if (!active) return;

      setSnap((s) => {
        if (s.gameId !== gameId) return s;
        const next = { ...s };
        if (game && !(game.id === s.gameId && game.version < s.version)) {
          next.state = game.state;
          next.version = game.version;
          next.status = game.status;
          next.hostId = game.host_id;
        }
        if (rosterRes.data) next.roster = rosterRes.data as PlayerRow[];
        return next;
      });
    };

    const id = setInterval(tick, inLobby ? 1500 : 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [snap.gameId, snap.status]);

  const notify = useCallback((version: number) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({ type: "broadcast", event: "bump", payload: { version } });
  }, []);

  return { ...snap, notify };
}
