-- Paleo — coöperatieve steentijd-game: sessions & realtime game state.
-- Tables are prefixed `paleo_` because they share a Supabase database with other
-- projects (incl. Regenwormen's `rw_` tables). No auth: a casual co-op party
-- game, so RLS policies are permissive for the anon role. Game integrity is
-- enforced client-side by the pure engine + optimistic version checks.

create table if not exists public.paleo_games (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  status      text not null default 'lobby',   -- lobby | playing | finished
  state       jsonb not null,
  version     integer not null default 0,
  host_id     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.paleo_players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.paleo_games(id) on delete cascade,
  player_id   text not null,            -- stable per-device id chosen by the client
  name        text not null,
  seat        integer,
  is_host     boolean not null default false,
  connected   boolean not null default true,
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (game_id, player_id)
);

create index if not exists paleo_players_game_id_idx on public.paleo_players (game_id);

-- Keep updated_at fresh on every write to a game row.
create or replace function public.paleo_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists paleo_games_touch on public.paleo_games;
create trigger paleo_games_touch before update on public.paleo_games
  for each row execute function public.paleo_touch_updated_at();

-- Row level security: enabled, but open to the anon role (casual public games).
alter table public.paleo_games enable row level security;
alter table public.paleo_players enable row level security;

drop policy if exists paleo_games_all on public.paleo_games;
create policy paleo_games_all on public.paleo_games
  for all to anon, authenticated using (true) with check (true);

drop policy if exists paleo_players_all on public.paleo_players;
create policy paleo_players_all on public.paleo_players
  for all to anon, authenticated using (true) with check (true);

-- Full row data on changes (so realtime payloads carry everything, incl. deletes).
alter table public.paleo_games replica identity full;
alter table public.paleo_players replica identity full;

-- Broadcast changes over Supabase Realtime.
alter publication supabase_realtime add table public.paleo_games;
alter publication supabase_realtime add table public.paleo_players;
