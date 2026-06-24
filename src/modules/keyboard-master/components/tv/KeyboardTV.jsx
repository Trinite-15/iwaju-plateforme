// KeyboardTV.jsx — Jeu de frappe Smart TV
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createKeyboardChannel } from '../../supabaseClient';
import { logger } from '../../../../logger';

// Session stable : survit aux rechargements de page
const getSessionId = () => {
  let id = sessionStorage.getItem('kb-session');
  if (!id) {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
    sessionStorage.setItem('kb-session', id);
  }
  return id;
};

// ── Phrases du jeu ──────────────────────────────────────────────
const PHRASES = [
  "LE SOLEIL SE LEVE SUR COTONOU",
  "LA TECHNOLOGIE CHANGE LE MONDE",
  "APPRENDRE CHAQUE JOUR EST UNE VICTOIRE",
  "IWAJU SIGNIFIE FUTUR EN YORUBA",
  "LA CYBERSECURITE PROTEGE NOS DONNEES",
  "LE CODE EST UN SUPER POUVOIR",
  "BENIN TERRE DE CULTURE ET DE SAVOIR",
  "CHAQUE TOUCHE TE RAPPROCHE DU BUT",
  "LA VITESSE VIENT AVEC LA PRATIQUE",
  "ECRIRE VITE EST UN ART QUI SE TRAVAILLE",
];

// ── Titres selon WPM ─────────────────────────────────────────────
const TITLES = [
  { min: 0,  emoji: '🐢', label: 'Débutant',          color: '#888888' },
  { min: 10, emoji: '🚶', label: 'Apprenti',           color: '#8be9fd' },
  { min: 20, emoji: '⚡', label: 'Intermédiaire',      color: '#50fa7b' },
  { min: 30, emoji: '🔥', label: 'Confirmé',           color: '#ffb86c' },
  { min: 45, emoji: '💎', label: 'Expert',             color: '#bd93f9' },
  { min: 60, emoji: '🏆', label: 'Champion IWAJU',     color: '#feca57' },
  { min: 80, emoji: '👑', label: 'Maître du Clavier',  color: '#ff6b6b' },
];

const getTitle = (wpm) => TITLES.reduce((best, t) => wpm >= t.min ? t : best, TITLES[0]);

const pickPhrase = () => PHRASES[Math.floor(Math.random() * PHRASES.length)];

const GAME = { IDLE: 'idle', PLAYING: 'playing', FINISHED: 'finished' };
const KEYBOARD_ROWS = [
  ['A','B','C','D','E','F','G','H','I','J'],
  ['K','L','M','N','O','P','Q','R','S','T'],
  ['U','V','W','X','Y','Z','⌫','␣'],
];

export default function KeyboardTV() {
  const navigate    = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [connected, setConnected] = useState(false);
  const [isTV,      setIsTV]      = useState(false);
  const [flashKey,  setFlashKey]  = useState(null);

  // Jeu
  const [gameState, setGameState] = useState(GAME.IDLE);
  const [phrase,    setPhrase]    = useState('');
  const [typed,     setTyped]     = useState('');
  const [timeLeft,  setTimeLeft]  = useState(60);
  const [wpm,       setWpm]       = useState(0);
  const [accuracy,  setAccuracy]  = useState(100);
  const [errors,    setErrors]    = useState(0);
  const [bestWpm,   setBestWpm]   = useState(0);

  const channelRef   = useRef(null);
  const timerRef     = useRef(null);
  const startRef     = useRef(null);
  const totalRef     = useRef(0);
  const errorRef     = useRef(0);
  const gameStateRef = useRef(GAME.IDLE); // ref pour accès dans le listener

  // Sync ref avec state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Détection TV
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
  }, []);

  // ── Connexion Supabase ───────────────────────────────────────
  useEffect(() => {
    const channel = createKeyboardChannel(sessionId)
      .on('broadcast', { event: 'key' }, ({ payload }) => {
        // Utiliser la ref pour lire l'état courant dans le listener
        if (gameStateRef.current !== GAME.PLAYING) return;
        handleKey(payload.key);
      })
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        logger.info('KeyboardTV', { status, sessionId });
      });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [sessionId]); // eslint-disable-line

  // ── Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== GAME.PLAYING) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); endGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState]); // eslint-disable-line

  const startGame = () => {
    setPhrase(pickPhrase());
    setTyped('');
    setTimeLeft(60);
    setWpm(0);
    setAccuracy(100);
    setErrors(0);
    totalRef.current = 0;
    errorRef.current = 0;
    startRef.current = null;
    setGameState(GAME.PLAYING);
  };

  const endGame = () => {
    setGameState(GAME.FINISHED);
  };

  const handleKey = (key) => {
    // Flash visuel
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 140);

    if (key === '⌫') {
      setTyped(prev => prev.slice(0, -1));
      return;
    }
    const char = (key === '␣') ? ' ' : key;

    // Démarrer chrono à la 1re touche
    if (!startRef.current) startRef.current = Date.now();
    totalRef.current += 1;

    setTyped(prev => {
      const expected = phrase[prev.length];
      if (char !== expected) {
        errorRef.current += 1;
        setErrors(e => e + 1);
      }
      const next = prev + char;

      // WPM
      const elapsed = (Date.now() - startRef.current) / 60000;
      if (elapsed > 0) setWpm(Math.round((next.length / 5) / elapsed));

      // Précision
      const acc = totalRef.current > 0
        ? Math.round(((totalRef.current - errorRef.current) / totalRef.current) * 100)
        : 100;
      setAccuracy(acc);

      // Phrase terminée → nouvelle phrase
      if (next.length >= phrase.length) {
        setPhrase(pickPhrase());
        return '';
      }
      return next;
    });
  };

  useEffect(() => {
    if (gameState === GAME.FINISHED) {
      setBestWpm(prev => Math.max(prev, wpm));
    }
  }, [gameState]); // eslint-disable-line

  const title      = getTitle(wpm);
  const timerColor = timeLeft <= 10 ? '#ff6b6b' : timeLeft <= 20 ? '#ffb86c' : '#50fa7b';
  const remoteUrl  = `${window.location.origin}/keyboard-master/remote?session=${sessionId}`;

  // Rendu phrase lettre par lettre
  const renderPhrase = () => phrase.split('').map((char, i) => {
    let color = '#444', bg = 'transparent';
    if (i < typed.length) {
      const ok = typed[i] === char;
      color = ok ? '#50fa7b' : '#ff6b6b';
      bg    = ok ? 'rgba(80,250,123,0.08)' : 'rgba(255,107,107,0.15)';
    } else if (i === typed.length) {
      color = '#fff'; bg = 'rgba(254,202,87,0.2)';
    }
    return (
      <span key={i} style={{ color, backgroundColor: bg, borderRadius: 3, padding: '0 1px', fontFamily: 'monospace', fontSize: isTV ? '26px' : '18px', letterSpacing: 2 }}>
        {char === ' ' ? '\u00A0\u00A0' : char}
      </span>
    );
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#0f0f1a', color:'#fff', padding: isTV ? '24px 28px' : '14px 16px', fontFamily:'system-ui,sans-serif', boxSizing:'border-box', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexShrink:0 }}>
        <button onClick={() => navigate('/')} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#666', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize: isTV ? 16 : 13 }}>← Retour</button>
        <h1 style={{ color:'#feca57', fontSize: isTV ? 28 : 20, margin:0 }}>⌨️ Keyboard Master</h1>
        <span style={{ fontSize:11, color: connected ? '#50fa7b' : '#ff6b6b', background: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)', padding:'4px 10px', borderRadius:20 }}>
          {connected ? '● Connecté' : '○ Connexion…'}
        </span>
      </div>

      {/* Corps */}
      <div style={{ display:'flex', gap:14, flex:1, minHeight:0 }}>

        {/* Colonne gauche — jeu */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>

          {/* Stats — visibles uniquement en jeu */}
          {gameState !== GAME.IDLE && (
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              {[
                { label:'WPM',      value: wpm,         color: title.color },
                { label:'Précision',value: `${accuracy}%`, color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' },
                { label:'Erreurs',  value: errors,      color: errors === 0 ? '#50fa7b' : '#ff6b6b' },
                { label:'Temps',    value: `${timeLeft}s`, color: timerColor },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${s.color}33`, borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
                  <div style={{ fontSize: isTV ? 24 : 18, fontWeight:'bold', color:s.color, fontFamily:'monospace' }}>{s.value}</div>
                  <div style={{ fontSize:9, color:'#555', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Titre courant */}
          {gameState === GAME.PLAYING && wpm > 0 && (
            <div style={{ textAlign:'center', fontSize: isTV ? 16 : 13, color: title.color, fontWeight:'bold', flexShrink:0 }}>
              {title.emoji} {title.label}
            </div>
          )}

          {/* Zone principale */}
          <div style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>

            {gameState === GAME.IDLE && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize: isTV ? 52 : 38, marginBottom:12 }}>⌨️</div>
                <p style={{ color:'#666', fontSize: isTV ? 17 : 13, marginBottom:20, lineHeight:1.7 }}>
                  {connected
                    ? <>Scanne le QR code avec ton téléphone<br/>puis clique sur <strong style={{ color:'#feca57' }}>Démarrer</strong></>
                    : <span style={{ color:'#ff6b6b' }}>En attente de connexion…</span>
                  }
                </p>
                {connected && (
                  <button onClick={startGame} style={{ backgroundColor:'#feca57', color:'#0f0f1a', border:'none', borderRadius:10, padding:'12px 32px', fontSize: isTV ? 20 : 15, fontWeight:'bold', cursor:'pointer' }}>
                    🚀 Démarrer
                  </button>
                )}
                {bestWpm > 0 && <p style={{ color:'#444', fontSize:11, marginTop:14 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></p>}
              </div>
            )}

            {gameState === GAME.PLAYING && (
              <div style={{ width:'100%' }}>
                <div style={{ lineHeight:2.2, wordBreak:'break-all', textAlign:'center', marginBottom:10 }}>
                  {renderPhrase()}
                </div>
                <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.round((typed.length / phrase.length) * 100)}%`, background:'#feca57', borderRadius:2, transition:'width 0.1s' }} />
                </div>
              </div>
            )}

            {gameState === GAME.FINISHED && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize: isTV ? 56 : 42, marginBottom:8 }}>{title.emoji}</div>
                <div style={{ fontSize: isTV ? 44 : 32, fontWeight:'bold', color: title.color }}>{wpm} WPM</div>
                <div style={{ fontSize: isTV ? 20 : 15, color: title.color, marginBottom:16 }}>{title.label}</div>
                <div style={{ display:'flex', gap:16, justifyContent:'center', marginBottom:20, flexWrap:'wrap' }}>
                  <span style={{ color:'#666', fontSize:12 }}>Précision : <strong style={{ color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' }}>{accuracy}%</strong></span>
                  <span style={{ color:'#666', fontSize:12 }}>Erreurs : <strong style={{ color: errors === 0 ? '#50fa7b' : '#ff6b6b' }}>{errors}</strong></span>
                  {bestWpm > 0 && <span style={{ color:'#666', fontSize:12 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></span>}
                </div>
                <button onClick={startGame} style={{ backgroundColor:'#feca57', color:'#0f0f1a', border:'none', borderRadius:10, padding:'10px 28px', fontSize: isTV ? 17 : 14, fontWeight:'bold', cursor:'pointer' }}>
                  🔄 Rejouer
                </button>
              </div>
            )}
          </div>

          {/* Clavier visuel (flash des touches reçues) */}
          <div style={{ flexShrink:0 }}>
            {KEYBOARD_ROWS.map((row, i) => (
              <div key={i} style={{ display:'flex', gap:3, justifyContent:'center', marginBottom:3 }}>
                {row.map(key => {
                  const flash = flashKey === key;
                  const special = key === '⌫' || key === '␣';
                  return (
                    <div key={key} style={{
                      padding: isTV ? '9px 6px' : '5px 3px',
                      backgroundColor: flash ? 'rgba(254,202,87,0.45)' : 'rgba(255,255,255,0.04)',
                      borderRadius:6,
                      flex: special ? 1.6 : 1,
                      textAlign:'center',
                      fontSize: isTV ? 16 : 11,
                      color: flash ? '#feca57' : '#444',
                      border:`1px solid ${flash ? 'rgba(254,202,87,0.5)' : 'rgba(255,255,255,0.03)'}`,
                      fontFamily:'monospace',
                      transition:'all 0.08s',
                      transform: flash ? 'scale(1.18)' : 'scale(1)',
                    }}>{key}</div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite — QR + session */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', borderRadius:12, padding:14, border:'1px solid rgba(255,255,255,0.07)', width: isTV ? 160 : 130, flexShrink:0 }}>
          <QRCodeSVG value={remoteUrl} size={isTV ? 128 : 100} bgColor="#0f0f1a" fgColor="#ffffff" />
          <p style={{ color:'#555', fontSize:8, margin:0, textAlign:'center' }}>Scanner pour jouer</p>
          <p style={{ color:'#feca57', fontSize: isTV ? 17 : 13, margin:0, fontFamily:'monospace', letterSpacing:3, fontWeight:'bold' }}>{sessionId}</p>
          <div style={{ width:'100%', height:1, background:'rgba(255,255,255,0.05)' }} />
          <p style={{ color:'#333', fontSize:7, margin:0, textAlign:'center', lineHeight:1.5 }}>ou tape ce code<br/>dans /remote</p>
          {gameState === GAME.IDLE && connected && (
            <button onClick={startGame} style={{ marginTop:6, backgroundColor:'#feca57', color:'#0f0f1a', border:'none', borderRadius:8, padding:'7px 10px', fontSize:11, fontWeight:'bold', cursor:'pointer', width:'100%' }}>
              ▶ Start
            </button>
          )}
          {gameState === GAME.PLAYING && (
            <div style={{ marginTop:6, textAlign:'center' }}>
              <div style={{ fontSize: isTV ? 28 : 22, fontWeight:'bold', color: timerColor, fontFamily:'monospace' }}>{timeLeft}s</div>
              <div style={{ fontSize:8, color:'#444' }}>restantes</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', fontSize:8, color:'#222', borderTop:'1px solid rgba(255,255,255,0.03)', paddingTop:7, flexShrink:0 }}>
        <span>IWAJU Keyboard Master v3</span>
        <span>{isTV ? '📺 TV' : '💻 Desktop'}</span>
        <span>Session: {sessionId}</span>
      </div>
    </div>
  );
}
