"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import AppLogo from "../components/AppLogo";

// Shell only — the accounting analytics (commission rollups, tier/subscription
// fees, bookings ledger) will be built into this dashboard later.
export default function AccDashboard() {
  const router = useRouter();
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEECE4]/20 to-background p-6">
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="relative text-center">
          <div className="flex justify-center mb-2"><AppLogo src="/logo-dark.png" /></div>
          <h1 className="text-4xl font-bold text-foreground">Accountant Portal</h1>
          <p className="text-lg text-muted-foreground mt-2">Accounts &amp; analytics</p>
          <Button variant="ghost" onClick={logout} className="absolute top-0 right-0 flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analytics coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is where the accounting analytics will live — commission rollups (15% per booking partner), tier / subscription fees per partner, and the full bookings ledger. The sign-in and portal shell are in place; we&apos;ll build the reports out next.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
