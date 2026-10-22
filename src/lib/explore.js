import { supabase, ejecutar, rpc, uidActual } from './supabase.js';
import { enviarReporte, bloquearUsuario as bloquear } from './safety.js';

// =============================================================================
// Explorar (M07), perfil de otro alumno (M08) y solicitudes (M09). Solo Supabase.
// Sin perfiles de muestra: si nadie más se registró, la lista está vacía y la
// vista muestra su estado vacío.
// =============================================================================

const CAMPOS_PERFIL_PUBLICO = 'id, nombre, apellido, usuario, foto_url, bio, sede, carrera, ciclo, intereses, enlaces, estado_en_vivo';

// Quita caracteres con significado en los filtros de PostgREST (coma, paréntesis, comodines)
const limpiarBusqueda = (t = '') => t.replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);

/**
 * Perfiles reales de mi universidad, sin mí y sin quienes bloqueé
 * (quienes me bloquearon ya los oculta el servidor).
 */
export async function fetchPerfilesExplorar({ searchTerm, carrera, ciclo, interes } = {}) {
  const uid = await uidActual();

  const bloqueados = (await ejecutar(
    supabase.from('bloqueos').select('bloqueado_id').eq('bloqueador_id', uid)
  )) || [];

  let query = supabase
    .from('perfiles')
    .select(CAMPOS_PERFIL_PUBLICO)
    .neq('id', uid)
    .order('creado_en', { ascending: false })
    .limit(100);

  if (bloqueados.length) {
    query = query.not('id', 'in', `(${bloqueados.map((b) => b.bloqueado_id).join(',')})`);
  }
  if (carrera) query = query.eq('carrera', carrera);
  if (ciclo) query = query.eq('ciclo', Number(ciclo));
  if (interes) query = query.contains('intereses', [interes]);

  const termino = limpiarBusqueda(searchTerm);
  if (termino) {
    const p = `%${termino}%`;
    query = query.or(`nombre.ilike.${p},apellido.ilike.${p},usuario.ilike.${p},carrera.ilike.${p}`);
  }

  return (await ejecutar(query)) || [];
}

/**
 * "Recién llegados" del Inicio: alumnos nuevos de otras carreras de mi sede con
 * los que aún no tengo relación. Lo decide el servidor (RPC recien_llegados).
 */
export async function fetchRecienLlegados(limite = 5) {
  return (await rpc('recien_llegados', { p_limite: limite })) || [];
}

/**
 * Solicitudes recibidas y enviadas, con el perfil del otro alumno.
 */
export async function fetchSolicitudes() {
  const uid = await uidActual();
  const filas = (await ejecutar(
    supabase
      .from('solicitudes_mensaje')
      .select(
        `id, de_id, a_id, motivo, estado, creado_en, respondido_en,
         de:perfiles!solicitudes_mensaje_de_id_fkey(${CAMPOS_PERFIL_PUBLICO}),
         a:perfiles!solicitudes_mensaje_a_id_fkey(${CAMPOS_PERFIL_PUBLICO})`
      )
      .or(`de_id.eq.${uid},a_id.eq.${uid}`)
      .order('creado_en', { ascending: false })
  )) || [];

  const recibidas = [];
  const enviadas = [];
  for (const s of filas) {
    const esRecibida = s.a_id === uid;
    const otroUsuario = esRecibida ? s.de : s.a;
    if (!otroUsuario) continue; // perfil oculto por bloqueo
    const item = { ...s, otroUsuario };
    delete item.de;
    delete item.a;
    (esRecibida ? recibidas : enviadas).push(item);
  }
  return { recibidas, enviadas };
}

/**
 * Envía una solicitud con motivo (spec 6.4). El servidor valida duplicados y bloqueos.
 */
export async function enviarSolicitudMensaje({ aId, motivo }) {
  return rpc('enviar_solicitud', { p_a_id: aId, p_motivo: motivo });
}

/**
 * Acepta o ignora. Si se acepta, devuelve el id de la conversación creada.
 */
export async function responderSolicitud({ solicitudId, aceptar }) {
  return rpc('responder_solicitud', { p_solicitud_id: solicitudId, p_aceptar: aceptar });
}

/**
 * Avisos en vivo de solicitudes nuevas o respondidas (RLS filtra a las mías).
 */
export function subscribeToSolicitudes(onCambio) {
  const canal = supabase
    .channel(`solicitudes_${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_mensaje' }, (payload) =>
      onCambio(payload)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

export function reportarContenido({ tipo, objetoId, motivo }) {
  return enviarReporte({ tipo, objetoId, motivo });
}

export function bloquearUsuario({ bloqueadoId }) {
  return bloquear(bloqueadoId);
}
