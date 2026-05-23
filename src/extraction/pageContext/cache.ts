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

function sessionGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.session.get(key, (items) => {
      resolve(items[key] as T | undefined);
    });
  });
}

function sessionSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.session.set({ [key]: value }, () => resolve());
  });
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
