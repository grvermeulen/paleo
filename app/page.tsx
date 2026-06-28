"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createGame, createGameAndJoin, joinGame } from "@/lib/api";
import { getDeviceId, getSavedName, saveName } from "@/lib/identity";
import Mammoth from "@/components/Mammoth";
import { HowToPlayButton } from "@/components/HowToPlay";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"host" | "join" | "phone" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(getSavedName()), []);

  // Phone-only: create a game and join it yourself, no separate laptop/TV board.
  async function createOnPhone() {
    setError(null);
    if (name.trim().length < 1) return setError("Vul je naam in.");
    setBusy("phone");
    try {
      saveName(name.trim());
      const newCode = await createGameAndJoin(getDeviceId(), name.trim());
      router.push(`/play/${newCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
      setBusy(null);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length < 3) return setError("Vul de spelcode in.");
    if (name.trim().length < 1) return setError("Vul je naam in.");
    setBusy("join");
    try {
      saveName(name.trim());
      await joinGame(code.trim().toUpperCase(), getDeviceId(), name.trim());
      router.push(`/play/${code.trim().toUpperCase()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Meedoen lukte niet.");
      setBusy(null);
    }
  }

  // Laptop/TV board mode: host shows the grot-board, players join on phones.
  async function host() {
    setError(null);
    setBusy("host");
    try {
      const newCode = await createGame(getDeviceId());
      router.push(`/host/${newCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-5 py-10">
      <header className="flex flex-col items-center text-center">
        <Mammoth className="anim-bob h-24 w-32" title="Paleo" />
        <h1 className="text-stroke mt-2 text-6xl font-extrabold text-[var(--color-ochre-500)]">
          Paleo
        </h1>
        <p className="mt-1 text-base font-semibold text-[var(--color-ink)]/70">
          Overleef samen de steentijd 🦣🔥
        </p>
        <HowToPlayButton className="mt-3" label="📖 Hoe werkt het? / Spelregels" />
      </header>

      {error && (
        <div className="card-pop w-full border-[var(--color-ember)] bg-[var(--color-ember)]/10 px-4 py-3 text-center font-bold text-[var(--color-ember-dark)]">
          {error}
        </div>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Je naam"
        maxLength={16}
        className="w-full rounded-2xl border-4 border-[var(--color-ink)] bg-white px-4 py-3 text-center text-xl font-bold outline-none focus:ring-4 focus:ring-[var(--color-clay-300)]"
      />

      <section className="card-pop flex w-full flex-col gap-3 p-5">
        <h2 className="text-xl font-extrabold">Samen op je telefoon 📱</h2>
        <p className="text-sm font-semibold text-[var(--color-ink)]/70">
          Maak een spel op je eigen telefoon en speel zelf mee. Geen laptop nodig —
          de anderen doen mee met de code.
        </p>
        <button
          onClick={createOnPhone}
          disabled={busy !== null}
          className="btn-pop bg-[var(--color-ochre-400)] text-white"
        >
          {busy === "phone" ? "Bezig…" : "🦣 Maak een nieuw spel"}
        </button>
      </section>

      <section className="card-pop flex w-full flex-col gap-3 p-5">
        <h2 className="text-xl font-extrabold">Meedoen met een code</h2>
        <form onSubmit={join} className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SPELCODE"
            maxLength={4}
            autoCapitalize="characters"
            className="w-full rounded-2xl border-4 border-[var(--color-ink)] bg-white px-4 py-3 text-center text-2xl font-extrabold tracking-[0.3em] outline-none focus:ring-4 focus:ring-[var(--color-clay-300)]"
          />
          <button type="submit" disabled={busy !== null} className="btn-pop bg-[var(--color-moss-300)]">
            {busy === "join" ? "Bezig…" : "👣 Doe mee"}
          </button>
        </form>
      </section>

      <details className="w-full">
        <summary className="cursor-pointer text-center text-sm font-bold text-[var(--color-ink)]/60">
          Liever een groot grot-bord op de laptop / TV?
        </summary>
        <section className="card-pop mt-3 flex w-full flex-col gap-3 p-5">
          <p className="text-sm font-semibold text-[var(--color-ink)]/70">
            Start het bord op een laptop of TV. Spelers doen mee met hun telefoon
            als controller.
          </p>
          <button onClick={host} disabled={busy !== null} className="btn-pop bg-[var(--color-clay-200)]">
            {busy === "host" ? "Bezig…" : "🔥 Start een grot-bord"}
          </button>
        </section>
      </details>

      <p className="max-w-xs text-center text-xs font-semibold text-[var(--color-ink)]/45">
        Coöperatief voor 1–4 spelers. Verzamel, maak werktuigen, jaag samen en
        schilder de grotwand voor de duisternis jullie inhaalt.
      </p>
    </main>
  );
}
