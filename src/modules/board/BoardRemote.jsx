// BoardRemote.jsx — interface mobile avec gestion orientation
import { useEffect, useRef, useState } from 'react';
import { logger } from '../../logger';
import { useOrientation } from '../../hooks/useOrientation';
import { useForceLandscape } from '../../hooks/useForceLandscape';
import { boardSupabase } from './supabaseClient';

function BoardRemote() {
  const sessionId  = new URLSearchParams(window.location.search).get('session') || '';
  const isPortrait = useOrientation();
  useForceLandscape();

  const canvasRef  = useRef(null);
  const channelRef = useRef(null);
  const isDrawing  = useRef(false);
  const colorRef   = useRef('#ffffff');
  const sizeRef    = useRef(8);
  const eraserRef  = useRef(false);

  const [color,      setColor]      = useState('#ffffff');
  const [size,       setSize]       = useState(8);
  const [eraserMode, setEraserMode] = useState(false);
  const [connected,  setConnected]  = useState(false);

  useEffect(() => { colorRef.current  = color;      }, [color]);
  useEffect(() => { sizeRef.current   = size;       }, [size]);
  useEffect(() => { eraserRef.current = eraserMode; }, [eraserMode]);

  // ── useEffect 1 : connexion Supabase — TOUJOURS active, même en portrait ──
  useEffect(() => {
    if (!sessionId) return;

    const channel = boardSupabase
      .channel(`platform-board-${sessionId}`)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          logger.info('BoardRemote connecté', { sessionId });
        } else {
          setConnected(false);
          logger.warn('BoardRemote channel', { status });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setConnected(false);
    };
  }, [sessionId]); // PAS de isPortrait ici

  // ── useEffect 2 : canvas + touch events — seulement en paysage ──
  useEffect(() => {
    if (isPortrait) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    const onResize = () => {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.putImageData(img, 0, 0);
      ctx.lineCap  = 'round';
      ctx.lineJoin = 'round';
    };
    window.addEventListener('resize', onResize);

    const sendPoint = (type, clientX, clientY) => {
      const color = eraserRef.current ? '#171713' : colorRef.current;
      const size  = eraserRef.current ? sizeRef.current * 4 : sizeRef.current;
      const norm  = clientX !== undefined
        ? { x: clientX / window.innerWidth, y: clientY / window.innerHeight }
        : {};

      // Dessin local sur le canvas du téléphone
      if (type === 'start' && clientX !== undefined) {
        ctx.beginPath(); ctx.moveTo(clientX, clientY);
        ctx.strokeStyle = color; ctx.lineWidth = size;
      } else if (type === 'move' && clientX !== undefined) {
        ctx.lineTo(clientX, clientY); ctx.stroke();
      } else if (type === 'end') {
        ctx.closePath();
      } else if (type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Envoi vers la TV via channelRef (créé dans useEffect 1)
      channelRef.current?.send({
        type: 'broadcast',
        event: 'draw',
        payload: { type, ...norm, color, size },
      });
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      isDrawing.current = true;
      const t = e.touches[0];
      sendPoint('start', t.clientX, t.clientY);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const t = e.touches[0];
      sendPoint('move', t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      sendPoint('end');
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('resize',     onResize);
      // Ne pas unsubscribe ici — c'est géré dans useEffect 1
    };
  }, [sessionId, isPortrait]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    channelRef.current?.send({ type: 'broadcast', event: 'draw', payload: { type: 'clear' } });
  };

  const handleExport = () => {
    const link = document.createElement('a');
    link.download = `iwaju-board-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  // ── Écran portrait : guide l'utilisateur ──
  if (isPortrait) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#171713',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: '0 24px', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 64 }}>🔄</div>
        <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 18, textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          Tourne ton téléphone<br />en mode <strong>paysage</strong><br />pour dessiner
        </p>
        <div style={{
          background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.3)',
          borderRadius: 12, padding: '12px 16px', maxWidth: 300,
        }}>
          <p style={{ color: '#ffc800', fontFamily: 'monospace', fontSize: 12, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
            💡 Ouvre ce lien dans <strong>Chrome</strong><br />
            pour que la rotation fonctionne.
          </p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)
            .then(() => alert('Lien copié ! Colle-le dans Chrome.'))}
          style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 30, padding: '8px 18px', cursor: 'pointer' }}
        >
          📋 Copier le lien
        </button>
        <p style={{ color: '#444', fontFamily: 'monospace', fontSize: 10, margin: 0 }}>Session : {sessionId}</p>
      </div>
    );
  }

  // ── Écran paysage : interface de dessin ──
  return (
    <main className="board-remote">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none' }} />

      <div className={`status-badge ${connected ? 'connected' : 'connecting'}`}>
        {connected ? '● Connecté' : '○ Connexion…'}
      </div>

      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(17,17,15,0.92)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 50,
        padding: '10px 18px', zIndex: 100,
      }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0 }} />
        <input type="range" min={2} max={30} value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ width: 70, accentColor: 'white' }} />
        <button type="button" onClick={() => setEraserMode((v) => !v)}
          style={{ background: eraserMode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 30, padding: '6px 14px', minHeight: 36, cursor: 'pointer' }}>
          {eraserMode ? '✏️' : '◻️'}
        </button>
        <button type="button" onClick={handleClear}
          style={{ background: 'rgba(220,50,50,0.2)', color: '#ff6b6b', border: '1px solid rgba(220,50,50,0.4)', borderRadius: 30, padding: '6px 14px', minHeight: 36, cursor: 'pointer' }}>
          🗑
        </button>
        <button type="button" onClick={handleExport}
          style={{ background: 'rgba(0,200,100,0.15)', color: '#00c864', border: '1px solid rgba(0,200,100,0.3)', borderRadius: 30, padding: '6px 14px', minHeight: 36, cursor: 'pointer' }}>
          🖼
        </button>
      </div>
    </main>
  );
}

export default BoardRemote;
