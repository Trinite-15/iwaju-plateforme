import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createKeyboardChannel } from '../../supabaseClient';
import { generateCode } from '../../utils/generateCode';
import logger from '../../../../logger';

const KEYBOARD_LAYOUT = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X', 'Y', 'Z'],
];

export default function KeyboardRemote() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const channelRef = useRef(null);
  const feedbackTimeout = useRef(null);

  useEffect(() => {
    const detectOrientation = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    detectOrientation();
    window.addEventListener('resize', detectOrientation);
    window.addEventListener('orientationchange', () => setTimeout(detectOrientation, 300));
    
    return () => {
      window.removeEventListener('resize', detectOrientation);
      window.removeEventListener('orientationchange', detectOrientation);
    };
  }, []);

  const connect = useCallback(() => {
    const id = sessionId || generateCode();
    setSessionId(id);

    const channel = createKeyboardChannel(id)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          setFeedback('✅ Connecté !');
          logger.info('KeyboardRemote connecté', { sessionId: id });
          setTimeout(() => setFeedback(''), 2000);
        } else {
          logger.warn('KeyboardRemote déconnecté', { status });
        }
      });

    channelRef.current = channel;
  }, [sessionId]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnected(false);
    setFeedback('🔌 Déconnecté');
    logger.info('KeyboardRemote déconnecté');
    setTimeout(() => setFeedback(''), 2000);
  }, []);

  const sendKey = useCallback((key) => {
    if (!connected || !channelRef.current) {
      setFeedback('⚠️ Connectez-vous d\'abord');
      setTimeout(() => setFeedback(''), 1500);
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'key',
      payload: { key },
    });

    // Feedback local
    if (key === '⌫' || key === 'Backspace') {
      setText(prev => prev.slice(0, -1));
    } else if (key === '␣' || key === 'Space') {
      setText(prev => prev + ' ');
    } else {
      setText(prev => prev + key);
    }

    // Haptic feedback (si disponible)
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    logger.debug('Touche envoyée', { key });
  }, [connected]);

  const generateNewCode = useCallback(() => {
    const code = generateCode();
    setSessionId(code);
    logger.debug('Nouveau code généré', { code });
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (feedbackTimeout.current) {
        clearTimeout(feedbackTimeout.current);
      }
    };
  }, []);

  const isLandscape = orientation === 'landscape';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0f0f1a',
      color: '#fff',
      padding: isLandscape ? '8px 16px' : '12px',
      fontFamily: 'system-ui, sans-serif',
      touchAction: 'none',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isLandscape ? '6px' : '10px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#666',
            padding: isLandscape ? '4px 10px' : '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: isLandscape ? '11px' : '13px',
          }}
        >
          ←
        </button>
        
        <span style={{ fontSize: isLandscape ? '13px' : '16px', color: '#feca57' }}>
          ⌨️ Clavier
        </span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: isLandscape ? '8px' : '10px',
            color: connected ? '#50fa7b' : '#ff6b6b',
          }}>
            {connected ? '●' : '○'}
          </span>
          <span style={{ fontSize: isLandscape ? '8px' : '9px', color: '#444' }}>
            {sessionId || '---'}
          </span>
        </div>
      </div>

      {/* Zone de texte */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        padding: isLandscape ? '6px 10px' : '10px 12px',
        marginBottom: isLandscape ? '6px' : '10px',
        minHeight: isLandscape ? '30px' : '48px',
        border: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: isLandscape ? '14px' : '18px',
          color: '#fff',
          wordBreak: 'break-all',
          minHeight: isLandscape ? '20px' : '30px',
        }}>
          {text || <span style={{ color: '#444' }}>...</span>}
        </div>
      </div>

      {/* Contrôles */}
      <div style={{
        display: 'flex',
        gap: isLandscape ? '4px' : '6px',
        marginBottom: isLandscape ? '6px' : '10px',
        flexWrap: 'wrap',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <input
          type="text"
          placeholder="Code"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          style={{
            flex: 1,
            padding: isLandscape ? '4px 8px' : '6px 10px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: isLandscape ? '12px' : '14px',
            outline: 'none',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            minWidth: '60px',
          }}
        />
        
        {!connected ? (
          <button
            onClick={connect}
            style={{
              padding: isLandscape ? '4px 12px' : '6px 16px',
              backgroundColor: '#50fa7b',
              color: '#0f0f1a',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: isLandscape ? '11px' : '13px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            Connecter
          </button>
        ) : (
          <button
            onClick={disconnect}
            style={{
              padding: isLandscape ? '4px 12px' : '6px 16px',
              backgroundColor: '#ff6b6b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: isLandscape ? '11px' : '13px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            Déco
          </button>
        )}
        
        <button
          onClick={generateNewCode}
          style={{
            padding: isLandscape ? '4px 8px' : '6px 10px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#888',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: isLandscape ? '11px' : '13px',
          }}
        >
          🎲
        </button>
      </div>

      {/* Message de feedback */}
      {feedback && (
        <div style={{
          textAlign: 'center',
          fontSize: isLandscape ? '10px' : '12px',
          color: feedback.includes('✅') ? '#50fa7b' : feedback.includes('⚠️') ? '#feca57' : '#ff6b6b',
          marginBottom: isLandscape ? '4px' : '6px',
          flexShrink: 0,
        }}>
          {feedback}
        </div>
      )}

      {/* Clavier */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: isLandscape ? '4px' : '6px',
        maxWidth: '500px',
        margin: '0 auto',
        width: '100%',
      }}>
        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
          <div key={rowIndex} style={{
            display: 'flex',
            gap: isLandscape ? '4px' : '6px',
            justifyContent: 'center',
          }}>
            {row.map((key) => (
              <button
                key={key}
                onTouchStart={(e) => {
                  e.preventDefault();
                  sendKey(key);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  sendKey(key);
                }}
                style={{
                  flex: 1,
                  padding: isLandscape ? '10px 2px' : '16px 4px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: isLandscape ? '14px' : '18px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'transform 0.05s',
                  ':active': {
                    transform: 'scale(0.92)',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                  },
                }}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
        
        <div style={{
          display: 'flex',
          gap: isLandscape ? '4px' : '6px',
          justifyContent: 'center',
        }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendKey('␣'); }}
            onMouseDown={(e) => { e.preventDefault(); sendKey('␣'); }}
            style={{
              flex: 2,
              padding: isLandscape ? '10px 2px' : '16px 4px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '6px',
              color: '#888',
              fontSize: isLandscape ? '12px' : '14px',
              cursor: 'pointer',
              touchAction: 'manipulation',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ␣ Espace
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); sendKey('⌫'); }}
            onMouseDown={(e) => { e.preventDefault(); sendKey('⌫'); }}
            style={{
              flex: 1,
              padding: isLandscape ? '10px 2px' : '16px 4px',
              backgroundColor: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.2)',
              borderRadius: '6px',
              color: '#ff6b6b',
              fontSize: isLandscape ? '16px' : '20px',
              cursor: 'pointer',
              touchAction: 'manipulation',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ⌫
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: isLandscape ? '4px 8px' : '6px 12px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        fontSize: isLandscape ? '7px' : '8px',
        color: '#333',
        marginTop: isLandscape ? '4px' : '6px',
      }}>
        <span>Scanne avec ton téléphone</span>
        <span>{isLandscape ? '🌅' : '📱'} {orientation}</span>
        <span>Session: {sessionId || '---'}</span>
      </div>
    </div>
  );
}