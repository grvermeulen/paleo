"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import Mammoth from "./Mammoth";

/** Victory overlay: the cave wall is complete. */
export default function WinScreen({
  day,
  onReplay,
  canReplay = false,
}: {
  day: number;
  onReplay?: () => void;
  canReplay?: boolean;
}) {
  useEffect(() => {
    const colors = ["#c2701c", "#9e560f", "#6f8f3b", "#e2542c", "#f4ecd8"];
    const end = Date.now() + 1200;
    const tick = () => {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(tick);
    };
    tick();
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 16 }}
      className="card-pop flex w-full max-w-md flex-col items-center gap-3 p-6 text-center"
    >
      <Mammoth className="anim-bob h-24 w-28" />
      <h2 className="text-stroke text-4xl font-extrabold text-[var(--color-moss-600)]">
        Gewonnen!
      </h2>
      <p className="font-semibold text-[var(--color-stone-700)]">
        De grotwand is af. Jullie stam overleefde {day} dag{day === 1 ? "" : "en"} en
        liet zijn teken na voor de eeuwigheid. 🎨
      </p>
      {canReplay && onReplay && (
        <button onClick={onReplay} className="btn-pop bg-[var(--color-moss-300)]">
          Nog een keer
        </button>
      )}
    </motion.div>
  );
}
