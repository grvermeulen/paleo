"use client";

import { useEffect, useState } from "react";
import { sound, type SoundSettings } from "@/lib/sound";

/** Small mute toggle + optional music control (host board). */
export default function SoundMenu({ showMusic = false }: { showMusic?: boolean }) {
  const [settings, setSettings] = useState<SoundSettings>({ muted: false, musicVolume: 0.5 });
  const [musicOn, setMusicOn] = useState(false);

  useEffect(() => sound.subscribe(setSettings), []);

  return (
    <div className="flex items-center gap-2">
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
