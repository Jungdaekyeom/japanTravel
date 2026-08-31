import { animate } from "motion/react";

export type PlaybackStage = {
  durationMs: number;
  lineKeys?: readonly string[];
  lineTimings?: Readonly<Record<string, { delayMs?: number; durationMs?: number }>>;
  pinKey?: string;
  focusPinKeys?: readonly string[];
};

export type PlaybackState = { progress: Record<string, number>; currentPinKey: string | null; completed: boolean; focusPinKeys?: readonly string[]; focusProgress?: number };

type Point = { lat: number; lng: number };
type AnimationControl = { stop: () => void };
type AnimateValue = (from: number, to: number, options: {
  duration: number;
  ease: "linear";
  onUpdate: (value: number) => void;
  onComplete: () => void;
}) => AnimationControl;

const motionAnimate: AnimateValue = (from, to, options) => animate(from, to, options);

export function pathAtProgress<T extends Point>(path: readonly T[], progress: number): Point[] {
  if (path.length < 2) return [...path];
  const scaled = Math.max(0, Math.min(1, progress)) * (path.length - 1);
  const whole = Math.floor(scaled);
  const visible: Point[] = path.slice(0, whole + 1);
  const fraction = scaled - whole;
  if (fraction > 0 && whole < path.length - 1) {
    const from = path[whole];
    const to = path[whole + 1];
    visible.push({ lat: from.lat + (to.lat - from.lat) * fraction, lng: from.lng + (to.lng - from.lng) * fraction });
  }
  return visible;
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

type PlaybackOptions = {
  stages: readonly PlaybackStage[];
  reducedMotion?: boolean;
  onUpdate: (state: PlaybackState) => void;
  onComplete?: () => void;
  animateValue?: AnimateValue;
};

export function createRoutePlayback(options: PlaybackOptions) {
  const animateValue = options.animateValue ?? motionAnimate;
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
    options.onUpdate({
      progress: { ...progress },
      currentPinKey: stage.pinKey ?? null,
      completed: false,
      ...(stage.focusPinKeys ? { focusPinKeys: stage.focusPinKeys, focusProgress: stageProgress } : {}),
    });
  }

  function playStage() {
    if (cancelled) return;
    const stage = options.stages[stageIndex];
    if (!stage) return finish();
    update(stage, 0);
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
