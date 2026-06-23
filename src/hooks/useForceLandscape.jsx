import { useEffect, useState, useCallback } from 'react';
import logger from '../logger';

/**
 * Hook pour forcer le mode paysage sur mobile
 * Utile pour l'adaptation à l'écran TV
 * 
 * @param {Object} options - Options
 * @param {boolean} options.force - Forcer le paysage (défaut: true)
 * @param {Function} options.onOrientationChange - Callback quand l'orientation change
 * @param {number} options.threshold - Seuil pour considérer comme paysage (défaut: 1.2)
 * @returns {Object} { isLandscape, isPortrait, orientation, requestLandscape }
 */
export function useForceLandscape(options = {}) {
  const {
    force = true,
    onOrientationChange = null,
    threshold = 1.2,
  } = options;

  const [isLandscape, setIsLandscape] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [orientation, setOrientation] = useState('portrait');
  const [isMobile, setIsMobile] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  // Détecter si c'est un mobile
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const mobile = /android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua);
    setIsMobile(mobile);
  }, []);

  // Détecter l'orientation
  const detectOrientation = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const landscape = width > height * threshold;

    setIsLandscape(landscape);
    setIsPortrait(!landscape);
    setOrientation(landscape ? 'landscape' : 'portrait');

    if (onOrientationChange) {
      onOrientationChange({ isLandscape: landscape, isPortrait: !landscape });
    }

    logger.debug('Orientation détectée', { 
      landscape, 
      width, 
      height, 
      ratio: (width / height).toFixed(2),
      isMobile 
    });

    return landscape;
  }, [threshold, onOrientationChange, isMobile]);

  // Demander le mode plein écran (utile pour les TV)
  const requestFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        logger.info('Mode plein écran activé');
        return true;
      } catch (err) {
        logger.warn('Impossible d\'activer le plein écran', { error: err.message });
        return false;
      }
    }
    return false;
  }, []);

  // Demander le mode paysage via l'API Screen Orientation
  const requestLandscape = useCallback(async () => {
    if (!isMobile || !force) return false;

    try {
      // Vérifier si l'API Screen Orientation est disponible
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        setHasRequested(true);
        logger.info('Mode paysage verrouillé');
        return true;
      }
      
      // Fallback: utiliser l'API Fullscreen
      await requestFullscreen();
      setHasRequested(true);
      return true;
    } catch (err) {
      logger.warn('Impossible de verrouiller le paysage', { error: err.message });
      
      // Fallback: essayer le fullscreen
      try {
        await requestFullscreen();
        return true;
      } catch (_) {
        return false;
      }
    }
  }, [isMobile, force, requestFullscreen]);

  // Afficher un overlay pour inviter l'utilisateur à tourner l'écran
  const showRotationPrompt = useCallback(() => {
    if (!isMobile || isLandscape || !force) return null;

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: '40px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '24px',
          animation: 'rotatePhone 2s ease-in-out infinite',
        }}>
          📱
        </div>
        <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#feca57' }}>
          Tournez votre téléphone
        </h2>
        <p style={{ fontSize: '16px', color: '#888', maxWidth: '400px' }}>
          Pour une meilleure expérience, utilisez votre téléphone en <strong style={{ color: '#fff' }}>mode paysage</strong>.
          Cela permettra d'adapter le dessin à la taille de votre écran TV.
        </p>
        <button
          onClick={() => requestLandscape()}
          style={{
            marginTop: '24px',
            padding: '12px 32px',
            backgroundColor: '#8be9fd',
            color: '#0f0f1a',
            border: 'none',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          🔄 Passer en paysage
        </button>
        <style>{`
          @keyframes rotatePhone {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(90deg); }
          }
        `}</style>
      </div>
    );
  }, [isMobile, isLandscape, force, requestLandscape]);

  // Écouter les changements d'orientation
  useEffect(() => {
    detectOrientation();

    window.addEventListener('resize', detectOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(detectOrientation, 300);
    });

    // Si mobile et force, demander le paysage
    if (isMobile && force) {
      setTimeout(requestLandscape, 500);
    }

    return () => {
      window.removeEventListener('resize', detectOrientation);
      window.removeEventListener('orientationchange', detectOrientation);
    };
  }, [detectOrientation, isMobile, force, requestLandscape]);

  return {
    isLandscape,
    isPortrait,
    orientation,
    isMobile,
    requestLandscape,
    requestFullscreen,
    showRotationPrompt,
    hasRequested,
    detectOrientation,
  };
}

export default useForceLandscape;