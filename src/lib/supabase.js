import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://tu-proyecto.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Kampus] Supabase no está configurado o tiene valores por defecto. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local.'
  );
}

// Cliente inicializado con fallback para evitar excepciones en build o entornos sin variables aún cargadas
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false // Modo OTP móvil, sin hash en URL
    }
  }
);

export default supabase;
