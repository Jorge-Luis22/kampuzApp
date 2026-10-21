import { supabase, ejecutar, uidActual } from './supabase.js';

// =============================================================================
// Centro de seguridad (M33): reportar, bloquear y moderación. Solo Supabase.
// Antes, sin configuración, estas funciones "simulaban" éxito. Ahora lanzan
// KampuzError con el mensaje para mostrarlo en la interfaz.
// =============================================================================

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
 * Envía un reporte a moderación. tipo: mensaje | perfil | espacio | consulta | mensaje_directo
 */
export async function enviarReporte({ tipo, objetoId, motivo, detalle = '' }) {
  const uid = await uidActual();
  const texto = detalle?.trim() ? `${motivo} — ${detalle.trim()}` : motivo;
  return ejecutar(
    supabase
      .from('reportes')
      .insert({ autor_id: uid, tipo, objeto_id: String(objetoId), motivo: texto, estado: 'abierto' })
      .select('id')
      .single()
  );
}

/**
 * Bloquea a otro alumno. El servidor oculta los perfiles en ambos sentidos y
 * cierra solicitudes y chats entre ambos.
 */
export async function bloquearUsuario(bloqueadoId) {
  const uid = await uidActual();
  const { error } = await supabase
    .from('bloqueos')
    .insert({ bloqueador_id: uid, bloqueado_id: bloqueadoId });
  if (error && error.code !== '23505') {
    await ejecutar(Promise.resolve({ error })); // traduce y lanza
  }
}

export async function desbloquearUsuario(bloqueadoId) {
  const uid = await uidActual();
  await ejecutar(
    supabase.from('bloqueos').delete().eq('bloqueador_id', uid).eq('bloqueado_id', bloqueadoId)
  );
}

export async function fetchUsuariosBloqueados() {
  const uid = await uidActual();
  return (
    (await ejecutar(
      supabase
        .from('bloqueos')
        .select('id, bloqueado_id, creado_en, perfil_bloqueado:perfiles!bloqueos_bloqueado_id_fkey(id, nombre, apellido, carrera, ciclo, foto_url)')
        .eq('bloqueador_id', uid)
        .order('creado_en', { ascending: false })
    )) || []
  );
}

export async function fetchReportesModeracion() {
  return (
    (await ejecutar(
      supabase
        .from('reportes')
        .select('id, tipo, objeto_id, motivo, estado, creado_en, autor:perfiles!reportes_autor_id_fkey(id, nombre, carrera)')
        .order('creado_en', { ascending: false })
        .limit(50)
    )) || []
  );
}

export async function actualizarEstadoReporte(reporteId, nuevoEstado) {
  await ejecutar(supabase.from('reportes').update({ estado: nuevoEstado }).eq('id', reporteId));
}
