// logger.js — IWAJU Platform
const logs = [];
const listeners = [];

export const logger = {
  debug: (msg, data) => {
    const entry = { level: 'DEBUG', msg, data, time: new Date().toISOString() };
    logs.push(entry);
    listeners.forEach(fn => fn(entry));
    console.debug(`[DEBUG] ${msg}`, data || '');
  },
  info: (msg, data) => {
    const entry = { level: 'INFO', msg, data, time: new Date().toISOString() };
    logs.push(entry);
    listeners.forEach(fn => fn(entry));
    console.log(`[INFO] ${msg}`, data || '');
  },
  warn: (msg, data) => {
    const entry = { level: 'WARN', msg, data, time: new Date().toISOString() };
    logs.push(entry);
    listeners.forEach(fn => fn(entry));
    console.warn(`[WARN] ${msg}`, data || '');
  },
  error: (msg, err) => {
    const entry = {
      level: 'ERROR', msg,
      error: err?.message,
      stack: err?.stack,
      time: new Date().toISOString(),
    };
    logs.push(entry);
    listeners.forEach(fn => fn(entry));
    console.error(`[ERROR] ${msg}`, err || '');
  },
  addListener: (fn) => {
    if (!listeners.includes(fn)) listeners.push(fn);
  },
  removeListener: (fn) => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  },
  getLogs: () => logs,
  download: () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `iwaju-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

window.onerror = (msg, src, line, col, err) => {
  logger.error(`Global error: ${msg} at ${src}:${line}:${col}`, err);
};
window.onunhandledrejection = (event) => {
  logger.error('Unhandled promise rejection', event.reason);
};

export default logger;