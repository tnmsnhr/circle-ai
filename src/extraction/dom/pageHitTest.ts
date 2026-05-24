const SYNCLE_HOST_IDS = new Set([
  "draw-on-web-root-host",
  "syncle-toolbar-mount",
  "syncle-page-styles",
]);

/** True if element is part of the Syncle overlay (not page content). */
export function isSyncleUiElement(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (cur instanceof HTMLElement) {
      const id = cur.id;
      if (id && SYNCLE_HOST_IDS.has(id)) return true;
      if (cur.classList?.contains("popup-bubble")) return true;
      if (cur.classList?.contains("draw-toolbar")) return true;
      if (cur.classList?.contains("draw-root")) return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

/** Topmost non-Syncle element at a viewport point. */
export function pageElementFromPoint(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (!isSyncleUiElement(el)) return el;
  }
  return null;
}

/** Filter Syncle UI from an elementsFromPoint stack. */
export function filterPageElements(stack: Element[]): Element[] {
  return stack.filter((el) => !isSyncleUiElement(el));
}
