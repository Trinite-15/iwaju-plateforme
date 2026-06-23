import { QRCodeSVG } from 'qrcode.react';

export default function QRPanel({ sessionId, url }) {
  const fullUrl = url || `${window.location.origin}/board/remote?session=${sessionId}`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '24px',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <QRCodeSVG
          value={fullUrl}
          size={180}
          level="H"
          includeMargin={true}
          fgColor="#1a1a2e"
          bgColor="#ffffff"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#aaa', fontSize: '14px', margin: '4px 0' }}>
          Scannez ce QR code
        </p>
        <code style={{
          color: '#8be9fd',
          fontSize: '11px',
          background: 'rgba(255,255,255,0.05)',
          padding: '4px 12px',
          borderRadius: '6px',
        }}>
          {fullUrl}
        </code>
      </div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        Session: <strong style={{ color: '#8be9fd' }}>{sessionId}</strong>
      </div>
    </div>
  );
}