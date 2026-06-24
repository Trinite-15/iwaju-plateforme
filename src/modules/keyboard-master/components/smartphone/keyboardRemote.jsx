// KeyboardRemote.jsx — Clavier smartphone
import { useState, useEffect, useRef, useCallback } from 'react';
import { createKeyboardChannel } from '../../supabaseClient';
import { logger } from '../../../../logger';

// Sons Web Audio
function beep(freq1, freq2, dur) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq1, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.type = 'sine'; osc.start(); osc.stop(ctx.currentTime + dur);
    osc.onended = () => ctx.close();
  } catch (_) {}
}
const playKey    = () => beep(700, 350, 0.07);
const playDelete = () => beep(280, 140, 0.08);

const ROWS = [
  ['A','B','C','D','E','F','G','H','I','J'],
  ['K','L','M','N','O','P','Q','R','S','T'],
  ['U','V','W','X','Y','Z'],
];

export default function KeyboardRemote() {
  const [connected,  setConnected]  = useState(false);
  const [sessionId,  setSessionId]  = useState('');
  const [feedback,   setFeedback]   = useState('');
  const [pressed,    setPressed]    = useState(null);
  const [landscape,  setLandscape]  = useState(false);
  // État du jeu vu depuis le téléphone
  const [gameState,  setGameState]  = useState('idle'); // idle | playing | finished

  const channelRef    = useRef(null);
  const connectedRef  = useRef(false);
  // Flag anti-double-appel touch+mouse
  const touchFiredRef = useRef(false);

  useEffect(() => { connectedRef.current = connected; }, [connected]);

  // Orientation
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 300));
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-connect via QR code
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('session');
    if (sid) { setSessionId(sid); doConnect(sid); }
  }, []); // eslint-disable-line

  const doConnect = useCallback((id) => {
    if (!id) return;
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);

    const ch = createKeyboardChannel(id)
      // Écouter les changements d'état du jeu (TV → téléphone)
      .on('broadcast', { event: 'game_state' }, ({ payload }) => {
        setGameState(payload.state);
      })
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        connectedRef.current = ok;
        if (ok) { showFeedback('✅ Connecté !', 2000); logger.info('Remote connecté', { id }); }
      });

    channelRef.current = ch;
  }, []); // eslint-disable-line

  const showFeedback = (msg, ms) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), ms);
  };

  // ── Envoi d'une commande de jeu (start / replay) ──
  const sendControl = useCallback((action) => {
    if (!connectedRef.current || !channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'game_control', payload: { action } });
    logger.debug('Control sent', { action });
  }, []);

  // ── Envoi d'une touche — avec protection anti-double-appel ──
  const sendKey = useCallback((key, fromTouch) => {
    // Si l'événement vient du mouse mais qu'un touch vient d'être traité → ignorer
    if (!fromTouch && touchFiredRef.current) return;

    if (!connectedRef.current || !channelRef.current) {
      showFeedback('⚠️ Connecte-toi d\'abord', 1200);
      return;
    }
    key === '⌫' ? playDelete() : playKey();
    if (navigator.vibrate) navigator.vibrate(7);

    setPressed(key);
    setTimeout(() => setPressed(null), 110);

    channelRef.current.send({ type: 'broadcast', event: 'key', payload: { key } });
    logger.debug('Key sent', { key });
  }, []);

  const handleTouchKey = useCallback((e, key) => {
    e.preventDefault();
    touchFiredRef.current = true;
    // Réinitialiser le flag après que mousedown ne puisse plus se déclencher
    setTimeout(() => { touchFiredRef.current = false; }, 500);
    sendKey(key, true);
  }, [sendKey]);

  const handleMouseKey = useCallback((e, key) => {
    e.preventDefault();
    sendKey(key, false);
  }, [sendKey]);

  useEffect(() => () => channelRef.current?.unsubscribe(), []);

  const kStyle = (key) => {
    const p = pressed === key;
    const isDel   = key === '⌫';
    const isSpace = key === '␣';
    return {
      flex: (isDel || isSpace) ? 1.6 : 1,
      padding: landscape ? '9px 2px' : '15px 2px',
      backgroundColor: p ? (isDel ? 'rgba(255,107,107,0.4)' : 'rgba(254,202,87,0.35)') : (isDel ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.08)'),
      border: `1px solid ${p ? (isDel ? 'rgba(255,107,107,0.6)' : 'rgba(254,202,87,0.5)') : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 7,
      color: p ? (isDel ? '#ff9090' : '#feca57') : (isDel ? '#ff6b6b' : '#fff'),
      fontSize: landscape ? 13 : 17,
      fontFamily: 'monospace',
      textAlign: 'center',
      cursor: 'pointer',
      touchAction: 'manipulation',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background 0.07s, transform 0.07s',
      transform: p ? 'scale(0.9)' : 'scale(1)',
    };
  };

  const ctrlBtnStyle = (color) => ({
    width: '100%',
    padding: landscape ? '10px' : '14px',
    backgroundColor: color,
    color: '#0f0f1a',
    border: 'none',
    borderRadius: 10,
    fontSize: landscape ? 14 : 17,
    fontWeight: 'bold',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#0f0f1a', color:'#fff', padding: landscape ? '6px 12px' : '10px', boxSizing:'border-box', overflow:'hidden', fontFamily:'system-ui,sans-serif', touchAction:'none', position:'relative' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: landscape ? 5 : 8, flexShrink:0 }}>
        <span style={{ fontSize: landscape ? 12 : 15, color:'#feca57' }}>⌨️ Keyboard Master</span>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          {sessionId && (
            <span style={{ fontSize: landscape ? 8 : 9, color:'#333', fontFamily:'monospace', letterSpacing: 1 }}>
              #{sessionId}
            </span>
          )}
          <span style={{ fontSize:9, color: connected ? '#50fa7b' : '#ff6b6b' }}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign:'center', fontSize: landscape ? 10 : 12, color: feedback.includes('✅')?'#50fa7b':'#feca57', marginBottom: landscape ? 3 : 5, flexShrink:0 }}>
          {feedback}
        </div>
      )}

      {/* Message si pas connecté */}
      {!connected && (
        <div style={{ textAlign:'center', color:'#555', fontSize: landscape ? 11 : 13, marginBottom: landscape ? 5 : 10, flexShrink:0, padding: '8px 0' }}>
          📷 Scanne le QR code sur la TV pour jouer
        </div>
      )}

      {/* ── Zone de contrôle du jeu ── */}
      {connected && gameState === 'idle' && (
        <div style={{ flexShrink:0, marginBottom: landscape ? 6 : 10, maxWidth:400, margin:'0 auto 10px', width:'100%' }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendControl('start'); }}
            onMouseDown={(e) => { if (!touchFiredRef.current) { e.preventDefault(); sendControl('start'); } }}
            style={ctrlBtnStyle('#feca57')}
          >
            🚀 Démarrer le jeu
          </button>
        </div>
      )}

      {connected && gameState === 'finished' && (
        <div style={{ flexShrink:0, marginBottom: landscape ? 6 : 10, maxWidth:400, margin:'0 auto 10px', width:'100%' }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendControl('replay'); }}
            onMouseDown={(e) => { if (!touchFiredRef.current) { e.preventDefault(); sendControl('replay'); } }}
            style={ctrlBtnStyle('#50fa7b')}
          >
            🔄 Rejouer
          </button>
        </div>
      )}

      {connected && gameState === 'playing' && (
        <div style={{ flexShrink:0, marginBottom: landscape ? 4 : 7, textAlign:'center' }}>
          <span style={{ fontSize: landscape ? 10 : 12, color:'#50fa7b' }}>🎮 Jeu en cours — tape !</span>
        </div>
      )}

      {/* Clavier */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap: landscape ? 3 : 5, maxWidth:560, margin:'0 auto', width:'100%' }}>
        {ROWS.map((row, i) => (
          <div key={i} style={{ display:'flex', gap: landscape ? 3 : 5 }}>
            {row.map(key => (
              <button key={key}
                onTouchStart={(e) => handleTouchKey(e, key)}
                onMouseDown={(e)  => handleMouseKey(e, key)}
                style={kStyle(key)}
              >{key}</button>
            ))}
          </div>
        ))}

        <div style={{ display:'flex', gap: landscape ? 3 : 5 }}>
          <button
            onTouchStart={(e) => handleTouchKey(e, '␣')}
            onMouseDown={(e)  => handleMouseKey(e, '␣')}
            style={{ ...kStyle('␣'), flex:2, color: pressed==='␣'?'#feca57':'#555', fontSize: landscape ? 10 : 12 }}
          >ESPACE</button>
          <button
            onTouchStart={(e) => handleTouchKey(e, '⌫')}
            onMouseDown={(e)  => handleMouseKey(e, '⌫')}
            style={{ ...kStyle('⌫'), flex:1, fontSize: landscape ? 17 : 21 }}
          >⌫</button>
        </div>
      </div>
    </div>
  );
}
