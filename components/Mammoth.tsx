"use client";

import { motion } from "framer-motion";

/**
 * The app mascot — a friendly woolly mammoth, drawn as an SVG with gentle idle
 * life: a breathing body, a swaying trunk, a flapping ear and an occasional
 * blink. Kept at the original 120×100 viewBox so existing sizes still fit.
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

      {/* legs */}
      <g stroke="#4a3620" strokeWidth="13" strokeLinecap="round">
        <line x1="40" y1="60" x2="40" y2="84" />
        <line x1="66" y1="60" x2="66" y2="84" />
      </g>
      <g stroke="#7a4a1c" strokeWidth="7" strokeLinecap="round">
        <line x1="40" y1="64" x2="40" y2="82" />
        <line x1="66" y1="64" x2="66" y2="82" />
      </g>

      {/* breathing body + head group */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={{ scale: [1, 1.035, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* shaggy body */}
        <ellipse cx="55" cy="48" rx="36" ry="29" fill="#5c4327" />
        <ellipse cx="55" cy="50" rx="31" ry="24" fill="#9e560f" />
        <ellipse cx="52" cy="58" rx="22" ry="14" fill="#b5701f" />

        {/* fur tufts along the back */}
        <path
          d="M24 40 q5 -9 11 -2 q5 -8 11 -1 q6 -8 12 -1 q6 -7 12 0"
          stroke="#5c4327"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />

        {/* head hump */}
        <circle cx="86" cy="38" r="20" fill="#5c4327" />
        <circle cx="86" cy="39" r="16" fill="#b5701f" />

        {/* ear (flaps gently) */}
        <motion.path
          d="M78 26 q-12 -4 -14 8 q9 4 16 -1 z"
          fill="#5c4327"
          style={{ transformBox: "fill-box", transformOrigin: "right" }}
          animate={{ rotate: [0, -10, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* tusks */}
        <path d="M92 50 q12 9 7 23" stroke="#f4ecd8" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M84 53 q9 8 5 20" stroke="#efe2c2" strokeWidth="5" fill="none" strokeLinecap="round" />

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
