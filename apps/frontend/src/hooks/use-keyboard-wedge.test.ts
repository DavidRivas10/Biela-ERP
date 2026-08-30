import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardWedge } from "./use-keyboard-wedge";

let clock = 0;
function advance(ms: number) {
  clock += ms;
}
function press(key: string) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  window.dispatchEvent(event);
  return event;
}
function type(text: string, gapMs: number) {
  for (const char of text) {
    advance(gapMs);
    press(char);
  }
}

beforeEach(() => {
  clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

describe("useKeyboardWedge", () => {
  it("fires on a fast burst ended by Enter and swallows the Enter", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardWedge(onScan));

    type("7501234567", 10);
    advance(10);
    const enter = press("Enter");

    expect(onScan).toHaveBeenCalledExactlyOnceWith("7501234567");
    expect(enter.defaultPrevented).toBe(true);
  });

  it("keeps burst characters out of the focused field once a burst is unmistakable", () => {
    renderHook(() => useKeyboardWedge(vi.fn()));

    const prevented: boolean[] = [];
    for (const char of "75012") {
      advance(10);
      prevented.push(press(char).defaultPrevented);
    }

    // The first two characters still reach the field; the rest are swallowed.
    expect(prevented).toEqual([false, false, true, true, true]);
  });

  it("ignores slow human typing", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardWedge(onScan));

    type("ABC123", 200);
    advance(200);
    press("Enter");

    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores bursts shorter than the minimum length", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardWedge(onScan, { minLength: 4 }));

    type("AB", 10);
    advance(10);
    press("Enter");

    expect(onScan).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardWedge(onScan, { enabled: false }));

    type("7501234567", 10);
    advance(10);
    press("Enter");

    expect(onScan).not.toHaveBeenCalled();
  });

  it("detaches its listener on unmount", () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useKeyboardWedge(onScan));
    unmount();

    type("7501234567", 10);
    advance(10);
    press("Enter");

    expect(onScan).not.toHaveBeenCalled();
  });
});
