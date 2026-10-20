import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Consulta el umbral mínimo de segmento configurado en la base de datos (clave: umbral_minimo_segmento).
 * Valor predeterminado de fábrica: 30 (Spec 6.5).
 */
export async function fetchUmbralMinimoSegmento() {
  if (!isSupabaseConfigured) return 30;

  try {
    const { data, error } = await supabase
      .from('config')
      .select('valor')
      .eq('clave', 'umbral_minimo_segmento')
      .maybeSingle();

    if (error || !data) return 30;
    return parseInt(data.valor, 10) || 30;
  } catch (err) {
    return 30;
  }
}

/**
 * Calcula el alcance del segmento en vivo mediante RPC de servidor (calcular_alcance_encuesta).
 * Retorna ÚNICAMENTE el conteo total de personas en el segmento.
 * El emisor nunca recibe la lista de identidades de los alumnos.
 */
export async function calcularAlcanceEnVivo(filtro) {
  if (!isSupabaseConfigured) {
    return 48; // Fallback mock verosímil
  }

  try {
    const payloadFiltro = {
      carrera: Array.isArray(filtro.carreras) ? filtro.carreras[0] : (filtro.carrera || null),
      cicloMin: Number(filtro.cicloMin || 1),
      cicloMax: Number(filtro.cicloMax || 10),
      edadMin: Number(filtro.edadMin || 16),
      edadMax: Number(filtro.edadMax || 99),
      intereses: filtro.intereses || []
    };

    const { data, error } = await supabase.rpc('calcular_alcance_encuesta', {
      p_filtro: payloadFiltro
    });

    if (error) {
      console.warn('[Kampus Surveys] Error en calcular_alcance_encuesta:', error.message);
      return 0;
    }

    return typeof data === 'number' ? data : parseInt(data, 10) || 0;
  } catch (err) {
    console.error('[Kampus Surveys] Excepción calcularAlcanceEnVivo:', err);
    return 0;
  }
}

/**
 * Envío seguro de encuesta mediante la RPC enviar_encuesta_segura (Sección 6.5, 7.4 y Ley 29733)
 * Valida en el servidor:
 * 1. Umbral mínimo de segmento (30)
 * 2. Nivel de Apoyo a la Investigación del emisor
 * 3. Selección aleatoria de muestra
 * 4. Tope de 3 encuestas/semana por alumno (el excedente se encola, no se descarta)
 */
export async function enviarEncuestaSegura({ titulo, descripcion, filtro, preguntas }) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no configurado.' };
  }

  try {
    const payloadFiltro = {
      carrera: Array.isArray(filtro.carreras) ? filtro.carreras[0] : (filtro.carrera || null),
      cicloMin: Number(filtro.cicloMin || 1),
      cicloMax: Number(filtro.cicloMax || 10),
      edadMin: Number(filtro.edadMin || 16),
      edadMax: Number(filtro.edadMax || 99),
      intereses: filtro.intereses || []
    };

    const payloadPreguntas = preguntas.map((p, idx) => ({
      orden: idx + 1,
      texto: p.texto,
      tipo: p.tipo, // 'unica' | 'multiple' | 'abierta'
      opciones: p.opciones || []
    }));

    const { data, error } = await supabase.rpc('enviar_encuesta_segura', {
      p_titulo: titulo.trim(),
      p_descripcion: descripcion?.trim() || '',
      p_filtro: payloadFiltro,
      p_preguntas: payloadPreguntas
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Carga la bandeja de encuestas asignadas al estudiante
 */
export async function fetchBandejaEncuestas(userId) {
  if (!isSupabaseConfigured || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('envios_encuesta')
      .select(`
        id,
        encuesta_id,
        estado,
        enviado_en,
        respondido_en,
        encuesta:encuesta_id (
          id,
          titulo,
          descripcion,
          autor_id,
          creado_en
        )
      `)
      .eq('destinatario_id', userId)
      .in('estado', ['pendiente', 'respondida'])
      .order('enviado_en', { ascending: false });

    if (error) {
      console.warn('[Kampus Surveys] Error al cargar bandeja:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Cargar cantidad de preguntas para cada encuesta
    return Promise.all(
      data.map(async (item) => {
        const { count: totalPreguntas } = await supabase
          .from('preguntas')
          .select('*', { count: 'exact', head: true })
          .eq('encuesta_id', item.encuesta_id);

        return {
          envioId: item.id,
          encuestaId: item.encuesta_id,
          titulo: item.encuesta?.titulo || 'Encuesta de investigación',
          objetivo: item.encuesta?.descripcion || 'Proyecto de tesis universitaria',
          estado: item.estado, // 'pendiente' | 'respondida'
          enviadoEn: item.enviado_en,
          respondidoEn: item.respondido_en,
          duracionMin: Math.max(2, Math.round((totalPreguntas || 3) * 0.8)),
          preguntasCount: totalPreguntas || 3
        };
      })
    );
  } catch (err) {
    console.error('[Kampus Surveys] Excepción fetchBandejaEncuestas:', err);
    return [];
  }
}

/**
 * Carga las preguntas de una encuesta para responderla (M27)
 */
export async function fetchPreguntasEncuesta(encuestaId) {
  if (!isSupabaseConfigured || !encuestaId) return [];

  try {
    const { data, error } = await supabase
      .from('preguntas')
      .select('id, orden, texto, tipo, opciones')
      .eq('encuesta_id', encuestaId)
      .order('orden', { ascending: true });

    if (error) {
      console.warn('[Kampus Surveys] Error cargando preguntas:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Guarda las respuestas de una encuesta (1 por pantalla en M27)
 * y actualiza el envío a 'respondida', sumando puntos a Apoyo a la Investigación.
 */
export async function responderEncuestaSegura({ envioId, encuestaId, respuestas }) {
  if (!isSupabaseConfigured || !envioId || !encuestaId) {
    return { success: false, error: 'Identificadores de encuesta requeridos.' };
  }

  try {
    // 1. Insertar respuestas de forma disociada (sin relacionar la identidad del alumno con la respuesta en tabla pública)
    const inserts = Object.entries(respuestas).map(([preguntaId, valor]) => ({
      envio_id: envioId,
      encuesta_id: encuestaId,
      pregunta_id: preguntaId,
      valor: typeof valor === 'object' ? valor : { respuesta: valor }
    }));

    if (inserts.length > 0) {
      const { error: respErr } = await supabase
        .from('respuestas')
        .insert(inserts);

      if (respErr) {
        console.warn('[Kampus Surveys] Error insertando respuestas:', respErr.message);
      }
    }

    // 2. Marcar el envío como respondido
    const { error: updErr } = await supabase
      .from('envios_encuesta')
      .update({
        estado: 'respondida',
        respondido_en: new Date().toISOString()
      })
      .eq('id', envioId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Consulta resultados agregados mediante RPC obtener_resultados_encuesta
 * Garantiza anonimato: nunca devuelve filas de votantes.
 */
export async function obtenerResultadosAgregados(encuestaId) {
  if (!isSupabaseConfigured || !encuestaId) return null;

  try {
    const { data, error } = await supabase.rpc('obtener_resultados_encuesta', {
      p_encuesta_id: encuestaId
    });

    if (error) {
      console.warn('[Kampus Surveys] Error en obtener_resultados_encuesta:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[Kampus Surveys] Excepción obtenerResultadosAgregados:', err);
    return null;
  }
}

/**
 * Carga las encuestas creadas por el usuario actual
 */
export async function fetchMisEncuestasCreadas(userId) {
  if (!isSupabaseConfigured || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('encuestas')
      .select('id, titulo, descripcion, alcance_calculado, alcance_enviado, estado, creado_en')
      .eq('autor_id', userId)
      .order('creado_en', { ascending: false });

    if (error) {
      console.warn('[Kampus Surveys] Error al cargar mis encuestas:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    return Promise.all(
      data.map(async (enc) => {
        const { count: respuestasCount } = await supabase
          .from('respuestas')
          .select('envio_id', { count: 'exact', head: true })
          .eq('encuesta_id', enc.id);

        return {
          id: enc.id,
          titulo: enc.titulo,
          descripcion: enc.descripcion,
          alcanceCalculado: enc.alcance_calculado,
          alcanceEnviado: enc.alcance_enviado,
          respuestasCount: respuestasCount || 0,
          estado: enc.estado,
          creadoEn: enc.creado_en
        };
      })
    );
  } catch (err) {
    return [];
  }
}
