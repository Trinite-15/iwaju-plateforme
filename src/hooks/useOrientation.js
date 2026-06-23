import { useEffect, useState } from 'react';

export function useOrientation() {
  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize',            check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize',            check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return isPortrait;
}