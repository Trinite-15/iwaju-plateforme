import { useState, useEffect, useRef } from 'react';
import logger from '../logger';

export default function LogsPanel({ maxHeight = 300, maxEntries = 100 }) {
  const [logs, setLogs] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [filter, setFilter] = useState('all'); // all, error, warn, info
  const logsContainerRef = useRef(null);

  useEffect(() => {
    const listener = (entry) => {
      setLogs(prev => {
        const newLogs = [...prev, entry];
        if (newLogs.length > maxEntries * 2) {
          return newLogs.slice(-maxEntries);
        }
        return newLogs;
      });
    };
    logger.addListener(listener);
    setLogs(logger.getLogs().slice(-maxEntries));

    return () => logger.removeListener(listener);
  }, [maxEntries]);

  // Scroll automatique vers le bas
  useEffect(() => {
    if (logsContainerRef.current && isVisible) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, isVisible]);

  const getLevelColor = (level) => {
    switch (level) {
      case 'ERROR': return '#ff6b6b';
      case 'WARN': return '#feca57';
      case 'DEBUG': return '#666';
      default: return '#aaa';
    }
  };

  const getLevelBg = (level) => {
    switch (level) {
      case 'ERROR': return 'rgba(255,107,107,0.1)';
      case 'WARN': return 'rgba(254,202,87,0.1)';
      case 'DEBUG': return 'rgba(255,255,255,0.02)';
      default: return 'rgba(255,255,255,0.02)';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.level === 'ERROR' || log.level === 'WARN';
    return log.level === filter.toUpperCase();
  });

  // --- EXPORT DES LOGS ---
  const exportLogs = (format = 'json') => {
    const logsToExport = filteredLogs.length > 0 ? filteredLogs : logs;
    
    if (format === 'json') {
      const data = JSON.stringify(logsToExport, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `iwaju-logs-${new Date().toISOString().slice(0,10)}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      logger.info('Logs exportés en JSON', { count: logsToExport.length });
    } else if (format === 'csv') {
      // Format CSV
      const headers = 'timestamp,level,message,userAgent,url\n';
      const rows = logsToExport.map(log => {
        const msg = log.message.replace(/,/g, ';').replace(/"/g, "'");
        return `${log.timestamp},${log.level},"${msg}",${log.userAgent || ''},${log.url || ''}`;
      }).join('\n');
      const data = headers + rows;
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `iwaju-logs-${new Date().toISOString().slice(0,10)}.csv`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      logger.info('Logs exportés en CSV', { count: logsToExport.length });
    } else if (format === 'text') {
      // Format texte lisible
      const lines = logsToExport.map(log => {
        return `[${log.timestamp}] [${log.level}] ${log.message}${log.data ? ' | Data: ' + JSON.stringify(log.data) : ''}`;
      }).join('\n');
      const blob = new Blob([lines], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `iwaju-logs-${new Date().toISOString().slice(0,10)}.txt`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      logger.info('Logs exportés en TXT', { count: logsToExport.length });
    }
  };

  // --- EFFACER LES LOGS ---
  const clearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          padding: '8px 14px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          color: '#888',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(10px)',
        }}
      >
        📋 Logs
        {logs.filter(l => l.level === 'ERROR').length > 0 && (
          <span style={{
            background: '#ff6b6b',
            color: '#fff',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {logs.filter(l => l.level === 'ERROR').length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: `${maxHeight}px`,
      backgroundColor: 'rgba(15,15,26,0.95)',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(20px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#888' }}>
            📋 Logs ({filteredLogs.length}/{logs.length})
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '2px 8px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: '#aaa',
              fontSize: '11px',
              outline: 'none',
            }}
          >
            <option value="all">Tous</option>
            <option value="error">⚠️ Erreurs</option>
            <option value="warn">⚠️ Avertissements</option>
            <option value="info">ℹ️ Infos</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {/* Export buttons */}
          <button
            onClick={() => exportLogs('json')}
            style={{
              background: 'rgba(139,233,253,0.1)',
              border: '1px solid rgba(139,233,253,0.2)',
              color: '#8be9fd',
              padding: '3px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
            }}
            title="Exporter en JSON"
          >
            📥 JSON
          </button>
          <button
            onClick={() => exportLogs('csv')}
            style={{
              background: 'rgba(80,250,123,0.1)',
              border: '1px solid rgba(80,250,123,0.2)',
              color: '#50fa7b',
              padding: '3px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
            }}
            title="Exporter en CSV"
          >
            📊 CSV
          </button>
          <button
            onClick={() => exportLogs('text')}
            style={{
              background: 'rgba(254,202,87,0.1)',
              border: '1px solid rgba(254,202,87,0.2)',
              color: '#feca57',
              padding: '3px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
            }}
            title="Exporter en TXT"
          >
            📄 TXT
          </button>
          <button
            onClick={clearLogs}
            style={{
              background: 'none',
              border: 'none',
              color: '#444',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '3px 6px',
            }}
            title="Effacer les logs"
          >
            🗑️
          </button>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '0 4px',
            }}
            title="Fermer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs list */}
      <div
        ref={logsContainerRef}
        style={{
          overflow: 'auto',
          flex: 1,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          fontSize: '10px',
          fontFamily: 'monospace',
          maxHeight: `${maxHeight - 60}px`,
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '20px' }}>
            Aucun log {filter !== 'all' ? `(${filter})` : ''}
          </div>
        ) : (
          filteredLogs.slice(-maxEntries).map((entry, i) => (
            <div key={i} style={{
              color: getLevelColor(entry.level),
              backgroundColor: getLevelBg(entry.level),
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              fontSize: '10px',
            }}>
              <span style={{ color: '#444', whiteSpace: 'nowrap' }}>
                {entry.timestamp.slice(11, 19)}
              </span>
              <span style={{
                fontWeight: 'bold',
                minWidth: '45px',
                color: getLevelColor(entry.level),
              }}>
                [{entry.level}]
              </span>
              <span style={{ wordBreak: 'break-all', flex: 1 }}>
                {entry.message}
                {entry.data && (
                  <span style={{ color: '#555', fontSize: '9px', display: 'block' }}>
                    {typeof entry.data === 'object' ? JSON.stringify(entry.data).slice(0, 100) : entry.data}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 12px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        fontSize: '9px',
        color: '#333',
        display: 'flex',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>Logs en mémoire: {logs.length}</span>
        <span>
          Erreurs: {logs.filter(l => l.level === 'ERROR').length} | 
          Warnings: {logs.filter(l => l.level === 'WARN').length}
        </span>
      </div>
    </div>
  );
}