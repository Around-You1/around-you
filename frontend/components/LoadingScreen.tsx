"use client";

import { useEffect, useRef, useState } from "react";

const LUMO = "#39FF14";

interface Props {
  // True once whatever the app is actually waiting on (session check, code
  // chunk load, etc.) has genuinely finished. The bar will animate but will
  // NEVER reach 100% until this flips true — it never lies about progress.
  ready: boolean;
  // Called after the bar has visibly completed and the fade-out finishes.
  // Use this to actually unmount the loading screen.
  onFinished: () => void;
}

export default function LoadingScreen({ ready, onFinished }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  // Ramp progress up asymptotically towards 92% while we wait — gives the
  // user real motion instead of a frozen bar, without ever claiming we're
  // done before we actually are.
  useEffect(() => {
    if (ready) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const remaining = 92 - p;
        return p + Math.max(0.5, remaining * 0.08);
      });
    }, 120);
    return () => clearInterval(interval);
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
                transition: "width 150ms linear",
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
              transition: "left 150ms linear",
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