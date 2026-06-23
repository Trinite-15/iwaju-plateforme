import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createKeyboardChannel } from '../../supabaseClient';
import logger from '../../../../logger';

const generateSessionId = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

export default function KeyboardTV() {
  const navigate = useNavigate();
  const [connected, setConnected]   = useState(false);
  const [sessionId, setSessionId]   = useState('');
  const [text, setText]             = useState('');
  const [isTV, setIsTV]             = useState(false);
  const [flashKey, setFlashKey]     = useState(null);
  const channelRef = useRef(null);

  // Détection TV + fix logger
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
  }, []);

  // Auto-connect avec session générée au montage
  useEffect(() => {
    const id = generateSessionId();
    setSessionId(id);

    const channel = createKeyboardChannel(id)
      .on('broadcast', { event: 'key' }, ({ payload }) => {
        const key = payload.key;
        logger.debug('Touche reçue', { key });

        // Flash visuel de la touche
        setFlashKey(key);
        setTimeout(() => setFlashKey(null), 150);

        if (key === '⌫' || key === 'Backspace') {
          setText(prev => prev.slice(0, -1));
        } else if (key === '␣' || key === 'Space') {
          setText(prev => prev + ' ');
        } else {
          setText(prev => prev + key);
        }
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
    };
  }, []);

  const clearText = () => { setText(''); logger.info('Texte effacé'); };
  const copyText  = () => {
    if (text) {
      navigator.clipboard?.writeText(text);
      logger.info('Texte copié', { length: text.length });
    }
  };

  const remoteUrl = sessionId
    ? `${window.location.origin}/keyboard-master/remote?session=${sessionId}`
    : '';

  const KEYBOARD_LAYOUT = [
    ['A','B','C','D','E','F','G','H','I','J'],
    ['K','L','M','N','O','P','Q','R','S','T'],
    ['U','V','W','X','Y','Z','⌫','␣'],
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: '#0f0f1a', color: '#fff',
      padding: isTV ? '32px' : '20px', fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#666', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '18px' : '14px' }}>
          ← Retour
        </button>
        <h1 style={{ color: '#feca57', fontSize: isTV ? '36px' : '24px', margin: 0 }}>⌨️ Keyboard Master</h1>
        <span style={{ fontSize: '12px', color: connected ? '#50fa7b' : '#ff6b6b', backgroundColor: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)', padding: '4px 12px', borderRadius: '20px' }}>
          {connected ? '● Connecté' : '○ Connexion…'}
        </span>
      </div>

      {/* Contenu principal : texte + QR côte à côte */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', alignItems: 'flex-start' }}>

        {/* Zone texte */}
        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: isTV ? '24px' : '16px', minHeight: isTV ? '120px' : '80px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
          <div style={{ fontSize: isTV ? '32px' : '20px', color: '#fff', wordBreak: 'break-all', minHeight: isTV ? '60px' : '40px', lineHeight: '1.6' }}>
            {text || <span style={{ color: '#444' }}>En attente de saisie...</span>}
          </div>
          <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '11px', color: '#444' }}>
            {text.length} caractères
          </div>
        </div>

        {/* QR code + session */}
        {remoteUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', minWidth: isTV ? '180px' : '140px' }}>
            <QRCodeSVG value={remoteUrl} size={isTV ? 140 : 110} bgColor="#0f0f1a" fgColor="#ffffff" />
            <p style={{ color: '#888', fontSize: '10px', margin: 0, textAlign: 'center', fontFamily: 'monospace' }}>Scanner pour contrôler</p>
            <p style={{ color: '#feca57', fontSize: isTV ? '20px' : '16px', margin: 0, fontFamily: 'monospace', letterSpacing: '3px', fontWeight: 'bold' }}>{sessionId}</p>
            <p style={{ color: '#555', fontSize: '9px', margin: 0, textAlign: 'center' }}>ou entrer ce code sur<br/>/keyboard-master/remote</p>
          </div>
        )}
      </div>

      {/* Boutons action */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={clearText} style={{ padding: '8px 18px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '16px' : '13px' }}>
          🗑️ Effacer
        </button>
        <button onClick={copyText} style={{ padding: '8px 18px', backgroundColor: 'rgba(139,233,253,0.1)', border: '1px solid rgba(139,233,253,0.2)', color: '#8be9fd', borderRadius: '8px', cursor: 'pointer', fontSize: isTV ? '16px' : '13px' }}>
          📋 Copier
        </button>
      </div>

      {/* Clavier visuel (affichage des touches) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isTV ? '10px' : '6px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', gap: isTV ? '10px' : '6px', justifyContent: 'center' }}>
            {row.map((key) => {
              const isSpecial = key === '⌫' || key === '␣';
              const isFlashing = flashKey === key;
              return (
                <div key={key} style={{
                  padding: isTV ? '18px 14px' : '12px 8px',
                  backgroundColor: isFlashing
                    ? 'rgba(254,202,87,0.4)'
                    : isSpecial ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  minWidth: isSpecial ? (isTV ? '90px' : '60px') : (isTV ? '56px' : '36px'),
                  flex: isSpecial ? 1.5 : 1,
                  textAlign: 'center',
                  fontSize: isTV ? '26px' : '16px',
                  color: isFlashing ? '#feca57' : isSpecial ? '#888' : '#fff',
                  border: `1px solid ${isFlashing ? 'rgba(254,202,87,0.6)' : 'rgba(255,255,255,0.05)'}`,
                  fontFamily: 'monospace',
                  transition: 'background-color 0.1s, color 0.1s',
                  transform: isFlashing ? 'scale(1.1)' : 'scale(1)',
                }}>
                  {key}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: isTV ? '14px' : '11px', color: '#444' }}>
          {connected
            ? <span style={{ color: '#50fa7b' }}>✅ Prêt — scanne le QR code avec ton téléphone</span>
            : <span style={{ color: '#ff6b6b' }}>⏳ Connexion en cours…</span>
          }
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
        <span>IWAJU Keyboard v2.0</span>
        <span>{isTV ? '📺 Smart TV' : '💻 Desktop'}</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}
