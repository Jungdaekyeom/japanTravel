export type PlaybackStage = { durationMs: number; lineKeys?: readonly string[]; pinKey?: string };

export type PlaybackState = { progress: Record<string, number>; currentPinKey: string | null; completed: boolean };

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
  let startTime: number | undefined;

  function completedProgress() {
    return Object.fromEntries(
      options.stages.flatMap((stage) => stage.lineKeys ?? []).map((key) => [key, 1]),
    );
  }

  function finish() {
    options.onUpdate({ progress: completedProgress(), currentPinKey: null, completed: true });
    options.onComplete?.();
  }

  function tick(time: number) {
    if (cancelled) return;
    startTime ??= time;
    const elapsed = time - startTime;
    let stageStart = 0;
    const progress: Record<string, number> = {};

    for (const stage of options.stages) {
      const stageEnd = stageStart + stage.durationMs;
      if (elapsed >= stageEnd) {
        for (const key of stage.lineKeys ?? []) progress[key] = 1;
        stageStart = stageEnd;
        continue;
      }

      const stageProgress = Math.max(0, Math.min(1, (elapsed - stageStart) / stage.durationMs));
      for (const key of stage.lineKeys ?? []) progress[key] = stageProgress;
      options.onUpdate({ progress, currentPinKey: stage.pinKey ?? null, completed: false });
      frameId = requestFrame(tick);
      return;
    }

    finish();
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
