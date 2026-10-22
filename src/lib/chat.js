import { supabase, ejecutar, rpc, uidActual } from './supabase.js';

// =============================================================================
// Chat 1 a 1 (M10). Solo Supabase: la conversación existe si una solicitud fue
// aceptada (origen 'solicitud': son contactos) o si alguien tocó "Yo te ayudo" en
// una publicación de ayuda (origen 'ayuda', solo mientras dure esa publicación).
// Realtime en mensajes_directos.
// =============================================================================

const CAMPOS_MENSAJE = 'id, conversacion_id, autor_id, texto, leido, creado_en, eliminado_en';

// Se puede "Eliminar para todos" un mensaje propio durante 24 h (lo valida el servidor)
export const HORAS_PARA_ELIMINAR = 24;

/**
 * "Eliminar chat para mí": sale de mi lista y solo veré los mensajes que lleguen después.
 * No borra nada y la otra persona no ve cambios.
 */
export function ocultarConversacion(conversacionId) {
  return rpc('ocultar_conversacion', { p_conversacion_id: conversacionId });
}

/**
 * "Eliminar para todos": ambos verán "Este mensaje fue eliminado".
 */
export function eliminarMensajeParaTodos(mensajeId) {
  return rpc('eliminar_mensaje_para_todos', { p_mensaje_id: mensajeId });
}

/**
 * Bandeja de chats con interlocutor, último mensaje y no leídos (una sola llamada).
 */
export async function fetchConversaciones() {
  const filas = (await rpc('mis_conversaciones')) || [];
  const uid = await uidActual();
  return filas.map((c) => ({
    id: c.id,
    otherUser: {
      id: c.otro_id,
      nombre: c.otro_nombre,
      apellido: c.otro_apellido,
      usuario: c.otro_usuario,
      foto_url: c.otro_foto_url,
      carrera: c.otro_carrera,
      ciclo: c.otro_ciclo,
      sede: c.otro_sede
    },
    ultimoMensaje: c.ultimo_texto
      ? `${c.ultimo_autor_id === uid ? 'Tú: ' : ''}${c.ultimo_texto}`
      : c.origen === 'ayuda'
      ? 'Chat por una publicación del tablón'
      : 'Ahora son contactos. Saluda.',
    origen: c.origen || 'solicitud',
    publicacionTitulo: c.publicacion_titulo || null,
    puedeEscribir: c.puede_escribir !== false,
    ultimoMensajeHora: c.ultimo_en,
    noLeidos: c.no_leidos || 0
  }));
}

/**
 * Id de la conversación con otro alumno, o null si no están conectados.
 */
export async function conversacionCon(otroId) {
  const uid = await uidActual();
  const [a, b] = uid < otroId ? [uid, otroId] : [otroId, uid];
  const fila = await ejecutar(
    supabase.from('conversaciones').select('id').eq('usuario_a_id', a).eq('usuario_b_id', b).maybeSingle()
  );
  return fila?.id || null;
}

/**
 * Id del chat con otro alumno solo si son contactos (origen 'solicitud'), o null.
 */
export async function conversacionDeContacto(otroId) {
  const uid = await uidActual();
  const [a, b] = uid < otroId ? [uid, otroId] : [otroId, uid];
  const fila = await ejecutar(
    supabase
      .from('conversaciones')
      .select('id')
      .eq('usuario_a_id', a)
      .eq('usuario_b_id', b)
      .eq('origen', 'solicitud')
      .maybeSingle()
  );
  return fila?.id || null;
}

export async function fetchMensajesDirectos(conversacionId) {
  const filas = await ejecutar(
    supabase
      .from('mensajes_directos')
      .select(CAMPOS_MENSAJE)
      .eq('conversacion_id', conversacionId)
      .order('creado_en', { ascending: false })
      .limit(300)
  );
  return (filas || []).reverse();
}

/**
 * Inserta el mensaje y devuelve la fila del servidor (con su id definitivo).
 */
export async function enviarMensajeDirecto({ conversacionId, texto }) {
  const uid = await uidActual();
  return ejecutar(
    supabase
      .from('mensajes_directos')
      .insert({ conversacion_id: conversacionId, autor_id: uid, texto: texto.trim() })
      .select(CAMPOS_MENSAJE)
      .single()
  );
}

export async function marcarMensajesComoLeidos(conversacionId) {
  const uid = await uidActual();
  await ejecutar(
    supabase
      .from('mensajes_directos')
      .update({ leido: true })
      .eq('conversacion_id', conversacionId)
      .neq('autor_id', uid)
      .eq('leido', false)
  );
}

/**
 * Une un mensaje a la lista sin duplicar:
 * - si ya está su id definitivo, solo actualiza sus campos (p. ej. "leído");
 * - si viene la respuesta de mi envío (tempId), reemplaza el mensaje optimista;
 * - si llega por Realtime mi propio mensaje antes que la respuesta HTTP, reemplaza
 *   el optimista pendiente con el mismo texto.
 */
export function fusionarMensaje(lista, mensaje, { tempId = null, miId = null } = {}) {
  if (lista.some((m) => m.id === mensaje.id)) {
    const sinTemp = tempId ? lista.filter((m) => m.id !== tempId) : lista;
    return sinTemp.map((m) => (m.id === mensaje.id ? { ...m, ...mensaje } : m));
  }

  let idx = tempId ? lista.findIndex((m) => m.id === tempId) : -1;
  if (idx === -1 && miId && mensaje.autor_id === miId) {
    idx = lista.findIndex((m) => m.optimista && !m.error && m.texto === mensaje.texto);
  }

  if (idx >= 0) {
    const copia = [...lista];
    copia[idx] = mensaje;
    return copia;
  }
  return [...lista, mensaje].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
}

/**
 * Realtime de una conversación: mensajes nuevos y cambios de "leído".
 */
export function subscribeToConversacion(conversacionId, { onInsert, onUpdate }) {
  const canal = supabase
    .channel(`chat_${conversacionId}_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes_directos', filter: `conversacion_id=eq.${conversacionId}` },
      (payload) => payload?.new && onInsert?.(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mensajes_directos', filter: `conversacion_id=eq.${conversacionId}` },
      (payload) => payload?.new && onUpdate?.(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}

/**
 * Realtime de todos mis chats (RLS filtra a mis conversaciones): para la bandeja y el contador.
 */
export function subscribeToMisMensajes(onCambio) {
  const canal = supabase
    .channel(`mis_chats_${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_directos' }, () => onCambio())
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
