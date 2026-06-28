"use client";

import { motion } from "framer-motion";

/** Defeat overlay: too many skulls — the tribe perished. */
export default function LoseScreen({
  day,
  onReplay,
  canReplay = false,
}: {
  day: number;
  onReplay?: () => void;
  canReplay?: boolean;
}) {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="card-pop flex w-full max-w-md flex-col items-center gap-3 border-[var(--color-ember-dark)] p-6 text-center"
    >
      <span className="text-6xl" aria-hidden>
        💀
      </span>
      <h2 className="text-stroke text-4xl font-extrabold text-[var(--color-ember-dark)]">
        De stam is gevallen
      </h2>
      <p className="font-semibold text-[var(--color-stone-700)]">
        Na {day} zware dag{day === 1 ? "" : "en"} werd het de stam te veel. De grot
        blijft leeg… Probeer het opnieuw.
      </p>
      {canReplay && onReplay && (
        <button onClick={onReplay} className="btn-pop bg-[var(--color-clay-200)]">
          Opnieuw proberen
        </button>
      )}
    </motion.div>
  );
}
