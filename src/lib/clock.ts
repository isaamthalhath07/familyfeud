/**
 * Shared clock for the round timer.
 *
 * The timer end time is an absolute timestamp written by the Admin device and read by every
 * phone, so a device whose clock is off would show the wrong countdown. We estimate the
 * offset from the web server's `Date` header and only correct clocks that are clearly wrong
 * (the header has 1 s resolution, so small offsets are noise).
 */
let offset = 0;

export const serverNow = () => Date.now() + offset;

const MIN_CORRECTION_MS = 2000;

export async function syncClock() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  let best: { off: number; rtt: number } | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const t0 = Date.now();
      const res = await fetch(`/favicon.svg?clock=${t0}`, { method: 'HEAD', cache: 'no-store' });
      const t1 = Date.now();
      const header = res.headers.get('date');
      const server = header ? Date.parse(header) : NaN;
      if (Number.isNaN(server)) continue;
      // The header is truncated to the second, so the true server time is ~500 ms later on average.
      const sample = { off: server + 500 - (t0 + t1) / 2, rtt: t1 - t0 };
      if (!best || sample.rtt < best.rtt) best = sample;
    } catch {
      /* offline — keep the local clock */
    }
  }
  if (best && Math.abs(best.off) > MIN_CORRECTION_MS) offset = Math.round(best.off);
}

/** Seconds left on the shared round timer. */
export function secondsLeft(state: { timerEndsAt: number | null; timerRemaining: number }) {
  if (state.timerEndsAt) return Math.max(0, Math.ceil((state.timerEndsAt - serverNow()) / 1000));
  return Math.max(0, state.timerRemaining);
}
