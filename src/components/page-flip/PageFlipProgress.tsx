"use client";

import type { PageFlipThemeConfig } from "./types";

export function PageFlipProgress({ index, total, config }: { index: number; total: number; config: PageFlipThemeConfig }) {
  const percent = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <div className="fixed left-1/2 top-5 z-[110] w-[min(260px,46vw)] -translate-x-1/2 text-center md:top-7" aria-live="polite">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] opacity-80">
        Media {index + 1} of {total}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, backgroundColor: config.edgeHighlightClass?.includes("#") ? undefined : "currentColor" }} />
      </div>
    </div>
  );
}

