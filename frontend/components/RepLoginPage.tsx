"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import AppLogo from "../components/AppLogo";

const LUMO = "#39FF14";
const LUMO_DARK = "#2dd10f";

export default function RepLoginPage() {
  const router = useRouter();
  const navigate = (to: string, opts?: { replace?: boolean }) =>
    opts?.replace ? router.replace(to) : router.push(to);
  const { toast, dismiss } = useToast();
  const [fullName, setFullName] = useState("");
  const [repCode, setRepCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRepLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Validation Error", description: "Full name is required", variant: "destructive" });
      return;
    }
    if (!repCode.trim()) {
      toast({ title: "Validation Error", description: "Rep code is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await backend.auth.repLogin({ fullName: fullName.trim(), repCode: repCode.trim() });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      dismiss();
      toast({ title: "Welcome!", description: `Signed in as ${res.user.fullName}` });
      navigate("/rep-onboarding");
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Login Failed",
        description: err?.message || "Invalid full name or rep code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 pt-4">
          <AppLogo />
        </div>

        <div
          className="rounded-2xl p-6 space-y-3"
          style={{
            background: "#111111",
            border: "1px solid rgba(57,255,20,0.18)",
            boxShadow: "0 0 40px rgba(57,255,20,0.06)",
          }}
        >
          <p
            className="text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#666" }}
          >
            Rep Sign In
          </p>

          <form
            id="rep-login-form"
            onSubmit={handleRepLogin}
            className="space-y-4"
            aria-label="Rep login form"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="rep-full-name"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#a0a0a0" }}
              >
                Full Name
              </label>
              <input
                id="rep-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                autoFocus
                aria-label="Rep full name"
                enterKeyHint="next"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(57,255,20,0.2)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  width: "100%",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                className="transition-all focus:border-[#39FF14] placeholder-gray-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rep-code"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#a0a0a0" }}
              >
                Rep Code
              </label>
              <input
                id="rep-code"
                type="text"
                value={repCode}
                onChange={(e) => setRepCode(e.target.value)}
                placeholder="e.g. Rep00000001"
                autoComplete="off"
                aria-label="Rep code"
                enterKeyHint="go"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(57,255,20,0.2)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  width: "100%",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                className="transition-all focus:border-[#39FF14] placeholder-gray-600"
              />
            </div>

            <button
              id="rep-login-btn"
              type="submit"
              disabled={loading}
              aria-label="Rep Sign In"
              style={{
                background: loading ? "#1a3a0a" : `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})`,
                color: "#000",
                border: "none",
                borderRadius: 10,
                padding: "14px 0",
                width: "100%",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                transition: "all 0.2s",
                minHeight: 48,
                letterSpacing: "0.02em",
                marginTop: 8,
              }}
              className="touch-manipulation"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm transition-colors hover:underline underline-offset-4"
              style={{ color: "#444" }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
