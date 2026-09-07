import { afterEach, describe, expect, it, vi } from "vitest";

import { animateFrame } from "./frame-animation";

function controlledBrowser(initiallyHidden = false) {
  let hidden = initiallyHidden;
  let now = 100;
  let nextFrameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const documentBoundary = new EventTarget();
  Object.defineProperty(documentBoundary, "hidden", { get: () => hidden });
  const addEventListener = vi.spyOn(documentBoundary, "addEventListener");
  const removeEventListener = vi.spyOn(documentBoundary, "removeEventListener");

  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("document", documentBoundary);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrameId;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));

  return {
    frames,
    addEventListener,
    removeEventListener,
    frame(at: number) {
      now = at;
      const [id, callback] = frames.entries().next().value ?? [];
      if (id === undefined || !callback) throw new Error("No pending animation frame");
      frames.delete(id);
      callback(at);
    },
    setHidden(value: boolean, at: number) {
      hidden = value;
      now = at;
      documentBoundary.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("animateFrame visibility lifecycle", () => {
  it("pauses elapsed time while hidden and releases its frame and listener on completion", () => {
    const browser = controlledBrowser();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    animateFrame(0, 1, { duration: 1, onUpdate, onComplete });
    browser.frame(600);
    expect(onUpdate).toHaveBeenLastCalledWith(0.5);

    browser.setHidden(true, 700);
    expect(browser.frames.size).toBe(0);
    browser.setHidden(false, 1_700);
    browser.frame(2_000);
    expect(onUpdate).toHaveBeenLastCalledWith(0.9);
    browser.frame(2_100);

    expect(onUpdate).toHaveBeenLastCalledWith(1);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(browser.frames.size).toBe(0);
    expect(browser.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      browser.addEventListener.mock.calls[0]?.[1],
    );
  });

  it("waits for visibility when started hidden", () => {
    const browser = controlledBrowser(true);
    const onUpdate = vi.fn();

    animateFrame(0, 1, { duration: 1, onUpdate, onComplete: vi.fn() });
    expect(browser.frames.size).toBe(0);

    browser.setHidden(false, 1_100);
    browser.frame(1_600);

    expect(onUpdate).toHaveBeenLastCalledWith(0.5);
  });

  it("releases its frame and visibility listener when stopped during an update", () => {
    const browser = controlledBrowser();
    const onComplete = vi.fn();
    const control = animateFrame(0, 1, {
      duration: 1,
      onUpdate: () => control.stop(),
      onComplete,
    });

    browser.frame(600);

    expect(browser.frames.size).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
    expect(browser.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      browser.addEventListener.mock.calls[0]?.[1],
    );
  });
});
