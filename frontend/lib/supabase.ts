"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Single browser Supabase client. Sessions persist to localStorage and are
// auto-refreshed, so a verified OTP login survives reloads.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  // Don't throw at import time (breaks the build); warn so misconfig is obvious.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.local.example to .env.local."
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
