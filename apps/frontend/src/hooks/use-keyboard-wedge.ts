import { useEffect, useRef } from "react";

interface KeyboardWedgeOptions {
  /** When false the listener is not attached. Defaults to true. */
  enabled?: boolean;
  /** Minimum characters before a burst is treated as a scan. Defaults to 3. */
  minLength?: number;
  /**
   * Maximum milliseconds between keystrokes for them to count as one burst.
   * Physical USB/Bluetooth scanners emit characters far faster than a human
   * can type. Defaults to 55ms.
   */
  maxIntervalMs?: number;
}

/**
 * Detects input from a physical barcode scanner working as a keyboard wedge.
 * Such scanners "type" the whole code in a very fast burst and then send
 * Enter. When a qualifying burst is seen, `onScan` is called with the code and
 * the trailing Enter is swallowed so it does not submit a form.
 *
 * Slow, human typing never triggers it: any gap longer than `maxIntervalMs`
 * resets the buffer, and the burst must contain at least `minLength`
 * fast characters.
 */
export function useKeyboardWedge(
  onScan: (code: string) => void,
  { enabled = true, minLength = 3, maxIntervalMs = 55 }: KeyboardWedgeOptions = {},
) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let fastKeys = 0;
    let lastTime = 0;

    function isEditable(node: EventTarget | null): boolean {
      if (!(node instanceof HTMLElement)) return false;
      return (
        node.tagName === "INPUT" ||
        node.tagName === "TEXTAREA" ||
        node.tagName === "SELECT" ||
        node.isContentEditable
      );
    }

    function handleKeydown(event: KeyboardEvent) {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const gap = now - lastTime;
      lastTime = now;

      if (event.key === "Enter") {
        const scannedFastEnough = gap <= maxIntervalMs;
        if (buffer.length >= minLength && fastKeys >= minLength && scannedFastEnough) {
          const code = buffer.trim();
          buffer = "";
          fastKeys = 0;
          if (code) {
            event.preventDefault();
            event.stopPropagation();
            onScanRef.current(code);
          }
        } else {
          buffer = "";
          fastKeys = 0;
        }
        return;
      }

      // Only printable single characters contribute to a barcode.
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (gap > maxIntervalMs) {
        // Too slow to be a scanner: start a fresh buffer from this key.
        buffer = event.key;
        fastKeys = 0;
        return;
      }

      buffer += event.key;
      fastKeys += 1;
      // Once a fast burst is unmistakably underway (a human cannot sustain
      // sub-threshold gaps this many times), keep the remaining scanned
      // characters from polluting the page. When a field is deliberately
      // focused we leave its own typing alone.
      if (fastKeys >= 3 && !isEditable(event.target)) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeydown, true);
    return () => window.removeEventListener("keydown", handleKeydown, true);
  }, [enabled, minLength, maxIntervalMs]);
}
