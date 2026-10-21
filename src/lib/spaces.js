import { supabase, ejecutar, rpc, uidActual } from './supabase.js';

// =============================================================================
// Espacios (M11–M16): grupo de carrera y ciclo, espacio de carrera, talleres y
// grupos de interés, con chat grupal en tiempo real. Solo Supabase.
// =============================================================================

function espacioDesdeFila(e) {
  return {
    id: e.id,
    tipo: e.tipo, // 'carrera_ciclo' | 'carrera' | 'taller' | 'interes'
    nombre: e.nombre,
    descripcion: e.descripcion,
    portadaUrl: e.portada_url,
    carrera: e.carrera,
    ciclo: e.ciclo,
    sede: e.sede,
    horario: e.horario,
    oficial: Boolean(e.oficial),
    estado: e.estado, // 'visible' | 'oculto'
    umbral: e.umbral,
    apoyos: e.apoyos || 0,
    miembrosCount: e.miembros || 0,
    linkInscripcion: e.link_inscripcion,
    esMiembro: Boolean(e.es_miembro),
    yaApoye: Boolean(e.ya_apoye),
    creadorId: e.creador_id
  };
}

/**
 * Mis espacios de carrera + talleres y grupos de interés (incluye propuestas para apoyarlas).
 */
export async function fetchEspacios() {
  const filas = (await rpc('listar_espacios')) || [];
  return filas.map(espacioDesdeFila);
}

export async function unirseAEspacio(espacioId) {
  const uid = await uidActual();
  const { error } = await supabase
    .from('membresias')
    .insert({ usuario_id: uid, espacio_id: espacioId, rol: 'miembro' });
  if (error && error.code !== '23505') {
    await ejecutar(Promise.resolve({ error }));
  }
}

export async function salirDeEspacio(espacioId) {
  const uid = await uidActual();
  await ejecutar(supabase.from('membresias').delete().eq('usuario_id', uid).eq('espacio_id', espacioId));
}

/**
 * Apoya una propuesta. Devuelve el estado tras el apoyo ('oculto' | 'visible').
 */
export async function apoyarPropuestaEspacio(espacioId) {
  return rpc('apoyar_propuesta', { p_espacio_id: espacioId });
}

/**
 * Propone un grupo de interés. El servidor lo crea oculto, con umbral max(15, 3% de la base).
 */
export async function proponerNuevoEspacio({ nombre, descripcion }) {
  return rpc('proponer_grupo', { p_nombre: nombre, p_descripcion: descripcion });
}

const CAMPOS_AUTOR = 'id, nombre, apellido, foto_url, carrera, ciclo, rol';

function mensajeDesdeFila(m, autor) {
  return {
    id: m.id,
    espacioId: m.espacio_id,
    autorId: m.autor_id,
    autorNombre: autor ? `${autor.nombre} ${autor.apellido || ''}`.trim() : 'Estudiante',
    autorFoto: autor?.foto_url || null,
    autorCarrera: autor?.carrera || '',
    autorCiclo: autor?.ciclo || '',
    autorRol: autor?.rol || 'alumno',
    texto: m.texto,
    creadoEn: m.creado_en
  };
}

export async function fetchMensajesEspacio(espacioId) {
  const filas = (await ejecutar(
    supabase
      .from('mensajes')
      .select(`id, espacio_id, autor_id, texto, creado_en, autor:perfiles!mensajes_autor_id_fkey(${CAMPOS_AUTOR})`)
      .eq('espacio_id', espacioId)
      .order('creado_en', { ascending: false })
      .limit(200)
  )) || [];
  return filas.reverse().map((m) => mensajeDesdeFila(m, m.autor));
}

/**
 * Envía y devuelve el mensaje con su id definitivo del servidor.
 */
export async function enviarMensajeEspacio({ espacioId, texto }) {
  const uid = await uidActual();
  const fila = await ejecutar(
    supabase
      .from('mensajes')
      .insert({ espacio_id: espacioId, autor_id: uid, texto: texto.trim() })
      .select(`id, espacio_id, autor_id, texto, creado_en, autor:perfiles!mensajes_autor_id_fkey(${CAMPOS_AUTOR})`)
      .single()
  );
  return mensajeDesdeFila(fila, fila.autor);
}

/**
 * Realtime del chat grupal. Los autores se cachean para no consultar por cada mensaje.
 */
export function subscribeToMensajesEspacio(espacioId, onNewMessage) {
  const autores = new Map();

  const canal = supabase
    .channel(`espacio_${espacioId}_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `espacio_id=eq.${espacioId}` },
      async (payload) => {
        const m = payload?.new;
        if (!m) return;
        if (!autores.has(m.autor_id)) {
          const { data } = await supabase.from('perfiles').select(CAMPOS_AUTOR).eq('id', m.autor_id).maybeSingle();
          autores.set(m.autor_id, data || null);
        }
        onNewMessage(mensajeDesdeFila(m, autores.get(m.autor_id)));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}

/**
 * Une un mensaje de grupo a la lista sin duplicar (envío optimista + Realtime).
 */
export function fusionarMensajeEspacio(lista, mensaje, { tempId = null, miId = null } = {}) {
  if (lista.some((m) => m.id === mensaje.id)) {
    return tempId ? lista.filter((m) => m.id !== tempId) : lista;
  }
  let idx = tempId ? lista.findIndex((m) => m.id === tempId) : -1;
  if (idx === -1 && miId && mensaje.autorId === miId) {
    idx = lista.findIndex((m) => m.optimista && !m.error && m.texto === mensaje.texto);
  }
  if (idx >= 0) {
    const copia = [...lista];
    copia[idx] = mensaje;
    return copia;
  }
  return [...lista, mensaje];
}

/**
 * Cursos de una carrera (catálogo), para sugerirlos al crear una consulta.
 */
export async function fetchCursosDeCarrera(carrera) {
  const filas = (await ejecutar(
    supabase.from('cursos').select('nombre, carreras!inner(nombre)').eq('carreras.nombre', carrera).order('nombre')
  )) || [];
  return filas.map((c) => c.nombre);
}
