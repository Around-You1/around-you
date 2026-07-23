"use client";

import { supabase } from "./supabase";

// Email-only OTP authentication (identity layer). Access-code authorization
// happens AFTER a session exists — see app/access/[code]/page.tsx.

// Send a one-time passcode to the given email. `shouldCreateUser` lets first-
// time users in; flip to false if you want to restrict to pre-provisioned users.
export async function signInWithOtp(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
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
