import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Variables d\'environnement Supabase manquantes');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const createBoardChannel = (sessionId) => {
  return supabase.channel(`board-${sessionId}`);
};

export default supabase;