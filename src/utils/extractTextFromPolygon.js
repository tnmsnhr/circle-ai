// Text extraction from a polygon drawn in *document (page) coordinates*.
// No OCR: it uses DOM ranges + bounding rects.

const pointInPolygon = (x, y, poly) => {
  // Ray-casting; poly is [{x,y},...]
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    // check edge intersection with horizontal ray at y
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const isNodeVisible = (node) => {
  // consider the nearest element container
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  return true;
};

const normalizeText = (s) =>
  s.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

export const extractTextFromPolygon = (polyPts) => {
  // polyPts are in *page* coordinates (e.pageX / e.pageY)
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node || !node.data || !node.data.trim()) return NodeFilter.FILTER_REJECT;
        if (!isNodeVisible(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const results = [];
  let node;

  while ((node = walker.nextNode())) {
    try {
      // Get rects for this text node
      const range = document.createRange();
      range.selectNodeContents(node);
      const rectList = range.getClientRects();
      if (!rectList || rectList.length === 0) continue;

      // If any rect's center lies inside polygon, include this node
      let hits = 0;
      for (const r of rectList) {
        if (r.width === 0 || r.height === 0) continue;
        const cx = r.left + r.width / 2 + window.scrollX;
        const cy = r.top + r.height / 2 + window.scrollY;
        if (pointInPolygon(cx, cy, polyPts)) {
          hits++;
          // Heuristic: a few rects are enough
          if (hits >= 1) break;
        }
      }
      if (hits > 0) {
        const text = normalizeText(node.data);
        if (text) results.push(text);
      }
    } catch {
      // ignore weird nodes/ranges
    }
  }

  return {
    text: normalizeText(results.join(" ")),
    parts: results, // individual node texts (if you want more control)
  };
};
