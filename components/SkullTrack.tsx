/** The death track: filled skulls vs the limit. Turns red as it fills. */
export default function SkullTrack({
  skulls,
  limit,
  size = "md",
}: {
  skulls: number;
  limit: number;
  size?: "sm" | "md" | "lg";
}) {
  const px = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const danger = skulls >= limit - 1;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex items-center gap-1 ${px}`}>
        {Array.from({ length: limit }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={
              i < skulls
                ? danger
                  ? "anim-wiggle"
                  : ""
                : "opacity-25 grayscale"
            }
          >
            💀
          </span>
        ))}
      </div>
      <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-stone-700)]">
        Verlies bij {limit}
      </span>
    </div>
  );
}
