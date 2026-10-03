import { useEffect, useState, useSyncExternalStore } from 'react';
import { liveSync } from '../services/liveSync';
import type { GameState } from '../types/game';

/** Live, cross-device game snapshot. Re-renders whenever anything changes on any device. */
export function useLiveGame() {
  return useSyncExternalStore(liveSync.subscribe, liveSync.getSnapshot);
}

function secondsLeft(state: GameState) {
  if (state.timerEndsAt) return Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  return state.timerRemaining;
}

/** Seconds remaining, computed locally on each device from the shared end timestamp. */
export function useCountdown(state: GameState) {
  const [left, setLeft] = useState(() => secondsLeft(state));
  useEffect(() => {
    setLeft(secondsLeft(state));
    if (!state.timerEndsAt) return;
    const id = setInterval(() => setLeft(secondsLeft(state)), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timerEndsAt, state.timerRemaining]);
  return left;
}
