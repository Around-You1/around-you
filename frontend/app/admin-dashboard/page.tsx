"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AdminDashboard = dynamic(() => import("@/components/AdminDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

// Reached after password-based SuperAdmin login (AdminLoginPage.tsx), which
// is a separate, simpler auth model from the rest of /dashboard/* — it uses
// only the Go backend's token + user, never a Supabase session at all.
//
// Deliberately placed OUTSIDE app/dashboard/ so it is NOT wrapped by
// app/dashboard/layout.tsx's guard, which requires a Supabase session and
// would otherwise redirect a successfully-logged-in SuperAdmin straight back
// to /login — exactly the bug this route fixes.
//
// The pre-existing /dashboard/admin route is untouched and still used by the
// separate Supabase + access-code admin path (see app/access/[code]/page.tsx)
// — that one already has a Supabase session by the time it gets there, so its
// guard was never the problem.
export default function AdminDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;

    let role: string | undefined;
    try {
      role = userRaw ? JSON.parse(userRaw).role : undefined;
    } catch {
      role = undefined;
    }

    if (!token || role !== "SuperAdmin") {
      router.replace("/admin-login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <AdminDashboard />;
}
