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
        <span
          key={it.key}
          className={`inline-flex items-center gap-1 rounded-full border-2 border-[var(--color-ink)] bg-white/70 font-extrabold ${text} ${pad}`}
        >
          <span aria-hidden>{it.emoji}</span>
          <span className="tabular-nums">{it.value}</span>
        </span>
      ))}
    </div>
  );
}
