import { afterEach, describe, expect, it, vi } from "vitest";

import { TRAVELERS, type TravelerId } from "../../trip/travelers";
import { createRoutePlayback, pathAtProgress, visualStages, type PlaybackState } from "./animation";
import { buildDayLayers } from "./placeholder-routes";

const days = [1, 2, 3, 4, 5] as const;
const scopes: readonly (TravelerId | null)[] = [null, ...TRAVELERS.map(({ id }) => id)];

function manualMotion() {
  const calls: Array<{ duration: number; update: (value: number) => void; complete: () => void; stopped: boolean }> = [];
  return {
    calls,
    animateValue: (_from: number, _to: number, options: { duration: number; onUpdate: (value: number) => void; onComplete: () => void }) => {
      const call = { duration: options.duration, update: options.onUpdate, complete: options.onComplete, stopped: false };
      calls.push(call);
      return { stop: () => { call.stopped = true; } };
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("buildDayLayers playback", () => {
  it("completes every authored day and traveler scope exactly once", () => {
    for (const day of days) {
      for (const traveler of scopes) {
        const layers = buildDayLayers(day, undefined, undefined, traveler);
        const stages = visualStages(layers.stages, layers.lines, () => 8);
        const motion = manualMotion();
        const states: PlaybackState[] = [];
        const onComplete = vi.fn();
        const playback = createRoutePlayback({
          stages,
          animateValue: motion.animateValue,
          onUpdate: (state) => states.push(state),
          onComplete,
        });
        playback.play();
        let index = 0;
        while (index < motion.calls.length) {
          motion.calls[index].update(1);
          motion.calls[index].complete();
          index += 1;
        }
        expect(onComplete, `${day}:${traveler}`).toHaveBeenCalledOnce();
        expect(states.at(-1)).toEqual({
          progress: Object.fromEntries(layers.lines.map(({ key }) => [key, 1])),
          currentPinKey: null,
          completed: true,
        });
        playback.play();
        expect(onComplete).toHaveBeenCalledOnce();
      }
    }
  });

  it("delays a line without changing its own visual speed", () => {
    const stages = visualStages([{
      durationMs: 1,
      lineKeys: ["first", "second"],
      lineTimings: { second: { delayMs: 0.5 } },
    }], [
      { key: "first", path: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }] },
      { key: "second", path: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }] },
    ], () => 8);
    const firstDuration = stages[0].lineTimings?.first?.durationMs ?? 0;
    expect(stages[0].lineTimings?.second).toEqual({ delayMs: firstDuration / 2, durationMs: firstDuration });
    expect(stages[0].durationMs).toBe(firstDuration * 1.5);
  });

  it("runs split route steps sequentially", () => {
    const stages = visualStages([{ durationMs: 1, lineKeys: ["walk", "bus"], sequential: true }], [
      { key: "walk", path: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }] },
      { key: "bus", path: [{ lat: 0, lng: 1 }, { lat: 0, lng: 3 }] },
    ], () => 8);
    const timings = stages[0].lineTimings!;
    expect(timings.bus.delayMs).toBeCloseTo(timings.walk.durationMs!, 5);
    expect(stages[0].durationMs).toBeCloseTo(timings.walk.durationMs! + timings.bus.durationMs!, 5);
  });

  it("keeps short movements visible", () => {
    const stages = visualStages([{ durationMs: 1000, focusPinKeys: ["a", "b"] }, {
      durationMs: 2000, lineKeys: ["short", "long"],
      lineTimings: { short: { durationMs: 1000 }, long: { delayMs: 500, durationMs: 1500 } },
    }], [
      { key: "short", path: [{ lat: 35, lng: 135 }, { lat: 35, lng: 135.00001 }] },
      { key: "long", path: [{ lat: 35, lng: 135 }, { lat: 35, lng: 135.001 }] },
    ], () => 8);
    expect(stages[1].lineTimings?.short.durationMs).toBeGreaterThanOrEqual(1200);
    expect(stages[1].durationMs).toBeGreaterThanOrEqual(1200);
  });

  it("continues domestic travel off screen while the camera follows the next departure", () => {
    const layers = buildDayLayers(1);
    const stages = visualStages(layers.stages, layers.lines, () => 9);
    const domestic = stages.find((stage) => stage.lineKeys?.includes("terminal-icn"))!;
    expect(domestic.lineKeys).toEqual(["terminal-icn", "mandeok-pus", "suwon-gmp"]);
    const timing = domestic.lineTimings!;
    expect(timing["mandeok-pus"].delayMs).toBeLessThan(timing["terminal-icn"].durationMs!);
    expect(timing["suwon-gmp"].delayMs).toBeLessThan(timing["mandeok-pus"].delayMs! + timing["mandeok-pus"].durationMs!);
    expect(domestic.cameraCues?.map((cue) => cue.focusPinKeys)).toEqual([["mandeok", "busan"], ["suwon", "gimpo"]]);
    expect(domestic.cameraCues![1].atMs - domestic.cameraCues![0].atMs).toBeGreaterThanOrEqual(1600);
  });

  it("retimes a resized playback without resetting progress or accepting stale frames", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const onComplete = vi.fn();
    const playback = createRoutePlayback({ stages: [{ durationMs: 2000, lineKeys: ["route"] }], animateValue: motion.animateValue, onUpdate: (state) => states.push(state), onComplete });
    playback.play();
    motion.calls[0].update(0.4);
    playback.resize([{ durationMs: 4000, lineKeys: ["route"] }]);
    expect(states.at(-1)?.progress.route).toBe(0.4);
    expect(motion.calls[1].duration).toBeCloseTo(2.4);
    motion.calls[0].update(0.1);
    motion.calls[0].complete();
    expect(states.at(-1)?.progress.route).toBe(0.4);
    expect(onComplete).not.toHaveBeenCalled();
    motion.calls[1].update(0.5);
    expect(states.at(-1)?.progress.route).toBeCloseTo(0.7);
    motion.calls[1].complete();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("finishes immediately in reduced motion", () => {
    const layers = buildDayLayers(4);
    const motion = manualMotion();
    const onComplete = vi.fn();
    const onUpdate = vi.fn();
    createRoutePlayback({
      stages: layers.stages,
      reducedMotion: true,
      animateValue: motion.animateValue,
      onUpdate,
      onComplete,
    }).play();
    expect(motion.calls).toHaveLength(0);
    expect(onUpdate).toHaveBeenLastCalledWith({
      progress: Object.fromEntries(layers.lines.map(({ key }) => [key, 1])),
      currentPinKey: null,
      completed: true,
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("stops active animation and ignores stale updates after cancellation", () => {
    const motion = manualMotion();
    const onUpdate = vi.fn();
    const playback = createRoutePlayback({
      stages: [{ durationMs: 1000, lineKeys: ["route"] }],
      animateValue: motion.animateValue,
      onUpdate,
    });
    playback.play();
    const before = onUpdate.mock.calls.length;
    playback.cancel();
    motion.calls[0].update(0.5);
    expect(motion.calls[0].stopped).toBe(true);
    expect(onUpdate).toHaveBeenCalledTimes(before);
  });

  it("waits for a prepared map and never resumes a cancelled request", async () => {
    const motion = manualMotion();
    let ready!: () => void;
    const waiting = new Promise<void>((resolve) => { ready = resolve; });
    const onComplete = vi.fn();
    const playback = createRoutePlayback({
      stages: [{ durationMs: 1200, lineKeys: ["route"] }],
      beforeStage: () => waiting,
      animateValue: motion.animateValue, onUpdate: vi.fn(), onComplete,
    });
    playback.play();
    expect(motion.calls).toHaveLength(0);
    playback.cancel();
    ready();
    await waiting;
    expect(motion.calls).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("uses frame timestamps rather than frame counts", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(performance, "now").mockReturnValue(100);
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    createRoutePlayback({ stages: [{ durationMs: 1000, lineKeys: ["route"] }], onUpdate, onComplete }).play();
    frames.get(1)?.(600);
    expect(onUpdate).toHaveBeenLastCalledWith({ progress: { route: 0.5 }, currentPinKey: null, completed: false });
    frames.get(2)?.(1100);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

describe("pathAtProgress", () => {
  it("moves at constant projected distance without mutating its path", () => {
    const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 11 }];
    expect(pathAtProgress(path, 0.5)).toEqual([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 5.5 }]);
    expect(pathAtProgress(path, 1)).toEqual(path);
    expect(path).toHaveLength(3);
  });
});
