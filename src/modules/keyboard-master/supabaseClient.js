import { createClient } from '@supabase/supabase-js';
import logger from '../../logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  logger.warn('Variables d\'environnement Supabase manquantes pour Keyboard');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const createKeyboardChannel = (sessionId) => {
  if (!sessionId) {
    logger.error('createKeyboardChannel: sessionId requis');
    return null;
  }

  const channelName = `keyboard-${sessionId}`;
  logger.debug('Création channel Keyboard', { channelName });

  return supabase.channel(channelName, {
    config: {
      broadcast: {
        ack: true,
      },
    },
  });
};

export const cleanupKeyboardChannel = (channel) => {
  if (!channel) return;
  try {
    const topic = channel.topic;
    channel.unsubscribe();
    logger.debug('Channel Keyboard nettoyé', { topic });
  } catch (err) {
    logger.warn('Erreur nettoyage channel Keyboard', { error: err.message });
  }
};

export default supabase;