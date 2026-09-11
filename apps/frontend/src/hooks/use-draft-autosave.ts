import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 600;

export interface DraftEnvelope<T> {
  data: T;
  savedAt: string;
}

/**
 * Reads a previously autosaved draft for `key`, if any. Guarded so private
 * browsing or a corrupted value never throws — it just looks like no draft.
 */
export function readDraft<T>(key: string): DraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DraftEnvelope<T>;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode — nothing to clean up */
  }
}

/**
 * Saves `data` under `key` shortly after it stops changing, while `enabled`.
 * This is a local recovery net for an in-progress form (e.g. a sale being
 * scanned into an open account) — not sync between devices or tabs. Returns
 * a function that cancels any write still pending, for callers that just
 * persisted the real data and want to avoid a stale autosave overwriting it.
 */
export function useAutosaveDraft<T>(
  key: string,
  data: T,
  enabled: boolean,
): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    timer.current = setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = { data, savedAt: new Date().toISOString() };
        localStorage.setItem(key, JSON.stringify(envelope));
      } catch {
        /* private mode or quota exceeded — best effort only */
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [key, data, enabled]);
  return () => clearTimeout(timer.current);
}
