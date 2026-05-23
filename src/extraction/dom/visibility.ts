/** Skip hidden or zero-size elements when extracting text/media. */

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  const style = getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    parseFloat(style.opacity) < 0.05
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

export function isTextElementTag(tag: string): boolean {
  const skip = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "PATH",
    "IFRAME",
    "OBJECT",
    "EMBED",
  ]);
  return !skip.has(tag);
}
