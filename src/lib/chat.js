import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Obtiene o crea la conversación directa 1 a 1 entre dos usuarios.
 * Normaliza los IDs ordenados para garantizar un único registro por pareja de interlocutores.
 */
export async function getOrCreateConversacion(userId, otherUserId) {
  if (!isSupabaseConfigured || !userId || !otherUserId || userId === otherUserId) {
    return { success: false, error: 'Parámetros inválidos para conversación.' };
  }

  const userA = userId < otherUserId ? userId : otherUserId;
  const userB = userId < otherUserId ? otherUserId : userId;

  try {
    // 1. Buscar si ya existe
    const { data: existente, error: fetchErr } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('usuario_a_id', userA)
      .eq('usuario_b_id', userB)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.warn('[Kampus Chat] Error buscando conversación:', fetchErr.message);
    }

    if (existente) {
      return { success: true, conversacion: existente };
    }

    // 2. Si no existe, crearla
    const { data: creada, error: insertErr } = await supabase
      .from('conversaciones')
      .insert({
        usuario_a_id: userA,
        usuario_b_id: userB,
        abierta_en: new Date().toISOString(),
        ultimo_mensaje_en: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) {
      // Posible concurrencia: si ya se creó justo ahora, reintentar select
      const { data: reintento } = await supabase
        .from('conversaciones')
        .select('*')
        .eq('usuario_a_id', userA)
        .eq('usuario_b_id', userB)
        .maybeSingle();

      if (reintento) {
        return { success: true, conversacion: reintento };
      }
      return { success: false, error: insertErr.message };
    }

    return { success: true, conversacion: creada };
  } catch (err) {
    console.error('[Kampus Chat] Excepción getOrCreateConversacion:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Carga la lista de conversaciones del alumno con el perfil del interlocutor,
 * el último mensaje enviado/recibido y el conteo de no leídos.
 */
export async function fetchConversaciones(userId) {
  if (!isSupabaseConfigured || !userId) return [];

  try {
    const { data: convs, error } = await supabase
      .from('conversaciones')
      .select('*')
      .or(`usuario_a_id.eq.${userId},usuario_b_id.eq.${userId}`)
      .order('ultimo_mensaje_en', { ascending: false });

    if (error) {
      console.warn('[Kampus Chat] Error cargando conversaciones:', error.message);
      return [];
    }

    if (!convs || convs.length === 0) return [];

    // Cargar detalles para cada conversación
    const enriquecidas = await Promise.all(
      convs.map(async (c) => {
        const otherUserId = c.usuario_a_id === userId ? c.usuario_b_id : c.usuario_a_id;

        // Cargar perfil del otro estudiante
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('id, nombre, apellido, foto_url, carrera, ciclo, sede')
          .eq('id', otherUserId)
          .maybeSingle();

        // Cargar último mensaje
        const { data: ultimos } = await supabase
          .from('mensajes_directos')
          .select('*')
          .eq('conversacion_id', c.id)
          .order('creado_en', { ascending: false })
          .limit(1);

        const ultimoMensaje = ultimos && ultimos.length > 0 ? ultimos[0] : null;

        // Contar mensajes no leídos dirigidos al usuario actual
        const { count: noLeidos } = await supabase
          .from('mensajes_directos')
          .select('*', { count: 'exact', head: true })
          .eq('conversacion_id', c.id)
          .eq('leido', false)
          .neq('autor_id', userId);

        return {
          id: c.id,
          otherUser: perfil || {
            id: otherUserId,
            nombre: 'Compañero UTP',
            apellido: '',
            carrera: 'Estudiante',
            ciclo: 1,
            sede: 'Lima'
          },
          ultimoMensaje: ultimoMensaje ? ultimoMensaje.texto : 'Conversación iniciada',
          ultimoMensajeHora: ultimoMensaje ? ultimoMensaje.creado_en : c.abierta_en,
          noLeidos: noLeidos || 0,
          raw: c
        };
      })
    );

    return enriquecidas;
  } catch (err) {
    console.error('[Kampus Chat] Excepción al listar conversaciones:', err);
    return [];
  }
}

/**
 * Carga el historial de mensajes de una conversación
 */
export async function fetchMensajesDirectos(conversacionId) {
  if (!isSupabaseConfigured || !conversacionId) return [];

  try {
    const { data, error } = await supabase
      .from('mensajes_directos')
      .select('*')
      .eq('conversacion_id', conversacionId)
      .order('creado_en', { ascending: true });

    if (error) {
      console.warn('[Kampus Chat] Error cargando mensajes:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[Kampus Chat] Excepción fetchMensajesDirectos:', err);
    return [];
  }
}

/**
 * Envía un mensaje directo dentro de una conversación
 */
export async function enviarMensajeDirecto({ conversacionId, autorId, texto }) {
  if (!isSupabaseConfigured || !conversacionId || !autorId || !texto?.trim()) {
    return { success: false, error: 'Datos incompletos para enviar mensaje.' };
  }

  const payload = {
    conversacion_id: conversacionId,
    autor_id: autorId,
    texto: texto.trim(),
    leido: false
  };

  try {
    const { data, error } = await supabase
      .from('mensajes_directos')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Actualizar timestamp de la conversación en paralelo
    supabase
      .from('conversaciones')
      .update({ ultimo_mensaje_en: new Date().toISOString() })
      .eq('id', conversacionId)
      .then();

    return { success: true, mensaje: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Marca los mensajes no leídos recibidos en esta conversación como leídos
 */
export async function marcarMensajesComoLeidos(conversacionId, userId) {
  if (!isSupabaseConfigured || !conversacionId || !userId) return;

  try {
    await supabase
      .from('mensajes_directos')
      .update({ leido: true })
      .eq('conversacion_id', conversacionId)
      .neq('autor_id', userId)
      .eq('leido', false);
  } catch (err) {
    console.warn('[Kampus Chat] Error al marcar leídos:', err.message);
  }
}

/**
 * Se suscribe en tiempo real a los mensajes directos de una conversación
 */
export function subscribeToConversacion(conversacionId, onInsert) {
  if (!isSupabaseConfigured || !conversacionId) {
    return () => {};
  }

  const channel = supabase
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

  return () => {
    supabase.removeChannel(channel);
  };
}
