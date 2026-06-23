import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createBoardChannel } from './supabaseClient';
import { useForceLandscape } from '../../hooks/useForceLandscape.jsx';
import logger from '../../logger';

const COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#FF9FF3', '#54A0FF', '#5F27CD', '#1DD1A1', '#FF9F43', '#000000', '#FFFFFF'];
const SIZES = [2, 4, 6, 10, 16, 24, 32];

export default function BoardRemote() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') || '';

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);
  const channelRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);

  // --- Forcer le mode paysage ---
  const { 
    isLandscape, 
    isPortrait, 
    showRotationPrompt,
    requestLandscape,
    isMobile 
  } = useForceLandscape({
    force: true,
    onOrientationChange: ({ isLandscape }) => {
      logger.debug('Orientation changée', { isLandscape });
    },
  });

  // --- Connexion Supabase ---
  useEffect(() => {
    if (!sessionId) {
      logger.warn('Session ID manquant');
      return;
    }

    const channel = createBoardChannel(sessionId)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          logger.info('BoardRemote connecté', { sessionId });
        } else {
          logger.warn('BoardRemote déconnecté', { status });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [sessionId]);

  // --- Configuration canvas ---
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    logger.debug('Canvas mobile configuré', { width, height, isLandscape });
  }, [isLandscape]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  // --- Normalisation ---
  const normalize = useCallback((touch) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height,
    };
  }, []);

  // --- Envoi événement ---
  const sendEvent = useCallback((type, point = null) => {
    if (!channelRef.current || !connected) {
      logger.warn('Tentative d\'envoi sans connexion');
      return;
    }

    const payload = { type };
    if (point) {
      payload.x = Math.max(0, Math.min(1, point.x));
      payload.y = Math.max(0, Math.min(1, point.y));
      payload.color = isEraser ? '#ffffff' : color;
      payload.size = size;
    }

    channelRef.current.send({ type: 'broadcast', event: 'draw', payload });
  }, [connected, color, size, isEraser]);

  // --- Événements tactiles ---
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    isDrawing.current = true;
    sendEvent('start', normalize(touch));
  }, [normalize, sendEvent]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    sendEvent('move', normalize(touch));
  }, [normalize, sendEvent]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    isDrawing.current = false;
    sendEvent('end');
  }, [sendEvent]);

  // --- Gomme ---
  const toggleEraser = useCallback(() => {
    setIsEraser(!isEraser);
    logger.debug('Gomme', { active: !isEraser });
  }, [isEraser]);

  // --- Changer couleur ---
  const handleColorChange = useCallback((c) => {
    setColor(c);
    if (isEraser) setIsEraser(false);
    logger.debug('Couleur changée', { color: c });
  }, [isEraser]);

  // --- Afficher l'overlay de rotation si besoin ---
  if (isMobile && isPortrait) {
    return showRotationPrompt();
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0f0f1a',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
      touchAction: 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', color: '#666' }}>
          {isLandscape ? '🌅 Paysage' : '📱 Portrait'}
        </span>
        <span style={{
          fontSize: '10px',
          color: connected ? '#50fa7b' : '#ff6b6b',
        }}>
          {connected ? '● Connecté' : '○ Déconnecté'}
        </span>
        <span style={{ fontSize: '9px', color: '#444' }}>
          {sessionId.slice(0, 6)}
        </span>
        <button
          onClick={requestLandscape}
          style={{
            background: 'rgba(139,233,253,0.1)',
            border: '1px solid rgba(139,233,253,0.2)',
            color: '#8be9fd',
            padding: '2px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          🔄
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 10px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {/* Couleurs */}
        {COLORS.slice(0, 8).map(c => (
          <button
            key={c}
            onClick={() => handleColorChange(c)}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: c,
              border: color === c && !isEraser ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}

        <span style={{ fontSize: '9px', color: '#444', margin: '0 4px' }}>|</span>

        {/* Épaisseurs */}
        {SIZES.slice(0, 5).map(s => (
          <button
            key={s}
            onClick={() => setSize(s)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: size === s ? '2px solid #8be9fd' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: Math.min(s * 1.2, 14),
              height: Math.min(s * 1.2, 14),
              borderRadius: '50%',
              backgroundColor: isEraser ? '#888' : color,
            }} />
          </button>
        ))}

        <span style={{ fontSize: '9px', color: '#444', margin: '0 4px' }}>|</span>

        {/* Gomme */}
        <button
          onClick={toggleEraser}
          style={{
            background: isEraser ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.05)',
            border: isEraser ? '2px solid #ff6b6b' : '1px solid rgba(255,255,255,0.1)',
            color: isEraser ? '#ff6b6b' : '#888',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: isEraser ? 'bold' : 'normal',
          }}
        >
          🧹
        </button>

        <span style={{ fontSize: '9px', color: '#444', margin: '0 4px' }}>|</span>

        {/* Indicateur */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          color: '#666',
        }}>
          <span>{isEraser ? '🧹' : '✏️'}</span>
          <div style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: isEraser ? '#888' : color,
            border: '1px solid rgba(255,255,255,0.1)',
          }} />
          <span>{size}px</span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#1a1a2e',
        margin: '4px',
        borderRadius: '10px',
        overflow: 'hidden',
        touchAction: 'none',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            touchAction: 'none',
            cursor: 'crosshair',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />

        {!connected && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#666',
            fontSize: '14px',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div>Connexion en cours...</div>
            <div style={{ fontSize: '10px', color: '#444' }}>Session: {sessionId}</div>
          </div>
        )}

        {/* Indicateur de mode paysage */}
        {isLandscape && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            fontSize: '10px',
            color: 'rgba(139,233,253,0.5)',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '2px 10px',
            borderRadius: '12px',
            pointerEvents: 'none',
          }}>
            🌅 Paysage
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 12px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        fontSize: '9px',
        color: '#444',
      }}>
        <span>Scanne avec ton téléphone</span>
        <span>Session: {sessionId}</span>
      </div>
    </div>
  );
}