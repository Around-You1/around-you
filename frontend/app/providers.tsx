"use client";

import { Toaster } from "@/components/ui/toaster";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";

// App-wide client providers. The toast system used throughout the components
// mounts here so any component can call useToast(). TutorialProvider supplies
// the guided voice-over walkthrough (captions + Skip/Replay control).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TutorialProvider>
      {children}
      <Toaster />
    </TutorialProvider>
  );
}
