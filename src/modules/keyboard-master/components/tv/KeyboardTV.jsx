// KeyboardTV.jsx — Jeu de frappe Smart TV
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createKeyboardChannel } from '../../supabaseClient';
import { logger } from '../../../../logger';

const getSessionId = () => {
  let id = sessionStorage.getItem('kb-session');
  if (!id) { id = Math.random().toString(36).slice(2, 8).toUpperCase(); sessionStorage.setItem('kb-session', id); }
  return id;
};

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

// Titres basés sur WPM ET temps mis (en secondes) pour finir la phrase
// Si le jeu se termine par fin de phrase, on utilise le temps réel
const TITLES = [
  { min: 0,  emoji: '🐢', label: 'Débutant',         color: '#888888' },
  { min: 10, emoji: '🚶', label: 'Apprenti',          color: '#8be9fd' },
  { min: 20, emoji: '⚡', label: 'Intermédiaire',     color: '#50fa7b' },
  { min: 30, emoji: '🔥', label: 'Confirmé',          color: '#ffb86c' },
  { min: 45, emoji: '💎', label: 'Expert',            color: '#bd93f9' },
  { min: 60, emoji: '🏆', label: 'Champion IWAJU',    color: '#feca57' },
  { min: 80, emoji: '👑', label: 'Maître du Clavier', color: '#ff6b6b' },
];
const getTitle = (wpm) => TITLES.reduce((best, t) => wpm >= t.min ? t : best, TITLES[0]);

const pickPhrase = (current = '') => {
  const pool = PHRASES.filter(p => p !== current);
  return pool[Math.floor(Math.random() * pool.length)];
};

// Retirer les espaces pour la comparaison — l'utilisateur ne tape que des lettres
// Les espaces dans la phrase sont affichés mais sautés automatiquement
const lettersOnly = (str) => str.replace(/ /g, '');

const GAME = { IDLE: 'idle', PLAYING: 'playing', FINISHED: 'finished' };
const KEYBOARD_ROWS = [
  ['A','B','C','D','E','F','G','H','I','J'],
  ['K','L','M','N','O','P','Q','R','S','T'],
  ['U','V','W','X','Y','Z','⌫'],
];

export default function KeyboardTV() {
  const navigate    = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [connected, setConnected] = useState(false);
  const [isTV,      setIsTV]      = useState(false);
  const [flashKey,  setFlashKey]  = useState(null);

  const [gameState,  setGameState]  = useState(GAME.IDLE);
  const [phrase,     setPhrase]     = useState('');
  // typedLetters = seulement les lettres tapées (sans espaces)
  const [typedLetters, setTypedLetters] = useState('');
  const [timeLeft,   setTimeLeft]   = useState(60);
  const [timeTaken,  setTimeTaken]  = useState(0);  // temps réel si phrase complétée avant la fin
  const [wpm,        setWpm]        = useState(0);
  const [accuracy,   setAccuracy]   = useState(100);
  const [errors,     setErrors]     = useState(0);
  const [bestWpm,    setBestWpm]    = useState(0);
  const [finishedBy, setFinishedBy] = useState('timer'); // 'timer' | 'phrase'

  const channelRef      = useRef(null);
  const timerRef        = useRef(null);
  const startRef        = useRef(null);
  const totalRef        = useRef(0);
  const errorRef        = useRef(0);
  const gameStateRef    = useRef(GAME.IDLE);
  const phraseRef       = useRef('');
  const phraseLettersRef = useRef(''); // phrase sans espaces

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => {
    phraseRef.current = phrase;
    phraseLettersRef.current = lettersOnly(phrase);
  }, [phrase]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
  }, []);

  // Connexion Supabase
  useEffect(() => {
    const channel = createKeyboardChannel(sessionId)
      .on('broadcast', { event: 'key' }, ({ payload }) => {
        if (gameStateRef.current !== GAME.PLAYING) return;
        handleKey(payload.key);
      })
      .on('broadcast', { event: 'game_control' }, ({ payload }) => {
        if (payload.action === 'start'  && gameStateRef.current === GAME.IDLE)     startGame();
        if (payload.action === 'replay' && gameStateRef.current === GAME.FINISHED) startGame();
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        logger.info('KeyboardTV', { status, sessionId });
      });
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [sessionId]); // eslint-disable-line

  const broadcastState = useCallback((state) => {
    channelRef.current?.send({ type: 'broadcast', event: 'game_state', payload: { state } });
  }, []);

  // Timer — décrémente chaque seconde
  useEffect(() => {
    if (gameState !== GAME.PLAYING) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Fin par timer
          setFinishedBy('timer');
          setTimeTaken(60);
          setGameState(GAME.FINISHED);
          broadcastState(GAME.FINISHED);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, broadcastState]);

  const startGame = useCallback(() => {
    const p = pickPhrase();
    phraseRef.current = p;
    phraseLettersRef.current = lettersOnly(p);
    setPhrase(p);
    setTypedLetters('');
    setTimeLeft(60);
    setTimeTaken(0);
    setWpm(0);
    setAccuracy(100);
    setErrors(0);
    setFinishedBy('timer');
    totalRef.current = 0;
    errorRef.current = 0;
    startRef.current = null;
    setGameState(GAME.PLAYING);
    broadcastState(GAME.PLAYING);
  }, [broadcastState]);

  // ── handleKey : compare uniquement les lettres, ignore les espaces ──
  const handleKey = useCallback((key) => {
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 140);

    if (key === '⌫') {
      setTypedLetters(prev => prev.slice(0, -1));
      return;
    }
    // Ignorer la touche espace — les espaces sont sautés automatiquement
    if (key === '␣' || key === ' ') return;

    if (!startRef.current) startRef.current = Date.now();
    totalRef.current += 1;

    setTypedLetters(prev => {
      const target = phraseLettersRef.current; // phrase sans espaces
      const expected = target[prev.length];    // lettre attendue

      if (key !== expected) {
        errorRef.current += 1;
        setErrors(e => e + 1);
      }

      const next = prev + key;

      // Calcul WPM basé sur le temps écoulé depuis la 1re touche
      const elapsedMin = (Date.now() - startRef.current) / 60000;

      // ── Phrase complète → fin de partie immédiate ──
      if (next.length >= target.length) {
        clearInterval(timerRef.current);
        const elapsed = Math.round((Date.now() - startRef.current) / 1000);
        setTimeTaken(elapsed);
        setFinishedBy('phrase');
        setGameState(GAME.FINISHED);
        broadcastState(GAME.FINISHED);
        return next;
      }

      return next;
    });
  }, [broadcastState]); // eslint-disable-line

  useEffect(() => {
    if (gameState === GAME.FINISHED) setBestWpm(prev => Math.max(prev, wpm));
  }, [gameState]); // eslint-disable-line

  useEffect(() => {
    if (connected) broadcastState(gameState);
  }, [connected]); // eslint-disable-line

  const title      = getTitle(wpm);
  const timerColor = timeLeft <= 10 ? '#ff6b6b' : timeLeft <= 20 ? '#ffb86c' : '#50fa7b';
  const remoteUrl  = `${window.location.origin}/keyboard-master/remote?session=${sessionId}`;

  // ── Rendu de la phrase avec coloration ──
  // On maintient un index dans typedLetters en ignorant les espaces de la phrase
  const renderPhrase = () => {
    let letterIdx = 0; // index dans typedLetters
    return phraseRef.current.split('').map((char, i) => {
      if (char === ' ') {
        // Espace : affiché toujours en gris, non évalué
        return (
          <span key={i} style={{ color: '#333', fontFamily: 'monospace', fontSize: isTV ? '26px' : '18px', letterSpacing: 2 }}>
            {'\u00A0'}
          </span>
        );
      }
      // Lettre
      const myIdx = letterIdx++;
      let color = '#444', bg = 'transparent';
      if (myIdx < typedLetters.length) {
        const ok = typedLetters[myIdx] === char;
        color = ok ? '#50fa7b' : '#ff6b6b';
        bg    = ok ? 'rgba(80,250,123,0.08)' : 'rgba(255,107,107,0.15)';
      } else if (myIdx === typedLetters.length) {
        color = '#fff'; bg = 'rgba(254,202,87,0.25)'; // curseur
      }
      return (
        <span key={i} style={{ color, backgroundColor: bg, borderRadius: 3, padding: '0 1px', fontFamily: 'monospace', fontSize: isTV ? '26px' : '18px', letterSpacing: 2 }}>
          {char}
        </span>
      );
    });
  };

  // Progression : lettres tapées / total lettres (sans espaces)
  const progress = phraseLettersRef.current.length > 0
    ? Math.round((typedLetters.length / phraseLettersRef.current.length) * 100)
    : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#0f0f1a', color:'#fff', padding: isTV ? '24px 28px' : '14px 16px', fontFamily:'system-ui,sans-serif', boxSizing:'border-box', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexShrink:0 }}>
        <button onClick={() => navigate('/')} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#666', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize: isTV ? 16 : 13 }}>← Retour</button>
        <h1 style={{ color:'#feca57', fontSize: isTV ? 28 : 20, margin:0 }}>⌨️ Keyboard Master</h1>
        <span style={{ fontSize:11, color: connected ? '#50fa7b' : '#ff6b6b', background: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)', padding:'4px 10px', borderRadius:20 }}>
          {connected ? '● Connecté' : '○ Attente…'}
        </span>
      </div>

      {/* Corps */}
      <div style={{ display:'flex', gap:14, flex:1, minHeight:0 }}>

        {/* Gauche : jeu */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>

          {/* Stats */}
          {gameState !== GAME.IDLE && (
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              {[
                { label:'WPM',       value: wpm,            color: title.color },
                { label:'Précision', value: `${accuracy}%`, color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' },
                { label:'Erreurs',   value: errors,          color: errors === 0 ? '#50fa7b' : '#ff6b6b' },
                { label:'Temps',     value: `${timeLeft}s`,  color: timerColor },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${s.color}33`, borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
                  <div style={{ fontSize: isTV ? 24 : 18, fontWeight:'bold', color:s.color, fontFamily:'monospace' }}>{s.value}</div>
                  <div style={{ fontSize:9, color:'#555', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {gameState === GAME.PLAYING && wpm > 0 && (
            <div style={{ textAlign:'center', fontSize: isTV ? 16 : 13, color: title.color, fontWeight:'bold', flexShrink:0 }}>
              {title.emoji} {title.label}
            </div>
          )}

          {/* Zone principale */}
          <div style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'16px 20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>

            {gameState === GAME.IDLE && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize: isTV ? 52 : 38, marginBottom:12 }}>⌨️</div>
                <p style={{ color:'#666', fontSize: isTV ? 17 : 13, marginBottom:20, lineHeight:1.7 }}>
                  {connected
                    ? <>Scanne le QR code avec ton téléphone<br/>puis appuie sur <strong style={{ color:'#feca57' }}>Démarrer</strong></>
                    : <span style={{ color:'#ff6b6b' }}>En attente de connexion…</span>}
                </p>
                {bestWpm > 0 && <p style={{ color:'#444', fontSize:11, marginTop:8 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></p>}
              </div>
            )}

            {gameState === GAME.PLAYING && (
              <div style={{ width:'100%', textAlign:'center' }}>
                <div style={{ lineHeight:2.4, wordBreak:'break-all', marginBottom:12 }}>
                  {renderPhrase()}
                </div>
                <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${progress}%`, background:'#feca57', borderRadius:2, transition:'width 0.1s' }} />
                </div>
              </div>
            )}

            {gameState === GAME.FINISHED && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize: isTV ? 56 : 42, marginBottom:8 }}>{title.emoji}</div>
                <div style={{ fontSize: isTV ? 44 : 32, fontWeight:'bold', color: title.color }}>{wpm} WPM</div>
                <div style={{ fontSize: isTV ? 20 : 16, color: title.color, marginBottom:12 }}>{title.label}</div>

                {/* Afficher le temps réel si phrase complétée avant le timer */}
                {finishedBy === 'phrase' && (
                  <div style={{ background:'rgba(254,202,87,0.1)', border:'1px solid rgba(254,202,87,0.3)', borderRadius:10, padding:'8px 16px', marginBottom:12, display:'inline-block' }}>
                    <span style={{ color:'#feca57', fontSize: isTV ? 16 : 13 }}>
                      ⏱ Phrase complétée en <strong>{timeTaken}s</strong> !
                    </span>
                  </div>
                )}

                <div style={{ display:'flex', gap:16, justifyContent:'center', marginBottom:12, flexWrap:'wrap' }}>
                  <span style={{ color:'#666', fontSize:12 }}>Précision : <strong style={{ color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' }}>{accuracy}%</strong></span>
                  <span style={{ color:'#666', fontSize:12 }}>Erreurs : <strong style={{ color: errors === 0 ? '#50fa7b' : '#ff6b6b' }}>{errors}</strong></span>
                  {bestWpm > 0 && <span style={{ color:'#666', fontSize:12 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></span>}
                </div>
                <p style={{ color:'#555', fontSize: isTV ? 14 : 12, margin:0 }}>
                  Appuie sur <strong style={{ color:'#50fa7b' }}>Rejouer</strong> depuis le téléphone
                </p>
              </div>
            )}
          </div>

          {/* Clavier visuel flash */}
          <div style={{ flexShrink:0 }}>
            {KEYBOARD_ROWS.map((row, i) => (
              <div key={i} style={{ display:'flex', gap:3, justifyContent:'center', marginBottom:3 }}>
                {row.map(key => {
                  const flash = flashKey === key;
                  return (
                    <div key={key} style={{
                      padding: isTV ? '9px 6px' : '5px 3px',
                      backgroundColor: flash ? 'rgba(254,202,87,0.45)' : 'rgba(255,255,255,0.04)',
                      borderRadius:6, flex: key === '⌫' ? 1.4 : 1, textAlign:'center',
                      fontSize: isTV ? 16 : 11, color: flash ? '#feca57' : '#444',
                      border:`1px solid ${flash ? 'rgba(254,202,87,0.5)' : 'rgba(255,255,255,0.03)'}`,
                      fontFamily:'monospace', transition:'all 0.08s',
                      transform: flash ? 'scale(1.18)' : 'scale(1)',
                    }}>{key}</div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Droite : QR */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', borderRadius:12, padding:14, border:'1px solid rgba(255,255,255,0.07)', width: isTV ? 160 : 130, flexShrink:0 }}>
          <QRCodeSVG value={remoteUrl} size={isTV ? 128 : 100} bgColor="#0f0f1a" fgColor="#ffffff" />
          <p style={{ color:'#555', fontSize:8, margin:0, textAlign:'center' }}>Scanner pour jouer</p>
          <p style={{ color:'#feca57', fontSize: isTV ? 17 : 13, margin:0, fontFamily:'monospace', letterSpacing:3, fontWeight:'bold' }}>{sessionId}</p>
          <div style={{ width:'100%', height:1, background:'rgba(255,255,255,0.05)' }} />
          <p style={{ color:'#333', fontSize:7, margin:0, textAlign:'center', lineHeight:1.5 }}>ou tape ce code<br/>dans /remote</p>
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
