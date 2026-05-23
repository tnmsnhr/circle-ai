# Syncle extraction pipeline

Unified DOM-first + visual-fallback extraction for lasso/rect selections. Output is an `ExtractedContext` object ready for your chat/AI backend.

## Folder structure

```
src/extraction/
├── types.ts                 # TypeScript interfaces
├── constants.ts             # Limits, message types, thresholds
├── index.ts                 # Public exports
├── buildExtractedContext.ts # Main orchestrator
├── runExtraction.js         # JS bridge for OverlayApp
├── geometry/
│   └── rect.ts              # Selection rect, expand, intersect
├── dom/
│   ├── elements.ts          # Elements overlapping selection
│   ├── text.ts              # Text-node + block text extraction
│   └── visibility.ts
├── text/
│   └── clean.ts             # Dedupe, truncate, clean
├── extract/
│   ├── focus.ts             # Focus text
│   ├── context.ts           # Nearby / ancestor / headings / links
│   ├── media.ts             # Images, SVG, PDF hints
│   └── strategy.ts          # When to capture screenshot
└── screenshot/
    ├── captureClient.ts     # chrome.runtime.sendMessage → background
    └── cropRect.ts          # Reference crop/resize (mirrored in offscreen.js)

public/
├── background.js            # captureVisibleTab + message routing
└── offscreen.js             # JPEG crop/resize (OFFSCREEN_CROP_RECT)
```

## Message flow (MV3)

```
Content script                    Service worker              Offscreen doc
     |                                 |                          |
     | EXTRACTION_CAPTURE_CROP         |                          |
     |------------------------------->| captureVisibleTab        |
     |                                 | OFFSCREEN_CROP_RECT      |
     |                                 |------------------------->|
     |                                 |     crop + JPEG base64   |
     |<-------------------------------|                          |
```

## Usage

```ts
import { buildExtractedContext, rectFromPoints } from "./extraction";

const rect = rectFromPoints(lassoClientPoints);
const payload = await buildExtractedContext(rect);

// Send to your backend:
await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ selection: payload }),
});
```

Lasso integration (already wired):

```js
import { runSelectionExtraction } from "./extraction/runExtraction.js";
const extracted = await runSelectionExtraction(clientPts);
// popup.content.extracted
```

## Extraction rules (summary)

| Rule | Behavior |
|------|----------|
| DOM-first | Text from overlapping text nodes + blocks; no full HTML |
| Visual fallback | JPEG crop when canvas/video/SVG/low text/partial image |
| Partial image | `isPartialSelection` + screenshot, not full `src` file |
| Context | Selection expanded ~320px; ancestor walk from center |
| Limits | Focus 4k, nearby 2.8k, ancestor 1.4k chars |
| Screenshot | Max width 1280px, quality 0.82, only when needed |
| PDF | Text if in DOM; else visual; PDF.js hook ready in `media.pdf` |

## Example payload

See [`example-payload.json`](./example-payload.json).

## Edge cases

- **Fixed/sticky UI**: Selection uses viewport coords; scroll sync is handled by your anchor system, but re-extract after large scroll if sending stale crops.
- **Cross-origin iframe**: Cannot read DOM inside iframe; screenshot may still show pixels.
- **Shadow DOM**: `elementsFromPoint` pierces open shadow roots in modern Chrome; closed shadows need visual fallback.
- **Lazy images**: `currentSrc` used; off-screen images may have empty text—visual crop helps.
- **Huge pages**: Point sampling + media query avoids full-tree walks; still avoid re-extracting on every scroll frame.
- **captureVisibleTab**: Requires active tab in same window; fails on `chrome://` URLs and some restricted pages.
- **Retina**: Crop uses `devicePixelRatio` from the page.
- **Lasso vs rect**: Pipeline uses the **axis-aligned bounding box** of the lasso; true polygon clip can reuse existing `OFFSCREEN_CROP` if needed later.

## Future improvements

- [ ] PDF.js text layer for in-browser PDF viewers
- [ ] Polygon clip crop (reuse `OFFSCREEN_CROP`) instead of bbox-only
- [ ] OCR pass on visual-only crops (offscreen Tesseract)
- [ ] Cache last screenshot per tab for N ms to debounce multiple selections
- [ ] `buildExtractedContext` option: max token budget estimator before send
- [ ] Table cell structured JSON (not only `tableHeaders`)
