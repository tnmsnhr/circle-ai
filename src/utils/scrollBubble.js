/** Scroll distance before chat bubbles collapse into chips. */
export const SCROLL_COLLAPSE_THRESHOLD_PX = 100;

/** No scroll activity for this long before bubbles expand again. */
export const SCROLL_SETTLE_BEFORE_EXPAND_MS = 650;

/** Duration of the one-shot collapse / expand morph. */
export const BUBBLE_MORPH_MS = 360;

/**
 * Track scroll deltas (window + nested scrollers) and drive collapse/expand.
 * Uses hysteresis: collapse only after threshold; expand only after a full settle.
 */
export function attachScrollBubbleController({
  onCollapse,
  onExpand,
  isPinned,
  isCollapsed,
}) {
  const scrollPos = new WeakMap();
  let accumulated = 0;
  let lastWinX = window.scrollX;
  let lastWinY = window.scrollY;
  let settleTimer = null;
  let collapsedThisSession = false;

  const clearSettle = () => {
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  };

  const scheduleExpandCheck = () => {
    clearSettle();
    settleTimer = setTimeout(() => {
      if (!collapsedThisSession || isPinned()) return;
      collapsedThisSession = false;
      accumulated = 0;
      onExpand();
    }, SCROLL_SETTLE_BEFORE_EXPAND_MS);
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

    if (!isCollapsed() && !isPinned() && accumulated >= SCROLL_COLLAPSE_THRESHOLD_PX) {
      collapsedThisSession = true;
      onCollapse();
    }

    if (isCollapsed() || collapsedThisSession) {
      scheduleExpandCheck();
    }
  };

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return () => {
    document.removeEventListener("scroll", onScroll, true);
    clearSettle();
  };
}
