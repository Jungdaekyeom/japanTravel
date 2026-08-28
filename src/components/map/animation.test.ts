import { describe, expect, it, vi } from "vitest";

import { createRoutePlayback, pathAtProgress } from "./animation";
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
  it("draws both Day 1 flights together for 2.4 seconds before rail begins", () => {
    const layers = buildDayLayers(1);

    expect(layers.stages).toEqual([
      { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
      { durationMs: 1200, lineKeys: ["kix-kyoto"] },
    ]);
    expect(layers.lines.map(({ key }) => key)).toEqual(["pus-kix", "icn-kix", "kix-kyoto"]);
  });

  it("uses no route line on Day 4 and emphasizes Tokyo pins in order", () => {
    const layers = buildDayLayers(4);

    expect(layers.lines).toEqual([]);
    expect(layers.stages).toEqual([
      { durationMs: 450, pinKey: "tokyo" },
      { durationMs: 450, pinKey: "asakusa" },
      { durationMs: 450, pinKey: "shibuya" },
    ]);
  });
});

describe("createRoutePlayback", () => {
  it("runs parallel line progress before moving to the next stage", () => {
    const frames = manualFrames();
    const states: Array<{ progress: Record<string, number>; currentPinKey: string | null; completed: boolean }> = [];
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
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 1, "icn-kix": 1, "kix-kyoto": 0 });
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
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "tokyo", completed: false });
    frames.step(450);
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "asakusa", completed: false });
    frames.step(900);
    expect(states.at(-1)).toMatchObject({ progress: {}, currentPinKey: "shibuya", completed: false });
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
