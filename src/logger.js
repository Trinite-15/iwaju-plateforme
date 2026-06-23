const MAX_LOGS = 500;
let logs = [];

export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.listeners = [];
    this.persistKey = 'iwaju_logs';
    this.loadPersisted();
  }

  loadPersisted() {
    try {
      const saved = localStorage.getItem(this.persistKey);
      if (saved) {
        logs = JSON.parse(saved).slice(-MAX_LOGS);
      }
    } catch (_) {
      logs = [];
    }
  }

  savePersisted() {
    try {
      localStorage.setItem(this.persistKey, JSON.stringify(logs.slice(-MAX_LOGS)));
    } catch (_) {}
  }

  addListener(fn) {
    this.listeners.push(fn);
  }

  removeListener(fn) {
    this.listeners = this.listeners.filter(l => l !== fn);
  }

  log(level, message, data = null) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? this.sanitize(data) : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    logs.push(entry);
    if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
    this.savePersisted();

    this.listeners.forEach(fn => fn(entry));

    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(`[${entry.timestamp}] ERROR:`, message, data || '');
        break;
      case LOG_LEVELS.WARN:
        console.warn(`[${entry.timestamp}] WARN:`, message, data || '');
        break;
      default:
        console.log(`[${entry.timestamp}] ${level}:`, message, data || '');
    }
  }

  sanitize(obj) {
    if (!obj) return null;
    try {
      const str = JSON.stringify(obj);
      const sanitized = str.replace(/(secret|token|key|password|auth|api[_-]?key)[\":]\\s*[\":]?\\s*[\"']?([^\"',}]+)[\"']?/gi, '$1":"***REDACTED***"');
      return JSON.parse(sanitized);
    } catch (_) {
      return String(obj);
    }
  }

  debug(message, data) { this.log(LOG_LEVELS.DEBUG, message, data); }
  info(message, data) { this.log(LOG_LEVELS.INFO, message, data); }
  warn(message, data) { this.log(LOG_LEVELS.WARN, message, data); }
  error(message, data) { this.log(LOG_LEVELS.ERROR, message, data); }

  getLogs() { return [...logs]; }
  clearLogs() { logs = []; this.savePersisted(); }
}

export const logger = new Logger();
export default logger;