// supabaseClient.js — Module Keyboard Master
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../logger';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  logger.warn('Variables Supabase manquantes pour Keyboard');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

// ⚠️ PAS de ack:true — ça bloque les broadcasts entre clients différents
export const createKeyboardChannel = (sessionId) => {
  if (!sessionId) {
    logger.error('createKeyboardChannel: sessionId requis');
    return null;
  }
  const channelName = `keyboard-${sessionId}`;
  logger.debug('Création channel Keyboard', { channelName });
  return supabase.channel(channelName);
};

export default supabase;