"use client";

import * as React from "react";

// Minimal swipe hook reconstructed from usage:
//   const handlers = useSwipe({ onSwipedLeft, onSwipedRight, minSwipeDistance: 50 });
//   <div {...handlers}>...</div>
export interface SwipeOptions {
  onSwipedLeft?: () => void;
  onSwipedRight?: () => void;
  onSwipedUp?: () => void;
  onSwipedDown?: () => void;
  minSwipeDistance?: number;
}

export function useSwipe(options: SwipeOptions) {
  const {
    onSwipedLeft,
    onSwipedRight,
    onSwipedUp,
    onSwipedDown,
    minSwipeDistance = 50,
  } = options;

  const start = React.useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;

      if (Math.abs(dx) >= Math.abs(dy)) {
        if (Math.abs(dx) < minSwipeDistance) return;
        if (dx < 0) onSwipedLeft?.();
        else onSwipedRight?.();
      } else {
        if (Math.abs(dy) < minSwipeDistance) return;
        if (dy < 0) onSwipedUp?.();
        else onSwipedDown?.();
      }
    },
    [onSwipedLeft, onSwipedRight, onSwipedUp, onSwipedDown, minSwipeDistance]
  );

  return { onTouchStart, onTouchEnd };
}
