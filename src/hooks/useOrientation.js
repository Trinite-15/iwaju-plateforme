import { useState, useEffect } from 'react';

/**
 * Hook pour détecter l'orientation de l'écran
 * 
 * @param {number} threshold - Seuil pour considérer comme paysage (défaut: 1)
 * @returns {Object} { orientation, isLandscape, isPortrait, width, height }
 */
export function useOrientation(threshold = 1) {
  const [orientation, setOrientation] = useState({
    orientation: 'portrait',
    isLandscape: false,
    isPortrait: true,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const detectOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height * threshold;

      setOrientation({
        orientation: isLandscape ? 'landscape' : 'portrait',
        isLandscape,
        isPortrait: !isLandscape,
        width,
        height,
      });
    };

    detectOrientation();

    window.addEventListener('resize', detectOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(detectOrientation, 300);
    });

    return () => {
      window.removeEventListener('resize', detectOrientation);
      window.removeEventListener('orientationchange', detectOrientation);
    };
  }, [threshold]);

  return orientation;
}

export default useOrientation;