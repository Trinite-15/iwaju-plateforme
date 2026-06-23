import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createKeyboardChannel } from '../../supabaseClient';
import logger from '../../../../logger';

const KEYBOARD_LAYOUT = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X', 'Y', 'Z', '⌫', '␣'],
];

export default function KeyboardTV() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [text, setText] = useState('');
  const [isTV, setIsTV] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsTV(ua.includes('smarttv') || ua.includes('webos') || ua.includes('tizen') || ua.includes('vidaa'));
    
    const logListener = (entry) => {
      setLogEntries(prev => [...prev.slice(-50), entry]);
    };
    logger.addListener(logListener);
    
    return () => logger.removeListener(logListener);
  }, []);

  const connect = () => {
    if (!sessionId) {
      logger.warn('Session ID requis');
      return;
    }

    const channel = createKeyboardChannel(sessionId)
      .on('broadcast', { event: 'key' }, ({ payload }) => {
        const key = payload.key;
        logger.debug('Touche reçue', { key });
        
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
          logger.info('KeyboardTV connecté', { sessionId });
        } else {
          logger.warn('KeyboardTV déconnecté', { status });
        }
      });

    channelRef.current = channel;
    logger.info('Connexion KeyboardTV', { sessionId });
  };

  const disconnect = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnected(false);
    logger.info('KeyboardTV déconnecté');
  };

  const clearText = () => {
    setText('');
    logger.info('Texte effacé');
  };

  const copyText = () => {
    if (text) {
      navigator.clipboard?.writeText(text);
      logger.info('Texte copié', { length: text.length });
    }
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0f0f1a',
      color: '#fff',
      padding: isTV ? '32px' : '20px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#666',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: isTV ? '18px' : '14px',
          }}
        >
          ← Retour
        </button>
        
        <h1 style={{ color: '#feca57', fontSize: isTV ? '36px' : '24px' }}>
          ⌨️ Clavier
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '12px',
            color: connected ? '#50fa7b' : '#ff6b6b',
            backgroundColor: connected ? 'rgba(80,250,123,0.1)' : 'rgba(255,107,107,0.1)',
            padding: '4px 12px',
            borderRadius: '20px',
          }}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </span>
          <span style={{ fontSize: '11px', color: '#444' }}>
            {isTV ? '📺 TV' : '📱 Desktop'}
          </span>
        </div>
      </div>

      {/* Zone de texte */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: isTV ? '24px' : '16px',
        marginBottom: '24px',
        minHeight: isTV ? '120px' : '80px',
        border: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
      }}>
        <div style={{
          fontSize: isTV ? '32px' : '20px',
          color: '#fff',
          wordBreak: 'break-all',
          minHeight: isTV ? '60px' : '40px',
          lineHeight: '1.6',
        }}>
          {text || <span style={{ color: '#444' }}>En attente de saisie...</span>}
        </div>
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '12px',
          fontSize: '11px',
          color: '#444',
        }}>
          {text.length} caractères
        </div>
      </div>

      {/* Contrôles */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="ID de session (ex: ABC123)"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: isTV ? '18px' : '14px',
            width: isTV ? '280px' : '200px',
            outline: 'none',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontFamily: 'monospace',
          }}
        />
        
        {!connected ? (
          <button
            onClick={connect}
            style={{
              padding: '10px 28px',
              backgroundColor: '#50fa7b',
              color: '#0f0f1a',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isTV ? '18px' : '14px',
              fontWeight: 'bold',
            }}
          >
            🔗 Connecter
          </button>
        ) : (
          <button
            onClick={disconnect}
            style={{
              padding: '10px 28px',
              backgroundColor: '#ff6b6b',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isTV ? '18px' : '14px',
              fontWeight: 'bold',
            }}
          >
            🔌 Déconnecter
          </button>
        )}
        
        <button
          onClick={clearText}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#888',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: isTV ? '16px' : '13px',
          }}
        >
          🗑️ Effacer
        </button>
        
        <button
          onClick={copyText}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(139,233,253,0.1)',
            border: '1px solid rgba(139,233,253,0.2)',
            color: '#8be9fd',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: isTV ? '16px' : '13px',
          }}
        >
          📋 Copier
        </button>
      </div>

      {/* Clavier virtuel (affichage) */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: isTV ? '12px' : '8px',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
      }}>
        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
          <div key={rowIndex} style={{
            display: 'flex',
            gap: isTV ? '12px' : '8px',
            justifyContent: 'center',
          }}>
            {row.map((key) => {
              const isSpecial = key === '⌫' || key === '␣';
              return (
                <div key={key} style={{
                  padding: isTV ? '20px 16px' : '14px 10px',
                  backgroundColor: isSpecial ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  minWidth: isSpecial ? (isTV ? '100px' : '70px') : (isTV ? '60px' : '40px'),
                  flex: isSpecial ? 1.5 : 1,
                  textAlign: 'center',
                  fontSize: isTV ? '28px' : '18px',
                  color: isSpecial ? '#888' : '#fff',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontFamily: 'monospace',
                  fontWeight: isSpecial ? 'bold' : 'normal',
                  boxShadow: connected ? '0 0 30px rgba(254,202,87,0.05)' : 'none',
                }}>
                  {key === '␣' ? '␣' : key}
                </div>
              );
            })}
          </div>
        ))}
        
        {/* Indicateur de statut */}
        <div style={{
          textAlign: 'center',
          marginTop: isTV ? '24px' : '16px',
          fontSize: isTV ? '14px' : '11px',
          color: '#444',
        }}>
          {connected ? (
            <span style={{ color: '#50fa7b' }}>✅ Prêt à recevoir les touches</span>
          ) : (
            <span>🔴 Entrez un ID de session et connectez-vous</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: '#333',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        paddingTop: '12px',
      }}>
        <span>IWAJU Keyboard v1.0</span>
        <span>{isTV ? '📺 Mode Smart TV' : '💻 Mode Desktop'}</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}