"use client";

import { useEffect, useState } from "react";

// Branded loading splash — the neon Around You skyline with the pin, a glowing
// progress bar and the car driving across it, built from the saved artwork in
// /public/loading. Always dark/neon, matching the Around You cover.
export default function BrandLoading() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let v = 0;
    const id = setInterval(() => {
      v = v >= 100 ? 0 : v + 2;
      setPct(v);
    }, 56);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ayl-wrap">
      <style>{`
        .ayl-wrap{min-height:100vh;width:100%;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;overflow:hidden;padding:24px 16px}
        .ayl-pin{width:120px;max-width:38%;height:auto;filter:drop-shadow(0 0 16px rgba(57,255,20,.45))}
        .ayl-sky{width:100%;max-width:1000px;height:auto;mix-blend-mode:screen}
        .ayl-barwrap{width:100%;max-width:620px;position:relative;height:70px}
        .ayl-track{position:absolute;left:0;right:0;bottom:6px;height:14px;border-radius:999px;background:#0a0a0a;border:1px solid #1b5e20;overflow:hidden}
        .ayl-fill{height:100%;border-radius:999px;background:#39ff14;box-shadow:0 0 12px #39ff14,0 0 26px #39ff14;animation:aylfill 2.8s ease-in-out infinite}
        .ayl-car{position:absolute;bottom:14px;left:0;width:90px;transform:translateX(-50%);mix-blend-mode:screen;animation:ayldrive 2.8s ease-in-out infinite;pointer-events:none}
        .ayl-car img{width:100%;height:auto;display:block}
        .ayl-pct{color:#39ff14;font-weight:800;font-size:1.2rem;text-shadow:0 0 10px #39ff14;letter-spacing:.06em;font-variant-numeric:tabular-nums}
        @keyframes aylfill{0%{width:0%}100%{width:100%}}
        @keyframes ayldrive{0%{left:0%}100%{left:100%}}
      `}</style>

      <img src="/loading/logo-clear.png" alt="Around You" className="ayl-pin" />
      <img src="/loading/skyline-v3.png" alt="" className="ayl-sky" />

      <div className="ayl-barwrap">
        <div className="ayl-track"><div className="ayl-fill" /></div>
        <div className="ayl-car"><img src="/loading/car.png" alt="" /></div>
      </div>

      <div className="ayl-pct">{pct}%</div>
    </div>
  );
}
