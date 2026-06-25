// KeyboardTV.jsx — Jeu de frappe Smart TV
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createKeyboardChannel } from '../../supabaseClient';
import { logger } from '../../../../logger';

// ── Helpers ────────────────────────────────────────────────────
const getSessionId = () => {
  let id = sessionStorage.getItem('kb-session');
  if (!id) { id = Math.random().toString(36).slice(2, 8).toUpperCase(); sessionStorage.setItem('kb-session', id); }
  return id;
};

const lettersOnly = (str) => str.replace(/ /g, '');

const pickPhrase = (current = '') => {
  const pool = PHRASES.filter(p => p !== current);
  return pool[Math.floor(Math.random() * pool.length)];
};

const getTitle = (wpm) => TITLES.reduce((best, t) => wpm >= t.min ? t : best, TITLES[0]);

// ── Données ────────────────────────────────────────────────────
const PHRASES = [
  "LE CHAT DORT AU SOLEIL.",
  "LA VIE EST UN LONG VOYAGE.",
  "IL FAIT BEAU AUJOURD'HUI.",
  "REGARDE LES ÉTOILES BRILLER.",
  "UNE POMME ROUGE ET SUCRÉE.",
  "LE VENT SOUFFLE DOUCEMENT.",
  "UN CAFÉ CHAUD LE MATIN.",
  "LA MUSIQUE ADOUCIT LES MŒURS.",
  "PRENDS LE TEMPS DE VIVRE.",
  "LA NUIT PORTE CONSEIL.",
  "UN PETIT PAS APRÈS L'AUTRE.",
  "ÉCRIS TON PROPRE DESTIN.",
  "LA PATIENCE EST UNE VERTU.",
  "RIRE FAIT DU BIEN.",
  "GARDE TOUJOURS LE SOURIRE.",
  "LA VÉRITÉ FINIT PAR TRIOMPHER.",
  "LE TEMPS PASSE TROP VITE.",
  "ÉCOUTE LE CHANT DES OISEAUX.",
  "UNE IMAGE VAUT MILLE MOTS.",
  "TOUT VIENT À POINT NOMMÉ.",
  "PORTEZ CE VIEUX WHISKY AU JUGE BLOND QUI FUME.",
  "JUGEZ VITE CE BAFOUEUR AU LOOK TRÈS DANDY.",
  "VOYEZ LE BRICK GÉANT QUE J'EXAMINE PRÈS DU QUAI.",
  "BUVEZ CE GRAND WHISKY QUE JE VOUS APPORTE FIXEMENT.",
  "LE VIF ZÉPHYR JUBILE SUR LES BRANCHES DU KUMQUAT.",
  "UN GROS REQUIN BLANC NAGE PRÈS DU QUAI DE L'ÎLE DE JERSEY.",
  "LE SPHINX JOYEUX A FAIT UN BOND REMARQUABLE SUR LA DIGUE.",
  "FLÂNEZ SUR LE VIEUX QUAI ET ADMIREZ CE MAGNIFIQUE PAYSAGE.",
  "QUINZE JOLIS WAGONS DE BOIS PRÉCIEUX AVANCENT VERS LA MINE.",
  "L'APPRENTISSAGE D'UNE NOUVELLE LANGUE DEMANDE DE LA RÉGULARITÉ.",
  "VOYAGER PERMET DE DÉCOUVRIR DE NOUVELLES CULTURES FASCINANTES.",
  "LA TECHNOLOGIE MODERNE ÉVOLUE À UNE VITESSE IMPRESSIONNANTE.",
  "UN ESPRIT SAIN DANS UN CORPS SAIN EST LA CLÉ DU BONHEUR.",
  "LES PETITS RUISSEAUX FONT LES GRANDES RIVIÈRES, DIT LE PROVERBE.",
  "IL FAUT PARFOIS SORTIR DE SA ZONE DE CONFORT POUR GRANDIR.",
  "LA CRÉATIVITÉ CONSISTE SIMPLEMENT À CONNECTER DES CHOSES ENTRE ELLES.",
  "RIEN N'EST PERMANENT DANS CE MONDE EN PERPÉTUEL CHANGEMENT.",
  "LA PERSÉVÉRANCE EST LE SECRET DE TOUTES LES GRANDES RÉUSSITES.",
  "PRENEZ SOIN DE VOS PENSÉES, CAR ELLES DEVIENNENT VOS MOTS.",
  "LE SUCCÈS N'EST PAS FINAL, L'ÉCHEC N'EST PAS FATAL.",
  "INNOVER, C'EST SAVOIR ABANDONNER DES IDÉES QUI ONT FONCTIONNÉ.",
  "LA LECTURE EST UNE AMITIÉ QUI NE TROMPE JAMAIS PERSONNE.",
  "LE BONHEUR NE SE TROUVE PAS, IL SE CONSTRUIT AU QUOTIDIEN.",
  "CHAQUE JOUR EST UNE NOUVELLE OPPORTUNITÉ DE FAIRE MIEUX.",
  "L'IMAGINATION EST PLUS IMPORTANTE QUE LE SAVOIR ABSOLU.",
  "LE SECRET POUR AVANCER, C'EST TOUT SIMPLEMENT DE COMMENCER.",
  "LES ERREURS SONT LA PREUVE QUE VOUS ESSAYEZ D'APPRENDRE.",
  "SOYEZ LE CHANGEMENT QUE VOUS VOULEZ VOIR DANS CE MONDE.",
  "LA SIMPLICITÉ EST LA SOPHISTICATION SUPRÊME EN ART ET DESIGN.",
  "L'ANTICONSTITUTIONNELLEMENT LONG DISCOURS A FINI PAR LASSER L'AUDITOIRE.",
  "LE DROMADAIRE S'EST ARRÊTÉ BRUSQUEMENT DEVANT L'OASIS ASSÉCHÉE.",
  "LES ALGORITHMES DE CRYPTOGRAPHIE ASYMÉTRIQUE PROTÈGENT NOS DONNÉES.",
  "L'ÉPHÉMÈRE BEAUTÉ D'UN COUCHER DE SOLEIL AUTOMNAL M'ÉMEUT TOUJOURS.",
  "LE VIEUX VIOLONISTE EXÉCUTAIT UN CONCERTO D'UNE COMPLEXITÉ INOUÏE.",
  "DES VAGUES TUMULTUEUSES S'ÉCRASAIENT VIOLEMMENT CONTRE LA FALAISE ABRUPTE.",
  "LA JUXTAPOSITION DE CES COULEURS CRÉE UN CONTRASTE SAISISSANT.",
  "CE LABYRINTHE INEXTRICABLE A DÉCOURAGÉ LES PLUS HARDIS EXPLORATEURS.",
  "L'AMBIGUÏTÉ DE SA RÉPONSE LAISSA L'ASSEMBLÉE DANS UNE PERPLEXITÉ TOTALE.",
  "LES CHERCHEURS ÉTUDIENT L'IMPACT DE LA BIODIVERSITÉ SUR L'ÉCOSYSTÈME.",
  "UNE ATMOSPHÈRE DÉLÉTÈRE RÉGNAIT DANS CETTE VIEILLE RUELLE SOMBRE.",
  "LE DACTYLOGRAPHE S'ENTRAÎNE QUOTIDIENNEMENT POUR BATTRE SON RECORD.",
  "L'INGÉNIERIE LOGICIELLE REQUIERT UNE RIGUEUR QUASI MATHÉMATIQUE.",
  "DES ÉTINCELLES ÉBLOUISSANTES JAILLISSAIENT DE LA FORGE EN ACTIVITÉ.",
  "CE PROJET COLLABORATIF NÉCESSITE UNE SYNCHRONISATION PARFAITE DES TÂCHES.",
  "LES VARIATIONS CLIMATIQUES PERTURBENT LES CYCLES DE LA FAUNE LOCALE.",
  "UNE LUEUR INCANDESCENTE PERÇAIT À TRAVERS L'ÉPAIS BROUILLARD MATINAL.",
  "L'ARCHITECTURE GOTHIQUE SE DISTINGUE PAR SES VOÛTES D'OGIVES ÉLANCÉES.",
  "LA CYBERSÉCURITÉ EST DEVENUE UN ENJEU GÉOPOLITIQUE MAJEUR CE SIÈCLE.",
  "DES RÉFLEXES FULGURANTS SONT INDISPENSABLES POUR CE GENRE D'EXERCICE.",
  "LE PLUS GRAND RISQUE EST DE N'EN PRENDRE AUCUN.",
  "LE SEUL MOYEN DE FAIRE DU BON TRAVAIL, C'EST D'AIMER CE QUE VOUS FAITES.",
  "QUE VOS CHOIX SOIENT LE REFLET DE VOS ESPOIRS, NON DE VOS PEURS.",
  "LE BONHEUR EST PARFOIS CACHÉ DANS L'INCONNU.",
  "LA CONNAISSANCE PARLE, MAIS LA SAGESSE ÉCOUTE.",
  "IL N'Y A PAS DE RÉUSSITE FACILE NI D'ÉCHECS DÉFINITIFS.",
  "EXIGE BEAUCOUP DE TOI-MÊME ET ATTENDS PEU DES AUTRES.",
  "LES CHAUSSETTES DE L'ARCHIDUCHESSE SONT-ELLES SÈCHES, ARCHISÈCHES ?",
  "UN CHASSEUR SACHANT CHASSER SAIT CHASSER SANS SON CHIEN.",
  "CINQ CHIENS CHASSENT SIX CHATS DANS LA FORÊT SOMBRE.",
  "DIS-MOI, PETIT CHAT, QUAND CESSERAS-TU D'ÊTRE SI CAPRICIEUX ?",
  "TROIS PETITES TRUITES CUITES, TROIS PETITES TRUITES CRUES.",
  "SI SIX SCIES SCIENT SIX CYPRÈS, SIX CENT SCIES SCIENT SIX CENT CYPRÈS.",
  "ZAZA ZÉZAYE AU MILIEU DES SEIZE CHAISES DE SA TANTE.",
  "UN GÉNÉREUX DÉJEUNER RÉGÉNÉRERAIT DES GÉNÉRAUX DÉGÉNÉRÉS.",
  "SON CHAT SONGE À SA SOURIS SOUS SON GRAND CHAPEAU DE PAILLE.",
  "PAPILLON PAPILLONNE DANS LE PAVILLON SOUS LES YEUX DE LA PAPESSE.",
];

const TITLES = [
  { min: 0,  emoji: '🐢', label: 'Débutant',         color: '#888888' },
  { min: 10, emoji: '🚶', label: 'Apprenti',          color: '#8be9fd' },
  { min: 20, emoji: '⚡', label: 'Intermédiaire',     color: '#50fa7b' },
  { min: 30, emoji: '🔥', label: 'Confirmé',          color: '#ffb86c' },
  { min: 45, emoji: '💎', label: 'Expert',            color: '#bd93f9' },
  { min: 60, emoji: '🏆', label: 'Champion IWAJU',    color: '#feca57' },
  { min: 80, emoji: '👑', label: 'Maître du Clavier', color: '#ff6b6b' },
];

const GAME = { IDLE: 'idle', PLAYING: 'playing', FINISHED: 'finished' };

const KEYBOARD_ROWS = [
  ['A','Z','E','R','T','Y','U','I','O','P'],
  ['Q','S','D','F','G','H','J','K','L','M'],
  ['W','X','C','V','B','N','⌫'],
];

// ── Composant ──────────────────────────────────────────────────
export default function KeyboardTV() {
  const navigate    = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [connected, setConnected] = useState(false);
  const [isTV,      setIsTV]      = useState(false);
  const [flashKey,  setFlashKey]  = useState(null);

  const [gameState,    setGameState]    = useState(GAME.IDLE);
  const [phrase,       setPhrase]       = useState('');
  const [typedLetters, setTypedLetters] = useState('');
  const [timeLeft,     setTimeLeft]     = useState(60);
  const [timeTaken,    setTimeTaken]    = useState(0);
  const [wpm,          setWpm]          = useState(0);
  const [accuracy,     setAccuracy]     = useState(100);
  const [errors,       setErrors]       = useState(0);
  const [bestWpm,      setBestWpm]      = useState(0);
  const [finishedBy,   setFinishedBy]   = useState('timer');

  const channelRef    = useRef(null);
  const timerRef      = useRef(null);
  const startRef      = useRef(null);
  const totalRef      = useRef(0);
  const errorRef      = useRef(0);
  const gameStateRef  = useRef(GAME.IDLE);
  const phraseRef     = useRef('');
  const phraseLetters = useRef('');
  const typedRef      = useRef('');

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => {
    phraseRef.current     = phrase;
    phraseLetters.current = lettersOnly(phrase);
  }, [phrase]);
  useEffect(() => { typedRef.current = typedLetters; }, [typedLetters]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
  }, []);

  const broadcastState = useCallback((state) => {
    channelRef.current?.send({ type: 'broadcast', event: 'game_state', payload: { state } });
  }, []);

  // ── Connexion Supabase ──────────────────────────────────────
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

  useEffect(() => {
    if (!connected) return;
    broadcastState(gameState);
  }, [connected]); // eslint-disable-line

  // ── Timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== GAME.PLAYING) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
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

  // ── Démarrer ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const p = pickPhrase();
    phraseRef.current     = p;
    phraseLetters.current = lettersOnly(p);
    typedRef.current      = '';
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

  // ── Traitement touche — WPM calculé hors setTyped ──────────
  const handleKey = useCallback((key) => {
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 140);

    if (key === '⌫') {
      const updated = typedRef.current.slice(0, -1);
      typedRef.current = updated;
      setTypedLetters(updated);
      return;
    }

    if (key === '␣' || key === ' ') return;

    if (!startRef.current) startRef.current = Date.now();
    totalRef.current += 1;

    const target   = phraseLetters.current;
    const pos      = typedRef.current.length;
    const expected = target[pos];

    if (key !== expected) {
      errorRef.current += 1;
      setErrors(prev => prev + 1);
    }

    const next = typedRef.current + key;
    typedRef.current = next;
    setTypedLetters(next);

    // WPM ici, jamais dans un setState imbriqué
    const elapsedMin = (Date.now() - startRef.current) / 60000;
    if (elapsedMin > 0) setWpm(Math.round((next.length / 5) / elapsedMin));

    const acc = totalRef.current > 0
      ? Math.round(((totalRef.current - errorRef.current) / totalRef.current) * 100)
      : 100;
    setAccuracy(acc);

    // Phrase terminée → fin immédiate
    if (next.length >= target.length) {
      clearInterval(timerRef.current);
      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      setTimeTaken(elapsed);
      setFinishedBy('phrase');
      setGameState(GAME.FINISHED);
      broadcastState(GAME.FINISHED);
    }
  }, [broadcastState]);

  useEffect(() => {
    if (gameState === GAME.FINISHED) setBestWpm(prev => Math.max(prev, wpm));
  }, [gameState]); // eslint-disable-line

  // ── Rendu phrase — espaces affichés mais non évalués ────────
  const renderPhrase = () => {
    let letterIdx = 0;
    return phrase.split('').map((char, i) => {
      if (char === ' ') {
        return <span key={i} style={{ fontFamily: 'monospace', fontSize: isTV ? '26px' : '18px' }}>{'\u00A0'}</span>;
      }
      const myIdx = letterIdx++;
      let color = '#444', bg = 'transparent';
      if (myIdx < typedLetters.length) {
        const ok = typedLetters[myIdx] === char;
        color = ok ? '#50fa7b' : '#ff6b6b';
        bg    = ok ? 'rgba(80,250,123,0.08)' : 'rgba(255,107,107,0.15)';
      } else if (myIdx === typedLetters.length) {
        color = '#fff'; bg = 'rgba(254,202,87,0.25)';
      }
      return (
        <span key={i} style={{ color, backgroundColor: bg, borderRadius: 3, padding: '0 1px', fontFamily: 'monospace', fontSize: isTV ? '26px' : '18px', letterSpacing: 2 }}>
          {char}
        </span>
      );
    });
  };

  const title      = getTitle(wpm);
  const timerColor = timeLeft <= 10 ? '#ff6b6b' : timeLeft <= 20 ? '#ffb86c' : '#50fa7b';
  const remoteUrl  = `${window.location.origin}/keyboard-master/remote?session=${sessionId}`;
  const progress   = phraseLetters.current.length > 0
    ? Math.round((typedLetters.length / phraseLetters.current.length) * 100)
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

      <div style={{ display:'flex', gap:14, flex:1, minHeight:0 }}>

        {/* Gauche */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>

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

          <div style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'16px 20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>

            {gameState === GAME.IDLE && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize: isTV ? 52 : 38, marginBottom:12 }}>⌨️</div>
                <p style={{ color:'#666', fontSize: isTV ? 17 : 13, marginBottom:20, lineHeight:1.7 }}>
                  {connected
                    ? <>Scanne le QR avec ton téléphone<br/>puis appuie sur <strong style={{ color:'#feca57' }}>Démarrer</strong></>
                    : <span style={{ color:'#ff6b6b' }}>En attente de connexion…</span>}
                </p>
                {bestWpm > 0 && <p style={{ color:'#444', fontSize:11 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></p>}
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
                {finishedBy === 'phrase' && (
                  <div style={{ background:'rgba(254,202,87,0.1)', border:'1px solid rgba(254,202,87,0.3)', borderRadius:10, padding:'8px 16px', marginBottom:12, display:'inline-block' }}>
                    <span style={{ color:'#feca57', fontSize: isTV ? 15 : 12 }}>⏱ Phrase complétée en <strong>{timeTaken}s</strong> !</span>
                  </div>
                )}
                <div style={{ display:'flex', gap:16, justifyContent:'center', marginBottom:12, flexWrap:'wrap' }}>
                  <span style={{ color:'#666', fontSize:12 }}>Précision : <strong style={{ color: accuracy >= 90 ? '#50fa7b' : '#ffb86c' }}>{accuracy}%</strong></span>
                  <span style={{ color:'#666', fontSize:12 }}>Erreurs : <strong style={{ color: errors === 0 ? '#50fa7b' : '#ff6b6b' }}>{errors}</strong></span>
                  {bestWpm > 0 && <span style={{ color:'#666', fontSize:12 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></span>}
                </div>
                <p style={{ color:'#555', fontSize: isTV ? 14 : 12, margin:0 }}>Appuie sur <strong style={{ color:'#50fa7b' }}>Rejouer</strong> depuis le téléphone</p>
              </div>
            )}
          </div>

          {/* Clavier visuel */}
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