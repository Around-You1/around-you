import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeIndicatorProps {
  show?: boolean;
}

export default function SwipeIndicator({ show = true }: SwipeIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasSeenIndicator = localStorage.getItem("hasSeenSwipeIndicator");
    
    if (!hasSeenIndicator && show) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 500);

      const hideTimer = setTimeout(() => {
        setVisible(false);
        localStorage.setItem("hasSeenSwipeIndicator", "true");
      }, 3000);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="bg-background/95 backdrop-blur border rounded-full px-4 py-2 shadow-lg flex items-center gap-2 animate-pulse">
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">Swipe to switch tabs</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
