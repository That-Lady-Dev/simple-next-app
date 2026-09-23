"use client";

import { useRef } from "react";

// A swipe that starts on a button still fires a click when the browser decides
// the gesture was not a scroll. For actions that write data, that is too
// costly, so only a press that stays put counts as a tap.
const SLOP_PX = 10;

export function useTapOnly(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerCancel: () => {
      start.current = null;
    },
    onClick: (e: React.MouseEvent) => {
      const from = start.current;
      start.current = null;
      // Keyboard activation reports 0,0 and has no pointerdown: always allow it.
      if (from && (Math.abs(e.clientX - from.x) > SLOP_PX || Math.abs(e.clientY - from.y) > SLOP_PX)) return;
      onTap();
    },
  };
}
