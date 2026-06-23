import { useEffect, useRef, useCallback } from 'react';
import logger from '../logger';

/**
 * Hook pour gérer automatiquement le nettoyage des ressources
 * Évite les fuites de mémoire sur les Smart TV
 * 
 * @returns {Object} { register, registerTimeout, registerInterval }
 */
export function useCleanup() {
  const subscriptions = useRef([]);
  const timeouts = useRef([]);
  const intervals = useRef([]);
  const isMounted = useRef(true);

  // Marquer le composant comme monté
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Enregistre une souscription (channel, observable, etc.)
   * Nettoyage automatique au démontage
   */
  const register = useCallback((subscription) => {
    if (!subscription) return null;
    subscriptions.current.push(subscription);
    return subscription;
  }, []);

  /**
   * Enregistre un timeout
   * Nettoyage automatique au démontage
   */
  const registerTimeout = useCallback((timeout) => {
    if (!timeout) return null;
    timeouts.current.push(timeout);
    return timeout;
  }, []);

  /**
   * Enregistre un interval
   * Nettoyage automatique au démontage
   */
  const registerInterval = useCallback((interval) => {
    if (!interval) return null;
    intervals.current.push(interval);
    return interval;
  }, []);

  // Nettoyage automatique au démontage
  useEffect(() => {
    return () => {
      let count = 0;

      // Nettoyer les souscriptions
      subscriptions.current.forEach((sub) => {
        try {
          if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe();
            count++;
          } else if (sub && typeof sub.close === 'function') {
            sub.close();
            count++;
          }
        } catch (err) {
          logger.warn('Erreur nettoyage souscription', { error: err.message });
        }
      });
      subscriptions.current = [];

      // Nettoyer les timeouts
      timeouts.current.forEach((t) => {
        try {
          clearTimeout(t);
          count++;
        } catch (_) {}
      });
      timeouts.current = [];

      // Nettoyer les intervals
      intervals.current.forEach((i) => {
        try {
          clearInterval(i);
          count++;
        } catch (_) {}
      });
      intervals.current = [];

      if (count > 0) {
        logger.debug('Cleanup effectué', { resourcesFreed: count });
      }
    };
  }, []);

  return { register, registerTimeout, registerInterval };
}

/**
 * Hook simplifié pour nettoyer un channel Supabase
 * 
 * @param {RealtimeChannel} channel - Channel à nettoyer
 */
export function useChannelCleanup(channel) {
  useEffect(() => {
    if (!channel) return;

    const channelRef = channel;

    return () => {
      try {
        if (channelRef && typeof channelRef.unsubscribe === 'function') {
          channelRef.unsubscribe();
          logger.debug('Channel nettoyé', { channel: channelRef.topic });
        }
      } catch (err) {
        logger.warn('Erreur nettoyage channel', { error: err.message });
      }
    };
  }, [channel]);
}

/**
 * Hook pour nettoyer plusieurs channels
 * 
 * @param {Array} channels - Liste des channels à nettoyer
 */
export function useChannelsCleanup(channels) {
  useEffect(() => {
    if (!channels || channels.length === 0) return;

    const channelRefs = channels.filter(Boolean);

    return () => {
      channelRefs.forEach((channel) => {
        try {
          if (channel && typeof channel.unsubscribe === 'function') {
            channel.unsubscribe();
            logger.debug('Channel nettoyé', { channel: channel.topic });
          }
        } catch (err) {
          logger.warn('Erreur nettoyage channel', { error: err.message });
        }
      });
    };
  }, [channels]);
}

export default useCleanup;