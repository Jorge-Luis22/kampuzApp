import { supabase, isSupabaseConfigured } from './supabase.js';
import {
  getConversacionesStorage,
  getOrCreateConversacionStorage,
  getMensajesDirectosStorage,
  saveMensajeDirectoStorage,
  marcarMensajesComoLeidosStorage,
  subscribeToCampusEvents,
  findRegisteredUser,
  getRegisteredUsers
} from './campusStorage.js';

const withTimeout = (promise, ms = 2000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);
};

/**
 * Obtiene o crea la conversación directa 1 a 1 entre dos usuarios.
 * Normaliza los IDs ordenados para garantizar un único registro por pareja de interlocutores.
 */
export async function getOrCreateConversacion(userId, otherUserId) {
  if (!userId || !otherUserId || userId === otherUserId) {
    return { success: false, error: 'Parámetros inválidos para conversación.' };
  }

  // 1. Crear u obtener siempre del almacén local sincronizado
  const localConv = getOrCreateConversacionStorage(userId, otherUserId);

  // 2. Si Supabase está disponible, sincronizar
  if (isSupabaseConfigured) {
    const userA = userId < otherUserId ? userId : otherUserId;
    const userB = userId < otherUserId ? otherUserId : userId;

    try {
      const { data: existente } = await withTimeout(
        supabase
          .from('conversaciones')
          .select('*')
          .eq('usuario_a_id', userA)
          .eq('usuario_b_id', userB)
          .maybeSingle(),
        1800
      );

      if (existente) {
        return { success: true, conversacion: existente };
      }

      const { data: creada, error: insertErr } = await withTimeout(
        supabase
          .from('conversaciones')
          .insert({
            usuario_a_id: userA,
            usuario_b_id: userB,
            abierta_en: new Date().toISOString(),
            ultimo_mensaje_en: new Date().toISOString()
          })
          .select()
          .single(),
        1800
      );

      if (!insertErr && creada) {
        return { success: true, conversacion: creada };
      }
    } catch (err) {}
  }

  return { success: true, conversacion: localConv };
}

/**
 * Carga la lista de conversaciones del alumno con el perfil del interlocutor,
 * el último mensaje enviado/recibido y el conteo de no leídos.
 */
export async function fetchConversaciones(userId) {
  if (!userId) return [];

  // 1. Obtener conversaciones locales
  const locales = getConversacionesStorage().filter(
    c => c.usuario_a_id === userId || c.usuario_b_id === userId
  );

  let convs = [...locales];

  // 2. Si Supabase responde, fusionar
  if (isSupabaseConfigured) {
    try {
      const { data: remotos } = await withTimeout(
        supabase
          .from('conversaciones')
          .select('*')
          .or(`usuario_a_id.eq.${userId},usuario_b_id.eq.${userId}`)
          .order('ultimo_mensaje_en', { ascending: false }),
        2000
      );

      if (remotos && remotos.length > 0) {
        const ids = new Set(convs.map(c => c.id));
        for (const r of remotos) {
          if (!ids.has(r.id)) {
            convs.push(r);
          }
        }
      }
    } catch (err) {}
  }

  // Enriquecer cada conversación
  const enriquecidas = convs.map(c => {
    const otherUserId = c.usuario_a_id === userId ? c.usuario_b_id : c.usuario_a_id;

    // Buscar perfil del interlocutor
    const perfil = findRegisteredUser(otherUserId);

    // Obtener mensajes de la conversación
    const msgs = getMensajesDirectosStorage(c.id);
    const ultimoMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

    const noLeidos = msgs.filter(m => m.autor_id !== userId && !m.leido).length;

    return {
      id: c.id,
      otherUser: perfil || {
        id: otherUserId,
        nombre: 'Compañero UTP',
        apellido: '',
        usuario: 'estudiante',
        carrera: 'Campus',
        ciclo: 1,
        sede: 'Lima Sur'
      },
      ultimoMensaje: ultimoMsg ? ultimoMsg.texto : 'Conversación iniciada',
      ultimoMensajeHora: ultimoMsg ? ultimoMsg.creado_en : c.abierta_en,
      noLeidos,
      raw: c
    };
  });

  return enriquecidas.sort((a, b) => new Date(b.ultimoMensajeHora) - new Date(a.ultimoMensajeHora));
}

/**
 * Carga el historial de mensajes de una conversación
 */
export async function fetchMensajesDirectos(conversacionId) {
  if (!conversacionId) return [];

  // 1. Mensajes locales
  let mensajes = getMensajesDirectosStorage(conversacionId);

  // 2. Supabase si está disponible
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('mensajes_directos')
          .select('*')
          .eq('conversacion_id', conversacionId)
          .order('creado_en', { ascending: true }),
        2000
      );

      if (!error && data?.length) {
        const ids = new Set(mensajes.map(m => m.id));
        for (const m of data) {
          if (!ids.has(m.id)) mensajes.push(m);
        }
      }
    } catch (err) {}
  }

  return mensajes.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
}

/**
 * Envía un mensaje directo dentro de una conversación
 */
export async function enviarMensajeDirecto({ conversacionId, autorId, texto }) {
  if (!conversacionId || !autorId || !texto?.trim()) {
    return { success: false, error: 'Datos incompletos para enviar mensaje.' };
  }

  // 1. Guardar de inmediato en almacenamiento local sincronizado
  const mensajeLocal = saveMensajeDirectoStorage({
    conversacionId,
    autorId,
    texto: texto.trim()
  });

  // 2. Intentar enviar a Supabase en paralelo
  if (isSupabaseConfigured) {
    withTimeout(
      supabase.from('mensajes_directos').insert({
        conversacion_id: conversacionId,
        autor_id: autorId,
        texto: texto.trim(),
        leido: false
      }),
      2000
    ).catch(() => {});
  }

  return { success: true, mensaje: mensajeLocal };
}

/**
 * Marca los mensajes no leídos recibidos en esta conversación como leídos
 */
export async function marcarMensajesComoLeidos(conversacionId, userId) {
  if (!conversacionId || !userId) return;

  marcarMensajesComoLeidosStorage(conversacionId, userId);

  if (isSupabaseConfigured) {
    withTimeout(
      supabase
        .from('mensajes_directos')
        .update({ leido: true })
        .eq('conversacion_id', conversacionId)
        .neq('autor_id', userId)
        .eq('leido', false),
      1500
    ).catch(() => {});
  }
}

/**
 * Se suscribe en tiempo real a los mensajes directos de una conversación
 */
export function subscribeToConversacion(conversacionId, onInsert) {
  if (!conversacionId) return () => {};

  // 1. Suscripción local entre pestañas / ventanas
  const unsubCampus = subscribeToCampusEvents((evt) => {
    if (evt.tipo === 'mensaje_directo' && evt.payload?.conversacion_id === conversacionId) {
      if (typeof onInsert === 'function') {
        onInsert(evt.payload);
      }
    }
  });

  // 2. Suscripción a Supabase Realtime si está disponible
  let supabaseChannel = null;
  if (isSupabaseConfigured) {
    try {
      supabaseChannel = supabase
        .channel(`chat_${conversacionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes_directos',
            filter: `conversacion_id=eq.${conversacionId}`
          },
          (payload) => {
            if (payload?.new && typeof onInsert === 'function') {
              onInsert(payload.new);
            }
          }
        )
        .subscribe();
    } catch (e) {}
  }

  return () => {
    unsubCampus();
    if (supabaseChannel) {
      try {
        supabase.removeChannel(supabaseChannel);
      } catch (e) {}
    }
  };
}
