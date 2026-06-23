import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../modules/board/supabaseClient';
import { useCleanup } from './useCleanup';
import logger from '../logger';

/**
 * Hook pour gérer les channels Supabase Realtime
 * 
 * @param {string} channelName - Nom du channel
 * @param {Object} options - Options
 * @param {string} options.event - Nom de l'événement (défaut: 'message')
 * @param {boolean} options.presence - Activer la présence
 * @param {string} options.presenceKey - Clé de présence
 * @param {Function} onMessage - Callback pour les messages
 * @param {Function} onPresence - Callback pour la présence
 * @param {Function} onError - Callback pour les erreurs
 * @returns {Object} { channel, connected, error, send, presence }
 */
export function useSupabaseChannel(
  channelName,
  options = {},
  onMessage,
  onPresence,
  onError
) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [presence, setPresence] = useState({});
  const channelRef = useRef(null);
  const isMounted = useRef(true);
  const { register } = useCleanup();

  const eventName = options.event || 'message';
  const enablePresence = options.presence || false;
  const presenceKey = options.presenceKey || 'user';

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!channelName) {
      setError(new Error('Nom de channel requis'));
      return;
    }

    // Créer le channel
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true },
        presence: enablePresence ? { key: presenceKey } : undefined,
      },
    });

    // Gestion des messages
    if (onMessage) {
      channel.on('broadcast', { event: eventName }, ({ payload }) => {
        if (isMounted.current) {
          onMessage(payload);
        }
      });
    }

    // Gestion de la présence
    if (enablePresence && onPresence) {
      channel.on('presence', { event: 'sync' }, () => {
        if (isMounted.current) {
          const state = channel.presenceState();
          const userList = Object.values(state).flat();
          setPresence(userList);
          onPresence(userList);
        }
      });

      // Nouvel utilisateur
      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (isMounted.current) {
          logger.debug('Utilisateur rejoint', { key, count: newPresences.length });
        }
      });

      // Utilisateur parti
      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (isMounted.current) {
          logger.debug('Utilisateur parti', { key, count: leftPresences.length });
        }
      });
    }

    // Gestion des erreurs système
    channel.on('system', { event: 'error' }, (payload) => {
      if (isMounted.current) {
        const err = new Error(payload.error || 'Erreur channel');
        setError(err);
        setConnected(false);
        logger.error('Erreur channel', { channelName, error: payload.error });
        if (onError) onError(err);
      }
    });

    // Souscription
    channel.subscribe((status) => {
      if (!isMounted.current) return;

      if (status === 'SUBSCRIBED') {
        setConnected(true);
        setError(null);
        logger.info('Channel connecté', { channelName });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false);
        setError(new Error(`Statut: ${status}`));
        logger.warn('Channel déconnecté', { channelName, status });
        if (onError) onError(new Error(`Statut: ${status}`));
      }
    });

    channelRef.current = channel;
    register(channel);

    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (_) {}
        channelRef.current = null;
      }
    };
  }, [channelName, eventName, enablePresence, presenceKey, onMessage, onPresence, onError, register]);

  /**
   * Envoyer un message sur le channel
   */
  const send = useCallback((event, payload) => {
    if (!channelRef.current || !connected) {
      logger.warn('Tentative d\'envoi sans connexion', { channelName });
      return false;
    }

    try {
      channelRef.current.send({
        type: 'broadcast',
        event: event || eventName,
        payload,
      });
      return true;
    } catch (err) {
      logger.error('Erreur envoi message', { error: err.message });
      setError(err);
      return false;
    }
  }, [connected, channelName, eventName]);

  /**
   * Rejoindre la présence
   */
  const track = useCallback(async (data) => {
    if (!channelRef.current || !connected || !enablePresence) return false;
    try {
      await channelRef.current.track(data);
      return true;
    } catch (err) {
      logger.error('Erreur track présence', { error: err.message });
      return false;
    }
  }, [connected, enablePresence]);

  /**
   * Quitter la présence
   */
  const untrack = useCallback(async () => {
    if (!channelRef.current || !connected || !enablePresence) return false;
    try {
      await channelRef.current.untrack();
      return true;
    } catch (err) {
      logger.error('Erreur untrack présence', { error: err.message });
      return false;
    }
  }, [connected, enablePresence]);

  return {
    channel: channelRef.current,
    connected,
    error,
    send,
    presence,
    track,
    untrack,
  };
}

export default useSupabaseChannel;