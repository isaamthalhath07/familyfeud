import { useEffect, useState, useSyncExternalStore } from 'react';
import { liveSync } from '../services/liveSync';
import { secondsLeft } from '../lib/clock';
import type { GameState } from '../types/game';

/** Live, cross-device game snapshot. Re-renders whenever anything changes on any device. */
export function useLiveGame() {
  return useSyncExternalStore(liveSync.subscribe, liveSync.getSnapshot);
}

/** Seconds remaining, computed locally on each device from the shared end timestamp. */
export function useCountdown(state: GameState) {
  const { timerEndsAt, timerRemaining } = state;
  const [left, setLeft] = useState(() => secondsLeft({ timerEndsAt, timerRemaining }));
  useEffect(() => {
    const tick = () => setLeft(secondsLeft({ timerEndsAt, timerRemaining }));
    tick();
    if (!timerEndsAt) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerEndsAt, timerRemaining]);
  return left;
}
