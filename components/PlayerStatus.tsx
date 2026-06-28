"use client";

import { motion } from "framer-motion";
import type { PaleoPlayer } from "@/lib/engine";
import { cardOf } from "@/lib/engine";
import { HINT_META } from "@/lib/paleo/display";

/** Host-board summary of one player: name, deck left, and what they're doing. */
export default function PlayerStatus({
  player,
  accent,
  connected = true,
  isYou = false,
}: {
  player: PaleoPlayer;
  accent: string;
  connected?: boolean;
  isYou?: boolean;
}) {
  const active = player.active ? cardOf(player.active) : null;
  const empty = player.deck.length === 0 && !player.active;
  const state = active
    ? `bezig: ${active.title}`
    : empty
      ? "klaar voor de nacht"
      : "kiest een kaart…";

  return (
    <motion.div
      layout
      className={`card-pop flex items-center gap-3 p-3 ${active ? "anim-turn" : ""}`}
      style={{ borderColor: "var(--color-ink)" }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-ink)] text-lg font-extrabold text-white"
        style={{ backgroundColor: accent }}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-extrabold">
          <span className="truncate">{player.name}</span>
          {isYou && <span className="text-xs text-[var(--color-stone-700)]">(jij)</span>}
          {!connected && <span title="offline">📴</span>}
        </div>
        <div className="text-sm font-semibold text-[var(--color-stone-700)]">{state}</div>
      </div>
      <div className="flex items-center gap-1">
        {active && (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: HINT_META[active.hint].color }}
            aria-hidden
          >
            {HINT_META[active.hint].emoji}
          </span>
        )}
        <span className="rounded-full bg-[var(--color-clay-100)] px-2 py-0.5 text-sm font-bold tabular-nums">
          🂠 {player.deck.length}
        </span>
      </div>
    </motion.div>
  );
}
