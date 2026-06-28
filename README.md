# Paleo 🦣

Een coöperatieve steentijd-webgame voor 1–4 spelers, in dezelfde stijl en met
dezelfde techniek als [Regenwormen](https://github.com/grvermeulen/regenwormen).
Speel samen op je telefoon, of gebruik een laptop/TV als grot-bord met telefoons
als controller. Progressive Web App — installeerbaar en mobiel-vriendelijk.

> **Origineel werk.** Dit is een eigen game, geïnspireerd op de *mechanieken* van
> het genre (dag/nacht-cyclus, kies 1 van 3 verdekte kaarten, grondstoffen,
> werktuigen, gevaren, grotschildering). Alle kaarten, teksten, namen en artwork
> zijn origineel; er wordt geen auteursrechtelijk beschermd materiaal van het
> bordspel Paleo gereproduceerd.

## Hoe speel je

- **Samen op de telefoon:** open de app, "Maak een nieuw spel" en deel de code.
- **Laptop/TV als bord:** open "Start een grot-bord"; spelers scannen de QR of
  vullen de code in op hun telefoon.

Elke dag bekijkt iedereen tegelijk de achterkant van 3 kaarten en kiest er één om
om te draaien en op te lossen. Samen verzamel je **hout 🪵, vuursteen 🔪 en
voedsel 🍖**, bedenk je **ideeën 💡** en maak je **werktuigen** (vuur 🔥, speer 🗡️,
bijl 🪓, knots 🏏, mand 🧺, fakkel 🕯️). Jaag samen op wild, pas op voor gevaren ⚠️,
en schilder met fakkel + oker de **grotwand 🎨**.

- **Nacht:** als alle decks leeg zijn, eet de stam (voedsel = aantal stamleden;
  per tekort een 💀). Nacht-kaarten lossen op, daarna een nieuwe dag.
- **Winnen:** vul de grotwand (5 stukken).
- **Verliezen:** 5 💀 — dan sterft de stam uit.

## Tech

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Framer Motion ·
canvas-confetti · Supabase (Realtime) · Vitest. Geen eigen backend: de spel­logica
draait client-side in een pure, deterministische engine (`lib/engine.ts`), met
optimistische concurrency via een `version`-kolom.

### Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul je Supabase-gegevens in
npm run gen-icons            # genereert de PWA-iconen (mammoet)
npm run dev
npm test                     # engine-unittests (vitest)
```

### Omgevingsvariabelen

| Variabele | Omschrijving |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL van je Supabase-project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key |

Paleo gebruikt dezelfde Supabase-database als Regenwormen, met tabellen die
beginnen met `paleo_` (zie `supabase/migrations/0001_init.sql`).

### Database

Draai de migratie in `supabase/migrations/0001_init.sql` op je Supabase-project.
Die maakt `paleo_games` en `paleo_players` aan (permissieve RLS, realtime),
volledig los van eventuele `rw_`-tabellen.

### Deploy (Vercel)

Importeer de repo in Vercel, zet dezelfde twee env-vars, en deploy. De service
worker is gekoppeld aan de build-id, zodat elke deploy de cache automatisch
ververst.

## Architectuur

- `lib/engine.ts` — pure reducer (dag/nacht, kaart kiezen & oplossen, grondstoffen,
  werktuigen, gevechten, voeden, win/verlies). Randomness (deck-shuffles) wordt
  geïnjecteerd → volledig testbaar.
- `lib/paleo/cards.ts` · `missions.ts` — originele kaart- en scenariodata.
- `lib/api.ts` · `useGame.ts` — Supabase-CRUD + realtime sync.
- `app/host/[code]` — grot-bord (laptop/TV). `app/play/[code]` — controller (telefoon).
