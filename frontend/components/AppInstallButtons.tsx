"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Captured as early as this module loads on the client. Chrome fires
// `beforeinstallprompt` once when the app is installable (manifest + service
// worker + served over HTTPS). We stash it so the Android button can trigger
// the real native "Install app" dialog — a genuine one-tap install where the
// browser supports it. iOS/Safari exposes no such API, so iPhone always shows
// the manual Add-to-Home-Screen steps.
let deferredPrompt: any = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

const GREEN = "bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold";

export default function AppInstallButtons() {
  const [modal, setModal] = useState<null | "android" | "ios">(null);

  // Register a minimal service worker so Chrome treats the site as installable.
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const handleAndroid = async () => {
    if (deferredPrompt) {
      // Real native install prompt.
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {
        /* ignore */
      }
      deferredPrompt = null;
      return;
    }
    // Not eligible for the automatic prompt (already installed, not Chrome, or
    // the browser hasn't offered it yet) — show the manual steps.
    setModal("android");
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
      <p className="text-sm text-muted-foreground text-center sm:text-right max-w-xs">
        To download the Around You app icon, click which one applies to you
      </p>
      <div className="flex gap-2">
        <Button type="button" className={GREEN} onClick={handleAndroid}>
          Android
        </Button>
        <Button type="button" className={GREEN} onClick={() => setModal("ios")}>
          iPhone
        </Button>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-black">
                {modal === "android"
                  ? "Add the app icon — Android"
                  : "Add the app icon — iPhone"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-2xl leading-none text-gray-500 hover:text-black"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {modal === "android" ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-800">
                <li>Open your browser and go to <b>aroundyou.co.za</b>. You'll land on the app page.</li>
                <li>Tap the <b>3 dots</b> at the top right.</li>
                <li>Tap <b>"Install app"</b> (or "Install and create shortcut"), then tap <b>Install</b>.</li>
                <li>The app icon appears with your other apps. If you don't see it, swipe up and search <b>Around You</b>.</li>
                <li>Press and hold the icon, then choose <b>"Add to Home Screen"</b>.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-800">
                <li>Open <b>Safari</b> and go to <b>aroundyou.co.za</b>; let the page load fully.</li>
                <li>Tap the <b>Share</b> button at the bottom centre (a square with an arrow pointing up). A menu slides up.</li>
                <li>Scroll down and tap <b>"Add to Home Screen"</b>.</li>
                <li>Optionally edit the title, then tap <b>Add</b> at the top right.</li>
                <li>Safari closes and the Around You icon is on your Home Screen.</li>
              </ol>
            )}

            <p className="mt-4 text-xs text-gray-500">
              {modal === "android"
                ? "Tip: tapping Android above will pop up your phone's built-in install button when your browser supports it."
                : "iPhone can only be added through Safari's Share menu — Apple doesn't allow apps to add the icon for you."}
            </p>

            <Button type="button" className={`${GREEN} w-full mt-4`} onClick={() => setModal(null)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
