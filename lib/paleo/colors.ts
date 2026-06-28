/** Per-player accent colours, assigned by seat order. */
export const ACCENTS = ["#c2701c", "#6f8f3b", "#4c93b8", "#8a6fb0"];

export function accentFor(i: number): string {
  return ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];
}
