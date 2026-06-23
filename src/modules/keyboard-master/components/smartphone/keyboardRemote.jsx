import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createKeyboardChannel } from '../../supabaseClient';
import { generateCode } from '../../utils/generateCode';
import logger from '../../../../logger';

// Son de touche via Web Audio API
function playKeySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.type = 'sine';
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => ctx.close();
  } catch (e) {}
}

function playDeleteSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.type = 'sine';
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
    osc.onended = () => ctx.close();
  } catch (e) {}
}

const KEYBOARD_LAYOUT = [
  ['A','B','C','D','E','F','G','H','I','J'],
  ['K','L','M','N','O','P','Q','R','S','T'],
  ['U','V','W','X','Y','Z'],
];

export default function KeyboardRemote() {
  const navigate = useNavigate();
  const [connected, setConnected]   = useState(false);
  const [sessionId, setSessionId]   = useState('');
  const [text, setText]             = useState('');
  const [feedback, setFeedback]     = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [pressedKey, setPressedKey] = useState(null);
  const channelRef = useRef(null);
  const isProcessingKey = useRef(false); // ← AJOUT : pour éviter les doublons

  // Récupérer la session depuis l'URL si présente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get('session');
    if (sessionFromUrl) {
      setSessionId(sessionFromUrl);
    }
  }, []);

  // Orientation
  useEffect(() => {
    const detect = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    detect();
    window.addEventListener('resize', detect);
    window.addEventListener('orientationchange', () => setTimeout(detect, 300));
    return () => {
      window.removeEventListener('resize', detect);
      window.removeEventListener('orientationchange', detect);
    };
  }, []);

  // Auto-connect si session dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get('session');
    if (sessionFromUrl && !connected) {
      connectWithId(sessionFromUrl);
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
          logger.info('KeyboardRemote connecté', { sessionId: id });
          setTimeout(() => setFeedback(''), 2000);
        } else {
          setConnected(false);
          logger.warn('KeyboardRemote déconnecté', { status });
        }
      });

    channelRef.current = channel;
  }, []);

  const connect = useCallback(() => {
    const id = sessionId || generateCode();
    setSessionId(id);
    connectWithId(id);
  }, [sessionId, connectWithId]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnected(false);
    setFeedback('🔌 Déconnecté');
    setTimeout(() => setFeedback(''), 2000);
  }, []);

  // ---- CORRECTION DU DOUBLON : Une seule fonction d'envoi ----
  const sendKey = useCallback((key) => {
    // Éviter les doublons : si une touche est déjà en cours de traitement, on ignore
    if (isProcessingKey.current) return;
    isProcessingKey.current = true;

    if (!connected || !channelRef.current) {
      setFeedback('⚠️ Connecte-toi d\'abord');
      setTimeout(() => setFeedback(''), 1500);
      isProcessingKey.current = false;
      return;
    }

    // Sons
    if (key === '⌫') {
      playDeleteSound();
    } else {
      playKeySound();
    }

    // Flash visuel
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 120);

    // Vibration
    if (navigator.vibrate) navigator.vibrate(8);

    // Envoi Supabase
    channelRef.current.send({
      type: 'broadcast',
      event: 'key',
      payload: { key },
    });

    // Feedback local (pour l'affichage sur le téléphone)
    if (key === '⌫') {
      setText(prev => prev.slice(0, -1));
    } else if (key === '␣') {
      setText(prev => prev + ' ');
    } else {
      setText(prev => prev + key);
    }

    logger.debug('Touche envoyée', { key });

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      isProcessingKey.current = false;
    }, 100);
  }, [connected]);

  // Nettoyer le flag au démontage
  useEffect(() => {
    return () => {
      isProcessingKey.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) channelRef.current.unsubscribe();
    };
  }, []);

  const isLandscape = orientation === 'landscape';

  // ---- Gestion unifiée des événements tactiles et souris ----
  const handleKeyPress = useCallback((key, e) => {
    e.preventDefault();
    sendKey(key);
  }, [sendKey]);

  const keyBtn = (key, extraStyle = {}) => {
    const isPressed = pressedKey === key;
    return (
      <button
        key={key}
        // Utiliser UNIQUEMENT onPointerDown qui gère à la fois tactile et souris
        onPointerDown={(e) => {
          e.preventDefault();
          handleKeyPress(key, e);
        }}
        style={{
          flex: 1,
          padding: isLandscape ? '11px 2px' : '17px 4px',
          backgroundColor: isPressed ? 'rgba(254,202,87,0.35)' : 'rgba(255,255,255,0.09)',
          border: `1px solid ${isPressed ? 'rgba(254,202,87,0.5)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '7px',
          color: isPressed ? '#feca57' : '#fff',
          fontSize: isLandscape ? '15px' : '19px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          textAlign: 'center',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'background-color 0.08s, color 0.08s, border-color 0.08s',
          transform: isPressed ? 'scale(0.93)' : 'scale(1)',
          ...extraStyle,
        }}
      >
        {key}
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: '#0f0f1a', color: '#fff',
      padding: isLandscape ? '8px 16px' : '12px',
      fontFamily: 'system-ui, sans-serif',
      touchAction: 'none', overflow: 'hidden', boxSizing: 'border-box',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLandscape ? '6px' : '10px', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#666', padding: isLandscape ? '4px 10px' : '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: isLandscape ? '11px' : '13px' }}>←</button>
        <span style={{ fontSize: isLandscape ? '13px' : '16px', color: '#feca57' }}>⌨️ Clavier</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9px', color: connected ? '#50fa7b' : '#ff6b6b' }}>{connected ? '●' : '○'}</span>
          <span style={{ fontSize: isLandscape ? '8px' : '9px', color: '#444', fontFamily: 'monospace' }}>{sessionId || '---'}</span>
        </div>
      </div>

      {/* Zone texte */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: isLandscape ? '6px 10px' : '10px 12px', marginBottom: isLandscape ? '6px' : '8px', minHeight: isLandscape ? '28px' : '44px', border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ fontSize: isLandscape ? '13px' : '17px', color: '#fff', wordBreak: 'break-all', minHeight: isLandscape ? '18px' : '28px' }}>
          {text || <span style={{ color: '#333' }}>En attente...</span>}
        </div>
      </div>

      {/* Connexion */}
      <div style={{ display: 'flex', gap: isLandscape ? '4px' : '6px', marginBottom: isLandscape ? '6px' : '8px', alignItems: 'center', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Code session"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          style={{ flex: 1, padding: isLandscape ? '4px 8px' : '6px 10px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: isLandscape ? '12px' : '14px', outline: 'none', textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '2px' }}
        />
        {!connected ? (
          <button onClick={connect} style={{ padding: isLandscape ? '4px 12px' : '6px 16px', backgroundColor: '#50fa7b', color: '#0f0f1a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: isLandscape ? '11px' : '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            Connecter
          </button>
        ) : (
          <button onClick={disconnect} style={{ padding: isLandscape ? '4px 12px' : '6px 16px', backgroundColor: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: isLandscape ? '11px' : '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            Déco
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign: 'center', fontSize: isLandscape ? '10px' : '12px', color: feedback.includes('✅') ? '#50fa7b' : feedback.includes('⚠️') ? '#feca57' : '#ff6b6b', marginBottom: isLandscape ? '4px' : '6px', flexShrink: 0 }}>
          {feedback}
        </div>
      )}

      {/* Clavier */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isLandscape ? '4px' : '6px', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
        {KEYBOARD_LAYOUT.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: isLandscape ? '4px' : '6px' }}>
            {row.map(key => keyBtn(key))}
          </div>
        ))}

        {/* Rangée spéciale : espace + backspace */}
        <div style={{ display: 'flex', gap: isLandscape ? '4px' : '6px' }}>
          {keyBtn('␣', { flex: 2, color: pressedKey === '␣' ? '#feca57' : '#aaa', fontSize: isLandscape ? '12px' : '14px' })}
          {keyBtn('⌫', { flex: 1, backgroundColor: pressedKey === '⌫' ? 'rgba(255,107,107,0.35)' : 'rgba(255,107,107,0.12)', color: pressedKey === '⌫' ? '#ff9090' : '#ff6b6b', border: `1px solid ${pressedKey === '⌫' ? 'rgba(255,107,107,0.5)' : 'rgba(255,107,107,0.25)'}`, fontSize: isLandscape ? '16px' : '20px' })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: isLandscape ? '4px 0' : '6px 0', fontSize: isLandscape ? '7px' : '8px', color: '#333', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: isLandscape ? '4px' : '6px', flexShrink: 0 }}>
        <span>Scanne le QR sur la TV</span>
        <span>{isLandscape ? '🌅' : '📱'} {orientation}</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}