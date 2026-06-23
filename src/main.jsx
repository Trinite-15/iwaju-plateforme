import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/tv.css';

console.log('🚀 IWAJU Platform v1.0');
console.log('📱 Mode:', window.innerWidth > 1024 ? 'TV/Desktop' : 'Mobile');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);