"use client";

import { motion } from "framer-motion";
import type { Hint } from "@/lib/paleo/cards";
import { HINT_META } from "@/lib/paleo/display";

/**
 * The hidden back of a card — shows only its terrain hint, like peeking at the
 * back of the real card. Used both to choose between the top 3 and (read-only)
 * to show that another player is still holding cards.
 */
export default function CardBack({
  hint,
  onClick,
  selected = false,
  disabled = false,
  size = "md",
}: {
  hint: Hint;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const meta = HINT_META[hint];
  const dim = size === "sm" ? "h-16 w-12" : "h-28 w-20 sm:h-32 sm:w-24";
  const emoji = size === "sm" ? "text-2xl" : "text-4xl";
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      data-testid="card-back"
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      className={`relative flex ${dim} shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-4 text-white transition ${
        selected
          ? "border-[var(--color-ink)] ring-4 ring-[var(--color-sunny,#ffd23f)]"
          : "border-[var(--color-ink)]"
      } ${disabled && onClick ? "opacity-50" : ""}`}
      style={{ backgroundColor: meta.color }}
    >
      {/* rock-texture dots */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl opacity-20"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1.5px)",
          backgroundSize: "10px 10px",
        }}
      />
      <span className={emoji} aria-hidden>
        {meta.emoji}
      </span>
      <span className="text-stroke text-xs font-extrabold uppercase tracking-wide">
        {meta.label}
      </span>
    </Comp>
  );
}
