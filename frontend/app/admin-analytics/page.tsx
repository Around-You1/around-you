"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AnalyticsDashboard = dynamic(() => import("@/components/AnalyticsDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

// Same guard as admin-dashboard/page.tsx — SuperAdmin's Go-backend token,
// not a Supabase session.
export default function AdminAnalyticsPage() {
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

  return <AnalyticsDashboard />;
}
