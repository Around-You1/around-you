"use client";

import { useEffect, useRef, useState } from "react";

const LUMO = "#39FF14";

// How long the car takes to travel from 0% to 90% when the app is ready
// before this time is up. Tuned so the whole animation — skylines, bar,
// car — is actually visible rather than flashing past. The `ready` prop
// itself is already gated on a minimum display time in app/page.tsx, so by
// the time `ready` flips true here the bar is normally right around 90%
// already, giving a smooth final fill rather than an abrupt jump.
const RAMP_DURATION_MS = 3200;

// Layout constants (percent of the stage). The two skylines flank the screen
// and "almost touch" in the middle, with the logo bridging the gap. The
// loading bar spans from the MIDDLE of the JHB skyline (25%) to the MIDDLE of
// the Table Mountain skyline (75%), and the car rides along that same span.
const BAR_LEFT = 25; // = horizontal centre of the JHB skyline
const BAR_WIDTH = 50; // 25%..75% (centre of JHB .. centre of Table Mountain)
const BASELINE_BOTTOM = "40%"; // shared baseline the skylines + logo sit on

interface Props {
  // True once whatever the app is actually waiting on (session check, code
  // chunk load, MINIMUM display time, etc.) has genuinely finished. The bar
  // will animate but will NEVER reach 100% until this flips true.
  ready: boolean;
  // Called after the bar has visibly completed and the fade-out finishes.
  // Use this to actually unmount the loading screen.
  onFinished: () => void;
}

export default function LoadingScreen({ ready, onFinished }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const startRef = useRef<number | null>(null);

  // Smooth, time-based ramp up to 90% — linear, driven by requestAnimationFrame
  // so it plays at a steady, watchable pace regardless of how fast the network
  // actually is.
  useEffect(() => {
    if (ready) return;
    if (startRef.current === null) startRef.current = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const elapsed = now - (startRef.current ?? now);
      const pct = Math.min(90, (elapsed / RAMP_DURATION_MS) * 90);
      setProgress(pct);
      if (pct < 90) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  // Once genuinely ready, snap to 100% then fade out and unmount.
  useEffect(() => {
    if (!ready) return;
    setProgress(100);
    const fadeTimer = setTimeout(() => setFadingOut(true), 400);
    const doneTimer = setTimeout(() => onFinished(), 400 + 400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const p = progress / 100;
  const carLeft = BAR_LEFT + BAR_WIDTH * p; // car centre rides the bar span

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        zIndex: 9999,
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 400ms ease",
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {/* Johannesburg skyline — left, baseline on the shared line */}
        <img
          src="/loading/jhb-skyline.png"
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            bottom: BASELINE_BOTTOM,
            left: "1%",
            width: "47%",
            maxHeight: "42%",
            objectFit: "contain",
            objectPosition: "bottom",
          }}
        />

        {/* Table Mountain skyline — right, baseline on the shared line */}
        <img
          src="/loading/table-mountain-skyline.png"
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            bottom: BASELINE_BOTTOM,
            right: "1%",
            width: "47%",
            maxHeight: "42%",
            objectFit: "contain",
            objectPosition: "bottom",
          }}
        />

        {/* Around You logo — centred, its bottom point on the shared baseline */}
        <img
          src="/loading/logo-clear.png"
          alt="Around You"
          draggable={false}
          style={{
            position: "absolute",
            bottom: BASELINE_BOTTOM,
            left: "50%",
            transform: "translateX(-50%)",
            height: "clamp(70px, 18%, 170px)",
            width: "auto",
          }}
        />

        {/* The car — rides along the bar span, constant size */}
        <img
          src="/loading/car.png"
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            bottom: "calc(9% + 26px)",
            left: `${carLeft}%`,
            transform: "translateX(-50%)",
            width: "clamp(90px, 13%, 190px)",
            height: "auto",
            transition: "left 120ms linear",
          }}
        />

        {/* Loading bar — spans JHB centre (25%) to Table Mountain centre (75%) */}
        <div
          style={{
            position: "absolute",
            left: `${BAR_LEFT}%`,
            width: `${BAR_WIDTH}%`,
            bottom: "9%",
            height: 26,
            borderRadius: 999,
            border: `2px solid ${LUMO}`,
            background: "rgba(57,255,20,0.08)",
            boxShadow: `0 0 14px rgba(57,255,20,0.5), inset 0 0 10px rgba(57,255,20,0.25)`,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 3,
              width: `calc((100% - 6px) * ${p})`,
              background: LUMO,
              borderRadius: 999,
              boxShadow: `0 0 16px 3px ${LUMO}`,
              transition: "width 120ms linear",
            }}
          />
        </div>

        {/* Percentage under the bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "3%",
            textAlign: "center",
            color: LUMO,
            fontWeight: 700,
            fontSize: "clamp(18px, 3vw, 28px)",
            fontFamily: "system-ui, sans-serif",
            textShadow: "0 0 10px rgba(57,255,20,0.7)",
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}
