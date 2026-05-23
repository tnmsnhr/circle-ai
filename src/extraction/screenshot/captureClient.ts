import { MSG } from "../constants.js";
import type {
  CaptureCropRequest,
  CaptureCropResponse,
  SelectionRect,
} from "../types.js";

/**
 * Ask the service worker to capture the visible tab and return a cropped,
 * compressed JPEG as raw base64 (no data: prefix).
 */
export async function requestCroppedScreenshot(
  rect: SelectionRect,
  options?: { maxWidth?: number; quality?: number }
): Promise<string | undefined> {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const payload: CaptureCropRequest = {
    rect,
    devicePixelRatio,
    maxWidth: options?.maxWidth,
    quality: options?.quality,
  };

  try {
    const res = (await chrome.runtime.sendMessage({
      type: MSG.CAPTURE_CROP,
      payload,
    })) as CaptureCropResponse | undefined;

    if (!res?.ok || !res.cropImageBase64) {
      console.warn("[syncle] capture crop failed:", res?.error);
      return undefined;
    }
    return res.cropImageBase64;
  } catch (err) {
    console.warn("[syncle] capture crop error:", err);
    return undefined;
  }
}
