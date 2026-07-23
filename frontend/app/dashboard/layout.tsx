"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, onAuthStateChange } from "@/lib/session";

// Route guard for every /dashboard/* page. Requires a Supabase session
// (identity). Access-code authorization is layered on top by the individual
// dashboards via the stored Go token/user.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    getSession().then((session) => {
      if (!active) return;
      if (!session) router.replace("/login");
      else setReady(true);
    });

    const unsubscribe = onAuthStateChange((session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
