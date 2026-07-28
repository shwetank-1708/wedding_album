"use client";

import { useCallback, useMemo, useState } from "react";
import { canNavigatePageFlip, getBoundedPageFlipIndex } from "./pageFlipNavigation";
import type { PageFlipDirection } from "./types";

interface UsePageFlipNavigationArgs {
  initialIndex?: number;
  itemCount: number;
  loop?: boolean;
  onIndexChange?: (index: number) => void;
}

export function usePageFlipNavigation({ initialIndex = 0, itemCount, loop = false, onIndexChange }: UsePageFlipNavigationArgs) {
  const [currentIndex, setCurrentIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(itemCount - 1, 0)));
  const [direction, setDirection] = useState<PageFlipDirection>("next");
  const [isTurning, setIsTurning] = useState(false);

  const canNext = useMemo(() => canNavigatePageFlip(currentIndex, itemCount, "next", loop), [currentIndex, itemCount, loop]);
  const canPrev = useMemo(() => canNavigatePageFlip(currentIndex, itemCount, "prev", loop), [currentIndex, itemCount, loop]);

  const goTo = useCallback((index: number, nextDirection: PageFlipDirection = index >= currentIndex ? "next" : "prev") => {
    if (isTurning || itemCount <= 0 || index === currentIndex) return false;
    const bounded = loop ? ((index % itemCount) + itemCount) % itemCount : Math.min(Math.max(index, 0), itemCount - 1);
    if (bounded === currentIndex) return false;
    setDirection(nextDirection);
    setIsTurning(true);
    setCurrentIndex(bounded);
    onIndexChange?.(bounded);
    return true;
  }, [currentIndex, isTurning, itemCount, loop, onIndexChange]);

  const navigate = useCallback((nextDirection: PageFlipDirection) => {
    if (isTurning || !canNavigatePageFlip(currentIndex, itemCount, nextDirection, loop)) return false;
    return goTo(getBoundedPageFlipIndex(currentIndex, itemCount, nextDirection, loop), nextDirection);
  }, [currentIndex, goTo, isTurning, itemCount, loop]);

  return {
    currentIndex,
    direction,
    isTurning,
    canNext,
    canPrev,
    goTo,
    next: () => navigate("next"),
    prev: () => navigate("prev"),
    finishTurn: () => setIsTurning(false),
  };
}

