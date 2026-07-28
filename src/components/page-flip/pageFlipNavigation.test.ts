import { canNavigatePageFlip, getBoundedPageFlipIndex, getCoverFlowTransform, getVisiblePageFlipIndexes } from "./pageFlipNavigation";
import { getPageFlipThemeConfig, resolvePageFlipLayout, themeLayoutMap } from "./pageFlipThemes";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(getBoundedPageFlipIndex(0, 4, "next") === 1, "next moves forward");
assert(getBoundedPageFlipIndex(0, 4, "prev") === 0, "prev is bounded at first item");
assert(getBoundedPageFlipIndex(3, 4, "next") === 3, "next is bounded at last item");
assert(getBoundedPageFlipIndex(3, 4, "next", true) === 0, "loop next wraps to first item");
assert(getBoundedPageFlipIndex(0, 4, "prev", true) === 3, "loop prev wraps to last item");
assert(canNavigatePageFlip(0, 4, "prev") === false, "cannot navigate backward from first without loop");
assert(canNavigatePageFlip(0, 4, "prev", true) === true, "can navigate backward from first with loop");
assert(JSON.stringify(getVisiblePageFlipIndexes(2, 5)) === JSON.stringify([1, 2, 3]), "visible preload indexes are previous/current/next");
assert(JSON.stringify(getVisiblePageFlipIndexes(2, 5, 2)) === JSON.stringify([0, 1, 2, 3, 4]), "cover flow can render previous two/current/next two");
assert(JSON.stringify(getVisiblePageFlipIndexes(0, 5)) === JSON.stringify([0, 1]), "visible preload indexes respect lower bound");
assert(getCoverFlowTransform(0).rotateY === 0, "active cover flow item does not rotate");
assert(getCoverFlowTransform(-1).rotateY > 0, "left cover flow item rotates inward");
assert(getCoverFlowTransform(1).rotateY < 0, "right cover flow item rotates inward");
assert(getCoverFlowTransform(1, true).rotateY === 0, "reduced-motion cover flow removes 3D rotation");
assert(themeLayoutMap["royal-emerald"] === "two-page-spread", "premium wedding themes use two-page spread");
assert(themeLayoutMap["cinematic-noir"] === "side-preview", "cinematic themes use side previews");
assert(themeLayoutMap["neon-party"] === "story", "party themes use story layout");
assert(themeLayoutMap.default === "bottom-filmstrip", "bottom filmstrip remains the fallback layout");
assert(getPageFlipThemeConfig("minimal-love").showPersistentThumbnails === false, "non-filmstrip themes hide persistent thumbnails");
assert(resolvePageFlipLayout("minimal-love", "bottom-filmstrip") === "bottom-filmstrip", "owner layout override wins over theme default");
