import { QRCodeSVG } from 'qrcode.react';

function QRPanel({ sessionId }) {
  const origin    = window.location.origin;
  const mobileUrl = `${origin}/board/remote?session=${sessionId}`;

  return (
    <div className="qr-panel">
      <QRCodeSVG
        value={mobileUrl}
        size={150}
        bgColor="#171713"
        fgColor="#ffffff"
      />
      <p>Session : {sessionId}</p>
    </div>
  );
}

export default QRPanel;