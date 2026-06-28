"use client";

import { motion } from "framer-motion";

/**
 * The cave wall the tribe is painting. Each victory piece reveals one more ochre
 * animal; completing the wall wins the game.
 */
const ANIMALS = [
  // mammoth
  "M8 30 q0 -10 10 -10 q8 0 9 8 q4 -1 5 3 q1 4 -3 5 l-2 4 m-12 -8 l0 7 m8 -7 l0 7",
  // deer / stag
  "M10 32 l3 -10 l3 4 l3 -4 l3 10 m-9 -8 l-3 -6 m12 6 l3 -6",
  // bison
  "M8 28 q2 -8 12 -8 q10 0 12 8 l-2 6 m-18 -6 l0 6 m16 -6 l0 6",
  // horse
  "M9 30 q1 -9 7 -10 q3 -6 6 -4 q-1 3 -3 4 q6 1 7 10 m-13 -6 l0 6 m9 -6 l0 6",
  // hand print
  "M16 32 l0 -8 m-4 8 l0 -10 m4 2 l0 -6 m4 6 l0 -5 m4 7 l0 -3",
];

export default function CavePainting({
  painting,
  goal,
}: {
  painting: number;
  goal: number;
}) {
  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-4 border-[var(--color-ink)] bg-gradient-to-b from-[#caa978] to-[#a8814f] p-2 shadow-[var(--shadow-pop)]">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: goal }).map((_, i) => {
          const done = i < painting;
          return (
            <div
              key={i}
              className="relative aspect-square rounded-lg bg-[#b89263]/60 ring-1 ring-[#6b4f2f]/40"
            >
              <svg viewBox="0 0 40 40" className="h-full w-full">
                <motion.path
                  d={ANIMALS[i % ANIMALS.length]}
                  fill="none"
                  stroke="#7a2f17"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ opacity: done ? 1 : 0.12, pathLength: done ? 1 : 0.25 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </svg>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-center text-sm font-extrabold text-[#4a3420]">
        Grotwand {painting}/{goal} 🎨
      </p>
    </div>
  );
}
