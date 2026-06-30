import { TOOLS, type ToolId } from "@/lib/paleo/cards";

const ORDER: ToolId[] = ["vuur", "fakkel", "speer", "botspeer", "bijl", "knots", "mand"];

/** The tribe's invention shelf: owned tools highlighted, the rest faded. */
export default function ToolShelf({
  tools,
  compact = false,
}: {
  tools: ToolId[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {ORDER.map((id) => {
        const owned = tools.includes(id);
        const t = TOOLS[id];
        return (
          <span
            key={id}
            title={t.blurb}
            className={`inline-flex items-center gap-1 rounded-xl border-2 px-2 py-1 font-bold transition ${
              owned
                ? "border-[var(--color-ink)] bg-[var(--color-clay-100)]"
                : "border-dashed border-[var(--color-stone-300)] bg-white/40 opacity-50"
            } ${compact ? "text-sm" : "text-base"}`}
          >
            <span aria-hidden className={owned && id === "vuur" ? "anim-flicker" : ""}>
              {t.emoji}
            </span>
            {!compact && <span>{t.name}</span>}
          </span>
        );
      })}
    </div>
  );
}
