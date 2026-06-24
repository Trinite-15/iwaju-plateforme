// KeyboardRemote.jsx — Clavier smartphone
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate    = useNavigate();
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [feedback,  setFeedback]  = useState('');
  const [pressed,   setPressed]   = useState(null);
  const [landscape, setLandscape] = useState(false);
  const channelRef = useRef(null);
  const connectedRef = useRef(false); // ref pour sendKey

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

  const handleConnect = () => {
    const id = sessionId.trim();
    if (!id) { showFeedback('⚠️ Entre un code', 1500); return; }
    doConnect(id);
  };

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
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#0f0f1a', color:'#fff', padding: landscape ? '6px 12px' : '10px', boxSizing:'border-box', overflow:'hidden', fontFamily:'system-ui,sans-serif', touchAction:'none' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: landscape ? 5 : 8, flexShrink:0 }}>
        <button onClick={() => navigate('/')} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#555', padding: landscape ? '3px 8px' : '5px 11px', borderRadius:6, cursor:'pointer', fontSize: landscape ? 10 : 12 }}>←</button>
        <span style={{ fontSize: landscape ? 12 : 15, color:'#feca57' }}>⌨️ Keyboard Master</span>
        <span style={{ fontSize:9, color: connected ? '#50fa7b' : '#ff6b6b' }}>{connected ? '● Connecté' : '○ Déconnecté'}</span>
      </div>

      {/* Connexion */}
      <div style={{ display:'flex', gap:6, marginBottom: landscape ? 4 : 7, flexShrink:0 }}>
        <input
          type="text"
          placeholder="Code session (ex: A1B2C3)"
          value={sessionId}
          onChange={e => setSessionId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
          maxLength={8}
          style={{ flex:1, padding: landscape ? '4px 8px' : '6px 10px', background:`rgba(255,255,255,${connected?'0.08':'0.05'})`, border:`1px solid ${connected?'rgba(80,250,123,0.35)':'rgba(255,255,255,0.1)'}`, borderRadius:6, color:'#fff', fontSize: landscape ? 11 : 13, outline:'none', fontFamily:'monospace', letterSpacing:2, textTransform:'uppercase' }}
        />
        {!connected
          ? <button onClick={handleConnect}    style={{ padding: landscape ? '4px 12px' : '6px 16px', background:'#50fa7b', color:'#0f0f1a', border:'none', borderRadius:6, cursor:'pointer', fontSize: landscape ? 11 : 13, fontWeight:'bold', whiteSpace:'nowrap' }}>Connecter</button>
          : <button onClick={handleDisconnect} style={{ padding: landscape ? '4px 10px' : '6px 14px', background:'rgba(255,107,107,0.2)', color:'#ff6b6b', border:'1px solid rgba(255,107,107,0.3)', borderRadius:6, cursor:'pointer', fontSize: landscape ? 11 : 13, whiteSpace:'nowrap' }}>Déco</button>
        }
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign:'center', fontSize: landscape ? 10 : 12, color: feedback.includes('✅')?'#50fa7b':feedback.includes('🔌')?'#888':'#feca57', marginBottom: landscape ? 3 : 5, flexShrink:0 }}>
          {feedback}
        </div>
      )}

      {/* Message si pas connecté */}
      {!connected && (
        <div style={{ textAlign:'center', color:'#333', fontSize: landscape ? 10 : 12, marginBottom: landscape ? 3 : 5, flexShrink:0 }}>
          Entre le code affiché sur l'écran PC/TV et clique <strong style={{ color:'#50fa7b' }}>Connecter</strong>
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

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', padding: landscape ? '3px 0' : '5px 0', fontSize:7, color:'#222', borderTop:'1px solid rgba(255,255,255,0.04)', marginTop: landscape ? 3 : 5, flexShrink:0 }}>
        <span>Scanne le QR sur la TV ou entre le code</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}
