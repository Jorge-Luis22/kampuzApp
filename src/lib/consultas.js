import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Moderación de texto en cliente (Sección 7.1 y trg_moderar_consulta en DB)
 * Regla dura y visible: "Se habla del curso, no de la persona".
 */
export function moderarConsultaTexto(texto) {
  if (!texto || !texto.trim()) return { bloqueado: false, motivo: null };

  const mencionaDocente = /\b(profe|profesor|profesora|docente|maestro|maestra)\b/i.test(texto);
  const emiteJuicio = /\b(mejor|peor|cuál|recomienda|evita|jala|regala|bueno|malo|filtro|fácil|difícil)\b/i.test(texto);
  // Sensible a mayúsculas para nombres propios (sin flag /i)
  const nombrePropio = /\b(profesor|profesora|docente|profe)\s+[A-ZÁÉÍÓÚ]/.test(texto);

  if (mencionaDocente && emiteJuicio) {
    return {
      bloqueado: true,
      motivo: 'Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones o qué material conviene.'
    };
  }

  if (nombrePropio) {
    return {
      bloqueado: true,
      motivo: 'Mencionaste a un docente por su nombre. En Kampus se consulta sobre el curso y su contenido académico.'
    };
  }

  return { bloqueado: false, motivo: null };
}

/**
 * Carga las consultas académicas activas de una carrera con sus asesorías y valoraciones
 */
export async function fetchConsultasCarrera(carrera) {
  if (!isSupabaseConfigured || !carrera) return [];

  try {
    const { data: consultasData, error } = await supabase
      .from('consultas')
      .select('*')
      .ilike('carrera', carrera)
      .in('estado', ['activa', 'respondida'])
      .order('creado_en', { ascending: false });

    if (error) {
      console.warn('[Kampus Consultas] Error cargando consultas:', error.message);
      return [];
    }

    if (!consultasData || consultasData.length === 0) return [];

    // Cargar asesorías y valoraciones para cada consulta
    const consultasEnriquecidas = await Promise.all(
      consultasData.map(async (c) => {
        const autoresIds = c.autores_ids || [];
        const autoresNombres = c.autores_nombres || [];

        // Consultar asesorías (respuestas)
        const { data: asesoriasData } = await supabase
          .from('asesorias')
          .select(`
            id,
            consulta_id,
            asesor_id,
            texto,
            modo,
            estrellas_calculadas,
            calificado,
            creado_en,
            asesor:asesor_id (
              id,
              nombre,
              apellido,
              carrera,
              ciclo,
              foto_url
            )
          `)
          .eq('consulta_id', c.id)
          .order('creado_en', { ascending: true });

        const respuestas = (asesoriasData || []).map((a) => ({
          id: a.id,
          asesorId: a.asesor_id,
          asesorNombre: a.asesor ? `${a.asesor.nombre} ${a.asesor.apellido || ''}`.trim() : 'Compañero',
          asesorCarrera: a.asesor?.carrera || c.carrera,
          asesorCiclo: a.asesor?.ciclo || 5,
          asesorFoto: a.asesor?.foto_url || null,
          texto: a.texto,
          modo: a.modo,
          estrellasCalculadas: a.estrellas_calculadas,
          calificadoPorSolicitante: Boolean(a.calificado),
          fecha: a.creado_en ? new Date(a.creado_en).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Reciente'
        }));

        return {
          id: c.id,
          carrera: c.carrera,
          curso: c.curso,
          tema: c.tema,
          textoResumen: c.texto_resumen,
          autoresIds,
          autoresNombres,
          nAlumnos: Math.max(1, autoresIds.length),
          autores: autoresNombres.length > 0 ? autoresNombres : ['Estudiante'],
          estado: c.estado,
          fecha: c.creado_en ? new Date(c.creado_en).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Reciente',
          respuestas
        };
      })
    );

    return consultasEnriquecidas;
  } catch (err) {
    console.error('[Kampus Consultas] Excepción fetchConsultasCarrera:', err);
    return [];
  }
}

/**
 * Publica una nueva consulta o la agrupa automáticamente si ya existe una similar (M19)
 */
export async function crearOConsultarAgrupada({ carrera, curso, tema, texto, user }) {
  if (!isSupabaseConfigured || !user?.id || !carrera || !curso || !tema?.trim() || !texto?.trim()) {
    return { exito: false, motivo: 'Datos incompletos para publicar la consulta.' };
  }

  // 1. Moderación previa en cliente
  const mod = moderarConsultaTexto(texto);
  if (mod.bloqueado) {
    return { exito: false, motivo: mod.motivo };
  }

  try {
    const { data, error } = await supabase.rpc('crear_o_agrupar_consulta', {
      p_carrera: carrera.trim(),
      p_curso: curso.trim(),
      p_tema: tema.trim(),
      p_texto: texto.trim(),
      p_autor_id: user.id,
      p_autor_nombre: `${user.nombre || 'Estudiante'} ${user.apellido || ''}`.trim()
    });

    if (error) {
      return { exito: false, motivo: error.message };
    }

    return {
      exito: true,
      consultaId: data?.consulta_id,
      agrupada: Boolean(data?.agrupada)
    };
  } catch (err) {
    return { exito: false, motivo: err.message };
  }
}

/**
 * Valida si un alumno puede orientar una consulta (Regla 7.1)
 * Requisitos:
 * 1. Ciclo >= 5
 * 2. No ser uno de los autores de la duda (no auto-orientarse)
 */
export function validarPermisoOrientar(user, consulta) {
  if (!user) return { puede: false, motivo: 'Debes iniciar sesión.' };

  const userCiclo = Number(user.ciclo || 1);
  if (userCiclo < 5) {
    return {
      puede: false,
      motivo: `Tu ciclo actual (${userCiclo}.°) no cumple el requisito mínimo. Solo alumnos de ciclo ≥ 5 pueden orientar en consultas de carrera.`
    };
  }

  const autoresIds = consulta?.autoresIds || [];
  if (autoresIds.includes(user.id)) {
    return {
      puede: false,
      motivo: 'No puedes orientar una consulta planteada por ti mismo.'
    };
  }

  return { puede: true, motivo: null };
}

/**
 * Publica una orientación a una consulta académica (M21)
 * Calcula estrellas potenciales: (modo == "llamada" ? 3 : 1) * nAlumnos (si nAlumnos >= 2)
 */
export async function publicarOrientacionDB({ consultaId, user, texto, modo = 'mensaje', nAlumnos = 1 }) {
  if (!isSupabaseConfigured || !consultaId || !user?.id || !texto?.trim()) {
    return { exito: false, motivo: 'Datos incompletos para publicar la orientación.' };
  }

  try {
    const factorModo = modo === 'llamada' ? 3 : 1;
    // Anti-gaming: solo dan estrellas consultas agrupadas (nAlumnos >= 2)
    const estrellas = nAlumnos >= 2 ? factorModo * nAlumnos : 0;

    const { data, error } = await supabase
      .from('asesorias')
      .insert({
        consulta_id: consultaId,
        asesor_id: user.id,
        texto: texto.trim(),
        modo,
        estrellas_calculadas: estrellas,
        calificado: false
      })
      .select()
      .single();

    if (error) {
      return { exito: false, motivo: error.message };
    }

    // Actualizar estado de consulta si estaba activa
    await supabase
      .from('consultas')
      .update({ estado: 'respondida' })
      .eq('id', consultaId);

    return { exito: true, asesoria: data };
  } catch (err) {
    return { exito: false, motivo: err.message };
  }
}

/**
 * Valora la respuesta recibida (M22)
 * Anti-gaming: SOLO quien preguntó puede valorar la respuesta para acreditar las estrellas.
 */
export async function valorarRespuestaDB({ asesoriaId, consultaId, user, sirvio = true }) {
  if (!isSupabaseConfigured || !asesoriaId || !user?.id) {
    return { exito: false, motivo: 'Datos incompletos para valorar.' };
  }

  try {
    // 1. Insertar valoración
    const { error: valErr } = await supabase
      .from('valoraciones_asesoria')
      .insert({
        asesoria_id: asesoriaId,
        evaluador_id: user.id,
        sirvio
      });

    if (valErr && valErr.code !== '23505') {
      console.warn('[Kampus Consultas] Error registrando valoración:', valErr.message);
    }

    // 2. Marcar asesoría como calificada
    const { error: updErr } = await supabase
      .from('asesorias')
      .update({ calificado: true })
      .eq('id', asesoriaId);

    if (updErr) {
      return { exito: false, motivo: updErr.message };
    }

    return { exito: true };
  } catch (err) {
    return { exito: false, motivo: err.message };
  }
}
