import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Normas de Convivencia Universitaria Kampuz (M33)
 */
export const NORMAS_CONVIVENCIA = [
  {
    titulo: '1. Se habla de la materia, no de la persona',
    descripcion: 'Las consultas y aportes deben enfocarse en contenidos académicos, dudas de ejercicios y aprendizaje mutuo. No se permiten comentarios despectivos, calificaciones sobre docentes ni ataques personales.'
  },
  {
    titulo: '2. Cero tolerancia al acoso y discriminación',
    descripcion: 'Kampuz es un espacio seguro para todos los estudiantes de la universidad. Queda estrictamente prohibido cualquier tipo de hostigamiento, lenguaje discriminatorio, agresión verbal o contenido sexual no solicitado.'
  },
  {
    titulo: '3. Integridad y honestidad académica',
    descripcion: 'La comunidad promueve la colaboración y el aprendizaje compartido. No se permite la suplantación de identidad ni la comercialización de tareas, exámenes o evaluaciones.'
  },
  {
    titulo: '4. Privacidad y consentimiento',
    descripcion: 'Respeta la privacidad de tus compañeros. No compartas capturas de chats privados ni datos de contacto de terceros sin su autorización expresa.'
  }
];

/**
 * Envía un reporte formal a la tabla public.reportes
 */
export async function enviarReporte({ autorId, tipo, objetoId, motivo, detalle = '' }) {
  if (!isSupabaseConfigured) {
    console.log('[Safety Mock] Reporte simulado:', { autorId, tipo, objetoId, motivo, detalle });
    return { success: true };
  }

  try {
    const textoMotivo = detalle ? `${motivo} — ${detalle}` : motivo;
    const { data, error } = await supabase
      .from('reportes')
      .insert({
        autor_id: autorId,
        tipo,
        objeto_id: String(objetoId),
        motivo: textoMotivo,
        estado: 'abierto'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('[Safety] Error al enviar reporte:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Bloquea a un usuario de forma recíproca
 */
export async function bloquearUsuario(bloqueadorId, bloqueadoId) {
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { data, error } = await supabase
      .from('bloqueos')
      .insert({
        bloqueador_id: bloqueadorId,
        bloqueado_id: bloqueadoId
      })
      .select()
      .single();

    if (error && error.code !== '23505') { // 23505 = unique_violation
      throw error;
    }

    return { success: true, data };
  } catch (err) {
    console.error('[Safety] Error al bloquear usuario:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Desbloquea a un usuario previamente bloqueado
 */
export async function desbloquearUsuario(bloqueadorId, bloqueadoId) {
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('bloqueos')
      .delete()
      .eq('bloqueador_id', bloqueadorId)
      .eq('bloqueado_id', bloqueadoId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Safety] Error al desbloquear usuario:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene la lista de usuarios bloqueados por el usuario actual
 */
export async function fetchUsuariosBloqueados(userId) {
  if (!isSupabaseConfigured || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('bloqueos')
      .select(`
        id,
        bloqueado_id,
        creado_en,
        perfil_bloqueado:perfiles!bloqueado_id(id, nombre, carrera, ciclo, foto_url)
      `)
      .eq('bloqueador_id', userId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Safety] Error al obtener bloqueados:', err);
    return [];
  }
}

/**
 * Obtiene los reportes abiertos para vista de moderación
 */
export async function fetchReportesModeracion() {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('reportes')
      .select(`
        id,
        tipo,
        objeto_id,
        motivo,
        estado,
        creado_en,
        autor:perfiles!autor_id(id, nombre, carrera)
      `)
      .order('creado_en', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Safety] Error al obtener reportes de moderación:', err);
    return [];
  }
}

/**
 * Actualiza el estado de un reporte (moderadores)
 */
export async function actualizarEstadoReporte(reporteId, nuevoEstado) {
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('reportes')
      .update({ estado: nuevoEstado })
      .eq('id', reporteId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Safety] Error actualizando reporte:', err);
    return { success: false, error: err.message };
  }
}
