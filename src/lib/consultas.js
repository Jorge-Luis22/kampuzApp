import { rpc } from './supabase.js';

// =============================================================================
// Consultas agrupadas (M19–M22, spec 7.1). Las reglas se aplican en el servidor
// (crear_consulta, responder_consulta, valorar_asesoria). Aquí solo se avisa antes.
// =============================================================================

/**
 * Aviso previo en el cliente. El servidor repite la misma moderación (trigger).
 * "el profesor dijo..." no se bloquea; mencionar a un docente con un juicio, o
 * por su nombre propio, sí.
 */
export function moderarConsultaTexto(texto) {
  if (!texto || !texto.trim()) return { bloqueado: false, motivo: null };

  const mencionaDocente = /\b(profe|profesor|profesora|docente|maestro|maestra)\b/i.test(texto);
  const emiteJuicio = /\b(mejor|peor|cu[aá]l|recomienda|evita|jala|regala|bueno|malo|filtro|f[aá]cil|dif[ií]cil)\b/i.test(texto);
  // Sin bandera /i en el nombre: la mayúscula marca un nombre propio
  const nombrePropio = /\b([Pp]rofesora?|[Pp]rofe|[Dd]ocente|[Mm]aestra?)\s+[A-ZÁÉÍÓÚÑ]/.test(texto);

  if (mencionaDocente && emiteJuicio) {
    return {
      bloqueado: true,
      motivo: 'Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones o qué material conviene.'
    };
  }
  if (nombrePropio) {
    return {
      bloqueado: true,
      motivo: 'Mencionaste a un docente por su nombre. Se habla del curso, no de la persona.'
    };
  }
  return { bloqueado: false, motivo: null };
}

const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { month: 'short', day: 'numeric' }) : '';

/**
 * Consultas del espacio de MI carrera (todos los ciclos), con sus respuestas.
 */
export async function fetchConsultasCarrera(miId) {
  const grupos = (await rpc('listar_consultas_carrera')) || [];
  return grupos.map((g) => ({
    id: g.id,
    carrera: g.carrera,
    curso: g.curso,
    tema: g.tema,
    estado: g.estado,
    nAlumnos: g.n_alumnos,
    soyAutor: g.soy_autor,
    cicloMaxAutores: g.ciclo_max_autores,
    textoResumen: (g.textos || []).map((t) => t.texto).join('\n—\n'),
    autores: (g.textos || []).map((t) => t.firma),
    fecha: fechaCorta(g.creado_en),
    respuestas: (g.respuestas || []).map((r) => ({
      id: r.id,
      asesorId: r.asesor_id,
      asesorNombre: r.asesor_nombre?.trim() || 'Compañero',
      asesorCarrera: r.asesor_carrera,
      asesorCiclo: r.asesor_ciclo,
      asesorFoto: r.asesor_foto,
      texto: r.texto,
      modo: r.modo,
      estrellasCalculadas: r.valorada ? r.estrellas_acreditadas : r.estrellas_pendientes,
      calificadoPorSolicitante: r.valorada,
      miValoracion: r.mi_valoracion,
      esMio: r.asesor_id === miId,
      fecha: fechaCorta(r.creado_en)
    }))
  }));
}

/**
 * Crea o agrupa la consulta. La carrera y el ciclo los toma el servidor del perfil.
 */
export async function crearConsulta({ curso, tema, texto }) {
  return rpc('crear_consulta', { p_curso: curso, p_tema: tema, p_texto: texto });
}

/**
 * Aviso previo de quién puede orientar (spec 7.1). El servidor lo vuelve a validar.
 */
export function validarPermisoOrientar(user, consulta) {
  if (!user) return { puede: false, motivo: 'Debes iniciar sesión.' };
  if (consulta?.soyAutor) {
    return { puede: false, motivo: 'No puedes orientar una consulta en la que tú preguntaste.' };
  }
  const ciclo = Number(user.ciclo || 1);
  if (ciclo < 5) {
    return { puede: false, motivo: 'Solo alumnos de ciclo 5 o superior pueden orientar en consultas de carrera.' };
  }
  if (ciclo <= Number(consulta?.cicloMaxAutores || 0)) {
    return { puede: false, motivo: `Para orientar aquí debes estar en un ciclo mayor que ${consulta.cicloMaxAutores}.` };
  }
  return { puede: true, motivo: null };
}

export async function publicarOrientacion({ grupoId, texto, modo = 'mensaje' }) {
  return rpc('responder_consulta', { p_grupo_id: grupoId, p_texto: texto, p_modo: modo });
}

/**
 * Solo un autor de la consulta puede valorar; ahí se acreditan las estrellas.
 */
export async function valorarRespuesta({ asesoriaId, util = true }) {
  return rpc('valorar_asesoria', { p_asesoria_id: asesoriaId, p_util: util });
}
