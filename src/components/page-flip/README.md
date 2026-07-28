# Page-Flip Media Viewer

`PageFlipViewer` is the reusable fullscreen media viewer for EveBash gallery pages. It supports images and videos, keyboard navigation, swipe navigation, fullscreen, zoom, download, progress, slideshow, reduced-motion fallback, theme-driven transitions, and theme-driven viewer layouts.

## Basic Usage

```tsx
import { PageFlipViewer } from "@/components/page-flip/PageFlipViewer";

<PageFlipViewer
  items={mediaItems}
  initialIndex={0}
  theme="royal-emerald"
  loop
  onClose={() => setOpen(false)}
  onIndexChange={setCurrentIndex}
/>
```

## Viewer Layouts

Themes choose both their visual styling and their default layout:

- `bottom-filmstrip`: classic persistent thumbnail strip.
- `hidden-thumbnail-drawer`: clean viewer with a grid drawer.
- `two-page-spread`: album-style spread on desktop, single page on mobile.
- `side-preview`: centered media with previous/next side previews.
- `stacked-cards`: scrapbook-style stacked media.
- `story`: fullscreen story-style viewer with top progress bars.
- `numbered-navigation`: compact numbered navigation without thumbnails.
- `cover-flow`: 3D carousel with nearby media angled around the active item and a social action bar.

Gallery owners can override the theme default with:

```tsx
<PageFlipViewer viewerLayout="hidden-thumbnail-drawer" {...props} />
```

For the dedicated Cover Flow wrapper:

```tsx
import { CoverFlowMediaViewer } from "@/components/page-flip/CoverFlowMediaViewer";

<CoverFlowMediaViewer
  items={mediaItems}
  initialIndex={0}
  loop
  showLikes
  showComments
  showShare
  onClose={() => setOpen(false)}
/>
```

## Likes And Comments

Cover Flow reuses the existing EveBash `likes` and `comments` tables through `toggleLike`, `addComment`, `deletePhotoComment`, and `onPhotoInteractions`. Likes and new comments update optimistically and roll back if Supabase rejects the request. Because existing tables are reused, no extra migration is required for this viewer.

Comments open inside the viewer: desktop uses a right-side drawer and mobile uses a bottom sheet. Escape closes the comment drawer before the main viewer.

## Theme Mapping

Gallery template ids such as `royal`, `classic`, `hero`, `scrapbook`, and `cyber_tech` are mapped to page-flip themes in `pageFlipThemes.ts`.

Use:

```ts
getPageFlipThemeForTemplateId(event.templateId)
```

## Adding Another Theme

1. Add the theme id to `PageFlipTheme` in `types.ts`.
2. Add one `PageFlipThemeConfig` entry in `pageFlipThemes.ts`.
3. Add its default layout to `themeLayoutMap` and transition to `themeTransitionMap`.
4. If it maps to an EveBash event template, add the template id to `TEMPLATE_ID_TO_PAGE_FLIP_THEME`.
5. Prefer adjusting config values instead of adding theme-specific component logic.

## Media Loading

Most layouts keep the previous, current, and next preview media preloaded. Cover Flow keeps the previous two, current, and next two mounted so the 3D side previews can animate without loading the full gallery. Original URLs are used only for download. Signed/private URLs are rendered with plain `img`/`video` elements so Next.js optimization does not rewrite or break them.
