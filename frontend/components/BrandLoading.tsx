"use client";

import { useEffect, useState } from "react";

// A shared progress clock kept at module scope so the loader stays CONTINUOUS
// across the 2–3 quick remounts during start-up (auth check → chunk load → data
// fetch) instead of restarting the car each time. It resets only for a genuinely
// new loading episode (a gap of >1.5s with no frames).
let animStart = 0;
let animLast = 0;

// Branded loading splash — the neon Around You skyline with the pin, a glowing
// progress bar and the car driving across it, built from /public/loading. One
// value (pct) drives the bar width, the car position and the percentage, so
// they always move together.
export default function BrandLoading() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const DURATION = 6000; // ease toward ~95% over ~6s, then hold until ready
    const tick = () => {
      const now = performance.now();
      if (animStart === 0 || now - animLast > 1500) animStart = now; // new episode
      animLast = now;
      const e = Math.min(1, (now - animStart) / DURATION);
      const eased = 1 - Math.pow(1 - e, 3); // ease-out
      setPct(Math.round(eased * 95));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="ayl-wrap">
      <style>{`
        .ayl-wrap{min-height:100vh;width:100%;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;overflow:hidden;padding:24px 16px}
        .ayl-pin{width:120px;max-width:38%;height:auto;filter:drop-shadow(0 0 16px rgba(57,255,20,.45))}
        .ayl-sky{width:100%;max-width:1000px;height:auto;mix-blend-mode:screen}
        .ayl-barwrap{width:100%;max-width:620px;position:relative;height:70px}
        .ayl-track{position:absolute;left:0;right:0;bottom:6px;height:14px;border-radius:999px;background:#0a0a0a;border:1px solid #1b5e20;overflow:hidden}
        .ayl-fill{height:100%;border-radius:999px;background:#39ff14;box-shadow:0 0 12px #39ff14,0 0 26px #39ff14}
        .ayl-car{position:absolute;bottom:14px;width:90px;transform:translateX(-50%);mix-blend-mode:screen;pointer-events:none}
        .ayl-car img{width:100%;height:auto;display:block}
        .ayl-pct{color:#39ff14;font-weight:800;font-size:1.2rem;text-shadow:0 0 10px #39ff14;letter-spacing:.06em;font-variant-numeric:tabular-nums}
      `}</style>

      <img src="/loading/logo-clear.png" alt="Around You" className="ayl-pin" />
      <img src="/loading/skyline-v3.png" alt="" className="ayl-sky" />

      <div className="ayl-barwrap">
        <div className="ayl-track"><div className="ayl-fill" style={{ width: `${pct}%` }} /></div>
        <div className="ayl-car" style={{ left: `${pct}%` }}><img src="/loading/car.png" alt="" /></div>
      </div>

      <div className="ayl-pct">{pct}%</div>
    </div>
  );
}
