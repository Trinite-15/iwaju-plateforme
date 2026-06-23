import { Routes, Route } from 'react-router-dom';
import HomeMenu from './components/HomeMenu';
import LogsPanel from './components/LogsPanel';  // ← AJOUTER
import BoardTV from './modules/board/BoardTV';
import BoardRemote from './modules/board/BoardRemote';
import KeyboardTV from './modules/keyboard-master/components/tv/KeyboardTV';
import keyboardRemote from './modules/keyboard-master/components/smartphone/keyboardRemote';
import { logger } from './logger';

function App() {
  logger.debug('App montée');

  return (
    <>
      <Routes>
        <Route path="/" element={<HomeMenu />} />
        <Route path="/board/tv" element={<BoardTV />} />
        <Route path="/board/remote" element={<BoardRemote />} />
        <Route path="/keyboard/tv" element={<KeyboardTV />} />
        <Route path="/keyboard/remote" element={<KeyboardRemote />} />
      </Routes>
      
      {/* ← AJOUTER LogsPanel global */}
      <LogsPanel maxHeight={350} maxEntries={150} />
    </>
  );
}

export default App;