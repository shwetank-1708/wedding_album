/* eslint-disable @next/next/no-img-element */
"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryMediaItem, PageFlipThemeConfig } from "./types";

interface PageFlipThumbnailStripProps {
  items: GalleryMediaItem[];
  currentIndex: number;
  config: PageFlipThemeConfig;
  onSelect: (index: number) => void;
}

export function PageFlipThumbnailStrip({ items, currentIndex, config, onSelect }: PageFlipThumbnailStripProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[110] overflow-x-auto px-4 py-4 backdrop-blur-xl" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)" }}>
      <div className="mx-auto flex w-max max-w-full gap-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden border transition focus-visible:outline-none focus-visible:ring-2 md:h-20 md:w-20",
              config.controlClass,
              index === currentIndex ? "scale-100 opacity-100" : "scale-95 opacity-55 hover:opacity-90"
            )}
            style={{ borderRadius: config.cornerRadius }}
            aria-label={`Open media ${index + 1}`}
          >
            {item.type === "video" && (
              <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 text-white">
                <Play className="h-4 w-4 fill-current" />
              </span>
            )}
            <img src={item.thumbnailUrl || item.previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
