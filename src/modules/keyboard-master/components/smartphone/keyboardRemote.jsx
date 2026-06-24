import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createKeyboardChannel } from '../../supabaseClient';
import { generateCode } from '../../utils/generateCode';
import { logger } from '../../../../logger';

function playKeySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.type = 'sine'; osc.start(); osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => ctx.close();
  } catch (e) {}
}

function playDeleteSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.type = 'sine'; osc.start(); osc.stop(ctx.currentTime + 0.09);
    osc.onended = () => ctx.close();
  } catch (e) {}
}

const ROWS = [
  ['A','B','C','D','E','F','G','H','I','J'],
  ['K','L','M','N','O','P','Q','R','S','T'],
  ['U','V','W','X','Y','Z'],
];

export default function KeyboardRemote() {
  const navigate = useNavigate();
  const [connected,   setConnected]   = useState(false);
  const [sessionId,   setSessionId]   = useState('');
  const [feedback,    setFeedback]    = useState('');
  const [pressedKey,  setPressedKey]  = useState(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const channelRef = useRef(null);

  // Orientation
  useEffect(() => {
    const detect = () => setIsLandscape(window.innerWidth > window.innerHeight);
    detect();
    window.addEventListener('resize', detect);
    window.addEventListener('orientationchange', () => setTimeout(detect, 300));
    return () => { window.removeEventListener('resize', detect); };
  }, []);

  // Lire session dans l'URL au montage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) {
      setSessionId(sid);
      connectWithId(sid);
    }
  }, []); // eslint-disable-line

  const connectWithId = useCallback((id) => {
    if (!id) return;
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    const channel = createKeyboardChannel(id)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          setFeedback('✅ Connecté !');
          logger.info('KeyboardRemote connecté', { id });
          setTimeout(() => setFeedback(''), 2000);
        } else {
          setConnected(false);
          logger.warn('KeyboardRemote', { status });
        }
      });

    channelRef.current = channel;
  }, []);

  const connect = () => {
    const id = sessionId.trim() || generateCode();
    setSessionId(id);
    connectWithId(id);
  };

  const disconnect = () => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
    setFeedback('🔌 Déconnecté');
    setTimeout(() => setFeedback(''), 2000);
  };

  // sendKey : envoie UNIQUEMENT via Supabase, pas de setText local
  const sendKey = useCallback((key) => {
    if (!connected || !channelRef.current) {
      setFeedback('⚠️ Connecte-toi d\'abord');
      setTimeout(() => setFeedback(''), 1500);
      return;
    }

    key === '⌫' ? playDeleteSound() : playKeySound();
    if (navigator.vibrate) navigator.vibrate(8);

    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 110);

    channelRef.current.send({
      type: 'broadcast',
      event: 'key',
      payload: { key },
    });

    logger.debug('Touche envoyée', { key });
  }, [connected]);

  useEffect(() => () => channelRef.current?.unsubscribe(), []);

  const keyStyle = (key) => {
    const isPressed = pressedKey === key;
    const isDelete = key === '⌫';
    const isSpace = key === '␣';
    return {
      flex: (isDelete || isSpace) ? 1.6 : 1,
      padding: isLandscape ? '10px 2px' : '16px 2px',
      backgroundColor: isPressed
        ? (isDelete ? 'rgba(255,107,107,0.4)' : 'rgba(254,202,87,0.35)')
        : (isDelete ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.08)'),
      border: `1px solid ${isPressed
        ? (isDelete ? 'rgba(255,107,107,0.6)' : 'rgba(254,202,87,0.5)')
        : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '7px',
      color: isPressed ? (isDelete ? '#ff9090' : '#feca57') : (isDelete ? '#ff6b6b' : '#fff'),
      fontSize: isLandscape ? '14px' : '18px',
      cursor: 'pointer',
      fontFamily: 'monospace',
      textAlign: 'center',
      touchAction: 'manipulation',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background-color 0.08s, transform 0.08s',
      transform: isPressed ? 'scale(0.91)' : 'scale(1)',
    };
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: '#0f0f1a', color: '#fff',
      padding: isLandscape ? '6px 14px' : '10px 12px',
      boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif', touchAction: 'none',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLandscape ? '5px' : '8px', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555', padding: isLandscape ? '3px 9px' : '5px 11px', borderRadius: '6px', cursor: 'pointer', fontSize: isLandscape ? '10px' : '12px' }}>←</button>
        <span style={{ fontSize: isLandscape ? '12px' : '15px', color: '#feca57' }}>⌨️ Keyboard Master</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '8px', color: connected ? '#50fa7b' : '#ff6b6b' }}>{connected ? '●' : '○'}</span>
          <span style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace' }}>{sessionId || '---'}</span>
        </div>
      </div>

      {/* Connexion */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: isLandscape ? '5px' : '8px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Code session (ex: A1B2C3)"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          style={{ flex: 1, padding: isLandscape ? '4px 8px' : '6px 10px', backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${connected ? 'rgba(80,250,123,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: '#fff', fontSize: isLandscape ? '11px' : '13px', outline: 'none', fontFamily: 'monospace', letterSpacing: '2px' }}
        />
        {!connected
          ? <button onClick={connect} style={{ padding: isLandscape ? '4px 12px' : '6px 16px', backgroundColor: '#50fa7b', color: '#0f0f1a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: isLandscape ? '11px' : '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Connecter</button>
          : <button onClick={disconnect} style={{ padding: isLandscape ? '4px 12px' : '6px 16px', backgroundColor: 'rgba(255,107,107,0.2)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: isLandscape ? '11px' : '13px', whiteSpace: 'nowrap' }}>Déco</button>
        }
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign: 'center', fontSize: '11px', color: feedback.includes('✅') ? '#50fa7b' : '#feca57', marginBottom: isLandscape ? '3px' : '5px', flexShrink: 0 }}>
          {feedback}
        </div>
      )}

      {/* Clavier */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isLandscape ? '4px' : '5px', maxWidth: '560px', margin: '0 auto', width: '100%' }}>
        {ROWS.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: isLandscape ? '3px' : '5px' }}>
            {row.map(key => (
              <button key={key}
                onTouchStart={(e) => { e.preventDefault(); sendKey(key); }}
                onMouseDown={(e) => { e.preventDefault(); sendKey(key); }}
                style={keyStyle(key)}
              >{key}</button>
            ))}
          </div>
        ))}
        {/* Rangée espace + backspace */}
        <div style={{ display: 'flex', gap: isLandscape ? '3px' : '5px' }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendKey('␣'); }}
            onMouseDown={(e) => { e.preventDefault(); sendKey('␣'); }}
            style={{ ...keyStyle('␣'), flex: 2, fontSize: isLandscape ? '11px' : '13px', color: pressedKey === '␣' ? '#feca57' : '#666' }}
          >ESPACE</button>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendKey('⌫'); }}
            onMouseDown={(e) => { e.preventDefault(); sendKey('⌫'); }}
            style={{ ...keyStyle('⌫'), flex: 1, fontSize: isLandscape ? '18px' : '22px' }}
          >⌫</button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: isLandscape ? '3px 0' : '5px 0', fontSize: '7px', color: '#222', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: isLandscape ? '3px' : '5px', flexShrink: 0 }}>
        <span>Scanne le QR sur la TV</span>
        <span>{isLandscape ? '🌅' : '📱'}</span>
        <span>{sessionId || '---'}</span>
      </div>
    </div>
  );
}
