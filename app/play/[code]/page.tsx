"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/lib/useGame";
import {
  applyAction,
  advanceNight,
  startGame,
  joinGame,
  resetToLobby,
  touchPresence,
} from "@/lib/api";
import {
  type Action,
  type GameState,
  cardOf,
  reduce,
  weaponStrength,
} from "@/lib/engine";
import {
  getDeviceId,
  getSavedName,
  saveName,
  getQuickHunt,
  prefersReducedMotion,
} from "@/lib/identity";
import { playEventSfx } from "@/lib/sound";
import { useShake } from "@/lib/useShake";
import Mammoth from "@/components/Mammoth";
import ResourceBar from "@/components/ResourceBar";
import ToolShelf from "@/components/ToolShelf";
import SkullTrack from "@/components/SkullTrack";
import CavePainting from "@/components/CavePainting";
import CardBack from "@/components/CardBack";
import CardView from "@/components/CardView";
import WinScreen from "@/components/WinScreen";
import LoseScreen from "@/components/LoseScreen";
import HuntMiniGame from "@/components/HuntMiniGame";
import GameSounds from "@/components/GameSounds";
import SoundMenu from "@/components/SoundMenu";
import { HowToPlayButton } from "@/components/HowToPlay";

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const game = useGame(code);
  const meId = typeof window !== "undefined" ? getDeviceId() : "";
  const isHost = game.hostId === meId;

  // ---- optimistic overlay ------------------------------------------------
  const [optimistic, setOptimistic] = useState<GameState | null>(null);
  const optimisticRef = useRef<GameState | null>(null);
  const targetVersion = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const playedVersion = useRef(0);
  const [actErr, setActErr] = useState<string | null>(null);
  // When set, the chosen fight option is being played as the hunt mini-game.
  const [hunt, setHunt] = useState<{ optionIndex: number } | null>(null);

  const live = game.state;
  const view = optimistic ?? live;

  // Drop the optimistic overlay once the server has caught up to it.
  useEffect(() => {
    if (optimisticRef.current && game.version >= targetVersion.current) {
      optimisticRef.current = null;
      setOptimistic(null);
    }
  }, [game.version]);

  function emitSound(event: GameState["lastEvent"], version: number) {
    if (!event) return;
    if (version <= playedVersion.current) return;
    playedVersion.current = version;
    playEventSfx(event);
  }

  // Everyone else's moves (and our own once reconciled) play via the synced row.
  useEffect(() => {
    if (live) emitSound(live.lastEvent, game.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.version]);

  function dispatch(action: Action) {
    if (!game.gameId || !live) return;
    const base = optimisticRef.current ?? live;
    const next = reduce(base, action);
    if (next === base) return; // no-op / illegal
    optimisticRef.current = next;
    setOptimistic(next);
    targetVersion.current = game.version + 1;
    emitSound(next.lastEvent, targetVersion.current);
    setActErr(null);
    const gameId = game.gameId;
    queue.current = queue.current
      .then(() => applyAction(gameId, action))
      .then((v) => game.notify(v as number))
      .catch(() => {
        optimisticRef.current = null;
        setOptimistic(null);
        setActErr("Actie mislukt — probeer opnieuw.");
      });
  }

  // ---- presence heartbeat ------------------------------------------------
  useEffect(() => {
    if (!game.gameId || game.status !== "playing") return;
    const id = setInterval(() => touchPresence(game.gameId!, meId), 12000);
    touchPresence(game.gameId!, meId);
    return () => clearInterval(id);
  }, [game.gameId, game.status, meId]);

  const myPlayer = useMemo(
    () => view?.players.find((p) => p.id === meId) ?? null,
    [view, meId],
  );
  const offer = myPlayer && !myPlayer.active ? myPlayer.deck.slice(0, 3) : [];
  const canPick = !!myPlayer && !myPlayer.active && offer.length > 0 && view?.phase === "day";

  // Shake to pick a random card from the current offer.
  const shake = useShake(() => {
    if (!canPick) return;
    const pick = offer[Math.floor(Math.random() * offer.length)];
    dispatch({ type: "PICK", playerId: meId, cardId: pick });
  }, canPick);

  async function doNextDay() {
    if (!game.gameId) return;
    try {
      const v = await advanceNight(game.gameId);
      game.notify(v);
    } catch {
      setActErr("Kon de nacht niet doorlopen.");
    }
  }

  async function doReplay() {
    if (!game.gameId) return;
    try {
      const v = await resetToLobby(game.gameId);
      game.notify(v); // broadcast so every phone leaves the win/lose screen
    } catch {
      setActErr("Kon niet herstarten — probeer opnieuw.");
    }
  }

  // Choosing an option: fight options open the hunt mini-game (unless quick
  // resolve / reduced motion is on); everything else resolves immediately.
  function chooseOption(i: number) {
    if (!myPlayer?.active || !view) return;
    const opt = cardOf(myPlayer.active).options[i];
    if (opt?.fight == null) {
      dispatch({ type: "RESOLVE", playerId: meId, optionIndex: i });
      return;
    }
    if (getQuickHunt() || prefersReducedMotion()) {
      const outcome = weaponStrength(view) >= opt.fight ? "win" : "lose";
      dispatch({ type: "RESOLVE_HUNT", playerId: meId, optionIndex: i, outcome });
      return;
    }
    setHunt({ optionIndex: i });
  }

  function resolveHunt(outcome: "win" | "lose") {
    if (hunt) dispatch({ type: "RESOLVE_HUNT", playerId: meId, optionIndex: hunt.optionIndex, outcome });
    setHunt(null);
  }

  if (game.loading) return <Centered>Laden…</Centered>;
  if (game.error) return <Centered>{game.error}</Centered>;

  const inRoster = game.roster.some((r) => r.player_id === meId);

  // ---- Join gate (direct link / QR scan) ---------------------------------
  if (!inRoster) {
    if (game.status !== "lobby") {
      return <Centered>Dit spel is al begonnen. Vraag om een nieuwe ronde.</Centered>;
    }
    return <JoinGate code={code} meId={meId} />;
  }

  // ---- Lobby -------------------------------------------------------------
  if (!view || game.status === "lobby") {
    const players = game.roster.filter((r) => !r.is_host);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-5 px-5 py-8">
        <Mammoth className="anim-bob h-20 w-28" title="Paleo" />
        <h1 className="text-stroke text-4xl font-extrabold text-[var(--color-ochre-500)]">Paleo</h1>
        <div className="card-pop w-full p-5 text-center">
          <p className="font-semibold text-[var(--color-stone-700)]">Spelcode</p>
          <p className="text-stroke text-4xl font-extrabold tracking-[0.3em] text-[var(--color-ochre-500)]">
            {code}
          </p>
        </div>
        <div className="card-pop w-full p-5">
          <h2 className="mb-2 text-lg font-extrabold">Stam ({players.length}/4)</h2>
          <ul className="flex flex-col gap-1 font-bold">
            {players.map((p) => (
              <li key={p.player_id}>
                {p.player_id === meId ? "👉 " : "• "}
                {p.name}
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <button onClick={() => game.gameId && startGame(game.gameId)} className="btn-pop bg-[var(--color-moss-300)]">
            🔥 Start het avontuur
          </button>
        ) : (
          <p className="font-semibold text-[var(--color-stone-700)]">
            Wachten tot de host start…
          </p>
        )}
        <HowToPlayButton label="📖 Nieuw? Bekijk de uitleg" />
      </main>
    );
  }

  const finished = view.phase === "won" || view.phase === "lost";

  // ---- Playing -----------------------------------------------------------
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-3 py-3">
      <GameSounds event={live?.lastEvent ?? null} version={game.version} />

      {/* shared board summary */}
      <section className="card-pop flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-stroke rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-clay-200)] px-3 py-0.5 text-sm font-extrabold">
            {view.phase === "night" ? `🌙 Nacht ${view.day}` : `☀️ Dag ${view.day}`}
          </span>
          <SoundMenu showQuickHunt />
        </div>
        <CavePainting painting={view.painting} goal={view.paintingGoal} />
        <ResourceBar stock={view.stock} tribe={view.tribe} size="sm" />
        <ToolShelf tools={view.tools} compact />
        <SkullTrack skulls={view.skulls} limit={view.skullLimit} size="sm" />
      </section>

      {actErr && (
        <div className="card-pop border-[var(--color-ember)] bg-[var(--color-ember)]/10 p-2 text-center text-sm font-bold text-[var(--color-ember-dark)]">
          {actErr}
        </div>
      )}

      {finished ? (
        view.phase === "won" ? (
          <WinScreen day={view.day} canReplay={isHost} onReplay={doReplay} />
        ) : (
          <LoseScreen day={view.day} canReplay={isHost} onReplay={doReplay} />
        )
      ) : view.phase === "night" ? (
        <section className="card-pop flex flex-col items-center gap-3 p-5 text-center">
          <span className="text-4xl anim-flicker" aria-hidden>
            🌙🔥
          </span>
          <h2 className="text-xl font-extrabold">Nacht {view.day}</h2>
          <ul className="text-sm font-semibold text-[var(--color-stone-700)]">
            {view.log.filter((l) => l.day === view.day).slice(-4).map((l, i) => (
              <li key={i}>{l.text}</li>
            ))}
          </ul>
          <button onClick={doNextDay} className="btn-pop bg-[var(--color-ochre-400)] text-white">
            ☀️ Begin dag {view.day + 1}
          </button>
        </section>
      ) : !myPlayer ? (
        <Centered>Je kijkt mee met deze ronde.</Centered>
      ) : myPlayer.active && hunt ? (
        <HuntMiniGame
          card={cardOf(myPlayer.active)}
          option={cardOf(myPlayer.active).options[hunt.optionIndex]}
          state={view}
          onComplete={resolveHunt}
          onCancel={() => setHunt(null)}
        />
      ) : myPlayer.active ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-sm font-bold text-[var(--color-stone-700)]">
            Kies wat de stam doet:
          </p>
          <CardView
            card={cardOf(myPlayer.active)}
            state={view}
            interactive
            onResolve={chooseOption}
            onGiveUp={() => dispatch({ type: "GIVE_UP", playerId: meId })}
          />
        </div>
      ) : offer.length > 0 ? (
        <section className="flex flex-col items-center gap-3">
          <p className="text-center font-extrabold">Kies een kaart 🃏</p>
          <p className="-mt-1 text-center text-xs font-semibold text-[var(--color-stone-700)]">
            Je ziet alleen de achterkant. Tik om om te draaien{shake.permission === "granted" ? " — of schud!" : ""}.
          </p>
          <div className="flex items-end justify-center gap-3">
            {offer.map((inst) => (
              <CardBack
                key={inst}
                hint={cardOf(inst).hint}
                onClick={() => dispatch({ type: "PICK", playerId: meId, cardId: inst })}
              />
            ))}
          </div>
          {shake.needsPermission && shake.permission !== "granted" && (
            <button onClick={shake.requestPermission} className="btn-pop bg-[var(--color-clay-200)] text-base">
              📳 Zet schudden aan
            </button>
          )}
          <p className="mt-1 text-center text-xs font-semibold text-[var(--color-stone-500)]">
            Nog {view.players.filter((p) => p.deck.length > 0 || p.active).length} spelers bezig
          </p>
        </section>
      ) : (
        <section className="card-pop flex flex-col items-center gap-2 p-6 text-center">
          <span className="text-4xl anim-bob" aria-hidden>
            🔥
          </span>
          <h2 className="text-lg font-extrabold">Klaar voor vandaag!</h2>
          <p className="text-sm font-semibold text-[var(--color-stone-700)]">
            Wachten tot de anderen hun kaarten op hebben…
          </p>
        </section>
      )}
    </main>
  );
}

function JoinGate({ code, meId }: { code: string; meId: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setName(getSavedName()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 1) return setErr("Vul je naam in.");
    setBusy(true);
    setErr(null);
    try {
      saveName(name.trim());
      await joinGame(code, meId, name.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Meedoen lukte niet.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-5 py-10">
      <Mammoth className="anim-bob h-20 w-28" title="Paleo" />
      <h1 className="text-stroke text-4xl font-extrabold text-[var(--color-ochre-500)]">Paleo</h1>
      <p className="font-semibold text-[var(--color-stone-700)]">
        Doe mee met spel <span className="font-extrabold">{code}</span>
      </p>
      {err && (
        <div className="card-pop w-full border-[var(--color-ember)] bg-[var(--color-ember)]/10 p-3 text-center font-bold text-[var(--color-ember-dark)]">
          {err}
        </div>
      )}
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Je naam"
          maxLength={16}
          className="w-full rounded-2xl border-4 border-[var(--color-ink)] bg-white px-4 py-3 text-center text-xl font-bold outline-none focus:ring-4 focus:ring-[var(--color-clay-300)]"
        />
        <button type="submit" disabled={busy} className="btn-pop bg-[var(--color-moss-300)]">
          {busy ? "Bezig…" : "👣 Doe mee"}
        </button>
      </form>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8 text-center text-lg font-bold text-[var(--color-stone-700)]">
      {children}
    </main>
  );
}
