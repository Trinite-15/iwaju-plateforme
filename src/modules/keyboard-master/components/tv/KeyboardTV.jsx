import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createKeyboardChannel } from '../../supabaseClient';
import logger from '../../../../logger';

// ---- Liste des phrases pour le jeu ----
const PHRASES = [
  "Le soleil brille dans le ciel bleu",
  "La vie est belle et pleine de surprises",
  "Un ordinateur peut résoudre des problèmes complexes",
  "La musique adoucit les moeurs",
  "Le temps passe vite quand on s'amuse",
  "Une bonne alimentation est essentielle pour la santé",
  "Les étoiles brillent dans la nuit noire",
  "La connaissance est une source de pouvoir",
  "Le courage permet de surmonter les obstacles",
  "La patience est une vertu précieuse",
  "Un grand voyage commence par un premier pas",
  "L'amitié est un trésor inestimable",
  "Le savoir est la clé de la liberté",
  "La nature est pleine de merveilles à découvrir",
  "Chaque jour est une nouvelle opportunité"
];

// ---- Titres selon le niveau ----
const TITLES = {
  bronze: { name: "Apprenti Clavier", minWpm: 0, emoji: "🥉", color: "#cd7f32" },
  silver: { name: "Dactylo Confirmé", minWpm: 20, emoji: "🥈", color: "#c0c0c0" },
  gold: { name: "Maître du Clavier", minWpm: 40, emoji: "🥇", color: "#ffd700" },
  platinum: { name: "Légende du Clavier", minWpm: 60, emoji: "💎", color: "#e5e4e2" },
  diamond: { name: "Dieu du Clavier", minWpm: 80, emoji: "👑", color: "#b9f2ff" }
};

const generateSessionId = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

export default function KeyboardTV() {
  const navigate = useNavigate();
  const [connected, setConnected]   = useState(false);
  const [sessionId, setSessionId]   = useState('');
  const [isTV, setIsTV]             = useState(false);
  const channelRef = useRef(null);

  // ---- État du jeu ----
  const [targetPhrase, setTargetPhrase] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [title, setTitle] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [flashKey, setFlashKey] = useState(null);
  const timerInterval = useRef(null);

  // Détection TV
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
    // Choisir une phrase aléatoire au démarrage
    const randomPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setTargetPhrase(randomPhrase);
  }, []);

  // ---- Calcul des statistiques ----
  const calculateStats = useCallback(() => {
    if (!startTime || !endTime) return;
    
    const timeInMinutes = (endTime - startTime) / 60000;
    const words = targetPhrase.split(' ').length;
    const wpmCalculated = Math.round(words / timeInMinutes);
    setWpm(wpmCalculated);
    
    const totalChars = targetPhrase.length;
    const accuracyCalculated = Math.round(((totalChars - totalErrors) / totalChars) * 100);
    setAccuracy(Math.min(100, accuracyCalculated));
    
    // Déterminer le titre
    let foundTitle = null;
    const titleKeys = Object.keys(TITLES).sort((a, b) => TITLES[b].minWpm - TITLES[a].minWpm);
    for (const key of titleKeys) {
      if (wpmCalculated >= TITLES[key].minWpm) {
        foundTitle = { ...TITLES[key], level: key };
        break;
      }
    }
    if (!foundTitle) {
      foundTitle = { ...TITLES.bronze, level: 'bronze' };
    }
    setTitle(foundTitle);
    setShowResults(true);
    
    logger.info('Partie terminée', { 
      wpm: wpmCalculated, 
      accuracy: accuracyCalculated, 
      title: foundTitle.name,
      time: timeInMinutes,
      errors: totalErrors
    });
  }, [startTime, endTime, targetPhrase, totalErrors]);

  // ---- Gestion des touches reçues ----
  const handleKeyPress = useCallback((key) => {
    if (isGameFinished) return;

    // Démarrer le jeu au premier appui
    if (!isGameActive && !isGameFinished) {
      setIsGameActive(true);
      setStartTime(Date.now());
      setCurrentIndex(0);
      setTotalErrors(0);
      setTypedText('');
      setShowResults(false);
      setElapsedTime(0);
      setWpm(0);
      setAccuracy(100);
      setTitle(null);
      
      // Démarrer le minuteur
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      timerInterval.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    // Flash visuel
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 150);

    if (key === '⌫' || key === 'Backspace') {
      // Backspace : revenir en arrière
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setTypedText(prev => prev.slice(0, -1));
      }
      return;
    }

    if (key === '␣' || key === 'Space') {
      // Ne pas traiter l'espace comme une lettre à vérifier
      // On l'ajoute simplement si on attend un espace
      const expectedChar = targetPhrase[currentIndex];
      if (expectedChar === ' ') {
        setCurrentIndex(prev => prev + 1);
        setTypedText(prev => prev + ' ');
        // Vérifier si la phrase est terminée
        if (currentIndex + 1 >= targetPhrase.length) {
          finishGame();
        }
      } else {
        // Mauvaise touche (espace alors qu'on attend une lettre)
        setTotalErrors(prev => prev + 1);
        logger.warn('Lettre incorrecte', { expected: expectedChar, received: '␣' });
      }
      return;
    }

    // Lettre normale
    const expectedChar = targetPhrase[currentIndex];
    
    if (!expectedChar) return;

    if (key === expectedChar) {
      // Lettre correcte
      setCurrentIndex(prev => prev + 1);
      setTypedText(prev => prev + key);
      
      // Vérifier si la phrase est terminée
      if (currentIndex + 1 >= targetPhrase.length) {
        finishGame();
      }
    } else {
      // Lettre incorrecte
      setTotalErrors(prev => prev + 1);
      logger.warn('Lettre incorrecte', { expected: expectedChar, received: key });
    }
  }, [isGameActive, isGameFinished, targetPhrase, currentIndex]);

  // ---- Fin du jeu ----
  const finishGame = useCallback(() => {
    setIsGameActive(false);
    setIsGameFinished(true);
    setEndTime(Date.now());
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    calculateStats();
  }, [calculateStats]);

  // ---- Réinitialiser le jeu ----
  const resetGame = useCallback(() => {
    setTypedText('');
    setCurrentIndex(0);
    setTotalErrors(0);
    setIsGameActive(false);
    setIsGameFinished(false);
    setShowResults(false);
    setStartTime(null);
    setEndTime(null);
    setElapsedTime(0);
    setWpm(0);
    setAccuracy(100);
    setTitle(null);
    const randomPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setTargetPhrase(randomPhrase);
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    logger.info('Jeu réinitialisé');
  }, []);

  // ---- Connexion Supabase ----
  useEffect(() => {
    const id = generateSessionId();
    setSessionId(id);

    const channel = createKeyboardChannel(id)
      .on('broadcast', { event: 'key' }, ({ payload }) => {
        const key = payload.key;
        logger.debug('Touche reçue', { key });
        handleKeyPress(key);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          logger.info('KeyboardTV connecté', { sessionId: id });
        } else {
          setConnected(false);
          logger.warn('KeyboardTV channel', { status });
        }
      });

    channelRef.current = channel;
    logger.info('KeyboardTV démarré', { sessionId: id });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [handleKeyPress]);

  // ---- Formater le temps ----
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const remoteUrl = sessionId
    ? `${window.location.origin}/keyboard/remote?session=${sessionId}`
    : '';

  // ---- Affichage de la phrase avec mise en évidence ----
  const renderPhrase = () => {
    const chars = targetPhrase.split('');
    return chars.map((char, index) => {
      let style = {
        fontSize: isTV ? '28px' : '20px',
        transition: 'color 0.2s',
        fontFamily: 'monospace',
      };
      
      if (index < currentIndex) {
        // Lettres déjà tapées (correctes)
        style.color = '#50fa7b';
      } else if (index === currentIndex && isGameActive) {
        // Lettre en cours
        style.color = '#feca57';
        style.textDecoration = 'underline';
        style.textDecorationColor = '#feca57';
      } else {
        // Lettres non tapées
        style.color = '#444';
      }
      
      // Afficher les espaces de manière visible
      const displayChar = char === ' ' ? '␣' : char;
      
      return (
        <span key={index} style={style}>
          {displayChar}
        </span>
      );
    });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: '#0f0f1a', color: '#fff',
      padding: isTV ? '32px' : '20px', fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#666', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '18px' : '14px' }}>
          ← Retour
        </button>
        <h1 style={{ color: '#feca57', fontSize: isTV ? '36px' : '24px', margin: 0 }}>⌨️ Keyboard Master</h1>
        <span style={{ fontSize: '12px', color: connected ? '#50fa7b' : '#ff6b6b', backgroundColor: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)', padding: '4px 12px', borderRadius: '20px' }}>
          {connected ? '● Connecté' : '○ Connexion…'}
        </span>
      </div>

      {/* ---- Statistiques en temps réel ---- */}
      <div style={{ 
        display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap',
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px 20px',
        border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontSize: '12px' }}>⏱️</span>
          <span style={{ color: '#fff', fontSize: isTV ? '20px' : '16px', fontFamily: 'monospace' }}>
            {isGameActive || isGameFinished ? formatTime(elapsedTime) : '00:00'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontSize: '12px' }}>📊 WPM</span>
          <span style={{ color: '#feca57', fontSize: isTV ? '20px' : '16px', fontFamily: 'monospace', fontWeight: 'bold' }}>
            {wpm > 0 ? wpm : '-'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontSize: '12px' }}>🎯 Précision</span>
          <span style={{ color: '#50fa7b', fontSize: isTV ? '20px' : '16px', fontFamily: 'monospace', fontWeight: 'bold' }}>
            {accuracy < 100 ? `${accuracy}%` : '-'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontSize: '12px' }}>❌ Erreurs</span>
          <span style={{ color: '#ff6b6b', fontSize: isTV ? '20px' : '16px', fontFamily: 'monospace', fontWeight: 'bold' }}>
            {totalErrors}
          </span>
        </div>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ color: '#666', fontSize: '12px' }}>🏆</span>
            <span style={{ color: title.color, fontSize: isTV ? '18px' : '14px', fontWeight: 'bold' }}>
              {title.emoji} {title.name}
            </span>
          </div>
        )}
      </div>

      {/* ---- Contenu principal : phrase + QR ---- */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', flex: 1, minHeight: 0 }}>

        {/* Zone de la phrase */}
        <div style={{ 
          flex: 1, 
          backgroundColor: 'rgba(255,255,255,0.05)', 
          borderRadius: '12px', 
          padding: isTV ? '24px' : '16px', 
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: isTV ? '150px' : '100px',
        }}>
          {showResults ? (
            // ---- Résultats finaux ----
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: isTV ? '48px' : '32px', marginBottom: '8px' }}>
                {title?.emoji}
              </div>
              <div style={{ fontSize: isTV ? '28px' : '20px', color: '#feca57', fontWeight: 'bold' }}>
                {title?.name}
              </div>
              <div style={{ fontSize: isTV ? '20px' : '16px', color: '#fff', marginTop: '8px' }}>
                {wpm} Mots/Minute · {accuracy}% de précision
              </div>
              <div style={{ fontSize: isTV ? '16px' : '12px', color: '#666', marginTop: '8px' }}>
                Temps: {formatTime(elapsedTime)} · {totalErrors} erreur{totalErrors > 1 ? 's' : ''}
              </div>
              <button
                onClick={resetGame}
                style={{
                  marginTop: '16px',
                  padding: '12px 32px',
                  backgroundColor: '#50fa7b',
                  color: '#0f0f1a',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: isTV ? '18px' : '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                🔄 Nouvelle partie
              </button>
            </div>
          ) : (
            // ---- Affichage de la phrase ----
            <div style={{ 
              fontSize: isTV ? '28px' : '20px', 
              lineHeight: '1.8',
              textAlign: 'center',
              letterSpacing: '2px',
              padding: '10px',
              wordBreak: 'break-all',
            }}>
              {targetPhrase ? renderPhrase() : <span style={{ color: '#444' }}>Chargement...</span>}
            </div>
          )}
          
          {/* Indicateur de statut */}
          {!showResults && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#444' }}>
              {isGameActive ? (
                <span style={{ color: '#50fa7b' }}>⌨️ En cours de frappe...</span>
              ) : isGameFinished ? (
                <span style={{ color: '#feca57' }}>✅ Terminé !</span>
              ) : (
                <span style={{ color: '#666' }}>⏳ Commencez à taper sur le téléphone</span>
              )}
            </div>
          )}
        </div>

        {/* QR code + session */}
        {remoteUrl && (
          <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', 
            background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', 
            border: '1px solid rgba(255,255,255,0.08)', 
            minWidth: isTV ? '180px' : '140px',
            flexShrink: 0,
            justifyContent: 'center',
          }}>
            <QRCodeSVG value={remoteUrl} size={isTV ? 140 : 110} bgColor="#0f0f1a" fgColor="#ffffff" />
            <p style={{ color: '#888', fontSize: '10px', margin: 0, textAlign: 'center', fontFamily: 'monospace' }}>Scanner pour contrôler</p>
            <p style={{ color: '#feca57', fontSize: isTV ? '20px' : '16px', margin: 0, fontFamily: 'monospace', letterSpacing: '3px', fontWeight: 'bold' }}>{sessionId}</p>
            <p style={{ color: '#555', fontSize: '9px', margin: 0, textAlign: 'center' }}>
              ou /keyboard/remote?session={sessionId}
            </p>
          </div>
        )}
      </div>

      {/* ---- Boutons action ---- */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={resetGame} style={{ padding: '8px 18px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '16px' : '13px' }}>
          🔄 Nouvelle phrase
        </button>
        <button onClick={() => { logger.clearLogs(); }} style={{ padding: '8px 18px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#666', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '16px' : '13px' }}>
          🗑️ Effacer logs
        </button>
      </div>

      {/* ---- Clavier visuel (affichage des touches) ---- */}
      <div style={{ 
        flexShrink: 0, 
        display: 'flex', flexDirection: 'column', justifyContent: 'center', 
        gap: isTV ? '8px' : '5px', maxWidth: '700px', margin: '0 auto', width: '100%' 
      }}>
        {[
          ['A','B','C','D','E','F','G','H','I','J'],
          ['K','L','M','N','O','P','Q','R','S','T'],
          ['U','V','W','X','Y','Z'],
        ].map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', gap: isTV ? '8px' : '5px', justifyContent: 'center' }}>
            {row.map((key) => {
              const isFlashing = flashKey === key;
              return (
                <div key={key} style={{
                  padding: isTV ? '12px 10px' : '8px 6px',
                  backgroundColor: isFlashing ? 'rgba(254,202,87,0.4)' : 'rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  minWidth: isTV ? '40px' : '28px',
                  flex: 1,
                  textAlign: 'center',
                  fontSize: isTV ? '18px' : '12px',
                  color: isFlashing ? '#feca57' : '#555',
                  border: `1px solid ${isFlashing ? 'rgba(254,202,87,0.5)' : 'rgba(255,255,255,0.03)'}`,
                  fontFamily: 'monospace',
                  transition: 'all 0.1s',
                  transform: isFlashing ? 'scale(1.05)' : 'scale(1)',
                }}>
                  {key}
                </div>
              );
            })}
          </div>
        ))}
        {/* Espace et Backspace */}
        <div style={{ display: 'flex', gap: isTV ? '8px' : '5px', justifyContent: 'center' }}>
          <div style={{
            flex: 3,
            padding: isTV ? '12px 10px' : '8px 6px',
            backgroundColor: flashKey === '␣' ? 'rgba(254,202,87,0.4)' : 'rgba(255,255,255,0.06)',
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: isTV ? '14px' : '10px',
            color: flashKey === '␣' ? '#feca57' : '#444',
            border: `1px solid ${flashKey === '␣' ? 'rgba(254,202,87,0.5)' : 'rgba(255,255,255,0.03)'}`,
            fontFamily: 'monospace',
            transition: 'all 0.1s',
            transform: flashKey === '␣' ? 'scale(1.05)' : 'scale(1)',
          }}>
            ␣ Espace
          </div>
          <div style={{
            flex: 1,
            padding: isTV ? '12px 10px' : '8px 6px',
            backgroundColor: flashKey === '⌫' ? 'rgba(255,107,107,0.3)' : 'rgba(255,107,107,0.1)',
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: isTV ? '18px' : '14px',
            color: flashKey === '⌫' ? '#ff6b6b' : '#666',
            border: `1px solid ${flashKey === '⌫' ? 'rgba(255,107,107,0.5)' : 'rgba(255,107,107,0.2)'}`,
            fontFamily: 'monospace',
            transition: 'all 0.1s',
            transform: flashKey === '⌫' ? 'scale(1.05)' : 'scale(1)',
          }}>
            ⌫
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', flexShrink: 0 }}>
        <span>IWAJU Keyboard v2.0</span>
        <span>{isTV ? '📺 Smart TV' : '💻 Desktop'}</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}