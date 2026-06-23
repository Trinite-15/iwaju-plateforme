// useForceLandscape.js — tente de verrouiller en paysage
import { useEffect } from 'react';

export function useForceLandscape() {
  useEffect(() => {
    if (screen?.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }, []);
}