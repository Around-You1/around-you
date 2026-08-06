"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AccDashboard = dynamic(() => import("@/components/AccDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

// Guarded like the SuperAdmin dashboard: token + role === "Accountant", else
// bounce to the accountant login. Outside app/dashboard/ so the Supabase-session
// guard there doesn't apply (accountant auth is Go-token only).
export default function AccDashboardPage() {
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
    if (!token || role !== "Accountant") {
      router.replace("/acc-login");
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

  return <AccDashboard />;
}
