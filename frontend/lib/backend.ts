"use client";

// Primary authenticated data channel used by 18 components via
// `import { getAuthenticatedBackend } from "../lib/backend"`.
//
// The client already attaches the Go authorization token and the Supabase
// identity token on every request (see backend/client.ts), so this returns that
// client directly. It is intentionally SYNCHRONOUS — components call it as
// `const backend = getAuthenticatedBackend()` (no await) and immediately use it.

import backend from "@/backend/client";

export function getAuthenticatedBackend() {
  return backend;
}

export default getAuthenticatedBackend;
