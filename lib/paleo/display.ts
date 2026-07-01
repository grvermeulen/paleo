/** Presentation metadata for cards & resources — emoji, labels, colours. */

import type { Hint, Resource } from "./cards";

export const HINT_META: Record<Hint, { emoji: string; label: string; color: string }> = {
  forest: { emoji: "🌳", label: "Bos", color: "#6f8f3b" },
  water: { emoji: "🌊", label: "Water", color: "#4c93b8" },
  hunt: { emoji: "🏹", label: "Jacht", color: "#c2701c" },
  cave: { emoji: "🕳️", label: "Grot", color: "#5c5547" },
  camp: { emoji: "🏕️", label: "Kamp", color: "#d98a2b" },
  people: { emoji: "👣", label: "Mensen", color: "#8a6fb0" },
  danger: { emoji: "⚠️", label: "Gevaar", color: "#e2542c" },
};

export const RES_META: Record<Resource | "ideas" | "bones", { emoji: string; label: string }> = {
  wood: { emoji: "🪵", label: "Hout" },
  flint: { emoji: "🔪", label: "Vuursteen" },
  food: { emoji: "🍖", label: "Voedsel" },
  ideas: { emoji: "💡", label: "Ideeën" },
  bones: { emoji: "🦴", label: "Botten" },
};

export const SKULL = "💀";
export const TRIBE = "👥";
export const PAINTING = "🎨";
