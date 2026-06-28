"use client";

import { useEffect, useRef } from "react";
import type { GameEvent } from "@/lib/engine";
import { playEventSfx } from "@/lib/sound";

/**
 * Plays the SFX for the latest game event, once per version. Keyed on `version`
 * so a re-render or a realtime echo doesn't replay the same sound. The acting
 * player also plays their move's sound optimistically (see the play page); this
 * covers everyone else.
 */
export default function GameSounds({
  event,
  version,
}: {
  event: GameEvent | null;
  version: number;
}) {
  const lastPlayed = useRef(-1);
  useEffect(() => {
    if (!event) return;
    if (version <= lastPlayed.current) return;
    lastPlayed.current = version;
    playEventSfx(event);
  }, [event, version]);
  return null;
}
