"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ResourceBar from "./ResourceBar";
import ToolShelf from "./ToolShelf";
import SkullTrack from "./SkullTrack";
import CavePainting from "./CavePainting";
import { HINT_META } from "@/lib/paleo/display";
import type { Hint } from "@/lib/paleo/cards";

/**
 * Interactive "how to play" for newcomers, opened from a Spelregels button.
 * It walks through the game in short steps and lets you *try* the core moves
 * (flip a card, earn a skull, paint the wall) using the real board widgets, so
 * the rules click before the first round. The last step is a quick-reference
 * summary so it doubles as the rulebook.
 */

// A demo card front, revealed when you tap a face-down card in step 2.
const DEMO_CARDS: { hint: Hint; title: string; reward: string }[] = [
  { hint: "forest", title: "Dicht bos", reward: "🪵 Hout + 💡 idee" },
  { hint: "hunt", title: "Hert jagen", reward: "🍖 Voedsel" },
  { hint: "water", title: "Rivier", reward: "🍖 Voedsel + 🪵 Hout" },
];

export function HowToPlayButton({
  className = "",
  label = "📖 Spelregels",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-pop bg-[var(--color-clay-100)] text-base ${className}`}
      >
        {label}
      </button>
      <AnimatePresence>{open && <HowToPlayModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  // Per-step interactive demo state.
  const [flipped, setFlipped] = useState<number | null>(null);
  const [skulls, setSkulls] = useState(0);
  const [paint, setPaint] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: "Welkom bij Paleo 🦣",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Een <b>coöperatief</b> steentijd-avontuur voor <b>1–4 spelers</b>. Jullie
            spelen <b>samen</b> tegen het spel: verzamel grondstoffen, maak werktuigen,
            jaag en vereeuwig je stam op de grotwand.
          </p>
          <CavePainting painting={2} goal={6} />
          <p className="text-center text-sm font-bold text-[var(--color-stone-700)]">
            🎨 Vul de grotwand (6 stukken) om te <b>winnen</b> — bij 5 💀 sterft de stam uit.
          </p>
        </div>
      ),
    },
    {
      title: "1. Kies elke dag een kaart 🃏",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Je krijgt 3 kaarten te zien met alleen de <b>achterkant</b>. Het terrein
            (🌳 bos, 🌊 water, 🏹 jacht…) verklapt wat er ongeveer op zit.{" "}
            <b>Tik op een kaart</b> om te kiezen:
          </p>
          <div className="flex items-end justify-center gap-3">
            {DEMO_CARDS.map((c, i) => (
              <DemoFlipCard
                key={i}
                card={c}
                flipped={flipped === i}
                onClick={() => setFlipped(i)}
              />
            ))}
          </div>
          <p className="h-5 text-center text-sm font-extrabold text-[var(--color-moss-600)]">
            {flipped !== null ? "Goed gekozen! De kaart wordt nu uitgevoerd. ✅" : "👆 Tik een kaart om om te draaien"}
          </p>
        </div>
      ),
    },
    {
      title: "2. Verzamel grondstoffen 🪵",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Kaarten leveren grondstoffen op die de hele stam deelt: 🪵 hout, 🔪
            vuursteen, 🍖 voedsel en 💡 ideeën. 🍖 voedt elke nacht je stam 👥.
          </p>
          <div className="card-pop w-full p-3">
            <ResourceBar stock={{ wood: 3, flint: 2, food: 4, ideas: 1, bones: 0 }} tribe={3} size="md" />
          </div>
          <p className="text-center text-sm font-bold text-[var(--color-stone-700)]">
            Zonder voedsel wordt je stam kleiner — en een lege stam is gevaarlijk.
          </p>
        </div>
      ),
    },
    {
      title: "3. Maak werktuigen 🔥",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Geef grondstoffen + 💡 ideeën uit om <b>werktuigen</b> te maken: 🔥 vuur, 🗡️
            speer, 🪓 bijl, 🕯️ fakkel… Ze maken jagen makkelijker en openen nieuwe acties.
          </p>
          <div className="card-pop w-full p-3">
            <ToolShelf tools={["vuur", "speer"]} />
          </div>
          <p className="text-center text-sm font-bold text-[var(--color-stone-700)]">
            Gekleurd = al gemaakt. Gestippeld = nog uit te vinden.
          </p>
        </div>
      ),
    },
    {
      title: "4. Pas op voor gevaren ⚠️",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Een mislukte jacht of een ⚠️ gevaar (wolven, storm, koorts) levert een 💀 op.
            Bij <b>5 💀</b> verlies je samen. Tik maar eens op het gevaar:
          </p>
          <div className="card-pop flex w-full flex-col items-center gap-3 p-4">
            <SkullTrack skulls={skulls} limit={5} size="lg" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSkulls((s) => Math.min(5, s + 1))}
                className="btn-pop bg-[var(--color-ember)] text-base text-white"
              >
                ⚠️ Gevaar!
              </button>
              {skulls > 0 && (
                <button
                  type="button"
                  onClick={() => setSkulls(0)}
                  className="btn-pop bg-[var(--color-clay-200)] text-base"
                >
                  ↺ Reset
                </button>
              )}
            </div>
            <p className="h-5 text-sm font-extrabold text-[var(--color-ember-dark)]">
              {skulls >= 5 ? "💀 De stam is uitgestorven! Werk dus samen slim." : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "5. Speel de nacht 🌙",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Als de dag op is, eet je stam en begint de <b>nacht</b>: een eigen ronde met
            nachtdieren (🐯🐻🦇) en gevaren in het donker. 🔥 vuur en 🕯️ fakkel zijn nu
            extra sterk. Bij elke overgang <b>pak je in</b>: kies max 4 werktuigen die
            meegaan — alleen die tellen mee in gevecht.
          </p>
          <div className="card-pop w-full p-3">
            <ResourceBar stock={{ wood: 1, flint: 2, food: 3, ideas: 1, bones: 2 }} tribe={3} size="md" />
          </div>
          <p className="text-center text-sm font-bold text-[var(--color-stone-700)]">
            ’s Nachts verzamel je 🦴 <b>botten</b> — die heb je nodig voor de laatste
            grotschilderingen. Doorspelen tot diep in de nacht loont!
          </p>
        </div>
      ),
    },
    {
      title: "6. Schilder om te winnen 🎨",
      body: (
        <div className="flex flex-col items-center gap-3">
          <p>
            Met genoeg grondstoffen — en 🦴 botten uit de nacht — schilder je de grotwand.
            <b> 6 stukken</b> = jullie winnen samen! Tik om te schilderen:
          </p>
          <CavePainting painting={paint} goal={6} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaint((p) => Math.min(6, p + 1))}
              className="btn-pop bg-[var(--color-moss-300)] text-base"
            >
              🎨 Schilder
            </button>
            {paint > 0 && (
              <button
                type="button"
                onClick={() => setPaint(0)}
                className="btn-pop bg-[var(--color-clay-200)] text-base"
              >
                ↺ Reset
              </button>
            )}
          </div>
          <p className="h-5 text-sm font-extrabold text-[var(--color-moss-600)]">
            {paint >= 6 ? "🎉 De wand is vol — gewonnen!" : ""}
          </p>
        </div>
      ),
    },
    {
      title: "Spelregels in het kort 📜",
      body: (
        <div className="flex flex-col gap-2 text-sm">
          <Rule emoji="🤝">Coöperatief voor 1–4 spelers. Ieder speelt op de eigen telefoon.</Rule>
          <Rule emoji="🃏">Elke dag kies je uit 3 kaarten (achterkant zichtbaar). Tik — of schud je telefoon voor een willekeurige keuze.</Rule>
          <Rule emoji="🪵">Verzamel 🪵 hout, 🔪 vuursteen, 🍖 voedsel en 💡 ideeën voor de hele stam.</Rule>
          <Rule emoji="🔥">Maak werktuigen (🔥🗡️🪓🕯️) om sterker te jagen en meer te kunnen.</Rule>
          <Rule emoji="🌙">’s Nachts eet je stam en speel je een nachtronde: nachtdieren, gevaren en 🦴 botten. Bij elke overgang pak je max 4 werktuigen in.</Rule>
          <Rule emoji="💀">Mislukkingen en gevaren geven 💀. Bij 5 💀 verlies je.</Rule>
          <Rule emoji="🎨">Schilder 6 stukken van de grotwand (deels met 🦴 botten) om samen te winnen!</Rule>
        </div>
      ),
    },
  ];

  const last = steps.length - 1;
  const cur = steps[step];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Spelregels en uitleg"
    >
      <motion.div
        className="card-pop flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b-4 border-[var(--color-ink)] bg-[var(--color-ochre-400)] px-4 py-2">
          <h2 className="text-stroke text-lg font-extrabold text-white">Hoe speel je Paleo?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-white text-lg font-extrabold leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3 font-semibold text-[var(--color-ink)]"
            >
              <h3 className="text-xl font-extrabold">{cur.title}</h3>
              {cur.body}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: progress dots + nav */}
        <div className="flex items-center justify-between gap-3 border-t-4 border-[var(--color-ink)] bg-[var(--color-clay-100)] px-4 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-pop bg-white px-4 py-2 text-base disabled:opacity-30"
          >
            ‹ Vorige
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Stap ${i + 1}`}
                className={`h-2.5 rounded-full border-2 border-[var(--color-ink)] transition-all ${
                  i === step ? "w-5 bg-[var(--color-ochre-500)]" : "w-2.5 bg-white"
                }`}
              />
            ))}
          </div>

          {step < last ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(last, s + 1))}
              className="btn-pop bg-[var(--color-moss-300)] px-4 py-2 text-base"
            >
              Volgende ›
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn-pop bg-[var(--color-moss-300)] px-4 py-2 text-base"
            >
              Spelen! 🔥
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Rule({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border-2 border-[var(--color-ink)] bg-white/60 px-3 py-2">
      <span className="text-lg leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="font-semibold text-[var(--color-stone-700)]">{children}</span>
    </div>
  );
}

// A small face-down card that flips to reveal a sample front when tapped.
function DemoFlipCard({
  card,
  flipped,
  onClick,
}: {
  card: { hint: Hint; title: string; reward: string };
  flipped: boolean;
  onClick: () => void;
}) {
  const meta = HINT_META[card.hint];
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-32 shrink-0"
      style={{ perspective: 600, width: "5.5rem" }}
      aria-label={`Kaart: ${card.title}`}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45 }}
      >
        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-4 border-[var(--color-ink)] text-white"
          style={{ backfaceVisibility: "hidden", backgroundColor: meta.color }}
        >
          <span className="text-3xl" aria-hidden>
            {meta.emoji}
          </span>
          <span className="text-xs font-extrabold">{meta.label}</span>
        </div>
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-4 border-[var(--color-ink)] bg-[var(--color-bone)] p-1 text-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="text-2xl" aria-hidden>
            {meta.emoji}
          </span>
          <span className="text-[0.7rem] font-extrabold leading-tight">{card.title}</span>
          <span className="text-[0.65rem] font-bold leading-tight text-[var(--color-stone-700)]">
            {card.reward}
          </span>
        </div>
      </motion.div>
    </button>
  );
}
