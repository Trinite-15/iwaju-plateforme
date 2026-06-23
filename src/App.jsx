// App.jsx — IWAJU Platform
import { useEffect } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import HomeMenu     from './components/HomeMenu';
import LogsPanel    from './components/LogsPanel';
import BoardTV      from './modules/board/BoardTV';
import BoardRemote  from './modules/board/BoardRemote';
import KeyboardTV   from './modules/keyboard-master/components/tv/KeyboardTV';
import KeyboardRemote from './modules/keyboard-master/components/smartphone/KeyboardRemote';
import { logger }   from './logger';

const requestFullscreen = () => {
  const root = document.documentElement;
  const req  = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) req.call(root);
};

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    logger.debug('IWAJU Platform démarrée');
    const onKeyDown = (e) => {
      logger.info('Touche pressée', { key: e.key });
      if (e.key === 'f' || e.key === 'F') requestFullscreen();
      if ((e.key === 'Escape' || e.key === 'Backspace') && window.location.pathname !== '/') {
        navigate('/');
      }
      if (e.key === 'Enter') document.activeElement?.click?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/"                      element={<HomeMenu />} />
      <Route path="/board"                 element={<BoardTV />} />
      <Route path="/board/remote"          element={<BoardRemote />} />
      <Route path="/keyboard-master"       element={<KeyboardTV />} />
      <Route path="/keyboard-master/remote" element={<KeyboardRemote />} />
      <Route path="*" element={
        <div className="not-found">
          <h1>Page introuvable</h1>
          <Link to="/">Retour menu</Link>
        </div>
      } />
    </Routes>
  );
}

export default App;