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
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [feedback,  setFeedback]  = useState('');
  const [pressed,   setPressed]   = useState(null);
  const [landscape, setLandscape] = useState(false);
  const channelRef = useRef(null);
  const connectedRef = useRef(false);

  // Sync ref
  useEffect(() => { connectedRef.current = connected; }, [connected]);

  // Orientation
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 300));
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-connect si session dans l'URL (QR code scanné)
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('session');
    if (sid) {
      setSessionId(sid);
      doConnect(sid);
    }
  }, []); // eslint-disable-line

  const doConnect = useCallback((id) => {
    if (!id) return;
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);

    const ch = createKeyboardChannel(id)
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        connectedRef.current = ok;
        if (ok) {
          showFeedback('✅ Connecté !', 2000);
          logger.info('Remote connecté', { id });
        }
      });

    channelRef.current = ch;
  }, []); // eslint-disable-line

  const handleDisconnect = () => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
    connectedRef.current = false;
    showFeedback('🔌 Déconnecté', 1500);
  };

  const showFeedback = (msg, ms) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), ms);
  };

  // ── Envoi d'une touche — UNIQUEMENT via Supabase, pas de texte local ──
  const sendKey = useCallback((key) => {
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

  useEffect(() => () => channelRef.current?.unsubscribe(), []);

  // Style d'une touche
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

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#0f0f1a', color:'#fff', padding: landscape ? '6px 12px' : '10px', boxSizing:'border-box', overflow:'hidden', fontFamily:'system-ui,sans-serif', touchAction:'none', position:'relative' }}>

      {/* Header — sans bouton retour */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: landscape ? 5 : 8, flexShrink:0 }}>
        <span style={{ fontSize: landscape ? 12 : 15, color:'#feca57' }}>⌨️ Keyboard Master</span>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          {/* Code session affiché discrètement */}
          {sessionId && (
            <span style={{ fontSize: landscape ? 8 : 9, color:'#333', fontFamily:'monospace', letterSpacing: 1 }}>
              #{sessionId}
            </span>
          )}
          <span style={{ fontSize:9, color: connected ? '#50fa7b' : '#ff6b6b' }}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </span>
          {connected && (
            <button onClick={handleDisconnect} style={{ padding: landscape ? '3px 8px' : '4px 10px', background:'rgba(255,107,107,0.15)', color:'#ff6b6b', border:'1px solid rgba(255,107,107,0.3)', borderRadius:6, cursor:'pointer', fontSize: landscape ? 9 : 11 }}>
              Déco
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign:'center', fontSize: landscape ? 10 : 12, color: feedback.includes('✅')?'#50fa7b':feedback.includes('🔌')?'#888':'#feca57', marginBottom: landscape ? 3 : 5, flexShrink:0 }}>
          {feedback}
        </div>
      )}

      {/* Message si pas connecté */}
      {!connected && (
        <div style={{ textAlign:'center', color:'#555', fontSize: landscape ? 11 : 13, marginBottom: landscape ? 5 : 10, flexShrink:0, padding: '8px 0' }}>
          📷 Scanne le QR code sur la TV pour jouer
        </div>
      )}

      {/* Clavier */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap: landscape ? 3 : 5, maxWidth:560, margin:'0 auto', width:'100%' }}>
        {ROWS.map((row, i) => (
          <div key={i} style={{ display:'flex', gap: landscape ? 3 : 5 }}>
            {row.map(key => (
              <button key={key}
                onTouchStart={e => { e.preventDefault(); sendKey(key); }}
                onMouseDown={e  => { e.preventDefault(); sendKey(key); }}
                style={kStyle(key)}
              >{key}</button>
            ))}
          </div>
        ))}

        {/* Espace + Backspace */}
        <div style={{ display:'flex', gap: landscape ? 3 : 5 }}>
          <button
            onTouchStart={e => { e.preventDefault(); sendKey('␣'); }}
            onMouseDown={e  => { e.preventDefault(); sendKey('␣'); }}
            style={{ ...kStyle('␣'), flex:2, color: pressed==='␣'?'#feca57':'#555', fontSize: landscape ? 10 : 12 }}
          >ESPACE</button>
          <button
            onTouchStart={e => { e.preventDefault(); sendKey('⌫'); }}
            onMouseDown={e  => { e.preventDefault(); sendKey('⌫'); }}
            style={{ ...kStyle('⌫'), flex:1, fontSize: landscape ? 17 : 21 }}
          >⌫</button>
        </div>
      </div>
    </div>
  );
}
