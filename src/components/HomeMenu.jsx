import { Link } from 'react-router-dom';
import LogsPanel from './LogsPanel';

const requestFullscreen = () => {
  const root = document.documentElement;
  const req  = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) req.call(root);
};

function HomeMenu() {
  return (
    <main className="home-menu">
      <button className="fullscreen-button" type="button" tabIndex={0} onClick={requestFullscreen}>
        Plein écran
      </button>
      <section className="home-content">
        <p className="kicker">Console télé</p>
        <h1>Plateforme IWAJU</h1>
        <div className="module-grid">
          <Link className="module-card" tabIndex={0} to="/keyboard-master">
            <span className="module-icon">KM</span>
            <strong>Maître du clavier</strong>
            <small>Jeu de frappe synchronisé avec un contrôle mobile</small>
          </Link>
          <Link className="module-card" tabIndex={0} to="/board">
            <span className="module-icon">IB</span>
            <strong>Tableau IWAJU</strong>
            <small>Tableau partagé pour dessiner en temps réel</small>
          </Link>
        </div>
      </section>
      <LogsPanel />
    </main>
  );
}

export default HomeMenu;