import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import logger from '../logger';

export default function HomeMenu() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [isTV, setIsTV] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const tvDetected = ua.includes('smarttv') || 
                       ua.includes('webos') || 
                       ua.includes('tizen') || 
                       ua.includes('vidaa') ||
                       (ua.includes('android') && window.innerWidth > 1920);
    setIsTV(tvDetected);
    logger.info('HomeMenu chargé', { isTV: tvDetected });
  }, []);

  const generateSession = () => {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(id);
    return id;
  };

  const navigateToBoard = (role) => {
    const id = sessionId || generateSession();
    const path = role === 'tv' ? `/board/tv?session=${id}` : `/board/remote?session=${id}`;
    navigate(path);
  };

  const navigateToKeyboard = (role) => {
    const path = role === 'tv' ? '/keyboard/tv' : '/keyboard/remote';
    navigate(path);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%)',
      padding: '24px',
      gap: '32px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: isTV ? '64px' : '48px',
          fontWeight: 'bold',
          color: '#8be9fd',
          marginBottom: '8px',
          textShadow: '0 0 40px rgba(139,233,253,0.2)',
        }}>
          IWAJU
        </h1>
        <p style={{
          fontSize: isTV ? '24px' : '18px',
          color: '#666',
          letterSpacing: '4px',
        }}>
          PLATFORM
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isTV ? 'repeat(2, 1fr)' : '1fr',
        gap: '16px',
        width: '100%',
        maxWidth: isTV ? '800px' : '400px',
      }}>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ fontSize: '14px', color: '#8be9fd', marginBottom: '16px', letterSpacing: '2px' }}>
            🎨 TABLEAU
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => navigateToBoard('tv')}
              style={{
                padding: isTV ? '16px 24px' : '14px 20px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: isTV ? '18px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            >
              📺 Écran principal
            </button>
            <button
              onClick={() => navigateToBoard('remote')}
              style={{
                padding: isTV ? '16px 24px' : '14px 20px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: isTV ? '18px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            >
              📱 Téléphone
            </button>
          </div>
          <div style={{ marginTop: '12px' }}>
            <input
              type="text"
              placeholder="Session ID (optionnel)"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ fontSize: '14px', color: '#feca57', marginBottom: '16px', letterSpacing: '2px' }}>
            ⌨️ CLAVIER
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => navigateToKeyboard('tv')}
              style={{
                padding: isTV ? '16px 24px' : '14px 20px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(254,202,87,0.2)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: isTV ? '18px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            >
              📺 Écran principal
            </button>
            <button
              onClick={() => navigateToKeyboard('remote')}
              style={{
                padding: isTV ? '16px 24px' : '14px 20px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(254,202,87,0.2)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: isTV ? '18px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            >
              📱 Téléphone
            </button>
          </div>
        </div>
      </div>

      <div style={{
        fontSize: '12px',
        color: '#444',
        textAlign: 'center',
        marginTop: '16px',
      }}>
        {isTV ? '📺 Mode Smart TV détecté' : '📱 Mode mobile détecté'}
        <span style={{ display: 'block', marginTop: '4px', fontSize: '10px', color: '#333' }}>
          v1.0 · IWAJU TECH
        </span>
      </div>
    </div>
  );
}