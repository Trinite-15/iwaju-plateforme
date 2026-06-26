// KeyboardRemote.jsx — Clavier AZERTY mobile complet
import { useState, useEffect, useRef, useCallback } from 'react';
import { createKeyboardChannel } from '../../supabaseClient';
import { logger } from '../../../../logger';

function beep(freq1, freq2, dur) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq1, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.type = 'sine'; osc.start(); osc.stop(ctx.currentTime + dur);
    osc.onended = () => ctx.close();
  } catch (_) {}
}
const playKey    = () => beep(700, 350, 0.06);
const playDelete = () => beep(280, 140, 0.08);
const playShift  = () => beep(500, 600, 0.05);

// ── Layouts ────────────────────────────────────────────────────
const LAYOUT_LETTERS = [
  ['a','z','e','r','t','y','u','i','o','p'],
  ['q','s','d','f','g','h','j','k','l','m'],
  ['w','x','c','v','b','n'],
];

// Symboles et chiffres (layout 123)
const LAYOUT_NUMBERS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['-','/',':',';','(',')','€','&','@','"'],
  ['.',',','?','!','\''],
];

// Accents disponibles par lettre (appui long)
const ACCENTS = {
  a: ['à','â','ä','æ'],
  e: ['é','è','ê','ë'],
  i: ['î','ï'],
  o: ['ô','ö','œ'],
  u: ['ù','û','ü'],
  c: ['ç'],
  n: ['ñ'],
  A: ['À','Â','Ä','Æ'],
  E: ['É','È','Ê','Ë'],
  I: ['Î','Ï'],
  O: ['Ô','Ö','Œ'],
  U: ['Ù','Û','Ü'],
  C: ['Ç'],
  N: ['Ñ'],
};

// Shift sur symboles → symboles alternatifs
const LAYOUT_SYMBOLS = [
  ['[',']','{','}','#','%','^','*','+','='],
  ['_','\\','|','~','<','>','$','£','¥','•'],
  ['.',',','?','!','\''],
];

export default function KeyboardRemote() {
  const [connected,   setConnected]   = useState(false);
  const [sessionId,   setSessionId]   = useState('');
  const [feedback,    setFeedback]    = useState('');
  const [gameState,   setGameState]   = useState('idle');

  // État clavier
  const [layout,      setLayout]      = useState('letters'); // 'letters' | 'numbers' | 'symbols'
  const [shifted,     setShifted]     = useState(false);     // majuscule
  const [capsLock,    setCapsLock]    = useState(false);     // verr. maj
  const [accentMenu,  setAccentMenu]  = useState(null);      // { key, options, x, y }
  const [pressed,     setPressed]     = useState(null);

  const channelRef    = useRef(null);
  const connectedRef  = useRef(false);
  const longPressRef  = useRef(null);   // timeout appui long
  const touchFiredRef = useRef(false);

  useEffect(() => { connectedRef.current = connected; }, [connected]);

  // Auto-connect QR
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

  const sendControl = useCallback((action) => {
    if (!connectedRef.current || !channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'game_control', payload: { action } });
  }, []);

  // ── Envoi touche ───────────────────────────────────────────
  const sendKey = useCallback((key) => {
    if (!connectedRef.current || !channelRef.current) {
      showFeedback('⚠️ Connecte-toi d\'abord', 1200);
      return;
    }
    key === '⌫' ? playDelete() : playKey();
    if (navigator.vibrate) navigator.vibrate(8);
    setPressed(key);
    setTimeout(() => setPressed(null), 110);
    channelRef.current.send({ type: 'broadcast', event: 'key', payload: { key } });
    logger.debug('Key sent', { key });

    // Après envoi : désactiver shift (sauf capslock)
    if (shifted && !capsLock && layout === 'letters') setShifted(false);
  }, [shifted, capsLock, layout]);

  // ── Gestion shift / caps ───────────────────────────────────
  const handleShift = () => {
    playShift();
    if (!shifted && !capsLock) {
      setShifted(true);
    } else if (shifted && !capsLock) {
      setShifted(false);
    } else if (capsLock) {
      setCapsLock(false);
      setShifted(false);
    }
  };

  const handleShiftDoubleTap = () => {
    playShift();
    setCapsLock(true);
    setShifted(true);
  };

  // ── Appui long → menu accents ──────────────────────────────
  const startLongPress = useCallback((key, el) => {
    const base = shifted || capsLock ? key.toUpperCase() : key.toLowerCase();
    const options = ACCENTS[base];
    if (!options || options.length === 0) return;

    longPressRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      const rect = el.getBoundingClientRect();
      setAccentMenu({
        key: base,
        options,
        x: Math.min(rect.left, window.innerWidth - options.length * 44 - 8),
        y: rect.top - 60,
      });
    }, 400);
  }, [shifted, capsLock]);

  const cancelLongPress = () => {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  const pickAccent = (char) => {
    setAccentMenu(null);
    sendKey(char);
  };

  useEffect(() => () => channelRef.current?.unsubscribe(), []);

  // ── Calcul lettre affichée selon shift/caps ────────────────
  const displayKey = (k) => {
    if (layout !== 'letters') return k;
    return (shifted || capsLock) ? k.toUpperCase() : k;
  };

  // ── Styles ─────────────────────────────────────────────────
  const keyBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, cursor: 'pointer',
    touchAction: 'manipulation', userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    fontFamily: 'system-ui, sans-serif',
    transition: 'background 0.07s, transform 0.07s',
    border: '1px solid rgba(255,255,255,0.08)',
    minHeight: 44,
  };

  const letterKey = (k, extraStyle = {}) => {
    const display = displayKey(k);
    const p = pressed === display || pressed === k;
    const hasAccent = !!(ACCENTS[k] || ACCENTS[k?.toUpperCase()]);
    return (
      <div
        key={k}
        style={{
          ...keyBase,
          flex: 1,
          backgroundColor: p ? 'rgba(254,202,87,0.3)' : 'rgba(255,255,255,0.09)',
          color: p ? '#feca57' : '#fff',
          fontSize: 18,
          fontWeight: '500',
          transform: p ? 'scale(0.91)' : 'scale(1)',
          position: 'relative',
          ...extraStyle,
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          touchFiredRef.current = true;
          setTimeout(() => { touchFiredRef.current = false; }, 500);
          startLongPress(k, e.currentTarget);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          cancelLongPress();
          if (!accentMenu) sendKey(display);
        }}
        onMouseDown={(e) => {
          if (touchFiredRef.current) return;
          e.preventDefault();
          startLongPress(k, e.currentTarget);
        }}
        onMouseUp={(e) => {
          if (touchFiredRef.current) return;
          cancelLongPress();
          if (!accentMenu) sendKey(display);
        }}
      >
        {display}
        {hasAccent && (
          <span style={{ position:'absolute', top:2, right:3, fontSize:6, color:'rgba(255,255,255,0.3)', lineHeight:1 }}>·</span>
        )}
      </div>
    );
  };

  const specialKey = (label, onPress, extraStyle = {}, labelStyle = {}) => {
    const p = pressed === label;
    return (
      <div
        key={label}
        style={{
          ...keyBase,
          backgroundColor: p ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
          color: '#aaa',
          fontSize: 13,
          fontWeight: '600',
          padding: '0 8px',
          minWidth: 42,
          transform: p ? 'scale(0.91)' : 'scale(1)',
          ...extraStyle,
        }}
        onTouchStart={(e) => { e.preventDefault(); touchFiredRef.current = true; setTimeout(() => { touchFiredRef.current = false; }, 500); setPressed(label); }}
        onTouchEnd={(e) => { e.preventDefault(); setPressed(null); onPress(); }}
        onMouseDown={(e) => { if (touchFiredRef.current) return; e.preventDefault(); setPressed(label); }}
        onMouseUp={(e) => { if (touchFiredRef.current) return; setPressed(null); onPress(); }}
      >
        <span style={labelStyle}>{label}</span>
      </div>
    );
  };

  // ── Rendu clavier selon layout ─────────────────────────────
  const renderLetterLayout = () => {
    const gap = 4;
    return (
      <>
        {LAYOUT_LETTERS.map((row, i) => (
          <div key={i} style={{ display:'flex', gap, justifyContent:'center' }}>
            {row.map(k => letterKey(k))}
          </div>
        ))}
        {/* Rangée bas : shift, w, x, c, v, b, n, backspace */}
        <div style={{ display:'flex', gap, justifyContent:'center' }}>
          {specialKey(
            capsLock ? '⇪' : shifted ? '⇧' : '⇧',
            handleShift,
            {
              backgroundColor: capsLock ? 'rgba(254,202,87,0.3)' : shifted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
              color: capsLock ? '#feca57' : shifted ? '#fff' : '#aaa',
              minWidth: 44,
            },
            { fontSize: 20 }
          )}
          {LAYOUT_LETTERS[2].map(k => letterKey(k))}
          {specialKey('⌫', () => sendKey('⌫'), {
            backgroundColor: 'rgba(255,107,107,0.12)',
            color: '#ff6b6b',
            minWidth: 44,
          }, { fontSize: 20 })}
        </div>
        {/* Rangée bas : 123, espace, . , entrée */}
        <div style={{ display:'flex', gap }}>
          {specialKey('123', () => setLayout('numbers'), { flex:1 })}
          {specialKey('ESPACE', () => sendKey(' '), { flex:3, color:'#888', fontSize:11 })}
          {specialKey('.', () => sendKey('.'), { flex:0.7, color:'#ccc', fontSize:18 })}
          {specialKey('↵', () => sendKey('\n'), { flex:1, color:'#8be9fd', fontSize:20 })}
        </div>
      </>
    );
  };

  const renderNumberLayout = () => {
    const currentLayout = layout === 'symbols' ? LAYOUT_SYMBOLS : LAYOUT_NUMBERS;
    const gap = 4;
    return (
      <>
        {currentLayout.slice(0,2).map((row, i) => (
          <div key={i} style={{ display:'flex', gap, justifyContent:'center' }}>
            {row.map(k => {
              const p = pressed === k;
              return (
                <div key={k} style={{ ...keyBase, flex:1, backgroundColor: p ? 'rgba(254,202,87,0.3)' : 'rgba(255,255,255,0.09)', color: p ? '#feca57' : '#fff', fontSize:16, transform: p ? 'scale(0.91)' : 'scale(1)' }}
                  onTouchStart={(e) => { e.preventDefault(); touchFiredRef.current = true; setTimeout(() => { touchFiredRef.current = false; }, 500); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey(k); }}
                  onMouseDown={(e) => { if (touchFiredRef.current) return; e.preventDefault(); }}
                  onMouseUp={(e) => { if (touchFiredRef.current) return; sendKey(k); }}
                >{k}</div>
              );
            })}
          </div>
        ))}
        {/* Rangée bas symboles */}
        <div style={{ display:'flex', gap, justifyContent:'center' }}>
          {specialKey(layout === 'symbols' ? '123' : '#+', () => setLayout(layout === 'symbols' ? 'numbers' : 'symbols'), { minWidth:44 })}
          {currentLayout[2].map(k => {
            const p = pressed === k;
            return (
              <div key={k} style={{ ...keyBase, flex:1, backgroundColor: p ? 'rgba(254,202,87,0.3)' : 'rgba(255,255,255,0.09)', color: p ? '#feca57' : '#fff', fontSize:16, transform: p ? 'scale(0.91)' : 'scale(1)' }}
                onTouchStart={(e) => { e.preventDefault(); touchFiredRef.current = true; setTimeout(() => { touchFiredRef.current = false; }, 500); }}
                onTouchEnd={(e) => { e.preventDefault(); sendKey(k); }}
                onMouseDown={(e) => { if (touchFiredRef.current) return; e.preventDefault(); }}
                onMouseUp={(e) => { if (touchFiredRef.current) return; sendKey(k); }}
              >{k}</div>
            );
          })}
          {specialKey('⌫', () => sendKey('⌫'), { backgroundColor:'rgba(255,107,107,0.12)', color:'#ff6b6b', minWidth:44 }, { fontSize:20 })}
        </div>
        {/* Rangée bas */}
        <div style={{ display:'flex', gap }}>
          {specialKey('ABC', () => setLayout('letters'), { flex:1 })}
          {specialKey('ESPACE', () => sendKey(' '), { flex:3, color:'#888', fontSize:11 })}
          {specialKey('.', () => sendKey('.'), { flex:0.7, color:'#ccc', fontSize:18 })}
          {specialKey('↵', () => sendKey('\n'), { flex:1, color:'#8be9fd', fontSize:20 })}
        </div>
      </>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#1a1a2e', color:'#fff', padding:'8px 6px 4px', boxSizing:'border-box', overflow:'hidden', fontFamily:'system-ui,sans-serif', touchAction:'none', userSelect:'none' }}>

      {/* Header compact */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexShrink:0, padding:'0 4px' }}>
        <span style={{ fontSize:13, color:'#feca57', fontWeight:'bold' }}>⌨️ Keyboard Master</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {sessionId && <span style={{ fontSize:9, color:'#333', fontFamily:'monospace', letterSpacing:1 }}>#{sessionId}</span>}
          <span style={{ fontSize:9, color: connected ? '#50fa7b' : '#ff6b6b' }}>{connected ? '● Connecté' : '○ Déco'}</span>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign:'center', fontSize:11, color: feedback.includes('✅') ? '#50fa7b' : '#feca57', marginBottom:4, flexShrink:0 }}>
          {feedback}
        </div>
      )}

      {/* Connexion si pas connecté */}
      {!connected && (
        <div style={{ display:'flex', gap:6, marginBottom:8, flexShrink:0 }}>
          <input
            type="text"
            placeholder="Code session"
            value={sessionId}
            onChange={e => setSessionId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
            maxLength={8}
            style={{ flex:1, padding:'6px 10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#fff', fontSize:13, outline:'none', fontFamily:'monospace', letterSpacing:2 }}
          />
          <button
            onTouchStart={(e) => { e.preventDefault(); doConnect(sessionId); }}
            onMouseDown={(e) => { e.preventDefault(); doConnect(sessionId); }}
            style={{ padding:'6px 16px', background:'#50fa7b', color:'#0f0f1a', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:'bold' }}
          >Connecter</button>
        </div>
      )}

      {/* Boutons contrôle jeu */}
      {connected && gameState === 'idle' && (
        <div style={{ flexShrink:0, marginBottom:8 }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendControl('start'); }}
            onMouseDown={(e) => { e.preventDefault(); sendControl('start'); }}
            style={{ width:'100%', padding:12, backgroundColor:'#feca57', color:'#0f0f1a', border:'none', borderRadius:10, fontSize:16, fontWeight:'bold', cursor:'pointer', touchAction:'manipulation' }}
          >🚀 Démarrer le jeu</button>
        </div>
      )}

      {connected && gameState === 'finished' && (
        <div style={{ flexShrink:0, marginBottom:8 }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendControl('replay'); }}
            onMouseDown={(e) => { e.preventDefault(); sendControl('replay'); }}
            style={{ width:'100%', padding:12, backgroundColor:'#50fa7b', color:'#0f0f1a', border:'none', borderRadius:10, fontSize:16, fontWeight:'bold', cursor:'pointer', touchAction:'manipulation' }}
          >🔄 Rejouer</button>
        </div>
      )}

      {connected && gameState === 'playing' && (
        <div style={{ flexShrink:0, marginBottom:6, textAlign:'center' }}>
          <span style={{ fontSize:11, color:'#50fa7b' }}>🎮 Jeu en cours</span>
        </div>
      )}

      {/* Clavier */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:4, maxWidth:560, margin:'0 auto', width:'100%' }}>
        {layout === 'letters' ? renderLetterLayout() : renderNumberLayout()}
      </div>

      {/* Menu accents (appui long) */}
      {accentMenu && (
        <>
          {/* Overlay pour fermer */}
          <div
            style={{ position:'fixed', inset:0, zIndex:99 }}
            onTouchStart={() => setAccentMenu(null)}
            onMouseDown={() => setAccentMenu(null)}
          />
          {/* Popup accents */}
          <div style={{
            position: 'fixed',
            left: accentMenu.x,
            top: accentMenu.y,
            zIndex: 100,
            display: 'flex',
            gap: 4,
            background: '#2a2a3e',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            {accentMenu.options.map(char => (
              <div
                key={char}
                style={{ width:40, height:44, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:7, backgroundColor:'rgba(255,255,255,0.1)', color:'#fff', fontSize:20, cursor:'pointer', fontFamily:'system-ui' }}
                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); pickAccent(char); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pickAccent(char); }}
              >{char}</div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 4px 0', fontSize:7, color:'#222', borderTop:'1px solid rgba(255,255,255,0.04)', marginTop:3, flexShrink:0 }}>
        <span>Scanne le QR sur la TV</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}
