// useSupabaseChannel.js — gère l'abonnement Supabase + cleanup
import { useEffect, useRef } from 'react';

export function useSupabaseChannel(supabase, channelName, onEvent, onStatus) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!channelName) return;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        onEvent?.(payload);
      })
      .subscribe((status) => {
        onStatus?.(status);
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [channelName]);

  return channelRef;
}