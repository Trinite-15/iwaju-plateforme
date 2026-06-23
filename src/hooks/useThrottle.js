import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook pour limiter le nombre d'appels d'une fonction
 * Utile pour réduire la charge CPU sur les Smart TV
 * 
 * @param {Function} fn - Fonction à throttler
 * @param {number} delay - Délai en millisecondes (défaut: 16ms = 60fps)
 * @returns {Function} Fonction throttlée
 */
export function useThrottle(fn, delay = 16) {
  const lastCall = useRef(0);
  const timeoutRef = useRef(null);
  const lastArgs = useRef(null);

  return useCallback((...args) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall.current);

    if (remaining <= 0) {
      // Appel immédiat
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      lastCall.current = now;
      fn(...args);
    } else if (!timeoutRef.current) {
      // Planifier le dernier appel
      lastArgs.current = args;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        lastCall.current = Date.now();
        fn(...lastArgs.current);
      }, remaining);
    }
  }, [fn, delay]);
}

/**
 * Hook pour throttler les événements tactiles
 * Limite le nombre de points envoyés par frame
 * 
 * @param {Function} fn - Fonction à appeler avec les points
 * @param {number} maxPointsPerFrame - Nombre max de points par frame
 * @returns {Function} Fonction pour ajouter un point
 */
export function useTouchThrottle(fn, maxPointsPerFrame = 3) {
  const queue = useRef([]);
  const rafId = useRef(null);
  const isProcessing = useRef(false);

  const processQueue = useCallback(() => {
    if (queue.current.length === 0) {
      isProcessing.current = false;
      return;
    }

    const points = queue.current.splice(0, maxPointsPerFrame);
    points.forEach(fn);

    rafId.current = requestAnimationFrame(processQueue);
  }, [fn, maxPointsPerFrame]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return useCallback((point) => {
    queue.current.push(point);
    if (!isProcessing.current) {
      isProcessing.current = true;
      rafId.current = requestAnimationFrame(processQueue);
    }
  }, [processQueue]);
}

/**
 * Hook pour throttle avec debounce
 * Utile pour les événements de redimensionnement
 * 
 * @param {Function} fn - Fonction à appeler
 * @param {number} delay - Délai en millisecondes
 * @returns {Function} Fonction avec debounce
 */
export function useDebounce(fn, delay = 250) {
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      fn(...args);
      timeoutRef.current = null;
    }, delay);
  }, [fn, delay]);
}

export default useThrottle;