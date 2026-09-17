export interface SchedulerClock {
  now(): number;
  setTimeout(action: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

const systemClock: SchedulerClock = {
  now: () => performance.now(),
  setTimeout: (action, delay) => setTimeout(action, delay),
  clearTimeout: (timer) => clearTimeout(timer),
};

/** One pending game action; cancellation also invalidates already queued callbacks. */
export function createScheduler(canRun: () => boolean, clock = systemClock) {
  let pending:
    { action: () => void; remaining: number; deadline: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  let generation = 0;

  function stopTimer() {
    if (timer !== undefined) clock.clearTimeout(timer);
    timer = undefined;
    generation++;
  }

  function arm() {
    if (!pending || paused) return;
    const job = pending;
    const token = generation;
    job.deadline = clock.now() + job.remaining;
    timer = clock.setTimeout(() => {
      if (token !== generation || paused || pending !== job) return;
      timer = undefined;
      pending = undefined;
      if (canRun()) job.action();
    }, job.remaining);
  }

  return {
    schedule(action: () => void, delay = 620) {
      stopTimer();
      pending = undefined;
      if (!canRun()) return;
      pending = { action, remaining: Math.max(0, delay), deadline: 0 };
      arm();
    },
    pause() {
      if (paused) return;
      if (pending && timer !== undefined)
        pending.remaining = Math.max(0, pending.deadline - clock.now());
      paused = true;
      stopTimer();
    },
    resume() {
      if (!paused) return;
      paused = false;
      if (!canRun()) {
        pending = undefined;
        return;
      }
      arm();
    },
    cancel() {
      stopTimer();
      pending = undefined;
      paused = false;
    },
  };
}
