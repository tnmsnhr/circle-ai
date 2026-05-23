/**
 * Reference implementation of rect crop + resize (runs in offscreen document).
 * The live crop runs in public/offscreen.js; keep logic aligned.
 */

export interface CropRectInput {
  /** Full screenshot as data URL. */
  dataUrl: string;
  rectCss: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  devicePixelRatio: number;
  maxWidth: number;
  quality: number;
}

export interface CropRectResult {
  base64: string;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Crop a CSS rect from a screenshot bitmap, scale down, encode as JPEG.
 * Exported for unit testing / documentation; offscreen uses equivalent logic.
 */
export async function cropRectFromDataUrl(
  input: CropRectInput
): Promise<CropRectResult> {
  const { dataUrl, rectCss, devicePixelRatio, maxWidth, quality } = input;
  const dpr = devicePixelRatio || 1;

  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  const sx = Math.max(0, Math.floor(rectCss.left * dpr));
  const sy = Math.max(0, Math.floor(rectCss.top * dpr));
  const sw = Math.max(
    1,
    Math.min(bitmap.width - sx, Math.ceil(rectCss.width * dpr))
  );
  const sh = Math.max(
    1,
    Math.min(bitmap.height - sy, Math.ceil(rectCss.height * dpr))
  );

  let dw = sw;
  let dh = sh;
  if (dw > maxWidth) {
    const scale = maxWidth / dw;
    dw = maxWidth;
    dh = Math.max(1, Math.round(sh * scale));
  }

  const canvas = new OffscreenCanvas(dw, dh);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);

  const outBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality,
  });

  const buffer = await outBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary);

  return { base64, width: dw, height: dh, mimeType: "image/jpeg" };
}
