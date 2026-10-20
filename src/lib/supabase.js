import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://tu-proyecto.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Kampuz] Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local.'
  );
}

// Con valores de relleno solo para que el build no falle; sin configuración real,
// toda llamada de datos lanza un error visible (ver asegurarConfiguracion).
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false // Código de 6 dígitos, sin enlaces mágicos
    }
  }
);

export default supabase;

// =============================================================================
// Helpers compartidos de la capa de datos
// Supabase es la única fuente de verdad. Si algo falla, se lanza KampuzError con
// un mensaje en español para mostrarlo en la interfaz. Nunca se finge éxito.
// =============================================================================

export const TIEMPO_ESPERA_MS = 15000;

export class KampuzError extends Error {
  constructor(mensaje, { codigo = null, causa = null } = {}) {
    super(mensaje);
    this.name = 'KampuzError';
    this.codigo = codigo;
    this.causa = causa;
  }
}

const MSG_SIN_CONEXION = 'No pudimos conectar con Kampuz. Revisa tu internet e inténtalo de nuevo.';
const MSG_TIEMPO = 'La conexión está tardando demasiado. Revisa tu internet e inténtalo de nuevo.';

// Códigos propios que lanzan los triggers y RPC del servidor (prefijo KAMPUZ_)
const MENSAJES_SERVIDOR = {
  KAMPUZ_CORREO_NO_PERMITIDO: 'Este correo no está habilitado en Kampuz. Usa tu correo @utp.edu.pe.',
  KAMPUZ_MENOR_DE_EDAD: 'Kampuz es solo para mayores de 18 años.'
};

/**
 * Traduce cualquier error (red, PostgREST, Auth, triggers) a un mensaje en español.
 */
export function mensajeError(err) {
  if (!err) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  if (err instanceof KampuzError) return err.message;

  const texto = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;

  // Errores propios del servidor: "KAMPUZ_CODIGO: mensaje legible"
  const propio = texto.match(/KAMPUZ_[A-Z_]+/);
  if (propio) {
    if (MENSAJES_SERVIDOR[propio[0]]) return MENSAJES_SERVIDOR[propio[0]];
    const legible = (err.message || '').split(':').slice(1).join(':').trim();
    if (legible) return legible;
  }

  if (/Failed to fetch|NetworkError|Network request failed|fetch failed|Load failed/i.test(texto)) {
    return MSG_SIN_CONEXION;
  }

  switch (err.code) {
    case '42501':
      return 'No tienes permiso para hacer esto.';
    case '23505':
      return 'Esto ya estaba registrado.';
    case '23503':
      return 'El elemento ya no existe. Actualiza la pantalla.';
    case 'PGRST116':
      return 'No encontramos lo que buscabas.';
    case 'PGRST202':
    case '42883':
    case '42P01':
    case '42703':
      return 'El servidor de Kampuz no está actualizado. Avisa al equipo.';
    default:
      break;
  }

  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

function asegurarConfiguracion() {
  if (!isSupabaseConfigured) {
    throw new KampuzError('La app no está configurada para conectarse al servidor (faltan las variables de Supabase).');
  }
}

/**
 * Espera una promesa con límite de tiempo (15 s por defecto).
 */
export function conTiempo(promesa, ms = TIEMPO_ESPERA_MS) {
  let timer;
  return Promise.race([
    Promise.resolve(promesa).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new KampuzError(MSG_TIEMPO, { codigo: 'TIEMPO' })), ms);
    })
  ]);
}

/**
 * Ejecuta una consulta de Supabase ({ data, error }) con timeout.
 * Devuelve data, o lanza KampuzError con el mensaje en español.
 */
export async function ejecutar(consulta, { ms = TIEMPO_ESPERA_MS } = {}) {
  asegurarConfiguracion();
  let resultado;
  try {
    resultado = await conTiempo(consulta, ms);
  } catch (err) {
    if (err instanceof KampuzError) throw err;
    throw new KampuzError(mensajeError(err), { causa: err });
  }
  if (resultado?.error) {
    throw new KampuzError(mensajeError(resultado.error), { codigo: resultado.error.code, causa: resultado.error });
  }
  return resultado?.data ?? null;
}

/**
 * Igual que ejecutar, pero devuelve también el conteo (consultas con { count }).
 */
export async function ejecutarConConteo(consulta, opciones) {
  asegurarConfiguracion();
  let resultado;
  try {
    resultado = await conTiempo(consulta, opciones?.ms);
  } catch (err) {
    if (err instanceof KampuzError) throw err;
    throw new KampuzError(mensajeError(err), { causa: err });
  }
  if (resultado?.error) {
    throw new KampuzError(mensajeError(resultado.error), { codigo: resultado.error.code, causa: resultado.error });
  }
  return { data: resultado?.data ?? null, count: resultado?.count ?? 0 };
}

/**
 * Llama a una función RPC del servidor.
 */
export function rpc(nombre, parametros = {}, opciones) {
  return ejecutar(supabase.rpc(nombre, parametros), opciones);
}

/**
 * ID del usuario con sesión real de Supabase (auth.uid()). Lanza si no hay sesión.
 */
export async function uidActual() {
  asegurarConfiguracion();
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) {
    throw new KampuzError('Tu sesión expiró. Vuelve a iniciar sesión.', { codigo: 'SIN_SESION' });
  }
  return uid;
}
