"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// The standalone /login screen has been retired. Everyone now signs in from the
// main /portal screen (Holiday Guest / Local Guest / Business-Service Partner).
// This route simply forwards to /portal, preserving any code/role/next query
// params so old links and in-app redirects keep working.
export default function LoginRedirect() {
  return (
    <Suspense fallback={<Fallback />}>
      <Redirector />
    </Suspense>
  );
}

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function Redirector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/portal?${qs}` : "/portal");
  }, [router, searchParams]);

  return <Fallback />;
}
