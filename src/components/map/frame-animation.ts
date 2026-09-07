type FrameOptions = {
  duration: number;
  onUpdate: (value: number) => void;
  onComplete: () => void;
};

export function animateFrame(from: number, to: number, options: FrameOptions) {
  let startedAt = performance.now();
  const durationMs = options.duration * 1000;
  const visibilityDocument = typeof document === "undefined" ? undefined : document;
  let frameId: number | undefined;
  let hiddenAt = visibilityDocument?.hidden ? startedAt : undefined;
  let stopped = false;

  const cleanup = () => {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    frameId = undefined;
    visibilityDocument?.removeEventListener("visibilitychange", onVisibilityChange);
  };

  const schedule = () => {
    if (!stopped && !visibilityDocument?.hidden && frameId === undefined) {
      frameId = requestAnimationFrame(update);
    }
  };

  const update = (now: number) => {
    frameId = undefined;
    if (stopped) return;
    const progress = durationMs === 0 ? 1 : Math.max(0, Math.min(1, (now - startedAt) / durationMs));
    options.onUpdate(from + (to - from) * progress);
    if (stopped) return;
    if (progress < 1) schedule();
    else {
      stopped = true;
      cleanup();
      options.onComplete();
    }
  };

  function onVisibilityChange() {
    if (stopped || !visibilityDocument) return;
    const now = performance.now();
    if (visibilityDocument.hidden) {
      hiddenAt ??= now;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = undefined;
    } else if (hiddenAt !== undefined) {
      startedAt += now - hiddenAt;
      hiddenAt = undefined;
      schedule();
    }
  }

  visibilityDocument?.addEventListener("visibilitychange", onVisibilityChange);
  schedule();
  return { stop() { if (!stopped) { stopped = true; cleanup(); } } };
}
