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

// Normaliser un caractère : retire accents, met en minuscule
const normalize = (c) => c?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '';

// Comparer deux caractères de façon souple (insensible casse + accents)
const charMatch = (typed, expected) => {
  if (!typed || !expected) return false;
  if (typed === expected) return true;
  return normalize(typed) === normalize(expected);
};

const pickPhrase = (current = '') => {
  const pool = PHRASES.filter(p => p !== current);
  return pool[Math.floor(Math.random() * pool.length)];
};

const getTitle = (wpm) => TITLES.reduce((best, t) => wpm >= t.min ? t : best, TITLES[0]);

// ── Phrases ────────────────────────────────────────────────────
const PHRASES = [
  "Le chat dort au soleil.",
  "La vie est un long voyage.",
  "Il fait beau aujourd'hui.",
  "Regarde les étoiles briller.",
  "Une pomme rouge et sucrée.",
  "Le vent souffle doucement.",
  "Un café chaud le matin.",
  "La musique adoucit les mœurs.",
  "Prends le temps de vivre.",
  "La nuit porte conseil.",
  "Un petit pas après l'autre.",
  "Écris ton propre destin.",
  "La patience est une vertu.",
  "Rire fait du bien.",
  "Garde toujours le sourire.",
  "La vérité finit par triompher.",
  "Le temps passe trop vite.",
  "Écoute le chant des oiseaux.",
  "Une image vaut mille mots.",
  "Tout vient à point nommé.",
  "Portez ce vieux whisky au juge blond qui fume.",
  "Jugez vite ce bafoueur au look très dandy.",
  "Voyez le brick géant que j'examine près du quai.",
  "Buvez ce grand whisky que je vous apporte fixement.",
  "Le vif zéphyr jubile sur les branches du kumquat.",
  "Un gros requin blanc nage près du quai de l'île de Jersey.",
  "Le sphinx joyeux a fait un bond remarquable sur la digue.",
  "Flânez sur le vieux quai et admirez ce magnifique paysage.",
  "Quinze jolis wagons de bois précieux avancent vers la mine.",
  "L'apprentissage d'une nouvelle langue demande de la régularité.",
  "Voyager permet de découvrir de nouvelles cultures fascinantes.",
  "La technologie moderne évolue à une vitesse impressionnante.",
  "Un esprit sain dans un corps sain est la clé du bonheur.",
  "Les petits ruisseaux font les grandes rivières, dit le proverbe.",
  "Il faut parfois sortir de sa zone de confort pour grandir.",
  "La créativité consiste simplement à connecter des choses entre elles.",
  "Rien n'est permanent dans ce monde en perpétuel changement.",
  "La persévérance est le secret de toutes les grandes réussites.",
  "Prenez soin de vos pensées, car elles deviennent vos mots.",
  "Le succès n'est pas final, l'échec n'est pas fatal.",
  "Innover, c'est savoir abandonner des idées qui ont fonctionné.",
  "La lecture est une amitié qui ne trompe jamais personne.",
  "Le bonheur ne se trouve pas, il se construit au quotidien.",
  "Chaque jour est une nouvelle opportunité de faire mieux.",
  "L'imagination est plus importante que le savoir absolu.",
  "Le secret pour avancer, c'est tout simplement de commencer.",
  "Les erreurs sont la preuve que vous essayez d'apprendre.",
  "Soyez le changement que vous voulez voir dans ce monde.",
  "La simplicité est la sophistication suprême en art et design.",
  "L'anticonstitutionnellement long discours a fini par lasser l'auditoire.",
  "Le dromadaire s'est arrêté brusquement devant l'oasis asséchée.",
  "Les algorithmes de cryptographie asymétrique protègent nos données.",
  "L'éphémère beauté d'un coucher de soleil automnal m'émeut toujours.",
  "Le vieux violoniste exécutait un concerto d'une complexité inouïe.",
  "Des vagues tumultueuses s'écrasaient violemment contre la falaise abrupte.",
  "La juxtaposition de ces couleurs crée un contraste saisissant.",
  "Ce labyrinthe inextricable a découragé les plus hardis explorateurs.",
  "L'ambiguïté de sa réponse laissa l'assemblée dans une perplexité totale.",
  "Les chercheurs étudient l'impact de la biodiversité sur l'écosystème.",
  "Une atmosphère délétère régnait dans cette vieille ruelle sombre.",
  "Le dactylographe s'entraîne quotidiennement pour battre son record.",
  "L'ingénierie logicielle requiert une rigueur quasi mathématique.",
  "Des étincelles éblouissantes jaillissaient de la forge en activité.",
  "Ce projet collaboratif nécessite une synchronisation parfaite des tâches.",
  "Les variations climatiques perturbent les cycles de la faune locale.",
  "Une lueur incandescente perçait à travers l'épais brouillard matinal.",
  "L'architecture gothique se distingue par ses voûtes d'ogives élancées.",
  "La cybersécurité est devenue un enjeu géopolitique majeur ce siècle.",
  "Des réflexes fulgurants sont indispensables pour ce genre d'exercice.",
  "Le plus grand risque est de n'en prendre aucun.",
  "Le seul moyen de faire du bon travail, c'est d'aimer ce que vous faites.",
  "Que vos choix soient le reflet de vos espoirs, non de vos peurs.",
  "Le bonheur est parfois caché dans l'inconnu.",
  "La connaissance parle, mais la sagesse écoute.",
  "Il n'y a pas de réussite facile ni d'échecs définitifs.",
  "Exige beaucoup de toi-même et attends peu des autres.",
  "Les chaussettes de l'archiduchesse sont-elles sèches, archisèches ?",
  "Un chasseur sachant chasser sait chasser sans son chien.",
  "Cinq chiens chassent six chats dans la forêt sombre.",
  "Dis-moi, petit chat, quand cesseras-tu d'être si capricieux ?",
  "Trois petites truites cuites, trois petites truites crues.",
  "Si six scies scient six cyprès, six cent scies scient six cent cyprès.",
  "Zaza zézaye au milieu des seize chaises de sa tante.",
  "Un généreux déjeuner régénérerait des généraux dégénérés.",
  "Son chat songe à sa souris sous son grand chapeau de paille.",
  "Papillon papillonne dans le pavillon sous les yeux de la papesse.",
];

// ── Titres ─────────────────────────────────────────────────────
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

  const [gameState,  setGameState]  = useState(GAME.IDLE);
  const [phrase,     setPhrase]     = useState('');
  // typed = tableau de caractères tapés, index pour index avec la phrase
  const [typed,      setTyped]      = useState([]);
  const [timeLeft,   setTimeLeft]   = useState(60);
  const [timeTaken,  setTimeTaken]  = useState(0);
  const [wpm,        setWpm]        = useState(0);
  const [accuracy,   setAccuracy]   = useState(100);
  const [errors,     setErrors]     = useState(0);
  const [bestWpm,    setBestWpm]    = useState(0);
  const [finishedBy, setFinishedBy] = useState('timer');

  const channelRef   = useRef(null);
  const timerRef     = useRef(null);
  const startRef     = useRef(null);
  const totalRef     = useRef(0);
  const errorRef     = useRef(0);
  const gameStateRef = useRef(GAME.IDLE);
  const phraseRef    = useRef('');
  const typedRef     = useRef([]);  // tableau sync

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { phraseRef.current = phrase; }, [phrase]);
  useEffect(() => { typedRef.current = typed; }, [typed]);

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
    phraseRef.current = p;
    typedRef.current  = [];
    setPhrase(p);
    setTyped([]);
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

  // ── Traitement touche ───────────────────────────────────────
  const handleKey = useCallback((key) => {
    // Flash sur la touche correspondante (majuscule pour le visuel)
    setFlashKey(key.toUpperCase());
    setTimeout(() => setFlashKey(null), 140);

    // Backspace — retire le dernier caractère tapé
    if (key === '⌫') {
      const updated = typedRef.current.slice(0, -1);
      typedRef.current = updated;
      setTyped([...updated]);
      return;
    }

    // Entrée → traiter comme espace
    const char = key === '\n' ? ' ' : key;

    if (!startRef.current) startRef.current = Date.now();
    totalRef.current += 1;

    const phrase  = phraseRef.current;
    const pos     = typedRef.current.length;
    const expected = phrase[pos] ?? '';

    const ok = charMatch(char, expected);
    if (!ok) {
      errorRef.current += 1;
      setErrors(prev => prev + 1);
    }

    const next = [...typedRef.current, char];
    typedRef.current = next;
    setTyped(next);

    // WPM — calculé ici, jamais dans un setState imbriqué
    const elapsedMin = (Date.now() - startRef.current) / 60000;
    if (elapsedMin > 0) setWpm(Math.round((next.length / 5) / elapsedMin));

    // Précision
    const acc = totalRef.current > 0
      ? Math.round(((totalRef.current - errorRef.current) / totalRef.current) * 100)
      : 100;
    setAccuracy(acc);

    // Phrase terminée → fin immédiate
    if (next.length >= phrase.length) {
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

  // ── Rendu phrase ────────────────────────────────────────────
  // Chaque caractère de la phrase comparé au caractère tapé à la même position
  const renderPhrase = () => {
    return phraseRef.current.split('').map((char, i) => {
      let color = '#444', bg = 'transparent';

      if (i < typed.length) {
        const ok = charMatch(typed[i], char);
        color = ok ? '#50fa7b' : '#ff6b6b';
        bg    = ok ? 'rgba(80,250,123,0.08)' : 'rgba(255,107,107,0.15)';
      } else if (i === typed.length) {
        // Curseur sur la prochaine lettre à taper
        color = '#fff'; bg = 'rgba(254,202,87,0.25)';
      }

      return (
        <span key={i} style={{
          color, backgroundColor: bg,
          borderRadius: 3,
          padding: '0 1px',
          fontFamily: 'monospace',
          fontSize: isTV ? '24px' : '17px',
          letterSpacing: 1,
          whiteSpace: 'pre', // preserve les espaces
        }}>
          {char}
        </span>
      );
    });
  };

  const title      = getTitle(wpm);
  const timerColor = timeLeft <= 10 ? '#ff6b6b' : timeLeft <= 20 ? '#ffb86c' : '#50fa7b';
  const remoteUrl  = `${window.location.origin}/keyboard-master/remote?session=${sessionId}`;
  const progress   = phrase.length > 0 ? Math.round((typed.length / phrase.length) * 100) : 0;

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
                    ? <>Scanne le QR avec ton téléphone<br/>puis appuie sur <strong style={{ color:'#feca57' }}>Démarrer</strong></>
                    : <span style={{ color:'#ff6b6b' }}>En attente de connexion…</span>}
                </p>
                {bestWpm > 0 && <p style={{ color:'#444', fontSize:11 }}>Record : <strong style={{ color:'#feca57' }}>{bestWpm} WPM</strong></p>}
              </div>
            )}

            {gameState === GAME.PLAYING && (
              <div style={{ width:'100%', textAlign:'center' }}>
                <div style={{ lineHeight:2.4, wordBreak:'break-word', marginBottom:12, textAlign:'left' }}>
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
