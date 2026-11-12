"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Flips the .dark class on <html> and remembers the choice. First-time visitors
// start in Dark (handled by the pre-paint script in layout.tsx); this just lets
// them switch. Stored per-browser in localStorage.
export default function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    if (next) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* best-effort */
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className={className}
      aria-label="Toggle dark or light mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
