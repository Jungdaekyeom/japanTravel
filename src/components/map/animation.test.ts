import { afterEach, describe, expect, it, vi } from "vitest";

import type { DayNumber } from "../../trip/public";
import { TRAVELERS, type TravelerId } from "../../trip/travelers";
import { createRoutePlayback, pathAtProgress, type PlaybackStage, type PlaybackState } from "./animation";
import { animateFrame } from "./frame-animation";
import { buildDayLayers, FULL_ROUTE_LINES, ROUTE_SCHEDULES } from "./placeholder-routes";

const DAY_NUMBERS = [1, 2, 3, 4, 5] as const;
const TRAVELER_SCOPES: readonly (TravelerId | null)[] = [null, ...TRAVELERS.map(({ id }) => id)];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const AUTHORED_STAGES: Readonly<Record<DayNumber, readonly PlaybackStage[]>> = {
  1: [
    { durationMs: 1000, focusPinKeys: ["mandeok", "busan"] },
    {
      durationMs: 13600,
      lineKeys: ["mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix"],
      lineTimings: {
        "mandeok-pus": { delayMs: 0, durationMs: 4000 },
        "suwon-gmp": { delayMs: 3000, durationMs: 4000 },
        "icheon-gmp": { delayMs: 1000, durationMs: 6000 },
        "pus-kix": { delayMs: 7800, durationMs: 3800 },
        "gmp-kix": { delayMs: 9600, durationMs: 4000 },
      },
      clock: [
        { elapsedMs: 0, minuteOfDay: 360 },
        { elapsedMs: 7000, minuteOfDay: 465 },
        { elapsedMs: 7800, minuteOfDay: 510 },
        { elapsedMs: 13600, minuteOfDay: 655 },
      ],
      cameraCues: [
        { atMs: 0, durationMs: 0, focusPinKeys: ["mandeok", "busan"] },
        { atMs: 4000, durationMs: 1000, focusPinKeys: ["suwon", "icheon", "gimpo"] },
        { atMs: 6800, durationMs: 1000, focusPinKeys: ["gimpo"] },
        { atMs: 9600, durationMs: 1000, focusPinKeys: ["busan", "gimpo", "kix"] },
      ],
    },
    { durationMs: 1000, focusPinKeys: ["kix", "kyoto"] },
    { durationMs: 1200, lineKeys: ["kix-kyoto"] },
    { durationMs: 1000, focusPinKeys: ["kyoto", "kiyomizu", "ginkaku", "kinkaku"] },
    {
      durationMs: 1200,
      lineKeys: ["kyoto-kiyomizu-bus", "kyoto-kiyomizu-walk"],
      lineTimings: {
        "kyoto-kiyomizu-bus": { delayMs: 0, durationMs: 700 },
        "kyoto-kiyomizu-walk": { delayMs: 700, durationMs: 500 },
      },
    },
    {
      durationMs: 1200,
      lineKeys: ["kiyomizu-ginkaku-walk-start", "kiyomizu-ginkaku-bus", "kiyomizu-ginkaku-walk-end"],
      lineTimings: {
        "kiyomizu-ginkaku-walk-start": { delayMs: 0, durationMs: 450 },
        "kiyomizu-ginkaku-bus": { delayMs: 450, durationMs: 500 },
        "kiyomizu-ginkaku-walk-end": { delayMs: 950, durationMs: 250 },
      },
    },
    {
      durationMs: 1200,
      lineKeys: ["ginkaku-kinkaku-walk-start", "ginkaku-kinkaku-bus", "ginkaku-kinkaku-walk-end"],
      lineTimings: {
        "ginkaku-kinkaku-walk-start": { delayMs: 0, durationMs: 150 },
        "ginkaku-kinkaku-bus": { delayMs: 150, durationMs: 900 },
        "ginkaku-kinkaku-walk-end": { delayMs: 1050, durationMs: 150 },
      },
    },
    {
      durationMs: 1200,
      lineKeys: ["kinkaku-kyoto-walk", "kinkaku-kyoto-bus"],
      lineTimings: {
        "kinkaku-kyoto-walk": { delayMs: 0, durationMs: 150 },
        "kinkaku-kyoto-bus": { delayMs: 150, durationMs: 1050 },
      },
    },
  ],
  2: [
    { durationMs: 1000, focusPinKeys: ["kyoto", "odawara"] },
    { durationMs: 1400, lineKeys: ["kyoto-odawara"] },
    { durationMs: 1000, focusPinKeys: ["odawara", "hakone"] },
    { durationMs: 1000, lineKeys: ["odawara-hakone"] },
  ],
  3: [
    { durationMs: 1000, focusPinKeys: ["hakone", "odawara"] },
    { durationMs: 1000, lineKeys: ["hakone-odawara"] },
    { durationMs: 1000, focusPinKeys: ["odawara", "ueno"] },
    { durationMs: 1400, lineKeys: ["odawara-tokyo"] },
    { durationMs: 1000, focusPinKeys: ["ueno", "shinjuku", "shibuya"] },
    { durationMs: 450, pinKey: "ueno" },
    { durationMs: 450, pinKey: "shinjuku" },
    { durationMs: 450, pinKey: "shibuya" },
  ],
  4: [
    { durationMs: 1000, focusPinKeys: ["akihabara", "sensoji", "ginza"] },
    { durationMs: 450, pinKey: "akihabara" },
    { durationMs: 450, pinKey: "sensoji" },
    { durationMs: 450, pinKey: "ginza" },
  ],
  5: [
    { durationMs: 1000, focusPinKeys: ["ueno", "nrt"] },
    { durationMs: 1400, lineKeys: ["tokyo-narita"] },
    { durationMs: 1000, focusPinKeys: ["nrt", "busan", "incheon"] },
    { durationMs: 2400, lineKeys: ["nrt-pus", "nrt-icn"] },
    { durationMs: 1000, focusPinKeys: ["busan", "incheon", "mandeok", "suwon", "icheon"] },
    { durationMs: 1400, lineKeys: ["pus-mandeok", "icn-suwon", "icn-icheon"] },
  ],
} as const;

function stageContract(stage: PlaybackStage) {
  return {
    durationMs: stage.durationMs,
    lineKeys: stage.lineKeys,
    lineTimings: stage.lineTimings,
    pinKey: stage.pinKey,
    focusPinKeys: stage.focusPinKeys,
    clock: stage.clock,
    cameraCues: stage.cameraCues,
  };
}

function expectedLineProgress(stage: PlaybackStage, key: string, stageProgress: number) {
  const timing = stage.lineTimings?.[key];
  if (!timing || stageProgress >= 1) return stageProgress;
  const delayMs = timing.delayMs ?? 0;
  const durationMs = timing.durationMs ?? stage.durationMs - delayMs;
  return Math.max(0, Math.min(1, (stage.durationMs * stageProgress - delayMs) / durationMs));
}

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
        stages: layers.stages.map(stageContract),
      }];
    }))).toEqual({
      1: {
        lines: [
          "mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix", "kix-kyoto",
          "kyoto-kiyomizu-bus", "kyoto-kiyomizu-walk",
          "kiyomizu-ginkaku-walk-start", "kiyomizu-ginkaku-bus", "kiyomizu-ginkaku-walk-end",
          "ginkaku-kinkaku-walk-start", "ginkaku-kinkaku-bus", "ginkaku-kinkaku-walk-end",
          "kinkaku-kyoto-walk", "kinkaku-kyoto-bus",
        ],
        pins: ["mandeok", "suwon", "icheon", "busan", "gimpo", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"],
        stages: AUTHORED_STAGES[1].map(stageContract),
      },
      2: {
        lines: ["kyoto-odawara", "odawara-hakone"],
        pins: ["kyoto", "odawara", "hakone"],
        stages: AUTHORED_STAGES[2].map(stageContract),
      },
      3: {
        lines: ["hakone-odawara", "odawara-tokyo"],
        pins: ["hakone", "odawara", "ueno", "shinjuku", "shibuya"],
        stages: AUTHORED_STAGES[3].map(stageContract),
      },
      4: {
        lines: [],
        pins: ["akihabara", "sensoji", "ginza"],
        stages: AUTHORED_STAGES[4].map(stageContract),
      },
      5: {
        lines: ["tokyo-narita", "nrt-pus", "nrt-icn", "pus-mandeok", "icn-suwon", "icn-icheon"],
        pins: ["ueno", "nrt", "busan", "incheon", "mandeok", "suwon", "icheon"],
        stages: AUTHORED_STAGES[5].map(stageContract),
      },
    });
    const authoredStages = Object.values(AUTHORED_STAGES).flat();
    expect(authoredStages).toHaveLength(31);
    expect({
      focus: authoredStages.filter(({ focusPinKeys }) => focusPinKeys).length,
      line: authoredStages.filter(({ lineKeys }) => lineKeys).length,
      pin: authoredStages.filter(({ pinKey }) => pinKey).length,
    }).toEqual({ focus: 12, line: 13, pin: 6 });
  });

  it("preserves action validity and authored duration/order across all 25 day/traveler scopes", () => {
    let scopeCount = 0;
    let stageCount = 0;
    const actionCounts = { focus: 0, line: 0, pin: 0 };

    for (const day of DAY_NUMBERS) {
      for (const travelerId of TRAVELER_SCOPES) {
        scopeCount += 1;
        const layers = buildDayLayers(day, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId);
        const visibleLineKeys = new Set(layers.lines.map(({ key }) => key));
        const visiblePinKeys = new Set(layers.pins.map(({ key }) => key));
        const expectedStages = AUTHORED_STAGES[day].flatMap((stage): PlaybackStage[] => {
          const lineKeys = stage.lineKeys?.filter((key) => visibleLineKeys.has(key));
          const focusPinKeys = stage.focusPinKeys?.filter((key) => visiblePinKeys.has(key));
          const cameraCues = stage.cameraCues?.flatMap((cue) => {
            const cueFocusPinKeys = cue.focusPinKeys.filter((key) => visiblePinKeys.has(key));
            return cueFocusPinKeys.length > 0 ? [{ ...cue, focusPinKeys: cueFocusPinKeys }] : [];
          });
          const lineTimings = stage.lineTimings && Object.fromEntries(
            Object.entries(stage.lineTimings).filter(([key]) => lineKeys?.includes(key)),
          );
          if (stage.lineKeys && lineKeys?.length === 0) return [];
          if (stage.focusPinKeys && focusPinKeys?.length === 0) return [];
          if (stage.pinKey && !visiblePinKeys.has(stage.pinKey)) return [];
          return [{
            durationMs: stage.durationMs,
            ...(lineKeys ? { lineKeys } : {}),
            ...(lineTimings && Object.keys(lineTimings).length > 0 ? { lineTimings } : {}),
            ...(focusPinKeys ? { focusPinKeys } : {}),
            ...(stage.pinKey ? { pinKey: stage.pinKey } : {}),
            ...(stage.clock ? { clock: stage.clock } : {}),
            ...(cameraCues ? { cameraCues } : {}),
          }];
        });
        if (day === 1 && expectedStages[0]?.clock) {
          const drive = layers.lines.find(({ kind }) => kind === "car");
          if (drive) {
            expectedStages[0] = {
              ...expectedStages[0],
              cameraCues: [
                { atMs: 0, durationMs: 0, focusPinKeys: drive.pinKeys },
                ...expectedStages[0].cameraCues ?? [],
              ],
            };
            expectedStages.unshift({ durationMs: 1000, focusPinKeys: drive.pinKeys });
          }
        }

        expect(layers.stages.map(stageContract), `${day}:${travelerId ?? "all"} duration/order`).toEqual(expectedStages.map(stageContract));
        for (const stage of layers.stages) {
          stageCount += 1;
          const actions = [
            stage.lineKeys && stage.lineKeys.length > 0 ? "line" : null,
            stage.pinKey ? "pin" : null,
            stage.focusPinKeys && stage.focusPinKeys.length > 0 ? "focus" : null,
          ].filter((action): action is keyof typeof actionCounts => action !== null);
          expect(actions, `${day}:${travelerId ?? "all"} non-empty single action`).toHaveLength(1);
          actionCounts[actions[0]] += 1;
          expect(stage.lineKeys?.every((key) => visibleLineKeys.has(key)) ?? true).toBe(true);
          expect(stage.pinKey ? visiblePinKeys.has(stage.pinKey) : true).toBe(true);
          expect(stage.focusPinKeys?.length ?? 1).toBeGreaterThan(0);
          expect(stage.focusPinKeys?.every((key) => visiblePinKeys.has(key)) ?? true).toBe(true);
          expect(stage.cameraCues?.every(({ focusPinKeys }) => (
            focusPinKeys.length > 0 && focusPinKeys.every((key) => visiblePinKeys.has(key))
          )) ?? true).toBe(true);
        }
      }
    }

    expect(scopeCount).toBe(25);
    expect(stageCount).toBe(155);
    expect(actionCounts).toEqual({ focus: 60, line: 65, pin: 30 });
  });
});

describe("createRoutePlayback", () => {
  it("keeps timed routes, clock, and camera cues on one elapsed-time axis", () => {
    const motion = manualMotion();
    const states: PlaybackState[] = [];
    const morning: PlaybackStage = {
      durationMs: 13_600,
      lineKeys: ["mandeok-pus", "icheon-gmp", "suwon-gmp", "pus-kix", "gmp-kix"],
      lineTimings: {
        "mandeok-pus": { delayMs: 0, durationMs: 4_000 },
        "icheon-gmp": { delayMs: 1_000, durationMs: 6_000 },
        "suwon-gmp": { delayMs: 3_000, durationMs: 4_000 },
        "pus-kix": { delayMs: 7_800, durationMs: 3_800 },
        "gmp-kix": { delayMs: 9_600, durationMs: 4_000 },
      },
      clock: [
        { elapsedMs: 0, minuteOfDay: 360 },
        { elapsedMs: 7_000, minuteOfDay: 465 },
        { elapsedMs: 7_800, minuteOfDay: 510 },
        { elapsedMs: 13_600, minuteOfDay: 655 },
      ],
      cameraCues: [
        { atMs: 0, durationMs: 0, focusPinKeys: ["mandeok", "busan"] },
        { atMs: 4_000, durationMs: 1_000, focusPinKeys: ["suwon", "icheon", "gimpo"] },
        { atMs: 6_800, durationMs: 1_000, focusPinKeys: ["gimpo"] },
        { atMs: 9_600, durationMs: 1_000, focusPinKeys: ["busan", "gimpo", "kix"] },
      ],
    };
    const playback = createRoutePlayback({
      stages: [morning, { durationMs: 100, pinKey: "kix" }],
      onUpdate: (state) => states.push(state),
      animateValue: motion.animateValue,
    });

    playback.play();
    expect(states.at(-1)).toMatchObject({
      currentMinute: 360,
      focusPinKeys: ["mandeok", "busan"],
      focusProgress: 1,
    });

    motion.update(4_500 / 13_600);
    expect(states.at(-1)).toMatchObject({
      focusPinKeys: ["suwon", "icheon", "gimpo"],
      focusProgress: 0.5,
    });

    motion.update(9_600 / 13_600);
    expect(states.at(-1)).toMatchObject({
      currentMinute: 555,
      progress: { "pus-kix": 9 / 19, "gmp-kix": 0 },
      focusPinKeys: ["busan", "gimpo", "kix"],
      focusProgress: 0,
    });

    motion.update(11_600 / 13_600);
    expect(states.at(-1)).toMatchObject({
      currentMinute: 605,
      progress: { "pus-kix": 1, "gmp-kix": 0.5 },
      focusPinKeys: ["busan", "gimpo", "kix"],
      focusProgress: 1,
    });

    motion.update(0.7 + 0.2 + 0.1);
    expect(states.at(-1)).toMatchObject({
      currentMinute: 655,
      focusProgress: 1,
    });

    motion.update(1);
    expect(states.at(-1)?.progress).toMatchObject({ "pus-kix": 1, "gmp-kix": 1 });
    motion.complete();
    expect(states.at(-1)).toMatchObject({ currentPinKey: "kix" });
    expect(states.at(-1)).not.toHaveProperty("currentMinute");
    expect(states.at(-1)).not.toHaveProperty("focusPinKeys");
  });

  it("plays all 31 authored stage boundaries with literal focus, line, pin, duration, and completion behavior", () => {
    let playedStages = 0;

    for (const day of DAY_NUMBERS) {
      const motion = manualMotion();
      const states: PlaybackState[] = [];
      const onComplete = vi.fn();
      const layers = buildDayLayers(day);
      const playback = createRoutePlayback({
        stages: layers.stages,
        onUpdate: (state) => states.push(state),
        onComplete,
        animateValue: motion.animateValue,
      });

      playback.play();
      for (const [stageIndex, expectedStage] of AUTHORED_STAGES[day].entries()) {
        playedStages += 1;
        expect(motion.calls[stageIndex], `${day}:${stageIndex} animation contract`).toEqual({
          from: 0,
          to: 1,
          duration: expectedStage.durationMs / 1000,
          ease: "linear",
        });
        const started = states.at(-1)!;
        expect(started.completed).toBe(false);

        if (expectedStage.lineKeys) {
          expect(Object.fromEntries(expectedStage.lineKeys.map((key) => [key, started.progress[key]]))).toEqual(
            Object.fromEntries(expectedStage.lineKeys.map((key) => [key, 0])),
          );
          motion.update(0.5);
          const midway = states.at(-1)!;
          expect(Object.fromEntries(expectedStage.lineKeys.map((key) => [key, midway.progress[key]]))).toEqual(
            Object.fromEntries(expectedStage.lineKeys.map((key) => [key, expectedLineProgress(expectedStage, key, 0.5)])),
          );
          motion.update(1);
          const ended = states.at(-1)!;
          expect(Object.fromEntries(expectedStage.lineKeys.map((key) => [key, ended.progress[key]]))).toEqual(
            Object.fromEntries(expectedStage.lineKeys.map((key) => [key, 1])),
          );
        } else if (expectedStage.focusPinKeys) {
          expect(started).toMatchObject({ focusPinKeys: expectedStage.focusPinKeys, focusProgress: 0, currentPinKey: null });
          motion.update(0.5);
          expect(states.at(-1)).toMatchObject({ focusPinKeys: expectedStage.focusPinKeys, focusProgress: 0.5 });
        } else {
          expect(started).toMatchObject({ currentPinKey: expectedStage.pinKey, progress: {} });
          motion.update(0.5);
          expect(states.at(-1)).toMatchObject({ currentPinKey: expectedStage.pinKey });
        }
        motion.complete();
      }

      expect(states.at(-1)).toEqual({
        progress: Object.fromEntries(layers.lines.map(({ key }) => [key, 1])),
        currentPinKey: null,
        completed: true,
      });
      expect(onComplete).toHaveBeenCalledOnce();
      playback.play();
      expect(onComplete).toHaveBeenCalledOnce();
    }

    expect(playedStages).toBe(31);
  });

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

  it("stops the active animation control and ignores later updates when cancelled", () => {
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

  it("finishes immediately without starting animation when motion is reduced", () => {
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

  it("uses frame timestamps so default playback stays independent of display refresh rate", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(performance, "now").mockReturnValue(100);
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    createRoutePlayback({
      stages: [{ durationMs: 1000, lineKeys: ["route"] }],
      onUpdate,
      onComplete,
    }).play();

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    frames.get(1)?.(600);
    expect(onUpdate).toHaveBeenLastCalledWith({ progress: { route: 0.5 }, currentPinKey: null, completed: false });
    frames.get(2)?.(1100);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("does not start a frame when the initial update cancels playback", () => {
    const animateValue = vi.fn();
    const playback = createRoutePlayback({
      stages: [{ durationMs: 1000, lineKeys: ["route"] }],
      onUpdate: () => playback.cancel(),
      animateValue,
    });

    playback.play();

    expect(animateValue).not.toHaveBeenCalled();
  });

});

describe("animateFrame", () => {
  it.each([600, 1100])("honors stop called inside an update at timestamp %i", (now) => {
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(performance, "now").mockReturnValue(100);
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.set(1, callback);
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
    const onComplete = vi.fn();
    const control = animateFrame(0, 1, { duration: 1, onUpdate: () => control.stop(), onComplete });

    const frame = frames.get(1);
    frames.delete(1);
    frame?.(now);

    expect(frames.size).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("pathAtProgress", () => {
  it("moves at constant distance across uneven vertices without mutating the authored path", () => {
    const path = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 11, lng: 0 }];

    expect(pathAtProgress(path, 0.5)).toEqual([{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 5.5, lng: 0 }]);
    expect(pathAtProgress(path, 1)).toEqual(path);
    expect(path).toHaveLength(3);
  });
});
