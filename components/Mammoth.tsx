/** A friendly cartoon mammoth — the app mascot, drawn as an SVG. */
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
      <g stroke="#5c4327" strokeWidth="12" strokeLinecap="round">
        <line x1="44" y1="62" x2="44" y2="82" />
        <line x1="70" y1="62" x2="70" y2="82" />
      </g>
      <g stroke="#9e560f" strokeWidth="7" strokeLinecap="round">
        <line x1="44" y1="64" x2="44" y2="80" />
        <line x1="70" y1="64" x2="70" y2="80" />
      </g>
      {/* body + head hump */}
      <ellipse cx="57" cy="50" rx="33" ry="27" fill="#5c4327" />
      <ellipse cx="57" cy="50" rx="29" ry="23" fill="#9e560f" />
      <circle cx="84" cy="40" r="19" fill="#5c4327" />
      <circle cx="84" cy="40" r="15.5" fill="#b5701f" />
      {/* shaggy fur hint */}
      <path
        d="M26 52 q4 8 0 16 M34 58 q4 7 0 15 M80 64 q3 7 0 14"
        stroke="#7a4a1c"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* trunk */}
      <path
        d="M97 44 q12 6 9 20 q-2 12 -12 14"
        stroke="#5c4327"
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M97 44 q12 6 9 20 q-2 12 -12 14"
        stroke="#b5701f"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* tusk */}
      <path
        d="M92 52 q10 8 6 20"
        stroke="#f4ecd8"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* eye */}
      <circle cx="88" cy="36" r="2.6" fill="#2c2117" />
    </svg>
  );
}
