// BoardTV.jsx — tableau Smart TV avec DPR 4K + RAF queue
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LogsPanel from '../../components/LogsPanel';
import { logger } from '../../logger';
import { boardSupabase } from './supabaseClient';
import QRPanel from './QRPanel';

// Générer un ID stable : le garder dans sessionStorage pour survivre aux rechargements
const getSessionId = () => {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('session');
  if (fromUrl) return fromUrl;

  const stored = sessionStorage.getItem('board-session-id');
  if (stored) return stored;

  const newId = Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem('board-session-id', newId);
  return newId;
};

function BoardTV() {
  const [sessionId]   = useState(getSessionId);
  const canvasRef     = useRef(null);
  const channelRef    = useRef(null);
  const isDrawing     = useRef(false);
  const pointQueue    = useRef([]);
  const rafActive     = useRef(false);
  const colorRef      = useRef('#ffffff');
  const sizeRef       = useRef(6);
  const eraserRef     = useRef(false);

  const [color,      setColor]      = useState('#ffffff');
  const [size,       setSize]       = useState(6);
  const [eraserMode, setEraserMode] = useState(false);
  const [connStatus, setConnStatus] = useState('connecting');

  useEffect(() => { colorRef.current  = color;      }, [color]);
  useEffect(() => { sizeRef.current   = size;       }, [size]);
  useEffect(() => { eraserRef.current = eraserMode; }, [eraserMode]);

  const denormalize = useCallback((nx, ny, canvas) => {
    const dpr = window.devicePixelRatio || 1;
    return { px: nx * (canvas.width / dpr), py: ny * (canvas.height / dpr) };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width        = window.innerWidth  * dpr;
      canvas.height       = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap  = 'round';
      ctx.lineJoin = 'round';
      logger.info('Canvas resized', { css: `${window.innerWidth}x${window.innerHeight}`, dpr });
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    // RAF queue — 60fps
    const renderLoop = () => {
      while (pointQueue.current.length > 0) {
        const pt = pointQueue.current.shift();
        const { px, py } = denormalize(pt.x ?? 0, pt.y ?? 0, canvas);
        if (pt.type === 'start') {
          ctx.beginPath(); ctx.moveTo(px, py);
          ctx.strokeStyle = pt.color; ctx.lineWidth = pt.size;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        } else if (pt.type === 'move') {
          ctx.lineTo(px, py); ctx.stroke();
        } else if (pt.type === 'end') {
          ctx.closePath();
        } else if (pt.type === 'clear') {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      requestAnimationFrame(renderLoop);
    };
    if (!rafActive.current) {
      rafActive.current = true;
      requestAnimationFrame(renderLoop);
    }

    // Supabase Realtime
    const channel = boardSupabase
      .channel(`platform-board-${sessionId}`)
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        pointQueue.current.push(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('connected');
          logger.info('BoardTV connecté', { sessionId, dpr: window.devicePixelRatio || 1 });
        } else {
          logger.warn('BoardTV channel', { status });
        }
      });

    channelRef.current = channel;

    // Dessin local (souris / pointeur)
    const sendPoint = (type, clientX, clientY) => {
      const normalized = clientX !== undefined
        ? { x: clientX / window.innerWidth, y: clientY / window.innerHeight }
        : {};
      const payload = {
        type, ...normalized,
        color: eraserRef.current ? '#171713' : colorRef.current,
        size:  eraserRef.current ? sizeRef.current * 3 : sizeRef.current,
      };
      pointQueue.current.push(payload);
      channel.send({ type: 'broadcast', event: 'draw', payload });
    };

    const onDown = (e) => { isDrawing.current = true;  sendPoint('start', e.clientX, e.clientY); };
    const onMove = (e) => { if (isDrawing.current) sendPoint('move', e.clientX, e.clientY); };
    const onUp   = ()  => { if (isDrawing.current) { isDrawing.current = false; sendPoint('end'); } };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup',   onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup',   onUp);
      ro.disconnect();
      channel.unsubscribe();
      logger.info('BoardTV démonté', { sessionId });
    };
  }, [sessionId, denormalize]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    channelRef.current?.send({ type: 'broadcast', event: 'draw', payload: { type: 'clear' } });
    logger.info('Canvas effacé');
  };

  const handleExport = () => {
    const link = document.createElement('a');
    link.download = `iwaju-board-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    logger.info('Canvas exporté PNG');
  };

  return (
    <main className="board-screen">
      <canvas ref={canvasRef} tabIndex={0} />

      <div className={`status-badge ${connStatus}`}>
        {connStatus === 'connected' ? `Session : ${sessionId}` : 'Connexion…'}
      </div>

      <QRPanel sessionId={sessionId} />

      <nav className="top-nav">
        <Link to="/" tabIndex={0}>Menu</Link>
        <Link to={`/board/remote?session=${sessionId}`} tabIndex={0}>Télécommande</Link>
      </nav>

      <div className="toolbar">
        <label>Couleur</label>
        <input type="color" tabIndex={0} value={color} onChange={(e) => setColor(e.target.value)} />
        <label>Épaisseur</label>
        <input type="range" tabIndex={0} min={1} max={30} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        <button type="button" tabIndex={0} onClick={() => setEraserMode((v) => !v)}>
          {eraserMode ? '✏️ Dessiner' : '◻️ Gomme'}
        </button>
        <button type="button" tabIndex={0} onClick={handleClear}>🗑 Effacer</button>
        <button type="button" tabIndex={0} onClick={handleExport}>🖼 Exporter</button>
        <button type="button" tabIndex={0} onClick={() => logger.download()} style={{ opacity: 0.5, fontSize: '0.85rem' }}>📋 Logs</button>
      </div>

      <LogsPanel />
    </main>
  );
}

export default BoardTV;
