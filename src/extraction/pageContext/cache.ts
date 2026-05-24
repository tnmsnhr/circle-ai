import {
  PAGE_CONTEXT_TTL_MS,
  SELECTION_CONTEXT_TTL_MS,
} from "../constants.js";

const PAGE_KEY_PREFIX = "syncle:page:";
const SELECTION_KEY_PREFIX = "syncle:selection:";

export interface PageContextSession {
  pageContextId: string;
  pageFingerprint: string;
  canonicalUrl: string;
  pageContextBlock: string;
  registeredAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface SelectionSession {
  selectionContextId: string;
  pageContextId: string;
  localPinId: string;
  registeredAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

function isExpired(record: { expiresAt: string }): boolean {
  return Date.parse(record.expiresAt) <= Date.now();
}

const STORAGE_OP_MS = 4000;

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

function sessionGet<T>(key: string): Promise<T | undefined> {
  const op = new Promise<T | undefined>((resolve, reject) => {
    if (!chrome.storage?.session) {
      resolve(undefined);
      return;
    }
    chrome.storage.session.get(key, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(items[key] as T | undefined);
    });
  });
  return withTimeout(op, STORAGE_OP_MS, "chrome.storage.session.get").catch(
    (err) => {
      console.warn("[syncle] session get failed:", err);
      return undefined;
    }
  );
}

function sessionSet(key: string, value: unknown): Promise<void> {
  const op = new Promise<void>((resolve, reject) => {
    if (!chrome.storage?.session) {
      resolve();
      return;
    }
    chrome.storage.session.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
  return withTimeout(op, STORAGE_OP_MS, "chrome.storage.session.set").catch(
    (err) => {
      console.warn("[syncle] session set failed:", err);
    }
  );
}

function sessionRemove(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.session.remove(key, () => resolve());
  });
}

export async function getPageSession(
  pageFingerprint: string
): Promise<PageContextSession | undefined> {
  const record = await sessionGet<PageContextSession>(
    `${PAGE_KEY_PREFIX}${pageFingerprint}`
  );
  if (!record || isExpired(record)) {
    if (record) await sessionRemove(`${PAGE_KEY_PREFIX}${pageFingerprint}`);
    return undefined;
  }
  return record;
}

export async function touchPageSession(
  pageFingerprint: string,
  record: PageContextSession
): Promise<void> {
  const now = new Date().toISOString();
  const updated: PageContextSession = {
    ...record,
    lastUsedAt: now,
    expiresAt: new Date(Date.now() + PAGE_CONTEXT_TTL_MS).toISOString(),
  };
  await sessionSet(`${PAGE_KEY_PREFIX}${pageFingerprint}`, updated);
}

export async function savePageSession(
  pageFingerprint: string,
  data: Omit<PageContextSession, "registeredAt" | "lastUsedAt" | "expiresAt">
): Promise<PageContextSession> {
  const now = new Date().toISOString();
  const record: PageContextSession = {
    ...data,
    registeredAt: now,
    lastUsedAt: now,
    expiresAt: new Date(Date.now() + PAGE_CONTEXT_TTL_MS).toISOString(),
  };
  await sessionSet(`${PAGE_KEY_PREFIX}${pageFingerprint}`, record);
  return record;
}

export async function getSelectionSession(
  localPinId: string
): Promise<SelectionSession | undefined> {
  const record = await sessionGet<SelectionSession>(
    `${SELECTION_KEY_PREFIX}${localPinId}`
  );
  if (!record || isExpired(record)) {
    if (record) await sessionRemove(`${SELECTION_KEY_PREFIX}${localPinId}`);
    return undefined;
  }
  return record;
}

export async function saveSelectionSession(
  localPinId: string,
  data: Omit<SelectionSession, "registeredAt" | "lastUsedAt" | "expiresAt">
): Promise<SelectionSession> {
  const now = new Date().toISOString();
  const record: SelectionSession = {
    ...data,
    registeredAt: now,
    lastUsedAt: now,
    expiresAt: new Date(Date.now() + SELECTION_CONTEXT_TTL_MS).toISOString(),
  };
  await sessionSet(`${SELECTION_KEY_PREFIX}${localPinId}`, record);
  return record;
}
