import { TOOLS, type ToolId } from "@/lib/paleo/cards";

const ORDER: ToolId[] = ["vuur", "fakkel", "speer", "botspeer", "bijl", "knots", "mand"];

/**
 * The tribe's invention shelf. Three states per tool:
 *  - carried (in `active`)        → highlighted, in play this round
 *  - owned but left behind        → desaturated "💤 opgeslagen" (not counting for combat)
 *  - not yet invented             → dashed & faded
 *
 * `active` is the carried subset; when omitted, every owned tool is treated as
 * carried (used by the standalone tutorial demo).
 */
export default function ToolShelf({
  tools,
  active,
  compact = false,
}: {
  tools: ToolId[];
  active?: ToolId[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {ORDER.map((id) => {
        const owned = tools.includes(id);
        const carried = owned && (active ? active.includes(id) : true);
        const stored = owned && !carried; // left behind at the last transition
        const t = TOOLS[id];
        return (
          <span
            key={id}
            title={stored ? `${t.name} — niet meegenomen (telt niet mee in gevecht)` : t.blurb}
            className={`relative inline-flex items-center gap-1 rounded-xl border-2 px-2 py-1 font-bold transition ${
              carried
                ? "border-[var(--color-ink)] bg-[var(--color-clay-100)]"
                : stored
                  ? "border-[var(--color-stone-300)] bg-[var(--color-stone-300)]/20 text-[var(--color-stone-500)] opacity-60 grayscale"
                  : "border-dashed border-[var(--color-stone-300)] bg-white/40 opacity-50"
            } ${compact ? "text-sm" : "text-base"}`}
          >
            <span aria-hidden className={carried && id === "vuur" ? "anim-flicker" : ""}>
              {t.emoji}
            </span>
            {!compact && <span>{t.name}</span>}
            {stored && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1.5 text-xs"
                title="Niet meegenomen"
              >
                💤
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
