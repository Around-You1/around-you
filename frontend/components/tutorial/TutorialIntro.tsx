"use client";

import { useState } from "react";
import { Settings, Volume2, X } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import { useTutorial } from "@/components/tutorial/TutorialProvider";

const LUMO = "#39FF14";

// The first screen: just the logo, with a window explaining the voice tutorial.
// A settings cog opens the sound panel (turn volume up + Test sound). "Start"
// switches the voices on and begins the walkthrough; "Skip" goes straight in.
export default function TutorialIntro({ onDone }: { onDone: () => void }) {
  const tutorial = useTutorial();
  const [soundOpen, setSoundOpen] = useState(false);

  const start = () => { tutorial?.unlockAndStart(); onDone(); };
  const skip = () => { tutorial?.skipAll(); onDone(); };

  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: "radial-gradient(130% 90% at 50% 0%, rgba(57,255,20,0.10), #0a0a0a 60%)",
        padding: "24px 16px",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <AppLogo src="/logo-dark.png" size={150} />

      <div
        style={{
          position: "relative",
          width: "min(94vw, 460px)",
          background: "#111",
          border: "1px solid rgba(57,255,20,0.3)",
          borderRadius: 16,
          padding: "22px 20px 20px",
          boxShadow: "0 0 40px rgba(57,255,20,0.08)",
          color: "#d5d8d5",
        }}
      >
        {/* Settings cog — opens the sound panel */}
        <button
          type="button"
          aria-label="Sound settings"
          onClick={() => setSoundOpen((v) => !v)}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            border: `1px solid ${LUMO}`,
            background: soundOpen ? LUMO : "transparent",
            color: soundOpen ? "#071a05" : LUMO,
          }}
        >
          <Settings className="h-5 w-5" />
        </button>

        <h2 style={{ color: LUMO, fontSize: 20, fontWeight: 800, margin: "0 42px 8px 0" }}>
          Welcome to Around You
        </h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "0 0 6px" }}>
          There’s a short voice guide that talks you through each screen as you go.
        </p>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "0 0 14px", color: "#b9beb9" }}>
          Please turn your phone’s volume up. Tap the settings cog{" "}
          <Settings className="inline h-4 w-4" style={{ color: LUMO, verticalAlign: "-3px" }} />{" "}
          in the corner to test your sound.
        </p>

        {soundOpen ? (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(57,255,20,0.25)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: "#eafff0", fontSize: 14 }}>Sound check</span>
              <button type="button" aria-label="Close" onClick={() => setSoundOpen(false)} style={{ color: "#9aa0a6" }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.45, margin: "0 0 10px", color: "#b9beb9" }}>
              Turn your phone’s volume up and make sure it isn’t on silent, then tap below. If you hear a short chime, you’re ready.
            </p>
            <button
              type="button"
              onClick={() => tutorial?.testSound()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                color: LUMO,
                border: `1px solid ${LUMO}`,
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Volume2 className="h-4 w-4" /> Test sound
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={start}
          style={{
            width: "100%",
            background: LUMO,
            color: "#071a05",
            border: "none",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 16,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          Start tutorial
        </button>
        <button
          type="button"
          onClick={skip}
          style={{
            width: "100%",
            background: "transparent",
            color: "#9aa0a6",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            padding: "11px 16px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Skip — go straight in
        </button>
      </div>
    </div>
  );
}
