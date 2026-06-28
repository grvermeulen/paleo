import { createClient } from "@supabase/supabase-js";
import type { GameState } from "./engine";

// Fall back to harmless placeholders so a build without env (CI, local) doesn't
// throw while prerendering. Real values are baked into the client bundle at
// build/deploy time; all Supabase calls happen in the browser at runtime.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-placeholder";

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: { persistSession: false },
});

export interface GameRow {
  id: string;
  code: string;
  status: GameState["status"];
  state: GameState;
  version: number;
  host_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  player_id: string;
  name: string;
  seat: number | null;
  is_host: boolean;
  connected: boolean;
  last_seen: string;
  created_at: string;
}
