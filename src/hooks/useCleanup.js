import { useEffect, useRef } from 'react';

export function useCleanup() {
  const cleanups = useRef([]);

  const register = (fn) => {
    cleanups.current.push(fn);
  };

  useEffect(() => {
    return () => {
      cleanups.current.forEach((fn) => fn?.());
      cleanups.current = [];
    };
  }, []);

  return register;
}