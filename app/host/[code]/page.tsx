"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useGame } from "@/lib/useGame";
import { startGame, advanceNight, resetToLobby, applyAction } from "@/lib/api";
import { getDeviceId } from "@/lib/identity";
import { accentFor } from "@/lib/paleo/colors";
import Mammoth from "@/components/Mammoth";
import JoinQR from "@/components/JoinQR";
import ResourceBar from "@/components/ResourceBar";
import ToolShelf from "@/components/ToolShelf";
import SkullTrack from "@/components/SkullTrack";
import CavePainting from "@/components/CavePainting";
import PlayerStatus from "@/components/PlayerStatus";
import WinScreen from "@/components/WinScreen";
import LoseScreen from "@/components/LoseScreen";
import GameSounds from "@/components/GameSounds";
import SoundMenu from "@/components/SoundMenu";
import { HowToPlayButton } from "@/components/HowToPlay";
import HuntArena from "@/components/HuntArena";

export default function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const game = useGame(code);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meId = typeof window !== "undefined" ? getDeviceId() : "";

  useEffect(() => setOrigin(window.location.origin), []);

  const isHost = game.hostId === meId;
  const players = useMemo(
    () => game.roster.filter((r) => !r.is_host),
    [game.roster],
  );

  const connected = useMemo(() => {
    const map: Record<string, boolean> = {};
    const now = Date.now();
    for (const r of game.roster) {
      map[r.player_id] = now - new Date(r.last_seen).getTime() < 30000;
    }
    return map;
  }, [game.roster]);

  async function doStart() {
    if (!game.gameId) return;
    setErr(null);
    setBusy(true);
    try {
      await startGame(game.gameId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Starten lukte niet.");
    } finally {
      setBusy(false);
    }
  }

  async function doNextDay() {
    if (!game.gameId) return;
    setBusy(true);
    try {
      const v = await advanceNight(game.gameId);
      game.notify(v);
    } finally {
      setBusy(false);
    }
  }

  // The host can roll for the player whose turn it is when they're disconnected,
  // so a dropped phone never stalls the shared hunt.
  async function hostRoll(dice: [number, number]) {
    const h = game.state?.hunt;
    if (!game.gameId || !h) return;
    try {
      const v = await applyAction(game.gameId, {
        type: "HUNT_ROLL",
        playerId: h.order[h.turn],
        seq: h.seq,
        dice,
      });
      game.notify(v);
    } catch {
      /* a version race just means another device rolled first */
    }
  }

  async function doReset() {
    if (!game.gameId) return;
    setBusy(true);
    try {
      const v = await resetToLobby(game.gameId);
      game.notify(v); // wake every peer that's still on the win/lose screen
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Herstarten lukte niet.");
    } finally {
      setBusy(false);
    }
  }

  if (game.loading) {
    return <Centered>Laden…</Centered>;
  }
  if (game.error) {
    return <Centered>{game.error}</Centered>;
  }

  const state = game.state;

  // ---- Lobby -------------------------------------------------------------
  if (!state || game.status === "lobby") {
    const joinUrl = origin ? `${origin}/play/${code}` : "";
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-6 px-5 py-8">
        <Header code={code} />
        <HowToPlayButton label="📖 Nieuw? Bekijk de uitleg" />
        <div className="grid w-full gap-6 md:grid-cols-2">
          <section className="card-pop flex flex-col items-center gap-4 p-6">
            <h2 className="text-2xl font-extrabold">Doe mee!</h2>
            {joinUrl && <JoinQR url={joinUrl} />}
            <p className="text-center text-sm font-semibold text-[var(--color-stone-700)]">
              Scan de code of ga naar
              <br />
              <span className="font-extrabold">{origin?.replace(/^https?:\/\//, "")}</span>
              <br />
              en vul de spelcode in:
            </p>
            <div className="text-stroke rounded-2xl border-4 border-[var(--color-ink)] bg-[var(--color-ochre-400)] px-6 py-2 text-5xl font-extrabold tracking-[0.3em] text-white">
              {code}
            </div>
          </section>

          <section className="card-pop flex flex-col gap-3 p-6">
            <h2 className="text-2xl font-extrabold">Stam ({players.length}/4)</h2>
            {players.length === 0 ? (
              <p className="font-semibold text-[var(--color-stone-700)]">
                Nog niemand… deel de code!
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {players.map((p, i) => (
                  <li
                    key={p.player_id}
                    className="flex items-center gap-3 rounded-xl border-2 border-[var(--color-ink)] bg-white/60 px-3 py-2 font-bold"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-ink)] text-white"
                      style={{ backgroundColor: accentFor(i) }}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
            {err && <p className="font-bold text-[var(--color-ember-dark)]">{err}</p>}
            {isHost ? (
              <button
                onClick={doStart}
                disabled={busy || players.length < 1}
                className="btn-pop bg-[var(--color-moss-300)]"
              >
                {busy ? "Bezig…" : "🔥 Start het avontuur"}
              </button>
            ) : (
              <p className="text-sm font-semibold text-[var(--color-stone-700)]">
                Wacht tot de host start…
              </p>
            )}
          </section>
        </div>
        <Rules />
      </main>
    );
  }

  const finished = state.phase === "won" || state.phase === "lost";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-5 px-4 py-6">
      <GameSounds event={state.lastEvent} version={game.version} />

      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mammoth className="h-10 w-12" />
          <span className="text-2xl font-extrabold">Paleo</span>
        </div>
        <div className="text-stroke rounded-full border-4 border-[var(--color-ink)] bg-[var(--color-clay-200)] px-4 py-1 text-xl font-extrabold">
          {state.phase === "night" ? `🌙 Nacht ${state.day}` : `☀️ Dag ${state.day}`}
        </div>
        <SoundMenu showMusic />
      </div>

      {finished ? (
        <div className="flex w-full flex-col items-center gap-4 py-6">
          {state.phase === "won" ? (
            <WinScreen day={state.day} canReplay={isHost} onReplay={doReset} />
          ) : (
            <LoseScreen day={state.day} canReplay={isHost} onReplay={doReset} />
          )}
        </div>
      ) : (
        <>
          <CavePainting painting={state.painting} goal={state.paintingGoal} />

          <div className="flex w-full flex-col items-center gap-3">
            <ResourceBar stock={state.stock} tribe={state.tribe} size="lg" />
            <ToolShelf tools={state.tools} />
            <SkullTrack skulls={state.skulls} limit={state.skullLimit} size="lg" />
          </div>

          {state.hunt && (
            <HuntArena
              state={state}
              meId={meId}
              connected={connected}
              isHost={isHost}
              onRoll={hostRoll}
            />
          )}

          {state.phase === "night" && (
            <section className="card-pop flex w-full max-w-md flex-col items-center gap-3 p-5 text-center">
              <span className="text-4xl anim-flicker" aria-hidden>
                🌙🔥
              </span>
              <h3 className="text-xl font-extrabold">De stam rust bij het vuur</h3>
              <ul className="w-full text-sm font-semibold text-[var(--color-stone-700)]">
                {state.log
                  .filter((l) => l.day === state.day)
                  .slice(-4)
                  .map((l, i) => (
                    <li key={i}>{l.text}</li>
                  ))}
              </ul>
              {isHost && (
                <button onClick={doNextDay} disabled={busy} className="btn-pop bg-[var(--color-ochre-400)] text-white">
                  {busy ? "Bezig…" : `☀️ Begin dag ${state.day + 1}`}
                </button>
              )}
            </section>
          )}

          <section className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.players.map((p, i) => (
              <PlayerStatus
                key={p.id}
                player={p}
                accent={accentFor(i)}
                connected={connected[p.id] ?? true}
                isYou={p.id === meId}
              />
            ))}
          </section>

          <details className="w-full max-w-md">
            <summary className="cursor-pointer text-center text-sm font-bold text-[var(--color-stone-700)]">
              Logboek
            </summary>
            <ul className="card-pop mt-2 max-h-48 overflow-auto p-3 text-sm font-semibold">
              {[...state.log].reverse().map((l, i) => (
                <li key={i} className="border-b border-[var(--color-clay-200)] py-1 last:border-0">
                  <span className="text-[var(--color-stone-500)]">D{l.day}</span> {l.text}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </main>
  );
}

function Header({ code }: { code: string }) {
  return (
    <header className="flex flex-col items-center text-center">
      <Mammoth className="anim-bob h-20 w-28" title="Paleo" />
      <h1 className="text-stroke text-5xl font-extrabold text-[var(--color-ochre-500)]">Paleo</h1>
      <p className="font-semibold text-[var(--color-ink)]/70">
        Grot-bord · code <span className="font-extrabold">{code}</span>
      </p>
    </header>
  );
}

function Rules() {
  return (
    <section className="card-pop w-full max-w-2xl p-5 text-sm font-semibold text-[var(--color-stone-700)]">
      <h3 className="mb-1 text-lg font-extrabold text-[var(--color-ink)]">Hoe werkt het?</h3>
      <p>
        Elke speler bekijkt op de telefoon de achterkant van 3 kaarten en kiest er
        één. Samen verzamel je hout 🪵, vuursteen 🔪 en voedsel 🍖, bedenk je ideeën
        💡 en maak je werktuigen (vuur 🔥, speer 🗡️, fakkel 🕯️…). Jaag samen, pas op
        voor gevaren ⚠️ en schilder de grotwand 🎨. Vul de wand ({"5 stukken"}) en je
        wint — bij 5 💀 sterft de stam uit.
      </p>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8 text-center text-xl font-bold text-[var(--color-stone-700)]">
      {children}
    </main>
  );
}
