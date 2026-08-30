export type PlaybackStage = { durationMs: number; lineKeys?: readonly string[]; pinKey?: string; focusPinKeys?: readonly string[] };

export type PlaybackState = { progress: Record<string, number>; currentPinKey: string | null; completed: boolean; focusPinKeys?: readonly string[] };

type Point = { lat: number; lng: number };

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

type PlaybackOptions = {
  stages: readonly PlaybackStage[];
  reducedMotion?: boolean;
  onUpdate: (state: PlaybackState) => void;
  onComplete?: () => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
};

export function createRoutePlayback(options: PlaybackOptions) {
  const requestFrame = options.requestFrame ?? ((callback: FrameRequestCallback) => window.requestAnimationFrame(callback));
  const cancelFrame = options.cancelFrame ?? ((id: number) => window.cancelAnimationFrame(id));
  let frameId: number | undefined;
  let started = false;
  let cancelled = false;
  let stageIndex = 0;
  let stageStartedAt: number | undefined;
  const progress: Record<string, number> = {};

  function completedProgress() {
    return Object.fromEntries(
      options.stages.flatMap((stage) => stage.lineKeys ?? []).map((key) => [key, 1]),
    );
  }

  function finish() {
    options.onUpdate({ progress: completedProgress(), currentPinKey: null, completed: true });
    options.onComplete?.();
  }

  function update(stage: PlaybackStage, stageProgress: number) {
    for (const key of stage.lineKeys ?? []) progress[key] = stageProgress;
    options.onUpdate({
      progress: { ...progress },
      currentPinKey: stage.pinKey ?? null,
      completed: false,
      ...(stage.focusPinKeys ? { focusPinKeys: stage.focusPinKeys } : {}),
    });
  }

  function tick(time: number) {
    if (cancelled) return;
    const stage = options.stages[stageIndex];
    if (!stage) return finish();
    stageStartedAt ??= time;
    const stageProgress = Math.max(0, Math.min(1, (time - stageStartedAt) / stage.durationMs));
    update(stage, stageProgress);

    if (stageProgress < 1) {
      frameId = requestFrame(tick);
      return;
    }

    stageIndex += 1;
    const nextStage = options.stages[stageIndex];
    if (!nextStage) return finish();
    stageStartedAt = time;
    update(nextStage, 0);
    frameId = requestFrame(tick);
  }

  return {
    play() {
      if (started) return;
      started = true;
      if (options.reducedMotion || options.stages.length === 0) finish();
      else frameId = requestFrame(tick);
    },
    cancel() {
      cancelled = true;
      if (frameId !== undefined) cancelFrame(frameId);
    },
  };
}
