import { describe, expect, it, vi } from "vitest";

import { createRoutePlayback, pathAtProgress, type PlaybackState } from "./animation";
import { buildDayLayers } from "./placeholder-routes";

type FrameCallback = (time: number) => void;

function manualFrames() {
  let callback: FrameCallback | undefined;
  let id = 0;
  return {
    requestFrame(next: FrameCallback) {
      callback = next;
      return ++id;
    },
    cancelFrame(frameId: number) {
      if (frameId === id) callback = undefined;
    },
    step(time: number) {
      const next = callback;
      callback = undefined;
      next?.(time);
    },
    hasFrame() {
      return callback !== undefined;
    },
  };
}

describe("buildDayLayers", () => {
  it("defines the approved line, focus, and pin playback contracts for all five days", () => {
    expect(Object.fromEntries([1, 2, 3, 4, 5].map((day) => {
      const layers = buildDayLayers(day as 1 | 2 | 3 | 4 | 5);
      return [day, {
        lines: layers.lines.map(({ key }) => key),
        pins: layers.pins.map(({ key }) => key),
        stages: layers.stages.map(({ durationMs, lineKeys, pinKey, focusPinKeys }) => ({ durationMs, lineKeys, pinKey, focusPinKeys })),
      }];
    }))).toEqual({
      1: {
        lines: ["pus-kix", "icn-kix", "kix-kyoto"],
        pins: ["busan", "incheon", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"],
        stages: [
          { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 350, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["kix", "kyoto"] },
          { durationMs: 1200, lineKeys: ["kix-kyoto"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "kiyomizu", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "kinkaku", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "ginkaku", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "kyoto", focusPinKeys: undefined },
        ],
      },
      2: {
        lines: ["kyoto-odawara", "odawara-hakone"],
        pins: ["kyoto", "odawara", "hakone"],
        stages: [
          { durationMs: 1400, lineKeys: ["kyoto-odawara"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: ["odawara-hakone"], pinKey: undefined, focusPinKeys: undefined },
        ],
      },
      3: {
        lines: ["hakone-odawara", "odawara-tokyo", "tokyo-ueno"],
        pins: ["hakone", "odawara", "tokyo", "ueno", "shinjuku", "shibuya"],
        stages: [
          { durationMs: 1000, lineKeys: ["hakone-odawara"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1400, lineKeys: ["odawara-tokyo"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: ["tokyo-ueno"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "ueno", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "shinjuku", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "shibuya", focusPinKeys: undefined },
        ],
      },
      4: {
        lines: [],
        pins: ["akihabara", "sensoji", "ginza"],
        stages: [
          { durationMs: 450, lineKeys: undefined, pinKey: "akihabara", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "sensoji", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "ginza", focusPinKeys: undefined },
        ],
      },
      5: {
        lines: ["tokyo-narita", "nrt-pus", "nrt-icn"],
        pins: ["ueno", "nrt", "busan", "incheon"],
        stages: [
          { durationMs: 1400, lineKeys: ["tokyo-narita"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 2400, lineKeys: ["nrt-pus", "nrt-icn"], pinKey: undefined, focusPinKeys: undefined },
        ],
      },
    });
  });
});

describe("createRoutePlayback", () => {
  it("runs parallel line progress before moving to the next stage", () => {
    const frames = manualFrames();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: buildDayLayers(1).stages,
      onUpdate: (state) => states.push(state),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    playback.play();
    frames.step(0);
    frames.step(1200);
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 0.5, "icn-kix": 0.5 });
    expect(states.at(-1)?.progress["kix-kyoto"]).toBeUndefined();

    frames.step(2400);
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 1, "icn-kix": 1 });
    expect(states.at(-1)?.focusPinKeys).toEqual(["kix", "kyoto"]);
    frames.step(2750);
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 1, "icn-kix": 1, "kix-kyoto": 0 });
  });

  it("does not skip a focus stage after a long animation-frame gap", () => {
    const frames = manualFrames();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: buildDayLayers(1).stages,
      onUpdate: (state) => states.push(state),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    playback.play();
    frames.step(0);
    frames.step(2800);

    expect(states.at(-1)?.focusPinKeys).toEqual(["kix", "kyoto"]);
    frames.step(3100);
    expect(states.at(-1)?.focusPinKeys).toEqual(["kix", "kyoto"]);
  });

  it("cancels a pending frame and ignores later frame callbacks", () => {
    const frames = manualFrames();
    const onUpdate = vi.fn();
    const playback = createRoutePlayback({
      stages: buildDayLayers(3).stages,
      onUpdate,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    playback.play();
    frames.step(0);
    const countBeforeCancel = onUpdate.mock.calls.length;
    playback.cancel();
    frames.step(700);

    expect(frames.hasFrame()).toBe(false);
    expect(onUpdate).toHaveBeenCalledTimes(countBeforeCancel);
  });

  it("finishes immediately without scheduling frames when motion is reduced", () => {
    const frames = manualFrames();
    const onComplete = vi.fn();
    const onUpdate = vi.fn();
    const playback = createRoutePlayback({
      stages: buildDayLayers(4).stages,
      reducedMotion: true,
      onUpdate,
      onComplete,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    playback.play();

    expect(frames.hasFrame()).toBe(false);
    expect(onUpdate).toHaveBeenLastCalledWith({ progress: {}, currentPinKey: null, completed: true });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("emphasizes Day 4 pins one at a time and never creates line progress", () => {
    const frames = manualFrames();
    const states: Array<{ progress: Record<string, number>; currentPinKey: string | null; completed: boolean }> = [];
    const playback = createRoutePlayback({
      stages: buildDayLayers(4).stages,
      onUpdate: (state) => states.push(state),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    playback.play();
    frames.step(0);
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "akihabara", completed: false });
    frames.step(450);
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "sensoji", completed: false });
    frames.step(900);
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "ginza", completed: false });
    frames.step(1350);
    expect(states.at(-1)).toEqual({ progress: {}, currentPinKey: null, completed: true });
  });
});

describe("pathAtProgress", () => {
  it("interpolates the active segment without mutating the authored path", () => {
    const path = [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, { lat: 20, lng: 0 }];

    expect(pathAtProgress(path, 0.25)).toEqual([{ lat: 0, lng: 0 }, { lat: 5, lng: 5 }]);
    expect(pathAtProgress(path, 1)).toEqual(path);
    expect(path).toHaveLength(3);
  });
});
