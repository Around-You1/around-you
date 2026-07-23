"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import AppLogo from "../components/AppLogo";

const LUMO = "#39FF14";
const LUMO_DARK = "#2dd10f";

type InfoId = "about" | "heart" | "how" | "partner" | "sales";

const INFO_SECTIONS: { id: InfoId; title: string; content: React.ReactNode }[] = [
  {
    id: "about",
    title: "About Us",
    content: (
      <>
        <p>Around You welcomes guests with instant access to verified accommodation info, curated local partners, and exclusive perks.</p>
        <p>As a Holiday Guest, log in with the accommodation's unique QR Code or Access Code to unlock seamless navigation, trusted recommendations, and meaningful savings.</p>
        <p>As a Local, log in with your email address, province, and municipal area to search for restaurants, services, and attractions 'Around You.'</p>
        <p>Everything you need—where to go, what to enjoy, and how to get there—is just one tap away.</p>
        <p>It's hospitality, elevated.</p>
      </>
    ),
  },
  {
    id: "heart",
    title: "Our Values",
    content: (
      <>
        <p>We believe hospitality should go beyond the stay. That's why Around You partners with Trinity CSR, a social impact initiative committed to giving back.</p>
        <p>Through this collaboration, a portion of all platform sales supports causes that matter—like vulnerable communities, animal welfare, and grassroots organizations.</p>
      </>
    ),
  },
  {
    id: "how",
    title: "How It Works",
    content: (
      <>
        <p>Around You is designed to elevate guests' experience. It's a smart, seamless way to view all the accommodation information, connect with trusted local partners, and enjoy meaningful extras that help make your stay unforgettable.</p>
        <p>By using Around You, you unlock a powerful hospitality tool that helps you feel welcomed, informed, and connected from the moment you arrive at your accommodation.</p>
        <p>Your accommodation would have issued you a unique "Access Code" or "QR Code."</p>
        <p>Click the "Log In" button below, select the "Guest" tab, then select the "Holiday" tab, and either enter the accommodation name, address, province, and area, or enter the access code they may have sent you into the login portal. Then click the "Sign In" button.</p>
        <p>Or scan the QR Code the accommodation may have sent you. Make sure that on the Sign In page, the access code auto populates, then click the "Sign In" button.</p>
        <p>When logged in, guests instantly access:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Verified information about their accommodation</li>
        </ul>
        <p>Guests and Locals will access:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A curated selection of nearby restaurants, wellness venues, essential services, and local attractions</li>
          <li>Exclusive discounts from select venues (redeemable via digital codes)</li>
          <li>One click navigation to partner venues and points of interest</li>
        </ul>
      </>
    ),
  },
  {
    id: "partner",
    title: "Partner With Us",
    content: (
      <>
        <p>Become part of the Around You Partner Family and choose the package that suits you best. Each package gives you access to our tools, marketing support, and exclusive partner benefits, so you can grow your reach and earnings.</p>
        <p>
          Contact us at{" "}
          <a href="mailto:partners@aroundyou.co.za" style={{ color: LUMO }} className="hover:underline">
            partners@aroundyou.co.za
          </a>
          , where we will assist you in selecting a plan, completing a questionnaire for onboarding purposes, and starting to promote right away.
        </p>
      </>
    ),
  },
  {
    id: "sales",
    title: "Become a Seller",
    content: (
      <>
        <p>Become part of our sales family and earn 20% commission on all sales every month.</p>
        <p>Your sales carry forward and compound: what you sell in Month 1 is added to your Month 2 total; Month 1 + Month 2 are added to Month 3, and so on. This means consistent selling builds larger monthly totals and bigger payouts over time.</p>
        <p>Commissions are calculated and paid monthly, so you can track your progress and rewards each pay cycle.</p>
        <p>
          Contact us at{" "}
          <a href="mailto:sales@aroundyou.co.za" style={{ color: LUMO }} className="hover:underline">
            sales@aroundyou.co.za
          </a>
          .
        </p>
      </>
    ),
  },
];

function InfoSquareBtn({
  title,
  isOpen,
  onToggle,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      style={{
        background: "#000",
        border: `2px solid ${isOpen ? "#5fff3a" : LUMO}`,
        color: isOpen ? "#5fff3a" : LUMO,
        borderRadius: 10,
        fontWeight: 700,
        fontSize: "0.72rem",
        cursor: "pointer",
        textAlign: "center",
        letterSpacing: "0.03em",
        transition: "all 0.2s ease",
        aspectRatio: "1 / 1",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        minHeight: 22,
        lineHeight: 1.25,
      }}
      className="touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {title}
    </button>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const navigate = (to: string, opts?: { replace?: boolean }) =>
    opts?.replace ? router.replace(to) : router.push(to);
  const { toast, dismiss } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState<InfoId | null>(null);

  function toggleInfo(id: InfoId) {
    setInfoOpen((prev) => (prev === id ? null : id));
  }

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
      const res = await backend.auth.login({ role: "Admin", email: email.trim(), password });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      dismiss();
      toast({ title: "Welcome!", description: `Signed in as ${res.user.email}` });
      navigate("/admin");
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
      style={{ background: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 pt-4">
          <AppLogo allowUpload={true} />
        </div>

        <div
          className="rounded-2xl p-6 space-y-3"
          style={{
            background: "#111111",
            border: "1px solid rgba(57,255,20,0.18)",
            boxShadow: "0 0 40px rgba(57,255,20,0.06)",
          }}
        >
          <div className="grid grid-cols-4 gap-1.5 mb-1">
            {INFO_SECTIONS.map((s) => (
              <InfoSquareBtn
                key={s.id}
                title={s.title}
                isOpen={infoOpen === s.id}
                onToggle={() => toggleInfo(s.id)}
              />
            ))}
          </div>

          {INFO_SECTIONS.map((s) => (
            <div
              key={s.id}
              id={`info-content-${s.id}`}
              style={{
                maxHeight: infoOpen === s.id ? "700px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.2s ease",
                opacity: infoOpen === s.id ? 1 : 0,
                marginBottom: infoOpen === s.id ? "4px" : "0px",
              }}
            >
              <div
                className="px-4 py-4 text-sm leading-relaxed space-y-3"
                style={{
                  color: "#a0a0a0",
                  background: "rgba(57,255,20,0.04)",
                  borderRadius: 10,
                  border: "1px solid rgba(57,255,20,0.18)",
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: LUMO }}>
                  {s.title}
                </p>
                {s.content}
              </div>
            </div>
          ))}

          <p
            className="text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#666" }}
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
                style={{ color: "#a0a0a0" }}
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
                htmlFor="admin-password"
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#a0a0a0" }}
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-label="Admin password"
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
              id="admin-login-btn"
              type="submit"
              disabled={loading}
              aria-label="Admin Log In"
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
              {loading ? "Signing in…" : "Admin Log In"}
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
