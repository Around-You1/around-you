"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import backend from "@/backend/client";
import { useToast } from "@/components/ui/use-toast";
import AppLogo from "@/components/AppLogo";

// Accountant sign-in: a single shared access code (see auth.AccLogin, checked
// against the ACC_ACCESS_CODE Fly secret). On success we store the token + user
// and route to the accountant portal shell.
export default function AccLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: "Enter your access code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res: any = await backend.auth.accLogin({ accessCode: code.trim() });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      toast({ title: "Welcome", description: "Signed in to the accountant portal." });
      router.replace("/acc-dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Invalid access code.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md">
        <div className="mb-6 pt-4">
          <AppLogo />
        </div>
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "#111111", border: "1px solid rgba(57,255,20,0.18)" }}>
          <h1 className="text-2xl font-bold text-center" style={{ color: "#E6F7E6" }}>Accountant Portal</h1>
          <p className="text-center text-sm" style={{ color: "#8a8a8a" }}>Enter your access code to continue.</p>
          <form onSubmit={submit} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(57,255,20,0.2)",
                color: "#fff",
                borderRadius: 8,
                padding: "12px 14px",
                fontFamily: "monospace",
                letterSpacing: "0.12em",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#1a3a0a" : "linear-gradient(135deg,#39FF14,#2dd10f)",
                color: "#000",
                border: "none",
                borderRadius: 10,
                padding: "14px 0",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <button type="button" onClick={() => router.push("/portal")} className="w-full text-sm" style={{ color: "#666" }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
