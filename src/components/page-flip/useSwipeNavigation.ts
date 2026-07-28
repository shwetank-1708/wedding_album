"use client";

import { useCallback, useRef } from "react";

interface SwipeHandlers {
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onPointerCancel: React.PointerEventHandler<HTMLElement>;
}

export function useSwipeNavigation(onPrev: () => void, onNext: () => void, threshold = 48, includeMouse = false): SwipeHandlers {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const onPointerDown = useCallback<React.PointerEventHandler<HTMLElement>>((event) => {
    if (event.pointerType === "mouse" && !includeMouse) return;
    startRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
  }, [includeMouse]);

  const onPointerUp = useCallback<React.PointerEventHandler<HTMLElement>>((event) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) onNext();
    else onPrev();
  }, [onNext, onPrev, threshold]);

  const onPointerCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
