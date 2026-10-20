"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";

const GREEN = "#15a34a";

// Best-effort clipboard copy with a legacy fallback for older mobile browsers.
async function copyText(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Wi-Fi network name + password with tap-to-copy buttons and a short tip.
// Colours inherit from the surrounding text so it blends on both the light
// guest dashboard and the dark profile view. A web page can't join Wi-Fi
// directly, so this makes copy-then-paste as quick as possible.
export default function WifiConnect({
  name,
  password,
}: {
  name?: string | null;
  password?: string | null;
}) {
  const [copied, setCopied] = useState<"name" | "password" | null>(null);
  const [show, setShow] = useState(false);
  if (!name) return null;

  const doCopy = async (which: "name" | "password", value: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1600);
    }
  };

  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: `1px solid ${GREEN}`,
    color: GREEN,
    background: "transparent",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    margin: "3px 0",
  };
  const label: React.CSSProperties = { opacity: 0.65, minWidth: 66 };
  const value: React.CSSProperties = { fontWeight: 600, wordBreak: "break-all" };

  return (
    <div style={{ fontSize: 14, lineHeight: 1.4 }}>
      <div style={row}>
        <span style={label}>Network</span>
        <span style={value}>{name}</span>
        <button type="button" style={btn} onClick={() => doCopy("name", name)}>
          {copied === "name" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>

      {password ? (
        <div style={row}>
          <span style={label}>Password</span>
          <span style={{ ...value, fontFamily: "monospace" }}>
            {show ? password : "••••••••"}
          </span>
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((v) => !v)}
            style={{ background: "transparent", border: "none", color: "inherit", opacity: 0.7, cursor: "pointer", padding: 0 }}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button type="button" style={btn} onClick={() => doCopy("password", password)}>
            {copied === "password" ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </button>
        </div>
      ) : null}

      <p style={{ opacity: 0.6, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
        Tip: tap Copy, then open your phone’s Wi-Fi settings, choose <strong>{name}</strong> and paste the password.
      </p>
    </div>
  );
}
