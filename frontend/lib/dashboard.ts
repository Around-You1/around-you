"use client";

// Maps a signed-in user's role to their dashboard URL. Local Guests get their
// own /local-dashboard; Holiday Guests use /guest-dashboard; Partners use
// /partner-dashboard. The dashboards render the same components regardless of
// URL — the role in localStorage decides the view — so these are just cleaner,
// role-specific addresses.
export function dashboardPathForRole(role?: string | null): string {
  if (role === "Partner") return "/partner-dashboard";
  if (role === "LocalGuest") return "/local-dashboard";
  return "/guest-dashboard";
}

// The current user's dashboard path, read from the stored user (best-effort).
export function currentDashboardPath(): string {
  try {
    if (typeof window === "undefined") return "/guest-dashboard";
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return dashboardPathForRole(u?.role);
  } catch {
    return "/guest-dashboard";
  }
}
