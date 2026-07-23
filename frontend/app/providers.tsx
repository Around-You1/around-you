"use client";

import { Toaster } from "@/components/ui/toaster";

// App-wide client providers. The toast system used throughout the components
// mounts here so any component can call useToast().
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
