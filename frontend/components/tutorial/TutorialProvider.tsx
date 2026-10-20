"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

// ---- Voice-over script -------------------------------------------------------
// Each clip lives at /public/tutorial/<key>.mp3 and its caption text is shown on
// screen while it plays (captions never block taps — the banner is
// pointer-events:none and sits clear of the action buttons).
export type VOKey = "VO1" | "VO2" | "VO3" | "VO4" | "VO5" | "VO6" | "VO7" | "VO8";

const CAPTIONS: Record<VOKey, string> = {
  VO1: "Welcome to Around You.",
  VO2: "You’ll see three buttons. Staying here on holiday? Tap Holiday Guest. Live in the area? Tap Local. Own a listed business? Tap Partner.",
  VO3: "The place you’re staying will have sent you an access code. Find it, copy it, then paste or type it into the box marked Profile Access Code, then tap Sign In.",
  VO4: "Take a look around. See what your accommodation offers, and explore all of the businesses Around You — look for discounts, bookings and pre-orders wherever you go.",
  VO5: "Let’s get you registered as a Local. Type in your email address and your mobile number. Choose your province, then type your postal code. Now tap Register. We’ll ask you to confirm your mobile number. Then open your email for a short one-time code, and type it into the box marked OTP.",
  VO6: "We’ll save your details so that next time you just enter your Province and tap Sign In.",
  VO7: "To sign in as a Partner, Around You will have sent you an access code. Type it into the box marked Profile Access Code, then tap Sign In.",
  VO8: "At the top of your profile, tap Edit Profile. Type in your Partner Edit Code, and you can change anything you like — update your details, add or swap out photos, or remove what you don’t need.",
};

// A clip that auto-plays as soon as another finishes (VO5 → VO6 on the Local page).
const FOLLOW: Partial<Record<VOKey, VOKey>> = { VO5: "VO6" };

// Routes where the tutorial UI (captions + Skip/Replay control) may appear.
const TUTORIAL_ROUTES = ["/", "/portal", "/guest-dashboard", "/partner-dashboard"];

const LUMO = "#39FF14";

type Ctx = {
  enabled: boolean;
  audioUnlocked: boolean;
  unlockAndStart: () => void; // intro "Start tutorial"
  skipAll: () => void; // intro "Skip" and the floating Skip control
  replay: () => void; // floating Replay control
  testSound: () => void; // intro "Test sound"
  play: (key: VOKey) => void; // per-screen triggers
};

const TutorialCtx = createContext<Ctx | null>(null);
export const useTutorial = () => useContext(TutorialCtx);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [enabled, setEnabled] = useState(true); // auto-plays every visit until skipped
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [caption, setCaption] = useState("");
  const [showCaption, setShowCaption] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastRequestedRef = useRef<VOKey | null>(null);
  const playedRef = useRef<Set<VOKey>>(new Set());
  const enabledRef = useRef(true);
  const unlockedRef = useRef(false);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { unlockedRef.current = audioUnlocked; }, [audioUnlocked]);

  const getAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) { try { a.pause(); a.onended = null; } catch { /* ignore */ } }
    setShowCaption(false);
  }, []);

  const playFile = useCallback((key: VOKey, chain: boolean) => {
    const a = getAudio();
    if (!a) return;
    try { a.pause(); } catch { /* ignore */ }
    a.onended = null;
    a.muted = false;
    a.src = `/tutorial/${key}.mp3`;
    setCaption(CAPTIONS[key]);
    setShowCaption(true);
    a.onended = () => {
      const follow = chain ? FOLLOW[key] : undefined;
      if (follow && enabledRef.current) {
        playedRef.current.add(follow);
        playFile(follow, false);
      } else {
        setShowCaption(false);
      }
    };
    a.play().catch(() => { /* blocked until a user gesture — handled by intro */ });
  }, [getAudio]);

  const play = useCallback((key: VOKey) => {
    lastRequestedRef.current = key;
    if (!enabledRef.current || !unlockedRef.current) return;
    if (playedRef.current.has(key)) return;
    playedRef.current.add(key);
    playFile(key, true);
  }, [playFile]);

  // Unlock the audio element inside a user gesture (mobile autoplay policy).
  const unlock = useCallback(() => {
    const a = getAudio();
    if (!a) return;
    try {
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => { try { a.pause(); } catch { /* ignore */ } a.muted = false; })
         .catch(() => { a.muted = false; });
      } else {
        try { a.pause(); } catch { /* ignore */ }
        a.muted = false;
      }
    } catch { a.muted = false; }
    unlockedRef.current = true;
    setAudioUnlocked(true);
  }, [getAudio]);

  const testSound = useCallback(() => {
    const a = getAudio();
    if (!a) return;
    unlockedRef.current = true;
    setAudioUnlocked(true);
    try {
      a.pause();
      a.onended = null;
      a.muted = false;
      a.src = "/tutorial/chime.mp3";
      a.play().catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }, [getAudio]);

  const unlockAndStart = useCallback(() => {
    setEnabled(true);
    enabledRef.current = true;
    unlock();
  }, [unlock]);

  const skipAll = useCallback(() => {
    setEnabled(false);
    enabledRef.current = false;
    stop();
  }, [stop]);

  const replay = useCallback(() => {
    setEnabled(true);
    enabledRef.current = true;
    if (!unlockedRef.current) unlock();
    playedRef.current.clear();
    const key = lastRequestedRef.current;
    if (key) {
      playedRef.current.add(key);
      // next tick so unlock settles first
      setTimeout(() => playFile(key, true), 0);
    }
  }, [unlock, playFile]);

  const onTutorialRoute = TUTORIAL_ROUTES.includes(pathname);

  const ctx: Ctx = { enabled, audioUnlocked, unlockAndStart, skipAll, replay, testSound, play };

  return (
    <TutorialCtx.Provider value={ctx}>
      {children}

      {/* Caption banner — pinned to the top, taps pass straight through so it can
          never block a button the user needs to press. */}
      {onTutorialRoute && showCaption && caption ? (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 0px) + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(92vw, 560px)",
            pointerEvents: "none",
            zIndex: 60,
            background: "rgba(10,10,10,0.88)",
            border: "1px solid rgba(57,255,20,0.35)",
            borderRadius: 12,
            padding: "10px 14px",
            color: "#eafff0",
            fontSize: 14,
            lineHeight: 1.35,
            textAlign: "center",
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
          }}
        >
          {caption}
        </div>
      ) : null}

      {/* Skip / Replay control. */}
      {onTutorialRoute && audioUnlocked ? (
        <button
          type="button"
          onClick={() => (enabled ? skipAll() : replay())}
          style={{
            position: "fixed",
            right: "calc(env(safe-area-inset-right, 0px) + 12px)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            zIndex: 61,
            pointerEvents: "auto",
            background: enabled ? "rgba(10,10,10,0.9)" : LUMO,
            color: enabled ? "#eafff0" : "#071a05",
            border: `1px solid ${LUMO}`,
            borderRadius: 999,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {enabled ? "Skip tutorial" : "Replay tutorial"}
        </button>
      ) : null}
    </TutorialCtx.Provider>
  );
}
