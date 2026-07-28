import type { PageFlipDirection } from "./types";

export function getBoundedPageFlipIndex(currentIndex: number, itemCount: number, direction: PageFlipDirection, loop = false) {
  if (itemCount <= 0) return -1;
  const normalized = Math.min(Math.max(currentIndex, 0), itemCount - 1);
  const delta = direction === "next" ? 1 : -1;
  const nextIndex = normalized + delta;

  if (nextIndex >= 0 && nextIndex < itemCount) return nextIndex;
  if (!loop) return normalized;
  return direction === "next" ? 0 : itemCount - 1;
}

export function canNavigatePageFlip(currentIndex: number, itemCount: number, direction: PageFlipDirection, loop = false) {
  if (itemCount <= 1) return false;
  if (loop) return true;
  return direction === "next" ? currentIndex < itemCount - 1 : currentIndex > 0;
}

export function getVisiblePageFlipIndexes(currentIndex: number, itemCount: number, radius = 1) {
  if (itemCount <= 0) return [];
  const indexes = Array.from({ length: radius * 2 + 1 }, (_, offset) => currentIndex - radius + offset);
  return Array.from(new Set(indexes.filter((index) => index >= 0 && index < itemCount)));
}

export function getCoverFlowTransform(offset: number, reducedMotion = false) {
  const abs = Math.abs(offset);
  const boundedOpacity = abs > 2 ? 0 : Math.max(0.35, 1 - abs * 0.22);

  if (reducedMotion) {
    return {
      x: offset * 92,
      z: 0,
      rotateY: 0,
      scale: offset === 0 ? 1 : Math.max(0.76, 0.9 - abs * 0.06),
      opacity: boundedOpacity,
      zIndex: 100 - abs,
    };
  }

  return {
    x: offset * 220,
    z: -abs * 180,
    rotateY: offset < 0 ? 48 : offset > 0 ? -48 : 0,
    scale: offset === 0 ? 1 : Math.max(0.68, 0.88 - abs * 0.08),
    opacity: boundedOpacity,
    zIndex: 100 - abs,
  };
}
