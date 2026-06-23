import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createBoardChannel } from './supabaseClient';
import QRPanel from './QRPanel';
import logger from '../../logger';

const COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#FF9FF3', '#54A0FF', '#5F27CD', '#1DD1A1', '#FF9F43', '#000000', '#FFFFFF'];
const SIZES = [2, 4, 6, 10, 16, 24, 32];

const isSmartTV = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('smarttv') || 
         ua.includes('webos') || 
         ua.includes('tizen') || 
         ua.includes('vidaa') ||
         (ua.includes('android') && window.innerWidth > 1920);
};

export default function BoardTV() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') || `board-${Date.now()}`;

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const pointQueue = useRef([]);
  const isDrawingRef = useRef(false);
  const animFrameRef = useRef(null);
  const channelRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(6);
  const [showLogs, setShowLogs] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const isTV = isSmartTV();

  // --- Connexion Supabase ---
  useEffect(() => {
    const channel = createBoardChannel(sessionId)
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        pointQueue.current.push(payload);
      })
      .on('broadcast', { event: 'clear' }, () => {
        setClearPending(true);
        logger.info('Canvas effacé via commande');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          logger.info('BoardTV connecté', { sessionId });
        } else {
          logger.warn('BoardTV déconnecté', { status });
        }
      });

    channelRef.current = channel;

    // Écouter les logs
    const logListener = (entry) => {
      setLogEntries(prev => [...prev.slice(-100), entry]);
    };
    logger.addListener(logListener);

    return () => {
      logger.removeListener(logListener);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [sessionId]);

  // --- Configuration du canvas ---
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const containerWidth = rect.width || window.innerWidth;
    const containerHeight = rect.height || window.innerHeight;

    const dpr = isTV ? 1 : (window.devicePixelRatio || 1);
    const maxResolution = isTV ? 1920 : 3840;

    const width = Math.min(containerWidth * dpr, maxResolution);
    const height = Math.min(containerHeight * dpr, maxResolution);

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    ctx.scale(1, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    logger.debug('Canvas initialisé', { width, height, dpr, isTV });
  }, [isTV]);

  // --- Boucle de rendu ---
  const renderLoop = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    let processed = 0;
    const maxPerFrame = isTV ? 5 : 10;

    while (pointQueue.current.length > 0 && processed < maxPerFrame) {
      const pt = pointQueue.current.shift();
      processed++;

      const x = pt.x * canvas.width;
      const y = pt.y * canvas.height;

      try {
        if (pt.type === 'start') {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = pt.color || currentColor;
          ctx.lineWidth = (pt.size || currentSize) * (canvas.width / 1920);
          isDrawingRef.current = true;
        } else if (pt.type === 'move' && isDrawingRef.current) {
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (pt.type === 'end') {
          ctx.closePath();
          isDrawingRef.current = false;
        }
      } catch (err) {
        logger.error('Erreur rendu', { error: err.message });
      }
    }

    if (clearPending && pointQueue.current.length === 0) {
      setClearPending(false);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      logger.info('Canvas effacé localement');
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [clearPending, currentColor, currentSize, isTV]);

  // --- Effacer le canvas ---
  const handleClear = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'clear',
      payload: {},
    });
    logger.info('Commande effacer envoyée');
  }, []);

  // --- Exporter en PNG ---
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `iwaju-board-${sessionId}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      logger.info('Export PNG', { sessionId });
    } catch (err) {
      logger.error('Erreur export', { error: err.message });
    }
  }, [sessionId]);

  // --- Changer la couleur ---
  const handleColorChange = useCallback((color) => {
    setCurrentColor(color);
    setIsEraser(false);
    logger.debug('Couleur changée', { color });
  }, []);

  // --- Activer la gomme ---
  const handleEraser = useCallback(() => {
    setIsEraser(!isEraser);
    if (!isEraser) {
      setCurrentColor('#ffffff');
      logger.debug('Gomme activée');
    } else {
      setCurrentColor('#000000');
      logger.debug('Gomme désactivée');
    }
  }, [isEraser]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('resize', setupCanvas);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [setupCanvas, renderLoop]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0f0f1a',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: isTV ? '20px' : '16px', color: '#8be9fd' }}>
            IWAJU BOARD
          </span>
          <span style={{
            fontSize: '11px',
            color: connected ? '#50fa7b' : '#ff6b6b',
            backgroundColor: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)',
            padding: '2px 10px',
            borderRadius: '12px',
          }}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </span>
          <span style={{ fontSize: '11px', color: '#555' }}>
            Session: {sessionId.slice(0, 8)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: showLogs ? 'rgba(139,233,253,0.2)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: showLogs ? '#8be9fd' : '#888',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            📋 Logs
          </button>
          <button
            onClick={handleClear}
            style={{
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.2)',
              color: '#ff6b6b',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            🗑️ Effacer
          </button>
          <button
            onClick={handleExport}
            style={{
              background: 'rgba(139,233,253,0.1)',
              border: '1px solid rgba(139,233,253,0.2)',
              color: '#8be9fd',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            📥 Exporter
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '11px', color: '#666', marginRight: '4px' }}>
          🎨 Couleur
        </span>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => handleColorChange(c)}
            style={{
              width: isTV ? '28px' : '24px',
              height: isTV ? '28px' : '24px',
              borderRadius: '50%',
              backgroundColor: c,
              border: currentColor === c && !isEraser ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: currentColor === c && !isEraser ? '0 0 12px rgba(139,233,253,0.3)' : 'none',
            }}
          />
        ))}

        <span style={{ fontSize: '11px', color: '#666', margin: '0 8px' }}>
          ✏️ Épaisseur
        </span>
        {SIZES.map(s => (
          <button
            key={s}
            onClick={() => setCurrentSize(s)}
            style={{
              width: isTV ? '32px' : '28px',
              height: isTV ? '32px' : '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: currentSize === s ? '2px solid #8be9fd' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: Math.min(s * 1.2, 20),
              height: Math.min(s * 1.2, 20),
              borderRadius: '50%',
              backgroundColor: currentColor === '#ffffff' && isEraser ? '#888' : currentColor,
              border: currentColor === '#ffffff' && isEraser ? '1px solid #555' : 'none',
            }} />
          </button>
        ))}

        <button
          onClick={handleEraser}
          style={{
            background: isEraser ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.05)',
            border: isEraser ? '2px solid #ff6b6b' : '1px solid rgba(255,255,255,0.1)',
            color: isEraser ? '#ff6b6b' : '#888',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: isEraser ? 'bold' : 'normal',
          }}
        >
          🧹 Gomme
        </button>
      </div>

      {/* Canvas + Sidebar */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '12px',
        padding: '12px',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#1a1a2e',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              touchAction: 'none',
            }}
          />
          {!connected && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#666',
              fontSize: '18px',
            }}>
              Connexion en cours...
            </div>
          )}
        </div>

        {/* QR Panel */}
        <div style={{
          width: isTV ? '200px' : '240px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <QRPanel sessionId={sessionId} />
          
          {/* Logs Panel */}
          {showLogs && (
            <div style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              padding: '10px',
              border: '1px solid rgba(255,255,255,0.05)',
              minHeight: '100px',
              maxHeight: '300px',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <span style={{ fontSize: '10px', color: '#666' }}>
                  📋 Logs ({logEntries.length})
                </span>
                <button
                  onClick={() => logger.clearLogs()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#444',
                    fontSize: '9px',
                    cursor: 'pointer',
                  }}
                >
                  Effacer
                </button>
              </div>
              <div style={{
                fontSize: isTV ? '8px' : '9px',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
              }}>
                {logEntries.slice(-50).map((entry, i) => (
                  <div key={i} style={{
                    color: entry.level === 'ERROR' ? '#ff6b6b' :
                           entry.level === 'WARN' ? '#feca57' :
                           entry.level === 'DEBUG' ? '#555' : '#888',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    padding: '1px 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {entry.timestamp.slice(11, 19)} [{entry.level}] {entry.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}