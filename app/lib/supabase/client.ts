"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Create a Supabase client for use in Client Components / browser.
// Uses the anon key + user session (JWT) automatically.
export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.local.example to .env.local and fill NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY. See DESIGN-supabase-auth.md."
    );
  }

  return createBrowserClient(url, anonKey);
}

// Convenience singleton for simple client usage (auth state, queries from browser).
// Prefer calling createClient() inside components so each tree gets a fresh instance when needed.
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}
