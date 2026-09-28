import { animateFrame } from "./frame-animation";

export type PlaybackStage = {
  durationMs: number;
  lineKeys?: readonly string[];
  sequential?: boolean;
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

const pathMetrics = new WeakMap<readonly Point[], { points: { x: number; y: number }[]; cumulative: number[]; total: number }>();

function metrics(path: readonly Point[]) {
  const cached = pathMetrics.get(path);
  if (cached) return cached;
  const points = path.map(({ lat, lng }) => ({
    x: lng / 360,
    y: Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360)) / (2 * Math.PI),
  }));
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  const result = { points, cumulative, total: cumulative.at(-1) ?? 0 };
  pathMetrics.set(path, result);
  return result;
}

export function projectedPathLength(path: readonly Point[], zoom: number) {
  return metrics(path).total * 256 * 2 ** zoom;
}

export function visualStages(
  stages: readonly PlaybackStage[],
  lines: readonly { key: string; path: readonly Point[] }[],
  focusZoom: (keys: readonly string[]) => number,
): PlaybackStage[] {
  const byKey = new Map(lines.map((line) => [line.key, line]));
  let zoom = 5;
  return stages.map((stage) => {
    if (stage.focusPinKeys) zoom = focusZoom(stage.focusPinKeys);
    if (!stage.lineKeys?.length) return stage;
    let end = 0;
    let firstDuration = 0;
    const lineTimings = Object.fromEntries(stage.lineKeys.map((key, index) => {
      const line = byKey.get(key);
      const durationMs = line ? projectedPathLength(line.path, zoom) / 240 * 1000 : 0;
      if (index === 0) firstDuration = durationMs;
      const delayMs = stage.sequential ? end : (stage.lineTimings?.[key]?.delayMs ?? 0) / stage.durationMs * firstDuration;
      end = Math.max(end, delayMs + durationMs);
      return [key, { delayMs, durationMs }];
    }));
    return { ...stage, durationMs: Math.max(1, end), lineTimings };
  });
}

export function pathAtProgress<T extends Point>(path: readonly T[], progress: number): Point[] {
  if (path.length < 2) return [...path];
  const amount = Math.max(0, Math.min(1, progress));
  if (amount === 0) return [path[0]];
  if (amount === 1) return [...path];

  const { points, cumulative, total } = metrics(path);
  const target = total * amount;
  for (let index = 1; index < path.length; index += 1) {
    if (cumulative[index] < target) continue;
    const from = points[index - 1];
    const to = points[index];
    const distance = cumulative[index] - cumulative[index - 1];
    const fraction = distance === 0 ? 0 : (target - cumulative[index - 1]) / distance;
    const y = from.y + (to.y - from.y) * fraction;
    return [...path.slice(0, index), {
      lat: (2 * Math.atan(Math.exp(y * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI,
      lng: (from.x + (to.x - from.x) * fraction) * 360,
    }];
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
