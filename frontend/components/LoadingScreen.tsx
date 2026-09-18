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
  // so it plays at a steady, watchable pace regardless of how fast the
  // network actually is.
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
    const fadeTimer = setTimeout(() => setFadingOut(true), 350);
    const doneTimer = setTimeout(() => onFinished(), 350 + 400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 400ms ease",
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 640,
          height: "clamp(180px, 32vh, 300px)",
          display: "flex",
          alignItems: "flex-end",
          padding: "0 4vw",
          boxSizing: "border-box",
        }}
      >
        {/* Johannesburg skyline — left */}
        <img
          src="/loading/jhb-skyline.png"
          alt=""
          draggable={false}
          style={{
            height: "clamp(90px, 22vh, 170px)",
            width: "auto",
            maxWidth: "38%",
            objectFit: "contain",
            flexShrink: 0,
            filter: "drop-shadow(0 0 6px rgba(57,255,20,0.35))",
          }}
        />

        {/* Track between the two skylines: holds the bar + car */}
        <div
          style={{
            position: "relative",
            flex: 1,
            height: "100%",
            minWidth: 40,
          }}
        >
          {/* Rail */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 22,
              height: 5,
              borderRadius: 999,
              background: "rgba(57,255,20,0.15)",
              overflow: "hidden",
            }}
          >
            {/* Fill */}
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: LUMO,
                borderRadius: 999,
                boxShadow: `0 0 10px 2px ${LUMO}`,
                transition: "width 100ms linear",
              }}
            />
          </div>

          {/* Car, riding on top of the rail, sliding left -> right with progress */}
          <div
            style={{
              position: "absolute",
              bottom: 27,
              left: `${progress}%`,
              transform: "translateX(-50%)",
              transition: "left 100ms linear",
            }}
          >
            <img
              src="/loading/car.png"
              alt=""
              draggable={false}
              style={{
                width: "clamp(64px, 16vw, 100px)",
                height: "auto",
                display: "block",
                filter: `drop-shadow(0 0 6px ${LUMO})`,
              }}
            />
          </div>
        </div>

        {/* Table Mountain skyline — right */}
        <img
          src="/loading/table-mountain-skyline.png"
          alt=""
          draggable={false}
          style={{
            height: "clamp(110px, 26vh, 200px)",
            width: "auto",
            maxWidth: "38%",
            objectFit: "contain",
            flexShrink: 0,
            filter: "drop-shadow(0 0 6px rgba(57,255,20,0.35))",
          }}
        />
      </div>
    </div>
  );
}