// useThrottle.js — limite la fréquence d'appel d'une fonction
import { useCallback, useRef } from 'react';

export function useThrottle(fn, delay = 16) {
  const lastCall = useRef(0);
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      fn(...args);
    }
  }, [fn, delay]);
}