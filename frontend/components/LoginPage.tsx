"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import { SA_PROVINCES } from "../lib/saRegions";
import AppLogo from "../components/AppLogo";
import { signInWithOtp } from "../lib/auth";
import { supabase } from "../lib/supabase";

const VALID_CODE_RE = /^[A-Za-z0-9]*$/;
const STRIP_RE = /[^A-Za-z0-9]/g;

const LUMO = "#39FF14";
const LUMO_DARK = "#2dd10f";

type ActivePanel = "holiday" | "local" | "partner" | null;
type LoginMethod = "code" | "secondary";

function sanitizeCode(raw: string): string {
  return raw.replace(STRIP_RE, "");
}

function SignInSquareBtn({
  label,
  isOpen,
  onToggle,
}: {
  label: string;
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
        fontSize: "0.65rem",
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
        minHeight: 0,
        lineHeight: 1.25,
      }}
      className="touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)"; }}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
    >
      {label}
    </button>
  );
}

function ThemedLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a0a0a0" }}>
      {children}
    </label>
  );
}

function ThemedInput(props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(57,255,20,0.2)",
        color: "#fff",
        borderRadius: 8,
        padding: "10px 14px",
        width: "100%",
        fontSize: "0.9rem",
        outline: "none",
        ...(props.style || {}),
      }}
      className={`transition-all focus:border-[#39FF14] placeholder-gray-600 ${props.className || ""}`}
    />
  );
}

function ThemedSelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(57,255,20,0.2)",
          color: value ? "#fff" : "#666",
          borderRadius: 8,
          height: 42,
        }}
        className="transition-all focus:border-[#39FF14]"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent style={{ background: "#1a1a1a", border: "1px solid rgba(57,255,20,0.25)", color: "#fff" }}>
        {children}
      </SelectContent>
    </Select>
  );
}

function ProfileAccessCodeField({
  value,
  charError,
  onChange,
  onPaste,
}: {
  value: string;
  charError: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <ThemedLabel>Profile Access Code</ThemedLabel>
      <ThemedInput
        type="text"
        value={value}
        onChange={onChange}
        onPaste={onPaste}
        placeholder="Enter your 12-character code"
        maxLength={12}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoCapitalize="none"
        inputMode="text"
        enterKeyHint="go"
        translate="no"
        data-form-type="other"
        data-lpignore="true"
        className="font-mono tracking-widest text-center text-lg"
        style={{
          background: "rgba(57,255,20,0.06)",
          border: "1px solid rgba(57,255,20,0.35)",
          color: LUMO,
          letterSpacing: "0.15em",
          textAlign: "center",
          fontSize: "1.1rem",
          fontFamily: "monospace",
        }}
      />
      {charError ? (
        <p className="text-xs text-red-400 text-center">Invalid characters removed — letters and numbers only</p>
      ) : (
        <p className="text-xs text-center" style={{ color: "#666" }}>12-character code provided to you</p>
      )}
    </div>
  );
}

function LumoButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        background: disabled ? "#1a3a0a" : `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})`,
        color: "#000",
        border: "none",
        borderRadius: 10,
        padding: "14px 0",
        width: "100%",
        fontWeight: 700,
        fontSize: "1rem",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        minHeight: 48,
        letterSpacing: "0.02em",
      }}
      className="touch-manipulation"
    >
      {children}
    </button>
  );
}

function MethodToggle({ method, onChange }: { method: LoginMethod; onChange: (m: LoginMethod) => void }) {
  return (
    <div className="flex gap-2">
      {(["code", "secondary"] as LoginMethod[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          style={{
            flex: 1,
            background: method === m ? "rgba(57,255,20,0.15)" : "transparent",
            border: `1px solid ${method === m ? LUMO : "rgba(57,255,20,0.2)"}`,
            color: method === m ? LUMO : "#666",
            borderRadius: 6,
            padding: "6px 0",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {m === "code" ? "Access Code" : "Business Details"}
        </button>
      ))}
    </div>
  );
}

function PanelWrap({ id, activePanel, children }: { id: ActivePanel; activePanel: ActivePanel; children: React.ReactNode }) {
  const isOpen = activePanel === id;
  return (
    <div
      style={{
        maxHeight: isOpen ? "1200px" : "0px",
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div
        className="px-4 py-4 space-y-4 text-sm"
        style={{
          background: "rgba(57,255,20,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(57,255,20,0.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const navigate = (to: string, opts?: { replace?: boolean }) =>
    opts?.replace ? router.replace(to) : router.push(to);
  const searchParams = useSearchParams();
  const { toast, dismiss } = useToast();
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const [holidayCode, setHolidayCode] = useState("");
  const [holidayCodeError, setHolidayCodeError] = useState(false);
  const [holidayMethod, setHolidayMethod] = useState<LoginMethod>("code");
  const [holidayName, setHolidayName] = useState("");
  const [holidayAddress, setHolidayAddress] = useState("");
  const [holidayProvince, setHolidayProvince] = useState("");
  const [holidayArea, setHolidayArea] = useState("");

  const [localEmail, setLocalEmail] = useState("");
  const [localProvince, setLocalProvince] = useState("");
  const [localPostalCode, setLocalPostalCode] = useState("");

  const [partnerCode, setPartnerCode] = useState("");
  const [partnerCodeError, setPartnerCodeError] = useState(false);
  const [partnerMethod, setPartnerMethod] = useState<LoginMethod>("code");
  const [partnerName, setPartnerName] = useState("");
  const [partnerAddress, setPartnerAddress] = useState("");
  const [partnerProvince, setPartnerProvince] = useState("");
  const [partnerArea, setPartnerArea] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      const clean = code.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
      if (clean.length === 12) {
        const role = searchParams.get("role");
        if (role === "partner") {
          setPartnerCode(clean);
          setActivePanel("partner");
        } else {
          setHolidayCode(clean);
          setActivePanel("holiday");
        }
      }
    }
  }, [searchParams]);

  function togglePanel(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  function makeCodeHandlers(setter: (v: string) => void, errSetter: (v: boolean) => void) {
    return {
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const clean = sanitizeCode(raw);
        setter(clean);
        errSetter(clean !== raw);
      },
      onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text/plain");
        const clean = sanitizeCode(pasted).slice(0, 12);
        setter(clean);
        errSetter(!VALID_CODE_RE.test(pasted));
      },
    };
  }

  const holidayCodeHandlers = makeCodeHandlers(setHolidayCode, setHolidayCodeError);
  const partnerCodeHandlers = makeCodeHandlers(setPartnerCode, setPartnerCodeError);

  function validateCode(code: string): boolean {
    if (!VALID_CODE_RE.test(code)) {
      toast({ title: "Validation Error", description: "Access code must contain letters and numbers only", variant: "destructive" });
      return false;
    }
    if (code.length !== 12) {
      toast({ title: "Validation Error", description: `Access code must be exactly 12 characters (currently ${code.length})`, variant: "destructive" });
      return false;
    }
    return true;
  }

  function storeAndNavigate(token: string, user: object, path: string, welcomeName: string) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    dismiss();
    // welcomeName is often the backend's internal placeholder email (e.g.
    // "guest@Test BnB" / "partner@Test Grub" — see findByAccessCode in
    // auth.go, which has no dedicated display-name field to draw from
    // instead) — strip that prefix so the toast shows just the real name.
    const displayName = welcomeName.replace(/^(guest|partner)@/, "");
    toast({ title: "Welcome!", description: `Signed in as ${displayName}` });
    navigate(path);
  }

  async function handleHolidayLogin(e: React.FormEvent) {
    e.preventDefault();
    if (holidayMethod === "code") {
      const code = holidayCode.trim();
      if (!validateCode(code)) return;
      setLoading(true);
      try {
        const res = await backend.auth.accessCodeLogin({ accessCode: code });
        const path = res.user.profileType === "accommodation" || res.user.profileType === undefined
          ? "/guest-dashboard" : "/partner-dashboard";
        storeAndNavigate(res.token, res.user, path, res.user.email);
      } catch (err: any) {
        console.error(err);
        toast({ title: "Login Failed", description: err?.message || "Invalid access code", variant: "destructive" });
      } finally { setLoading(false); }
    } else {
      if (!holidayName.trim() || !holidayAddress.trim() || !holidayProvince || !holidayArea.trim()) {
        toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        const res = await backend.auth.secondaryLogin({
          partnerName: holidayName.trim(),
          address: holidayAddress.trim(),
          province: holidayProvince,
          area: holidayArea.trim(),
        });
        const path = res.user.role === "Guest" ? "/guest-dashboard" : "/partner-dashboard";
        storeAndNavigate(res.token, res.user, path, res.user.email);
      } catch (err: any) {
        console.error(err);
        toast({ title: "Login Failed", description: err?.message || "Partner not found", variant: "destructive" });
      } finally { setLoading(false); }
    }
  }

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!localEmail.trim()) { toast({ title: "Validation Error", description: "Email address is required", variant: "destructive" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(localEmail.trim())) { toast({ title: "Validation Error", description: "Please enter a valid email address", variant: "destructive" }); return; }
    if (!localProvince) { toast({ title: "Validation Error", description: "Province is required", variant: "destructive" }); return; }
    if (!localPostalCode.trim()) { toast({ title: "Validation Error", description: "Postal code is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const email = localEmail.trim().toLowerCase();

      // Returning guest: if this browser already has a verified Supabase
      // session for this exact email, skip the code step entirely.
      const { data: { session } } = await supabase.auth.getSession();
      const alreadyVerified = !!session && session.user?.email?.toLowerCase() === email;

      if (alreadyVerified) {
        const res = await backend.auth.localGuestLogin({ email, province: localProvince, postalCode: localPostalCode.trim() });
        storeAndNavigate(res.token, res.user, "/guest-dashboard", email.split("@")[0]);
        return;
      }

      // First time (or an expired/different session): send a one-time code
      // and finish signing in once they've verified it. The province/postal
      // code they already typed are carried through inside the `next` URL's
      // own query string — /verify does `router.replace(next)` literally, it
      // does not merge in any other query params, so they have to travel
      // as part of next's value itself or they'd be lost after redirecting.
      await signInWithOtp(email);
      toast({ title: "Check your email", description: `We sent a code to ${email}` });
      const nextParams = new URLSearchParams({
        pendingRole: "local",
        pendingProvince: localProvince,
        pendingPostalCode: localPostalCode.trim(),
      });
      const params = new URLSearchParams({
        email,
        next: `/portal?${nextParams.toString()}`,
      });
      router.push(`/verify?${params.toString()}`);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Login Failed", description: err?.message || "Unable to sign in. Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  }

  // After returning from /verify having just confirmed a one-time code,
  // finish the Local Guest sign-in automatically using the province/postal
  // code carried through in the URL — the person shouldn't have to type
  // those in twice.
  useEffect(() => {
    const pendingRole = searchParams.get("pendingRole");
    if (pendingRole !== "local") return;

    const province = searchParams.get("pendingProvince") || "";
    const postalCode = searchParams.get("pendingPostalCode") || "";

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return; // shouldn't happen — /verify already confirmed the session

      setLoading(true);
      try {
        const res = await backend.auth.localGuestLogin({ email, province, postalCode });
        storeAndNavigate(res.token, res.user, "/guest-dashboard", email.split("@")[0]);
      } catch (err: any) {
        toast({ title: "Login Failed", description: err?.message || "Unable to sign in. Please try again.", variant: "destructive" });
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePartnerLogin(e: React.FormEvent) {
    e.preventDefault();
    if (partnerMethod === "code") {
      const code = partnerCode.trim();
      if (!validateCode(code)) return;
      setLoading(true);
      try {
        const res = await backend.auth.accessCodeLogin({ accessCode: code });
        storeAndNavigate(res.token, res.user, "/partner-dashboard", res.user.email);
      } catch (err: any) {
        console.error(err);
        toast({ title: "Login Failed", description: err?.message || "Invalid access code", variant: "destructive" });
      } finally { setLoading(false); }
    } else {
      if (!partnerName.trim() || !partnerAddress.trim() || !partnerProvince || !partnerArea.trim()) {
        toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        const res = await backend.auth.secondaryLogin({
          partnerName: partnerName.trim(),
          address: partnerAddress.trim(),
          province: partnerProvince,
          area: partnerArea.trim(),
        });
        storeAndNavigate(res.token, res.user, "/partner-dashboard", res.user.email);
      } catch (err: any) {
        console.error(err);
        toast({ title: "Login Failed", description: err?.message || "Partner not found", variant: "destructive" });
      } finally { setLoading(false); }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md">
        <div className="mb-6 pt-4">
          <AppLogo />
        </div>

        <div
          className="rounded-2xl p-6 space-y-3"
          style={{ background: "#111111", border: "1px solid rgba(57,255,20,0.18)", boxShadow: "0 0 40px rgba(57,255,20,0.06)" }}
        >
          <p className="text-center text-sm font-semibold uppercase tracking-widest" style={{ color: "#666" }}>
            Sign in as a …
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            <SignInSquareBtn label="Holiday Guest" isOpen={activePanel === "holiday"} onToggle={() => togglePanel("holiday")} />
            <SignInSquareBtn label="Local Guest" isOpen={activePanel === "local"} onToggle={() => togglePanel("local")} />
            <SignInSquareBtn label="Partner" isOpen={activePanel === "partner"} onToggle={() => togglePanel("partner")} />
          </div>

          <PanelWrap id="holiday" activePanel={activePanel}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: LUMO }}>Holiday Guest</p>
            <MethodToggle method={holidayMethod} onChange={setHolidayMethod} />
            <form onSubmit={handleHolidayLogin} className="space-y-4">
              {holidayMethod === "code" ? (
                <ProfileAccessCodeField value={holidayCode} charError={holidayCodeError} onChange={holidayCodeHandlers.onChange} onPaste={holidayCodeHandlers.onPaste} />
              ) : (
                <>
                  <div className="space-y-1.5">
                    <ThemedLabel>Partner / Business Name</ThemedLabel>
                    <ThemedInput type="text" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Exact business name" />
                  </div>
                  <div className="space-y-1.5">
                    <ThemedLabel>Address</ThemedLabel>
                    <ThemedInput type="text" value={holidayAddress} onChange={(e) => setHolidayAddress(e.target.value)} placeholder="Street address" />
                  </div>
                  <div className="space-y-1.5">
                    <ThemedLabel>Province</ThemedLabel>
                    <ThemedSelect value={holidayProvince} onValueChange={setHolidayProvince} placeholder="Select province">
                      {SA_PROVINCES.map((p) => (
                        <SelectItem key={p} value={p} style={{ color: "#fff" }}>{p}</SelectItem>
                      ))}
                    </ThemedSelect>
                  </div>
                  <div className="space-y-1.5">
                    <ThemedLabel>Area</ThemedLabel>
                    <ThemedInput type="text" value={holidayArea} onChange={(e) => setHolidayArea(e.target.value)} placeholder="e.g. Cape Town, Stellenbosch" />
                  </div>
                </>
              )}
              <LumoButton disabled={loading}>{loading ? "Signing in…" : "Sign In"}</LumoButton>
            </form>
          </PanelWrap>

          <PanelWrap id="local" activePanel={activePanel}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: LUMO }}>Local Guest</p>
            <form onSubmit={handleLocalLogin} className="space-y-4">
              <div className="space-y-1.5">
                <ThemedLabel>Email Address</ThemedLabel>
                <ThemedInput
                  type="email"
                  value={localEmail}
                  onChange={(e) => setLocalEmail(e.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1.5">
                <ThemedLabel>Province</ThemedLabel>
                <ThemedSelect
                  value={localProvince}
                  onValueChange={(v) => { setLocalProvince(v); }}
                  placeholder="Select province"
                >
                  {SA_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p} style={{ color: "#fff" }}>{p}</SelectItem>
                  ))}
                </ThemedSelect>
              </div>
              <div className="space-y-1.5">
                <ThemedLabel>Postal Code</ThemedLabel>
                <ThemedInput
                  type="text"
                  value={localPostalCode}
                  onChange={(e) => setLocalPostalCode(e.target.value)}
                  placeholder="e.g. 7395"
                  inputMode="numeric"
                  enterKeyHint="next"
                />
              </div>
              <p className="text-xs" style={{ color: "#555" }}>You may sign in up to 10 times per month with this email.</p>
              <LumoButton disabled={loading}>{loading ? "Signing in…" : "Sign In"}</LumoButton>
            </form>
          </PanelWrap>

          <PanelWrap id="partner" activePanel={activePanel}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: LUMO }}>Partner</p>
            <MethodToggle method={partnerMethod} onChange={setPartnerMethod} />
            <form onSubmit={handlePartnerLogin} className="space-y-4">
              {partnerMethod === "code" ? (
                <ProfileAccessCodeField value={partnerCode} charError={partnerCodeError} onChange={partnerCodeHandlers.onChange} onPaste={partnerCodeHandlers.onPaste} />
              ) : (
                <>
                  <div className="space-y-1.5">
                    <ThemedLabel>Partner / Business Name</ThemedLabel>
                    <ThemedInput type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Exact business name" />
                  </div>
                  <div className="space-y-1.5">
                    <ThemedLabel>Address</ThemedLabel>
                    <ThemedInput type="text" value={partnerAddress} onChange={(e) => setPartnerAddress(e.target.value)} placeholder="Street address" />
                  </div>
                  <div className="space-y-1.5">
                    <ThemedLabel>Province</ThemedLabel>
                    <ThemedSelect value={partnerProvince} onValueChange={setPartnerProvince} placeholder="Select province">
                      {SA_PROVINCES.map((p) => (
                        <SelectItem key={p} value={p} style={{ color: "#fff" }}>{p}</SelectItem>
                      ))}
                    </ThemedSelect>
                  </div>
                  <div className="space-y-1.5">
                    <ThemedLabel>Area</ThemedLabel>
                    <ThemedInput type="text" value={partnerArea} onChange={(e) => setPartnerArea(e.target.value)} placeholder="e.g. Cape Town, Stellenbosch" />
                  </div>
                </>
              )}
              <LumoButton disabled={loading}>{loading ? "Signing in…" : "Sign In"}</LumoButton>
            </form>
          </PanelWrap>

          <p className="text-xs leading-relaxed px-1 pt-1" style={{ color: "#888" }}>
            We list Service Partners in and around your accommodation&apos;s location. Use the Radius slider to expand your search up to 150 km. To request inclusion of a service provider, submit full provider details to{" "}
            <a href="mailto:sales@aroundyou.co.za" className="underline underline-offset-2 transition-colors hover:text-[#39FF14]" style={{ color: "#aaa" }}>
              sales@aroundyou.co.za
            </a>
            .
          </p>

          <div className="pt-2 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/admin-login")}
              className="text-sm transition-colors hover:underline underline-offset-4"
              style={{ color: LUMO }}
            >
              SuperAdmin
            </button>
            <button
              type="button"
              onClick={() => navigate("/rep-login")}
              className="text-sm transition-colors hover:underline underline-offset-4"
              style={{ color: LUMO }}
            >
              Rep
            </button>
            <button
              type="button"
              onClick={() => navigate("/acc-login")}
              className="text-sm transition-colors hover:underline underline-offset-4"
              style={{ color: LUMO }}
            >
              Acc
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
