import { MSG } from "../constants.js";
import type {
  CaptureCropRequest,
  CaptureCropResponse,
  SelectionRect,
} from "../types.js";

const CAPTURE_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

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
    const res = (await withTimeout(
      new Promise<CaptureCropResponse | undefined>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: MSG.CAPTURE_CROP, payload },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response as CaptureCropResponse | undefined);
          }
        );
      }),
      CAPTURE_TIMEOUT_MS,
      "Screenshot capture"
    )) as CaptureCropResponse | undefined;

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
