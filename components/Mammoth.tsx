"use client";

import { motion } from "framer-motion";

/**
 * The app mascot — a friendly woolly mammoth, drawn as an SVG with gentle idle
 * life: a breathing body, a swaying trunk, a flapping ear and an occasional
 * blink. Big two-tone ear, a shaggy coat and forward-curling tusks. Kept at the
 * original 120×100 viewBox so existing sizes still fit.
 */
export default function Mammoth({
  className,
  title = "Mammoet",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label={title}>
      <title>{title}</title>

      {/* legs with shaggy cuffs */}
      <g stroke="#4a3620" strokeWidth="13" strokeLinecap="round">
        <line x1="40" y1="60" x2="40" y2="84" />
        <line x1="66" y1="60" x2="66" y2="84" />
      </g>
      <g stroke="#7a4a1c" strokeWidth="7" strokeLinecap="round">
        <line x1="40" y1="64" x2="40" y2="82" />
        <line x1="66" y1="64" x2="66" y2="82" />
      </g>
      <path
        d="M33 78 q3 6 7 2 M47 78 q3 6 7 2 M59 78 q3 6 7 2 M73 78 q3 6 7 2"
        stroke="#4a3620"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* breathing body + head group */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={{ scale: [1, 1.035, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* shaggy body */}
        <ellipse cx="55" cy="48" rx="37" ry="30" fill="#5c4327" />
        <ellipse cx="55" cy="50" rx="32" ry="25" fill="#9e560f" />
        <ellipse cx="52" cy="58" rx="23" ry="15" fill="#b5701f" />

        {/* ragged fur fringe hanging from the belly + back */}
        <path
          d="M21 50 q4 -10 10 -3 q4 -9 10 -2 q5 -9 11 -2 q5 -8 11 -1 q6 -8 12 0"
          stroke="#5c4327"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M22 62 q4 9 8 3 q3 9 8 3 q3 9 8 2 q3 8 8 2 q4 8 8 1 q4 7 8 0"
          stroke="#7a4a1c"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        {/* side fur strokes for extra shag */}
        <path
          d="M30 44 q3 8 0 16 M40 42 q3 9 0 18 M50 41 q2 9 0 18"
          stroke="#7a4a1c"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* head hump with a tuft */}
        <circle cx="86" cy="38" r="20" fill="#5c4327" />
        <circle cx="86" cy="39" r="16" fill="#b5701f" />
        <path d="M84 19 q3 -5 6 0 M89 20 q3 -4 5 1" stroke="#5c4327" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* big two-tone ear (flaps gently) */}
        <motion.g
          style={{ transformBox: "fill-box", transformOrigin: "right" }}
          animate={{ rotate: [0, -12, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M83 21 q-23 -7 -24 15 q15 10 26 -2 z" fill="#5c4327" />
          <path d="M80 25 q-16 -5 -17 11 q11 7 19 -1 z" fill="#b5701f" />
        </motion.g>

        {/* forward-curling tusks */}
        <path d="M90 53 q-4 13 3 19 q9 5 15 -4" stroke="#f4ecd8" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M85 55 q-4 11 2 16 q8 4 13 -3" stroke="#e9dcbb" strokeWidth="5" fill="none" strokeLinecap="round" />

        {/* eye (blinks) */}
        <motion.ellipse
          cx="90"
          cy="35"
          rx="2.8"
          ry="2.8"
          fill="#2c2117"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          animate={{ scaleY: [1, 1, 1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.86, 0.9, 0.94, 1] }}
        />
        <circle cx="91" cy="34" r="0.9" fill="#fff" />

        {/* trunk (sways from the head) */}
        <motion.g
          style={{ transformBox: "fill-box", transformOrigin: "top" }}
          animate={{ rotate: [0, 5, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M99 44 q14 7 11 22 q-2 13 -13 16"
            stroke="#5c4327"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M99 44 q14 7 11 22 q-2 13 -13 16"
            stroke="#b5701f"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </motion.g>
      </motion.g>
    </svg>
  );
}
