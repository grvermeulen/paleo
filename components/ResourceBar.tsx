"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Stock } from "@/lib/engine";
import { RES_META, TRIBE } from "@/lib/paleo/display";

/** Compact row of the tribe's shared resources + member count. */
export default function ResourceBar({
  stock,
  tribe,
  size = "md",
}: {
  stock: Stock;
  tribe: number;
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const pad = size === "lg" ? "px-3 py-1.5" : "px-2.5 py-1";
  const items: { key: string; emoji: string; value: number }[] = [
    { key: "wood", emoji: RES_META.wood.emoji, value: stock.wood },
    { key: "flint", emoji: RES_META.flint.emoji, value: stock.flint },
    { key: "food", emoji: RES_META.food.emoji, value: stock.food },
    { key: "ideas", emoji: RES_META.ideas.emoji, value: stock.ideas },
    { key: "tribe", emoji: TRIBE, value: tribe },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {items.map((it) => (
        <Pill key={it.key} emoji={it.emoji} value={it.value} text={text} pad={pad} />
      ))}
    </div>
  );
}

/** One stat chip that pops briefly whenever its value changes (loot landing). */
function Pill({ emoji, value, text, pad }: { emoji: string; value: number; text: string; pad: string }) {
  const prev = useRef(value);
  const [bump, setBump] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prev.current !== value) {
      setBump(value > prev.current ? "up" : "down");
      prev.current = value;
      const t = setTimeout(() => setBump(null), 320);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <motion.span
      animate={bump ? { scale: [1, 1.35, 1] } : { scale: 1 }}
      transition={{ duration: 0.32 }}
      className={`inline-flex items-center gap-1 rounded-full border-2 font-extrabold ${text} ${pad} ${
        bump === "up"
          ? "border-[var(--color-moss-500)] bg-[var(--color-moss-300)]/40"
          : bump === "down"
            ? "border-[var(--color-ember)] bg-[var(--color-ember)]/15"
            : "border-[var(--color-ink)] bg-white/70"
      }`}
    >
      <span aria-hidden>{emoji}</span>
      <span className="tabular-nums">{value}</span>
    </motion.span>
  );
}
