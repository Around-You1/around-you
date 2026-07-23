"use client";

import dynamic from "next/dynamic";

// Admin login (AdminLoginPage.tsx), untouched. Matches the components'
// navigate("/admin-login") target.
const AdminLoginPage = dynamic(() => import("@/components/AdminLoginPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  ),
});

export default function AdminLoginRoute() {
  return <AdminLoginPage />;
}
