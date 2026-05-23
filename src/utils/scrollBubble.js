/** Scroll distance before chat bubbles collapse into chips. */
export const SCROLL_COLLAPSE_THRESHOLD_PX = 100;

/** Duration of the one-shot collapse / expand morph. */
export const BUBBLE_MORPH_MS = 360;

/**
 * Collapse bubbles after scroll threshold. Expand only via user click on a chip.
 * "Fully compact" = all chips, none manually expanded.
 */
export function attachScrollBubbleController({ onCollapse, isFullyCompact }) {
  const scrollPos = new WeakMap();
  let accumulated = 0;
  let lastWinX = window.scrollX;
  let lastWinY = window.scrollY;

  const resetAccumulated = () => {
    accumulated = 0;
  };

  const onScroll = (e) => {
    let delta = 0;

    if (e.target === document) {
      delta +=
        Math.abs(window.scrollY - lastWinY) +
        Math.abs(window.scrollX - lastWinX);
      lastWinY = window.scrollY;
      lastWinX = window.scrollX;
    } else if (
      e.target instanceof Element &&
      e.target !== document.documentElement
    ) {
      const el = e.target;
      const top = el.scrollTop;
      const left = el.scrollLeft;
      const prev = scrollPos.get(el);
      scrollPos.set(el, { top, left });
      if (prev) {
        delta += Math.abs(top - prev.top) + Math.abs(left - prev.left);
      }
    }

    if (delta < 1) return;

    accumulated += delta;

    if (accumulated >= SCROLL_COLLAPSE_THRESHOLD_PX && !isFullyCompact()) {
      onCollapse();
      accumulated = 0;
    }
  };

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  const removeListener = () => {
    document.removeEventListener("scroll", onScroll, true);
  };

  return { removeListener, resetAccumulated };
}
