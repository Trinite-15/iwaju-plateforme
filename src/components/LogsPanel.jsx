import { useState } from 'react';
import { logger } from '../logger';

function LogsPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);

  const showLogs = () => {
    setLogs([...logger.getLogs()]);
    setOpen(true);
  };

  return (
    <>
      <button className="logs-button" type="button" tabIndex={0} onClick={showLogs}>
        Journaux
      </button>
      {open && (
        <div className="logs-modal" role="dialog" aria-modal="true">
          <div className="logs-card">
            <div className="logs-header">
              <h2>Journaux techniques</h2>
              <button type="button" tabIndex={0} onClick={() => setOpen(false)}>
                Fermer
              </button>
            </div>
            <pre>{JSON.stringify(logs, null, 2)}</pre>
            <button type="button" tabIndex={0} onClick={() => logger.download()}>
              Télécharger JSON
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default LogsPanel;