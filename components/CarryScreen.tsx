"use client";

import { useState } from "react";
import { type GameState, CARRY_MAX } from "@/lib/engine";
import { TOOLS, type ToolId } from "@/lib/paleo/cards";

/**
 * Day↔night transition: the tribe packs its kit. You carry at most CARRY_MAX
 * tools; only carried tools count for combat (🔥/🕯️ shine at night), so you
 * trade off weapons vs. light vs. the torch you need to paint. Host confirms.
 */
export default function CarryScreen({
  state,
  isHost,
  busy = false,
  onConfirm,
}: {
  state: GameState;
  isHost: boolean;
  busy?: boolean;
  onConfirm: (tools: ToolId[]) => void;
}) {
  const to = state.transition?.to ?? "night";
  const owned = state.tools;
  const [sel, setSel] = useState<ToolId[]>(() =>
    (state.activeTools.length ? state.activeTools : owned).slice(0, CARRY_MAX),
  );

  const toggle = (t: ToolId) =>
    setSel((s) =>
      s.includes(t) ? s.filter((x) => x !== t) : s.length < CARRY_MAX ? [...s, t] : s,
    );

  const night = to === "night";
  const accent = night ? "var(--color-ink)" : "var(--color-ochre-400)";

  return (
    <div className="card-pop w-full max-w-md overflow-hidden p-0" data-testid="carry-screen">
      <div className="flex items-center gap-2 px-4 py-2 text-white" style={{ backgroundColor: accent }}>
        <h3 className="text-stroke text-lg font-extrabold">
          {night ? "🌙 Pak in voor de nacht" : "☀️ Pak in voor de dag"}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <p className="text-sm font-semibold text-[var(--color-stone-700)]">
          {night
            ? "Kies welke werktuigen mee de duisternis in gaan. 🔥 vuur en 🕯️ fakkel zijn sterk tegen nachtroofdieren."
            : "Kies je uitrusting voor de nieuwe dag."}
        </p>

        {owned.length === 0 ? (
          <p className="text-sm font-bold text-[var(--color-stone-500)]">
            Nog geen werktuigen — niets in te pakken.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {owned.map((t) => {
                const on = sel.includes(t);
                const full = !on && sel.length >= CARRY_MAX;
                const str = night ? TOOLS[t].nightStrength ?? TOOLS[t].strength : TOOLS[t].strength;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!isHost || full}
                    aria-pressed={on}
                    onClick={() => isHost && toggle(t)}
                    className={`flex items-center gap-1 rounded-2xl border-4 px-3 py-2 text-base font-extrabold transition ${
                      on
                        ? "border-[var(--color-ink)] bg-[var(--color-moss-300)]"
                        : "border-[var(--color-ink)] bg-white/60"
                    } ${full ? "opacity-40" : ""} ${isHost ? "active:translate-y-0.5" : "cursor-default"}`}
                    title={TOOLS[t].blurb}
                  >
                    <span aria-hidden>{TOOLS[t].emoji}</span>
                    {TOOLS[t].name}
                    {str > 0 && <span className="text-sm text-[var(--color-ember-dark)]">⚔️{str}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-[var(--color-stone-700)]">
              {sel.length}/{CARRY_MAX} meegenomen
            </p>
          </>
        )}

        {isHost ? (
          <button
            onClick={() => onConfirm(sel)}
            disabled={busy}
            className="btn-pop bg-[var(--color-moss-300)]"
          >
            {busy ? "Bezig…" : night ? "🌙 De nacht in" : "☀️ Begin de dag"}
          </button>
        ) : (
          <p className="text-sm font-bold text-[var(--color-stone-500)]">De host pakt in…</p>
        )}
      </div>
    </div>
  );
}
