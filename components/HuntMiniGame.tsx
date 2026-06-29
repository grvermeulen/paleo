"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type GameState, weaponStrength } from "@/lib/engine";
import type { Card, CardOption } from "@/lib/paleo/cards";
import { sound } from "@/lib/sound";
import Mammoth from "./Mammoth";

/**
 * Turn-based hunting mini-game (Mode B: skill can override stats).
 *
 * Each round you ATTACK (a timing meter — land in the sweet spot for bonus
 * damage, your weapons set the floor) and then the prey strikes back: DODGE
 * within a reaction window or take a hit. Reduce the prey's HP to 0 to win;
 * lose all your tribe's HP and the hunt fails. Stats give an edge (weapons →
 * attack + dodge window, tribe/food → HP, target strength → prey HP + counter),
 * but a skilled player can still win an underdog fight or fumble a sure one.
 *
 * The component only decides win/lose and reports it via `onComplete`; the pure
 * engine applies the real reward/penalty (so every peer stays in sync).
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function targetEmoji(cardId: string): string {
  switch (cardId) {
    case "hert":
      return "🦌";
    case "zwijn":
      return "🐗";
    case "wolven":
      return "🐺";
    default:
      return "🦬";
  }
}

export default function HuntMiniGame({
  card,
  option,
  state,
  onComplete,
  onCancel,
}: {
  card: Card;
  option: CardOption;
  state: GameState;
  onComplete: (outcome: "win" | "lose") => void;
  onCancel: () => void;
}) {
  const F = option.fight ?? 1;
  const W = weaponStrength(state);

  // ---- derived mini-game parameters (Mode B) ----------------------------
  const targetMaxHp = 3 * F;
  const playerMaxHp = 4 + 2 * state.tribe + Math.min(state.stock.food, 3);
  const counterDmg = Math.max(1, Math.ceil(F / 2));
  // Reaction window after the strike cue: weapons widen it, prey strength
  // narrows it — but always fair (≥420ms) so skill can carry an underdog.
  const dodgeWindowMs = clamp(820 + 60 * W - 70 * F, 420, 1000);

  const [phase, setPhase] = useState<"intro" | "attack" | "dodge" | "won" | "lost">("intro");
  const [dodgeStage, setDodgeStage] = useState<"wind" | "strike">("wind");
  const [targetHp, setTargetHp] = useState(targetMaxHp);
  const [playerHp, setPlayerHp] = useState(playerMaxHp);
  const [hitFlash, setHitFlash] = useState<"target" | "player" | null>(null);
  const [toast, setToast] = useState<string>("");

  // Mirror HP in refs so timer/event callbacks always read the latest value
  // (no stale closures) and state updaters stay pure (StrictMode-safe).
  const targetHpRef = useRef(targetMaxHp);
  const playerHpRef = useRef(playerMaxHp);

  const windTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strikeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDodgeTimers = useCallback(() => {
    if (windTimer.current) clearTimeout(windTimer.current);
    if (strikeTimer.current) clearTimeout(strikeTimer.current);
    windTimer.current = null;
    strikeTimer.current = null;
  }, []);

  // Tidy up every pending timer on unmount.
  useEffect(() => {
    return () => {
      clearDodgeTimers();
      if (endTimer.current) clearTimeout(endTimer.current);
    };
  }, [clearDodgeTimers]);

  const flash = (who: "target" | "player") => {
    setHitFlash(who);
    setTimeout(() => setHitFlash(null), 220);
  };

  const finish = useCallback(
    (outcome: "win" | "lose") => {
      setPhase(outcome === "win" ? "won" : "lost");
      sound.play(outcome === "win" ? "hunt" : "fail");
      sound.vibrate(outcome === "win" ? [0, 30, 40, 30] : [0, 80, 40, 120]);
      endTimer.current = setTimeout(() => onComplete(outcome), 1100);
    },
    [onComplete],
  );

  // ---- the prey's counter-strike: dodge window or take a hit -------------
  const beginDodge = useCallback(() => {
    setPhase("dodge");
    setDodgeStage("wind");
    setToast("");
    const windup = 480 + Math.random() * 720;
    windTimer.current = setTimeout(() => {
      setDodgeStage("strike");
      strikeTimer.current = setTimeout(() => {
        // Window elapsed → the prey lands its blow.
        sound.play("hit");
        sound.vibrate([0, 80, 40, 120]);
        flash("player");
        setToast(`Geraakt! −${counterDmg} ❤️`);
        const next = Math.max(0, playerHpRef.current - counterDmg);
        playerHpRef.current = next;
        setPlayerHp(next);
        if (next <= 0) finish("lose");
        else endTimer.current = setTimeout(() => setPhase("attack"), 750);
      }, dodgeWindowMs);
    }, windup);
  }, [counterDmg, dodgeWindowMs, finish]);

  const onDodgeTap = () => {
    if (phase !== "dodge" || dodgeStage !== "strike") return; // ignore early taps
    clearDodgeTimers();
    sound.play("dodge");
    sound.vibrate(20);
    setToast("Ontweken! 💨");
    endTimer.current = setTimeout(() => setPhase("attack"), 650);
  };

  // ---- the player's attack: timing meter sets bonus damage --------------
  const onAttackLock = (bonus: number) => {
    const dmg = 1 + W + bonus;
    sound.play("hit");
    sound.vibrate(bonus >= 2 ? [0, 40, 30, 40] : 25);
    flash("target");
    setToast(bonus >= 2 ? `Voltreffer! −${dmg} 🎯` : bonus === 1 ? `Raak! −${dmg}` : `Schampschot −${dmg}`);
    const next = Math.max(0, targetHpRef.current - dmg);
    targetHpRef.current = next;
    setTargetHp(next);
    if (next <= 0) finish("win");
    else endTimer.current = setTimeout(() => beginDodge(), 700);
  };

  const isMammoth = card.id === "mammoet";
  const accent = card.hint === "danger" ? "var(--color-ember)" : "var(--color-ochre-500)";

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="card-pop w-full max-w-md overflow-hidden p-0"
      data-testid="hunt-minigame"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-white" style={{ backgroundColor: accent }}>
        <h3 className="text-stroke text-lg font-extrabold">⚔️ Jacht: {card.title}</h3>
        <span className="text-sm font-bold">kracht {W}</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* Prey + HP */}
        <div className="flex flex-col items-center gap-1">
          <motion.div
            animate={
              hitFlash === "target"
                ? { x: [0, -8, 8, -4, 0], filter: ["brightness(1)", "brightness(1.8)", "brightness(1)"] }
                : { y: [0, -4, 0] }
            }
            transition={hitFlash === "target" ? { duration: 0.22 } : { duration: 2, repeat: Infinity }}
            className="text-6xl"
            aria-hidden
          >
            {isMammoth ? <Mammoth className="h-20 w-24" /> : targetEmoji(card.id)}
          </motion.div>
          <HpBar value={targetHp} max={targetMaxHp} color="var(--color-ember)" label="Prooi" />
        </div>

        {/* Action zone */}
        <div className="min-h-[7.5rem]">
          <AnimatePresence mode="wait">
            {phase === "intro" && (
              <Step key="intro">
                <p className="text-center text-sm font-semibold text-[var(--color-stone-700)]">
                  Versla de prooi: tik je aanval op het juiste moment, ontwijk dan de tegenaanval.
                  Sterkere wapens slaan harder — maar jouw timing beslist.
                </p>
                <div className="flex justify-center gap-2">
                  <button onClick={() => setPhase("attack")} className="btn-pop bg-[var(--color-moss-300)]">
                    🗡️ Begin de jacht
                  </button>
                  <button onClick={onCancel} className="btn-pop bg-[var(--color-clay-200)] text-base">
                    Vlucht
                  </button>
                </div>
              </Step>
            )}

            {phase === "attack" && (
              <Step key="attack">
                <p className="text-center text-sm font-extrabold">Tik in de groene zone! 🎯</p>
                <AttackMeter onLock={onAttackLock} />
              </Step>
            )}

            {phase === "dodge" && (
              <Step key="dodge">
                <p className="text-center text-sm font-extrabold">
                  {dodgeStage === "wind" ? "De prooi haalt uit… wacht…" : "ONTWIJK NU! 💨"}
                </p>
                <button
                  onClick={onDodgeTap}
                  disabled={dodgeStage !== "strike"}
                  className={`btn-pop w-full ${
                    dodgeStage === "strike"
                      ? "anim-turn bg-[var(--color-ochre-400)] text-white"
                      : "bg-[var(--color-clay-200)] opacity-60"
                  }`}
                >
                  {dodgeStage === "strike" ? "💨 Ontwijk!" : "…"}
                </button>
              </Step>
            )}

            {phase === "won" && (
              <Step key="won">
                <p className="text-center text-2xl font-extrabold text-[var(--color-moss-600)]">
                  🎉 Buit binnen!
                </p>
              </Step>
            )}

            {phase === "lost" && (
              <Step key="lost">
                <p className="text-center text-2xl font-extrabold text-[var(--color-ember-dark)]">
                  💀 De prooi ontkwam…
                </p>
              </Step>
            )}
          </AnimatePresence>
        </div>

        {/* toast feedback */}
        <p className="h-5 text-center text-sm font-extrabold text-[var(--color-stone-700)]">{toast}</p>

        {/* Tribe HP */}
        <HpBar value={playerHp} max={playerMaxHp} color="var(--color-moss-500)" label="Jouw stam ❤️" />
      </div>
    </motion.div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col items-center gap-3"
    >
      {children}
    </motion.div>
  );
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

// A marker sweeps the bar; tap to lock. Center = bonus 2, near = 1, edge = 0.
// Self-contained rAF so per-frame updates don't re-render the whole mini-game.
function AttackMeter({ onLock }: { onLock: (bonus: number) => void }) {
  const [pos, setPos] = useState(0);
  const raf = useRef<number>(0);
  const start = useRef<number>(0);
  const locked = useRef(false);

  useEffect(() => {
    const PERIOD = 1150;
    const loop = (ts: number) => {
      if (!start.current) start.current = ts;
      const tline = ((ts - start.current) % PERIOD) / PERIOD; // 0..1
      setPos(tline < 0.5 ? tline * 2 : 2 - tline * 2); // ping-pong 0..1..0
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const lock = () => {
    if (locked.current) return;
    locked.current = true;
    cancelAnimationFrame(raf.current);
    const d = Math.abs(pos - 0.5);
    onLock(d < 0.08 ? 2 : d < 0.2 ? 1 : 0);
  };

  return (
    <button onClick={lock} className="w-full" aria-label="Sla toe">
      <div className="relative h-9 w-full overflow-hidden rounded-full border-4 border-[var(--color-ink)] bg-[var(--color-clay-100)]">
        {/* good zone */}
        <div className="absolute inset-y-0 left-[30%] w-[40%] bg-[var(--color-moss-300)]/60" />
        {/* perfect zone */}
        <div className="absolute inset-y-0 left-[42%] w-[16%] bg-[var(--color-moss-500)]/80" />
        {/* marker */}
        <div
          className="absolute top-0 h-full w-1.5 -translate-x-1/2 rounded bg-[var(--color-ember)]"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <span className="mt-1 inline-block rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-ember)] px-4 py-1 text-base font-extrabold text-white">
        🗡️ Sla toe!
      </span>
    </button>
  );
}
