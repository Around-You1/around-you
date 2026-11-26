"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RevealInput from "./RevealInput";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import AppLogo from "../components/AppLogo";

const LUMO = "var(--brand)";
const LUMO_DARK = "var(--brand)";

export default function AdminLoginPage() {
  const router = useRouter();
  const navigate = (to: string, opts?: { replace?: boolean }) =>
    opts?.replace ? router.replace(to) : router.push(to);
  const { toast, dismiss } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Validation Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Validation Error", description: "Password is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await backend.auth.login({ role: "Admin", email: email.trim(), password, accessCode: accessCode.trim() });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      dismiss();
      toast({ title: "Welcome!", description: `Signed in as ${res.user.email}` });
      navigate("/admin-dashboard");
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Login Failed",
        description: err?.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 pt-4">
          <AppLogo themed />
        </div>

        <div
          className="rounded-2xl p-6 space-y-3"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <p
            className="text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}
          >
            Admin Dashboard Log In
          </p>

          <form
            id="admin-login-form"
            onSubmit={handleAdminLogin}
            className="space-y-4"
            aria-label="Admin login form"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="admin-email"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="username"
                autoFocus
                aria-label="Admin email address"
                enterKeyHint="next"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  width: "100%",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                className="transition-all focus:border-brand placeholder-gray-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="admin-password"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Password
              </label>
              <RevealInput
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-label="Admin password"
                enterKeyHint="go"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  width: "100%",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                className="transition-all focus:border-brand placeholder-gray-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="admin-access-code"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Access Code
              </label>
              <RevealInput
                id="admin-access-code"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Your access code"
                autoComplete="one-time-code"
                aria-label="Admin access code"
                enterKeyHint="go"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  width: "100%",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                className="transition-all focus:border-brand placeholder-gray-600"
              />
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={loading}
              aria-label="Admin Log In"
              style={{
                background: loading ? "var(--muted)" : "var(--brand)",
                color: "var(--brand-foreground)",
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
              {loading ? "Signing in…" : "Admin Log In"}
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => navigate("/portal")}
              className="text-sm transition-colors hover:underline underline-offset-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
