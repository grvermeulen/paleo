"use client";

import { useEffect, useState } from "react";
import { sound, type SoundSettings } from "@/lib/sound";
import { getQuickHunt, setQuickHunt } from "@/lib/identity";

/** Small mute toggle + optional music control + quick-hunt toggle. */
export default function SoundMenu({
  showMusic = false,
  showQuickHunt = false,
}: {
  showMusic?: boolean;
  showQuickHunt?: boolean;
}) {
  const [settings, setSettings] = useState<SoundSettings>({ muted: false, musicVolume: 0.5 });
  const [musicOn, setMusicOn] = useState(false);
  const [quickHunt, setQuick] = useState(false);

  useEffect(() => sound.subscribe(setSettings), []);
  useEffect(() => setQuick(getQuickHunt()), []);

  return (
    <div className="flex items-center gap-2">
      {showQuickHunt && (
        <button
          onClick={() => {
            const next = !quickHunt;
            setQuickHunt(next);
            setQuick(next);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-white/70 text-xl"
          aria-label={quickHunt ? "Jacht-minigame aan" : "Snelle jacht (geen minigame)"}
          title={quickHunt ? "Snelle jacht aan — tik voor de minigame" : "Jacht-minigame aan — tik voor snelle jacht"}
        >
          {quickHunt ? "⚡" : "🏹"}
        </button>
      )}
      <button
        onClick={() => {
          sound.unlock();
          sound.toggleMute();
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-white/70 text-xl"
        aria-label={settings.muted ? "Geluid aan" : "Geluid uit"}
      >
        {settings.muted ? "🔇" : "🔊"}
      </button>
      {showMusic && (
        <button
          onClick={() => {
            sound.unlock();
            if (musicOn) {
              sound.stopMusic();
              setMusicOn(false);
            } else {
              sound.startMusic();
              setMusicOn(true);
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-white/70 text-xl"
          aria-label={musicOn ? "Muziek uit" : "Muziek aan"}
        >
          {musicOn ? "🎵" : "🎶"}
        </button>
      )}
    </div>
  );
}
