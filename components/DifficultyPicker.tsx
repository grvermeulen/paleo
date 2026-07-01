"use client";

import type { Difficulty } from "@/lib/engine";

const OPTIONS: { id: Difficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "🐣 Makkelijk", blurb: "Zwakkere prooi, taaiere stam" },
  { id: "normal", label: "⚖️ Normaal", blurb: "De standaard-uitdaging" },
  { id: "hard", label: "🔥 Moeilijk", blurb: "Sterkere prooi, hardere worpen" },
];

/** Choose the hunt difficulty in the lobby. Read-only for non-hosts. */
export default function DifficultyPicker({
  value,
  canEdit = false,
  onChange,
}: {
  value: Difficulty;
  canEdit?: boolean;
  onChange?: (d: Difficulty) => void;
}) {
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[1];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span className="text-sm font-extrabold text-[var(--color-stone-700)]">Moeilijkheid</span>
      <div className="flex w-full gap-2">
        {OPTIONS.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              disabled={!canEdit}
              aria-pressed={active}
              onClick={() => canEdit && onChange?.(o.id)}
              className={`flex-1 rounded-2xl border-4 px-2 py-2 text-sm font-extrabold transition ${
                active
                  ? "border-[var(--color-ink)] bg-[var(--color-ochre-400)] text-white"
                  : "border-[var(--color-ink)] bg-white/60 text-[var(--color-ink)]"
              } ${!canEdit && !active ? "opacity-40" : ""} ${canEdit ? "active:translate-y-0.5" : "cursor-default"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-[var(--color-stone-500)]">{current.blurb}</span>
    </div>
  );
}
