import { describe, expect, it, vi } from "vitest";

import { createRoutePlayback, pathAtProgress, type PlaybackState } from "./animation";
import { buildDayLayers } from "./placeholder-routes";

function manualMotion() {
  let current: { onUpdate?: (value: number) => void; onComplete?: () => void; stopped: boolean } | undefined;
  const calls: Array<{ from: number; to: number; duration: number; ease: string }> = [];
  return {
    animateValue(from: number, to: number, options: { duration: number; ease: string; onUpdate?: (value: number) => void; onComplete?: () => void }) {
      calls.push({ from, to, duration: options.duration, ease: options.ease });
      current = { onUpdate: options.onUpdate, onComplete: options.onComplete, stopped: false };
      return { stop() { if (current) current.stopped = true; } };
    },
    update(value: number) {
      if (!current?.stopped) current?.onUpdate?.(value);
    },
    complete() {
      if (!current?.stopped) current?.onComplete?.();
    },
    calls,
    stopped: () => current?.stopped ?? false,
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
        lines: ["mandeok-pus", "suwon-icn", "icheon-icn", "pus-kix", "icn-kix", "kix-kyoto"],
        pins: ["mandeok", "suwon", "icheon", "busan", "incheon", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"],
        stages: [
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["mandeok", "busan"] },
          { durationMs: 1400, lineKeys: ["mandeok-pus"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["suwon", "icheon", "incheon"] },
          { durationMs: 1400, lineKeys: ["suwon-icn", "icheon-icn"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["busan", "incheon", "kix"] },
          { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["kix", "kyoto"] },
          { durationMs: 1200, lineKeys: ["kix-kyoto"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["kyoto", "kiyomizu", "kinkaku", "ginkaku"] },
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
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["kyoto", "odawara"] },
          { durationMs: 1400, lineKeys: ["kyoto-odawara"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["odawara", "hakone"] },
          { durationMs: 1000, lineKeys: ["odawara-hakone"], pinKey: undefined, focusPinKeys: undefined },
        ],
      },
      3: {
        lines: ["hakone-odawara", "odawara-tokyo"],
        pins: ["hakone", "odawara", "ueno", "shinjuku", "shibuya"],
        stages: [
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["hakone", "odawara"] },
          { durationMs: 1000, lineKeys: ["hakone-odawara"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["odawara", "ueno"] },
          { durationMs: 1400, lineKeys: ["odawara-tokyo"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["ueno", "shinjuku", "shibuya"] },
          { durationMs: 450, lineKeys: undefined, pinKey: "ueno", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "shinjuku", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "shibuya", focusPinKeys: undefined },
        ],
      },
      4: {
        lines: [],
        pins: ["akihabara", "sensoji", "ginza"],
        stages: [
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["akihabara", "sensoji", "ginza"] },
          { durationMs: 450, lineKeys: undefined, pinKey: "akihabara", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "sensoji", focusPinKeys: undefined },
          { durationMs: 450, lineKeys: undefined, pinKey: "ginza", focusPinKeys: undefined },
        ],
      },
      5: {
        lines: ["tokyo-narita", "nrt-pus", "nrt-icn", "pus-mandeok", "icn-suwon", "icn-icheon"],
        pins: ["ueno", "nrt", "busan", "incheon", "mandeok", "suwon", "icheon"],
        stages: [
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["ueno", "nrt"] },
          { durationMs: 1400, lineKeys: ["tokyo-narita"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["nrt", "busan", "incheon"] },
          { durationMs: 2400, lineKeys: ["nrt-pus", "nrt-icn"], pinKey: undefined, focusPinKeys: undefined },
          { durationMs: 1000, lineKeys: undefined, pinKey: undefined, focusPinKeys: ["busan", "incheon", "mandeok", "suwon", "icheon"] },
          { durationMs: 1400, lineKeys: ["pus-mandeok", "icn-suwon", "icn-icheon"], pinKey: undefined, focusPinKeys: undefined },
        ],
      },
    });
  });
});

describe("createRoutePlayback", () => {
  it("delays only the configured line and uses the remaining stage time by default", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: [{
        durationMs: 1000,
        lineKeys: ["busan-flight", "incheon-flight"],
        lineTimings: { "incheon-flight": { delayMs: 400 } },
      }],
      onUpdate: (state) => states.push(state),
      animateValue: motion.animateValue,
    });

    playback.play();
    motion.update(0.2);
    expect(states.at(-1)?.progress).toEqual({ "busan-flight": 0.2, "incheon-flight": 0 });

    motion.update(0.7);
    expect(states.at(-1)?.progress).toEqual({ "busan-flight": 0.7, "incheon-flight": 0.5 });

    motion.update(1);
    expect(states.at(-1)?.progress).toEqual({ "busan-flight": 1, "incheon-flight": 1 });
  });

  it("lets a configured line duration finish before the stage ends", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: [{
        durationMs: 1000,
        lineKeys: ["shinkansen", "local-train"],
        lineTimings: { shinkansen: { durationMs: 250 } },
      }],
      onUpdate: (state) => states.push(state),
      animateValue: motion.animateValue,
    });

    playback.play();
    motion.update(0.125);
    expect(states.at(-1)?.progress).toEqual({ shinkansen: 0.5, "local-train": 0.125 });

    motion.update(0.5);
    expect(states.at(-1)?.progress).toEqual({ shinkansen: 1, "local-train": 0.5 });
  });

  it("uses Motion to run parallel line progress before moving to the next stage", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: [
        { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
        { durationMs: 350, focusPinKeys: ["kix", "kyoto"] },
        { durationMs: 1200, lineKeys: ["kix-kyoto"] },
      ],
      onUpdate: (state) => states.push(state),
      animateValue: motion.animateValue,
    });

    playback.play();
    expect(motion.calls[0]).toEqual({ from: 0, to: 1, duration: 2.4, ease: "linear" });
    motion.update(0.5);
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 0.5, "icn-kix": 0.5 });
    expect(states.at(-1)?.progress["kix-kyoto"]).toBeUndefined();

    motion.update(1);
    motion.complete();
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 1, "icn-kix": 1 });
    expect(states.at(-1)?.focusPinKeys).toEqual(["kix", "kyoto"]);
    motion.complete();
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 1, "icn-kix": 1, "kix-kyoto": 0 });
  });

  it("keeps the focus stage until Motion completes it", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: [
        { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
        { durationMs: 1000, focusPinKeys: ["kix", "kyoto"] },
      ],
      onUpdate: (state) => states.push(state),
      animateValue: motion.animateValue,
    });

    playback.play();
    motion.complete();
    expect(states.at(-1)).toMatchObject({ focusPinKeys: ["kix", "kyoto"], focusProgress: 0 });
    motion.update(0.5);
    expect(states.at(-1)).toMatchObject({ focusPinKeys: ["kix", "kyoto"], focusProgress: 0.5 });
  });

  it("stops the active Motion control and ignores later updates when cancelled", () => {
    const motion = manualMotion();
    const onUpdate = vi.fn();
    const playback = createRoutePlayback({
      stages: buildDayLayers(3).stages,
      onUpdate,
      animateValue: motion.animateValue,
    });

    playback.play();
    const countBeforeCancel = onUpdate.mock.calls.length;
    playback.cancel();
    motion.update(0.7);

    expect(motion.stopped()).toBe(true);
    expect(onUpdate).toHaveBeenCalledTimes(countBeforeCancel);
  });

  it("finishes immediately without starting Motion when motion is reduced", () => {
    const motion = manualMotion();
    const onComplete = vi.fn();
    const onUpdate = vi.fn();
    const playback = createRoutePlayback({
      stages: buildDayLayers(4).stages,
      reducedMotion: true,
      onUpdate,
      onComplete,
      animateValue: motion.animateValue,
    });

    playback.play();

    expect(motion.calls).toHaveLength(0);
    expect(onUpdate).toHaveBeenLastCalledWith({ progress: {}, currentPinKey: null, completed: true });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("emphasizes Day 4 pins one at a time and never creates line progress", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const playback = createRoutePlayback({
      stages: buildDayLayers(4).stages,
      onUpdate: (state) => states.push(state),
      animateValue: motion.animateValue,
    });

    playback.play();
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: null, completed: false, focusPinKeys: ["akihabara", "sensoji", "ginza"] });
    motion.complete();
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "akihabara", completed: false });
    motion.complete();
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "sensoji", completed: false });
    motion.complete();
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "ginza", completed: false });
    motion.complete();
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
