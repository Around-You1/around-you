"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Current Supabase session (or null). Identity layer.
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

// The Supabase access token (JWT) for the current session, if any.
export async function getSupabaseAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

// Subscribe to auth changes (login / logout / token refresh). Returns an
// unsubscribe function.
export function onAuthStateChange(
  cb: (session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// The Go backend authorization token issued by the access-code step. This is
// the bearer the Go API validates today; it is stored in localStorage by the
// resolver / login components (unchanged behavior).
export function getBackendToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

// The user object the access-code step resolved (role, profileType, entityId,
// area, ...). Used for dashboard routing.
export function getResolvedUser<T = any>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
