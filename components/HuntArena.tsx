"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  type GameState,
  weaponStrength,
  cardOf,
  huntDodgeTarget,
  HUNT_HIT,
} from "@/lib/engine";
import Mammoth from "./Mammoth";

/**
 * Shared, turn-based DICE hunt — rendered to every participant's phone and the
 * host board while `state.hunt` is set. On your turn you roll 2d6: attacks add
 * your weapons and subtract prey strength (you must reach 7 to wound it), then
 * you dodge (2d6 + tribe vs 6 + prey strength). Only the current player's device
 * can roll; the rolled dice are dispatched via `onRoll` so every peer reduces
 * the same result. The host can roll for a disconnected player.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const rollDie = () => 1 + Math.floor(Math.random() * 6);

function preyVisual(cardId: string) {
  switch (cardId) {
    case "hert":
      return "🦌";
    case "zwijn":
      return "🐗";
    case "wolven":
      return "🐺";
    default:
      return null; // mammoet → SVG
  }
}

export default function HuntArena({
  state,
  meId,
  connected,
  isHost = false,
  onRoll,
  onFlee,
}: {
  state: GameState;
  meId: string;
  connected?: Record<string, boolean>;
  isHost?: boolean;
  onRoll: (dice: [number, number]) => void;
  onFlee?: () => void;
}) {
  const hunt = state.hunt;
  const [rolling, setRolling] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([1, 1]);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!hunt) return null;

  const card = cardOf(`${hunt.cardId}#0`);
  const opt = card.options[hunt.optionIndex];
  const F = opt?.fight ?? 1;
  const W = weaponStrength(state);
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Speler";

  const currentId = hunt.order[hunt.turn];
  const currentConnected = connected ? connected[currentId] ?? true : true;
  const myTurn = currentId === meId;
  const hostFallback = isHost && !currentConnected; // roll for an AFK player
  const canRoll = (myTurn || hostFallback) && !rolling;
  const canFlee = !!onFlee && meId === hunt.initiatorId && hunt.seq === 0 && !rolling;

  function doRoll() {
    if (rolling) return;
    setRolling(true);
    const final: [number, number] = [rollDie(), rollDie()];
    let ticks = 0;
    iv.current = setInterval(() => {
      setFaces([rollDie(), rollDie()]);
      if (++ticks > 8) {
        if (iv.current) clearInterval(iv.current);
        setFaces(final);
        setRolling(false);
        onRoll(final);
      }
    }, 60);
  }

  const shownDice: [number, number] = rolling ? faces : hunt.lastRoll?.dice ?? [1, 1];
  const accent = card.hint === "danger" ? "var(--color-ember)" : "var(--color-ochre-500)";
  const attackStep = hunt.step === "attack";

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="card-pop w-full max-w-md overflow-hidden p-0"
      data-testid="hunt-arena"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-white" style={{ backgroundColor: accent }}>
        <h3 className="text-stroke text-lg font-extrabold">🎲 Jacht: {card.title}</h3>
        <span className="text-sm font-bold">kracht {W}</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* Prey + HP */}
        <div className="flex flex-col items-center gap-1">
          <motion.div
            key={hunt.preyHp}
            animate={{ x: [0, -6, 6, -3, 0] }}
            transition={{ duration: 0.25 }}
            className="text-6xl"
            aria-hidden
          >
            {preyVisual(hunt.cardId) ?? <Mammoth className="h-20 w-24" />}
          </motion.div>
          <HpBar value={hunt.preyHp} max={hunt.preyMaxHp} color="var(--color-ember)" label="Prooi" />
        </div>

        {/* Turn + step */}
        <div className="flex items-center justify-between text-sm font-extrabold">
          <span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-clay-200)] px-3 py-0.5">
            {attackStep ? "🗡️ Aanval" : "💨 Ontwijken"}
          </span>
          <span className="text-[var(--color-stone-700)]">
            Beurt: {nameOf(currentId)}
            {myTurn ? " (jij)" : ""}
          </span>
        </div>

        {/* Dice + roll */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <Die value={shownDice[0]} rolling={rolling} />
            <Die value={shownDice[1]} rolling={rolling} />
          </div>

          {/* last roll outcome (synced, visible to everyone) */}
          <AnimatePresence mode="wait">
            <motion.p
              key={hunt.seq}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="h-5 text-center text-sm font-extrabold"
            >
              {hunt.lastRoll ? rollText(hunt.lastRoll, nameOf(hunt.lastRoll.by)) : ""}
            </motion.p>
          </AnimatePresence>

          {/* threshold hint */}
          <p className="text-center text-xs font-semibold text-[var(--color-stone-700)]">
            {attackStep
              ? `Raak bij 2d6 + ${W} − ${F} ≥ ${HUNT_HIT}`
              : `Ontwijk bij 2d6 + stam ${state.tribe} ≥ ${huntDodgeTarget(F)}`}
          </p>

          {canRoll ? (
            <button onClick={doRoll} className="btn-pop bg-[var(--color-moss-300)]">
              🎲 {hostFallback && !myTurn ? `Gooi voor ${nameOf(currentId)}` : "Gooi!"}
            </button>
          ) : (
            <p className="text-center text-sm font-bold text-[var(--color-stone-500)]">
              {rolling ? "…" : `Wachten op ${nameOf(currentId)}…`}
            </p>
          )}

          {canFlee && (
            <button onClick={onFlee} className="text-xs font-bold text-[var(--color-stone-700)] underline">
              Blaas de jacht af
            </button>
          )}
        </div>

        {/* shared tribe HP */}
        <HpBar value={hunt.tribeHp} max={hunt.tribeMaxHp} color="var(--color-moss-500)" label="Stam ❤️" />
      </div>
    </motion.div>
  );
}

function rollText(
  lr: NonNullable<GameState["hunt"]>["lastRoll"],
  name: string,
): string {
  if (!lr) return "";
  const sum = lr.dice[0] + lr.dice[1];
  if (lr.kind === "attack") {
    return lr.ok ? `${name}: ${sum} → raak! prooi −${lr.dmg}` : `${name}: ${sum} → mis`;
  }
  return lr.ok ? `${name}: ${sum} → ontweken 💨` : `${name}: ${sum} → geraakt! stam −${lr.dmg}`;
}

function HpBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div className="w-full">
      <div className="mb-0.5 flex items-center justify-between text-xs font-bold text-[var(--color-stone-700)]">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.max(0, value)}/{max}
        </span>
      </div>
      <div className="h-3.5 w-full overflow-hidden rounded-full border-2 border-[var(--color-ink)] bg-white/60">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      </div>
    </div>
  );
}

// Pip layout for a standard die face.
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <motion.div
      animate={rolling ? { rotate: [0, -12, 12, -6, 0], y: [0, -6, 0] } : { rotate: 0, y: 0 }}
      transition={rolling ? { duration: 0.18, repeat: Infinity } : { type: "spring", stiffness: 300, damping: 18 }}
      className="grid h-14 w-14 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl border-4 border-[var(--color-ink)] bg-[var(--color-bone)] p-1.5 shadow-[var(--shadow-pop)]"
      aria-label={`Dobbelsteen ${value}`}
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = (PIPS[value] ?? []).some(([pr, pc]) => pr === r && pc === c);
        return <span key={i} className={`m-auto h-2 w-2 rounded-full ${on ? "bg-[var(--color-ink)]" : ""}`} />;
      })}
    </motion.div>
  );
}
