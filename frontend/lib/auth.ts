"use client";

import { supabase } from "./supabase";

// Email-only OTP authentication (identity layer). Access-code authorization
// happens AFTER a session exists — see app/access/[code]/page.tsx.

// Send a sign-in email to the given address. `shouldCreateUser` lets first-
// time users in; flip to false if you want to restrict to pre-provisioned users.
// `emailRedirectTo` is the page the confirmation LINK in the email returns to
// once clicked — so the guest just taps the link instead of copying a code.
// Defaults to the app root, which is always an allowed redirect (the Site URL).
export async function signInWithOtp(email: string, emailRedirectTo?: string) {
  const redirect =
    emailRedirectTo ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: redirect },
  });
  if (error) throw error;
  return data;
}

// Verify the 6-digit code the user received by email. On success a Supabase
// session is created and persisted.
export async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  return data;
}

// Clear the Supabase session AND the Go authorization token/user that the
// access-code step stored.
export async function signOut() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
}
