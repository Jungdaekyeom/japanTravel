import { animateFrame } from "./frame-animation";

export type PlaybackStage = {
  durationMs: number;
  lineKeys?: readonly string[];
  lineTimings?: Readonly<Record<string, { delayMs?: number; durationMs?: number }>>;
  pinKey?: string;
  focusPinKeys?: readonly string[];
  clock?: readonly { elapsedMs: number; minuteOfDay: number }[];
  cameraCues?: readonly {
    atMs: number;
    durationMs: number;
    focusPinKeys: readonly string[];
  }[];
};

export type PlaybackState = {
  progress: Record<string, number>;
  currentPinKey: string | null;
  completed: boolean;
  focusPinKeys?: readonly string[];
  focusProgress?: number;
  currentMinute?: number;
};

type Point = { lat: number; lng: number };
type AnimationControl = { stop: () => void };
type AnimateValue = (from: number, to: number, options: {
  duration: number;
  ease: "linear";
  onUpdate: (value: number) => void;
  onComplete: () => void;
}) => AnimationControl;

const defaultAnimate: AnimateValue = (from, to, options) => animateFrame(from, to, options);

export function pathAtProgress<T extends Point>(path: readonly T[], progress: number): Point[] {
  if (path.length < 2) return [...path];
  const amount = Math.max(0, Math.min(1, progress));
  if (amount === 0) return [path[0]];
  if (amount === 1) return [...path];

  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += Math.hypot(path[index].lat - path[index - 1].lat, path[index].lng - path[index - 1].lng);
  }
  const target = total * amount;
  let traveled = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const distance = Math.hypot(to.lat - from.lat, to.lng - from.lng);
    if (traveled + distance < target) {
      traveled += distance;
      continue;
    }
    const fraction = distance === 0 ? 0 : (target - traveled) / distance;
    return [...path.slice(0, index), { lat: from.lat + (to.lat - from.lat) * fraction, lng: from.lng + (to.lng - from.lng) * fraction }];
  }
  return [...path];
}

function lineProgressAt(stage: PlaybackStage, key: string, stageProgress: number) {
  const timing = stage.lineTimings?.[key];
  if (!timing || stageProgress >= 1) return stageProgress;

  const delayMs = Math.max(0, timing.delayMs ?? 0);
  const durationMs = timing.durationMs ?? stage.durationMs - delayMs;
  const elapsedMs = stage.durationMs * stageProgress;
  if (durationMs <= 0) return elapsedMs > delayMs ? 1 : 0;
  return Math.max(0, Math.min(1, (elapsedMs - delayMs) / durationMs));
}

function minuteAt(stage: PlaybackStage, elapsedMs: number) {
  const clock = stage.clock;
  if (!clock?.length) return undefined;
  let from = clock[0];
  let minute = from.minuteOfDay;
  for (const to of clock.slice(1)) {
    if (elapsedMs <= to.elapsedMs) {
      const durationMs = to.elapsedMs - from.elapsedMs;
      const progress = durationMs <= 0 ? 1 : Math.max(0, (elapsedMs - from.elapsedMs) / durationMs);
      minute = from.minuteOfDay + (to.minuteOfDay - from.minuteOfDay) * progress;
      break;
    }
    from = to;
    minute = to.minuteOfDay;
  }
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(minute)) * 4;
  return Math.floor(minute + tolerance);
}

function cameraAt(stage: PlaybackStage, elapsedMs: number, stageProgress: number) {
  let activeCue: NonNullable<PlaybackStage["cameraCues"]>[number] | undefined;
  for (const cue of stage.cameraCues ?? []) {
    if (cue.atMs > elapsedMs) break;
    activeCue = cue;
  }
  if (activeCue) return {
    focusPinKeys: activeCue.focusPinKeys,
    focusProgress: activeCue.durationMs <= 0
      ? 1
      : Math.max(0, Math.min(1, (elapsedMs - activeCue.atMs) / activeCue.durationMs)),
  };
  if (stage.focusPinKeys) return { focusPinKeys: stage.focusPinKeys, focusProgress: stageProgress };
  return undefined;
}

type PlaybackOptions = {
  stages: readonly PlaybackStage[];
  reducedMotion?: boolean;
  onUpdate: (state: PlaybackState) => void;
  onComplete?: () => void;
  animateValue?: AnimateValue;
};

export function createRoutePlayback(options: PlaybackOptions) {
  const animateValue = options.animateValue ?? defaultAnimate;
  let control: AnimationControl | undefined;
  let started = false;
  let cancelled = false;
  let finished = false;
  let stageIndex = 0;
  const progress: Record<string, number> = {};

  function completedProgress() {
    return Object.fromEntries(
      options.stages.flatMap((stage) => stage.lineKeys ?? []).map((key) => [key, 1]),
    );
  }

  function finish() {
    if (cancelled || finished) return;
    finished = true;
    options.onUpdate({ progress: completedProgress(), currentPinKey: null, completed: true });
    options.onComplete?.();
  }

  function update(stage: PlaybackStage, stageProgress: number) {
    for (const key of stage.lineKeys ?? []) progress[key] = lineProgressAt(stage, key, stageProgress);
    const elapsedMs = stage.durationMs * stageProgress;
    const currentMinute = minuteAt(stage, elapsedMs);
    const camera = cameraAt(stage, elapsedMs, stageProgress);
    options.onUpdate({
      progress: { ...progress },
      currentPinKey: stage.pinKey ?? null,
      completed: false,
      ...(camera ?? {}),
      ...(currentMinute === undefined ? {} : { currentMinute }),
    });
  }

  function playStage() {
    if (cancelled) return;
    const stage = options.stages[stageIndex];
    if (!stage) return finish();
    update(stage, 0);
    if (cancelled) return;
    control = animateValue(0, 1, {
      duration: stage.durationMs / 1000,
      ease: "linear",
      onUpdate: (value) => { if (!cancelled) update(stage, value); },
      onComplete: () => {
        if (cancelled) return;
        update(stage, 1);
        stageIndex += 1;
        playStage();
      },
    });
  }

  return {
    play() {
      if (started) return;
      started = true;
      if (options.reducedMotion || options.stages.length === 0) finish();
      else playStage();
    },
    cancel() {
      cancelled = true;
      control?.stop();
    },
  };
}
