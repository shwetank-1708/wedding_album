"use client";

import { PageFlipViewer, type PageFlipViewerProps } from "./PageFlipViewer";
import type { PageFlipTheme } from "./types";

export interface CoverFlowMediaViewerProps extends Omit<PageFlipViewerProps, "theme" | "viewerLayout"> {
  theme?: PageFlipTheme;
}

export function CoverFlowMediaViewer({ theme = "midnight-hero", ...props }: CoverFlowMediaViewerProps) {
  return <PageFlipViewer {...props} theme={theme} viewerLayout="cover-flow" />;
}

export * from "./types";
