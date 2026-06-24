import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createKeyboardChannel } from '../../supabaseClient';
import { logger } from '../../../../logger';

const generateSessionId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const PHRASES = [
  "LE SOLEIL SE LEVE SUR COTONOU",
  "LA TECHNOLOGIE CHANGE LE MONDE",
  "APPRENDRE CHAQUE JOUR EST UNE VICTOIRE",
  "IWAJU SIGNIFIE FUTUR EN YORUBA",
  "LA CYBERSECURITE PROTEGE NOS DONNEES",
  "LE CODE EST UN SUPER POUVOIR",
  "BENIN TERRE DE CULTURE ET DE SAVOIR",
  "CHAQUE TOUCHE TE RAPPROCHE DU BUT",
];

const TITLES = [
  { min: 0,  label: '🐢 Débutant',        color: '#888' },
  { min: 10, label: '🚶 Apprenti',         color: '#8be9fd' },
  { min: 20, label: '⚡ Intermédiaire',    color: '#50fa7b' },
  { min: 30, label: '🔥 Confirmé',         color: '#ffb86c' },
  { min: 45, label: '💎 Expert',           color: '#bd93f9' },
  { min: 60, label: '🏆 Champion IWAJU',   color: '#feca57' },
  { min: 80, label: '👑 Maître du Clavier',color: '#ff6b6b' },
];

function getTitle(wpm) {
  let title = TITLES[0];
  for (const t of TITLES) { if (wpm >= t.min) title = t; }
  return title;
}

// États du jeu
const STATE = { IDLE: 'idle', PLAYING: 'playing', FINISHED: 'finished' };

export default function KeyboardTV() {
  const navigate = useNavigate();
  const [connected,    setConnected]    = useState(false);
  const [sessionId,    setSessionId]    = useState('');
  const [isTV,         setIsTV]         = useState(false);
  const [flashKey,     setFlashKey]     = useState(null);

  // Jeu
  const [gameState,    setGameState]    = useState(STATE.IDLE);
  const [phrase,       setPhrase]       = useState('');
  const [typed,        setTyped]        = useState('');
  const [timeLeft,     setTimeLeft]     = useState(60);
  const [wpm,          setWpm]          = useState(0);
  const [accuracy,     setAccuracy]     = useState(100);
  const [errors,       setErrors]       = useState(0);
  const [bestWpm,      setBestWpm]      = useState(0);

  const channelRef  = useRef(null);
  const timerRef    = useRef(null);
  const startTimeRef = useRef(null);
  const totalKeysRef = useRef(0);
  const errorKeysRef = useRef(0);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
  }, []);

  // Connexion Supabase
  useEffect(() => {
    const id = generateSessionId();
    setSessionId(id);

    const channel = createKeyboardChannel(id)
      .on('broadcast', { event: 'key' }, ({ payload }) => {
        handleKey(payload.key);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          logger.info('KeyboardTV connecté', { sessionId: id });
        } else {
          setConnected(false);
        }
      });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); channelRef.current = null; };
  }, []); // eslint-disable-line

  const startGame = () => {
    const p = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setPhrase(p);
    setTyped('');
    setTimeLeft(60);
    setWpm(0);
    setAccuracy(100);
    setErrors(0);
    totalKeysRef.current = 0;
    errorKeysRef.current = 0;
    startTimeRef.current = null;
    setGameState(STATE.PLAYING);
  };

  // Timer
  useEffect(() => {
    if (gameState !== STATE.PLAYING) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState]); // eslint-disable-line

  const finishGame = () => {
    setGameState(STATE.FINISHED);
    setWpm(prev => { setBestWpm(best => Math.max(best, prev)); return prev; });
  };

  const handleKey = (key) => {
    if (gameState === STATE.IDLE || gameState === STATE.FINISHED) return;

    // Flash
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 150);

    // Démarrer le chrono à la première touche
    if (!startTimeRef.current) startTimeRef.current = Date.now();

    if (key === '⌫' || key === 'Backspace') {
      setTyped(prev => prev.slice(0, -1));
      return;
    }
    if (key === '␣' || key === 'Space') key = ' ';

    totalKeysRef.current += 1;

    setTyped(prev => {
      const newTyped = prev + key;
      const expected = phrase[prev.length];
      if (key !== expected) {
        errorKeysRef.current += 1;
        setErrors(e => e + 1);
      }

      // Calcul WPM
      const elapsed = (Date.now() - startTimeRef.current) / 60000;
      if (elapsed > 0) {
        const currentWpm = Math.round((newTyped.length / 5) / elapsed);
        setWpm(currentWpm);
      }
      // Précision
      const acc = totalKeysRef.current > 0
        ? Math.round(((totalKeysRef.current - errorKeysRef.current) / totalKeysRef.current) * 100)
        : 100;
      setAccuracy(acc);

      // Phrase terminée ?
      if (newTyped.length >= phrase.length) {
        const newP = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        setPhrase(newP);
        return '';
      }
      return newTyped;
    });
  };

  const remoteUrl = sessionId
    ? `${window.location.origin}/keyboard-master/remote?session=${sessionId}`
    : '';

  const title = getTitle(wpm);
  const timerColor = timeLeft <= 10 ? '#ff6b6b' : timeLeft <= 20 ? '#ffb86c' : '#50fa7b';

  // Rendu de la phrase avec coloration lettre par lettre
  const renderPhrase = () => {
    if (!phrase) return null;
    return phrase.split('').map((char, i) => {
      let color = '#555';
      let bg = 'transparent';
      if (i < typed.length) {
        color = typed[i] === char ? '#50fa7b' : '#ff6b6b';
        bg = typed[i] === char ? 'rgba(80,250,123,0.08)' : 'rgba(255,107,107,0.15)';
      } else if (i === typed.length) {
        color = '#fff';
        bg = 'rgba(254,202,87,0.25)';
      }
      return (
        <span key={i} style={{
          color, backgroundColor: bg,
          borderRadius: '3px',
          padding: '0 1px',
          fontFamily: 'monospace',
          fontSize: isTV ? '28px' : '20px',
          letterSpacing: '2px',
          transition: 'color 0.1s',
        }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      );
    });
  };

  const KEYBOARD_LAYOUT = [
    ['A','B','C','D','E','F','G','H','I','J'],
    ['K','L','M','N','O','P','Q','R','S','T'],
    ['U','V','W','X','Y','Z','⌫','␣'],
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: '#0f0f1a', color: '#fff',
      padding: isTV ? '28px' : '16px', fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#666', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '16px' : '13px' }}>← Retour</button>
        <h1 style={{ color: '#feca57', fontSize: isTV ? '30px' : '20px', margin: 0 }}>⌨️ Keyboard Master</h1>
        <span style={{ fontSize: '11px', color: connected ? '#50fa7b' : '#ff6b6b', backgroundColor: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
          {connected ? '● Connecté' : '○ Connexion…'}
        </span>
      </div>

      {/* Corps principal */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* Colonne gauche : jeu */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>

          {/* Stats */}
          {gameState !== STATE.IDLE && (
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              {[
                { label: 'WPM', value: wpm, color: title.color },
                { label: 'Précision', value: `${accuracy}%`, color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' },
                { label: 'Erreurs', value: errors, color: errors === 0 ? '#50fa7b' : '#ff6b6b' },
                { label: 'Temps', value: `${timeLeft}s`, color: timerColor },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.color}33`, borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: isTV ? '26px' : '20px', fontWeight: 'bold', color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Titre joueur */}
          {gameState === STATE.PLAYING && wpm > 0 && (
            <div style={{ textAlign: 'center', fontSize: isTV ? '18px' : '14px', color: title.color, fontWeight: 'bold', flexShrink: 0 }}>
              {title.label}
            </div>
          )}

          {/* Zone phrase / résultat / accueil */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>

            {gameState === STATE.IDLE && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isTV ? '48px' : '36px', marginBottom: '12px' }}>⌨️</div>
                <p style={{ color: '#888', fontSize: isTV ? '18px' : '14px', marginBottom: '20px', lineHeight: 1.6 }}>
                  Scanne le QR code avec ton téléphone<br />puis appuie sur <strong style={{ color: '#feca57' }}>Démarrer</strong>
                </p>
                {connected && (
                  <button onClick={startGame} style={{ backgroundColor: '#feca57', color: '#0f0f1a', border: 'none', borderRadius: '10px', padding: '12px 32px', fontSize: isTV ? '20px' : '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                    🚀 Démarrer
                  </button>
                )}
                {!connected && <p style={{ color: '#ff6b6b', fontSize: '13px' }}>En attente de connexion…</p>}
                {bestWpm > 0 && <p style={{ color: '#555', fontSize: '12px', marginTop: '12px' }}>Meilleur score : <strong style={{ color: '#feca57' }}>{bestWpm} WPM</strong></p>}
              </div>
            )}

            {gameState === STATE.PLAYING && (
              <div style={{ width: '100%' }}>
                <div style={{ lineHeight: '2', wordBreak: 'break-all', textAlign: 'center', marginBottom: '12px' }}>
                  {renderPhrase()}
                </div>
                {/* Barre de progression */}
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(typed.length / phrase.length) * 100}%`, background: '#feca57', borderRadius: '2px', transition: 'width 0.1s' }} />
                </div>
              </div>
            )}

            {gameState === STATE.FINISHED && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isTV ? '52px' : '40px', marginBottom: '8px' }}>{wpm >= 60 ? '🏆' : wpm >= 30 ? '🔥' : '👏'}</div>
                <div style={{ fontSize: isTV ? '40px' : '30px', fontWeight: 'bold', color: title.color, marginBottom: '4px' }}>{wpm} WPM</div>
                <div style={{ fontSize: isTV ? '20px' : '16px', color: title.color, marginBottom: '16px' }}>{title.label}</div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Précision : <strong style={{ color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' }}>{accuracy}%</strong></span>
                  <span style={{ color: '#888', fontSize: '13px' }}>Erreurs : <strong style={{ color: errors === 0 ? '#50fa7b' : '#ff6b6b' }}>{errors}</strong></span>
                  {bestWpm > 0 && <span style={{ color: '#888', fontSize: '13px' }}>Record : <strong style={{ color: '#feca57' }}>{bestWpm} WPM</strong></span>}
                </div>
                <button onClick={startGame} style={{ backgroundColor: '#feca57', color: '#0f0f1a', border: 'none', borderRadius: '10px', padding: '10px 28px', fontSize: isTV ? '18px' : '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🔄 Rejouer
                </button>
              </div>
            )}
          </div>

          {/* Clavier visuel flash */}
          <div style={{ flexShrink: 0 }}>
            {KEYBOARD_LAYOUT.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '4px' }}>
                {row.map(key => {
                  const isFlashing = flashKey === key;
                  return (
                    <div key={key} style={{
                      padding: isTV ? '10px 8px' : '6px 4px',
                      backgroundColor: isFlashing ? 'rgba(254,202,87,0.5)' : 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      minWidth: (key === '⌫' || key === '␣') ? (isTV ? '70px' : '50px') : (isTV ? '44px' : '30px'),
                      flex: (key === '⌫' || key === '␣') ? 1.5 : 1,
                      textAlign: 'center',
                      fontSize: isTV ? '18px' : '12px',
                      color: isFlashing ? '#feca57' : '#555',
                      border: `1px solid ${isFlashing ? 'rgba(254,202,87,0.6)' : 'rgba(255,255,255,0.04)'}`,
                      fontFamily: 'monospace',
                      transition: 'all 0.08s',
                      transform: isFlashing ? 'scale(1.15)' : 'scale(1)',
                    }}>{key}</div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite : QR + session */}
        {remoteUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.07)', width: isTV ? '170px' : '130px', flexShrink: 0 }}>
            <QRCodeSVG value={remoteUrl} size={isTV ? 130 : 100} bgColor="#0f0f1a" fgColor="#ffffff" />
            <p style={{ color: '#666', fontSize: '9px', margin: 0, textAlign: 'center' }}>Scanner pour jouer</p>
            <p style={{ color: '#feca57', fontSize: isTV ? '18px' : '14px', margin: 0, fontFamily: 'monospace', letterSpacing: '3px', fontWeight: 'bold' }}>{sessionId}</p>
            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            <p style={{ color: '#444', fontSize: '8px', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>ou entrer le code<br/>dans /remote</p>
            {gameState === STATE.IDLE && connected && (
              <button onClick={startGame} style={{ marginTop: '8px', backgroundColor: '#feca57', color: '#0f0f1a', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
                ▶ Start
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#2a2a3a', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', flexShrink: 0 }}>
        <span>IWAJU Keyboard Master v3.0</span>
        <span>{isTV ? '📺 Smart TV' : '💻 Desktop'}</span>
        <span>Session: {sessionId}</span>
      </div>
    </div>
  );
}
