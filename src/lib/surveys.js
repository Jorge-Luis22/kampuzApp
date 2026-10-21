import { supabase, ejecutar, rpc } from './supabase.js';

// =============================================================================
// Encuestas con filtro (M23–M28, spec 6.5 y 7.4). El servidor decide todo:
// umbral mínimo, alcance semanal, muestra aleatoria, tope de 3 por semana con
// cola y resultados solo agregados para el autor.
// =============================================================================

export async function fetchUmbralMinimoSegmento() {
  const fila = await ejecutar(
    supabase.from('config').select('valor').eq('clave', 'umbral_minimo_segmento').maybeSingle()
  );
  return parseInt(fila?.valor, 10) || 30;
}

function filtroParaServidor(filtro) {
  return {
    carreras: Array.isArray(filtro.carreras) ? filtro.carreras : filtro.carrera ? [filtro.carrera] : [],
    cicloMin: Number(filtro.cicloMin || 1),
    cicloMax: Number(filtro.cicloMax || 10),
    edadMin: Number(filtro.edadMin || 18),
    edadMax: Number(filtro.edadMax || 99),
    intereses: filtro.intereses || []
  };
}

/**
 * Cuántos alumnos caen en el filtro. Solo un número: nunca la lista.
 */
export async function calcularAlcanceEnVivo(filtro) {
  const n = await rpc('calcular_alcance_encuesta', { p_filtro: filtroParaServidor(filtro) });
  return Number(n) || 0;
}

/**
 * Envía la encuesta. Devuelve { encuesta_id, alcance_calculado, enviados, encolados }.
 */
export async function enviarEncuestaSegura({ titulo, descripcion, filtro, preguntas }) {
  return rpc('enviar_encuesta_segura', {
    p_titulo: titulo.trim(),
    p_descripcion: descripcion?.trim() || '',
    p_filtro: filtroParaServidor(filtro),
    p_preguntas: preguntas.map((p, idx) => ({
      orden: idx + 1,
      texto: p.texto,
      tipo: p.tipo || 'unica',
      opciones: (p.opciones || []).map((o) => o.trim()).filter(Boolean)
    }))
  });
}

/**
 * Bandeja: el servidor libera primero lo que estaba en cola si hay cupo semanal.
 */
export async function fetchBandejaEncuestas() {
  const filas = (await rpc('mi_bandeja_encuestas')) || [];
  return filas.map((e) => ({
    envioId: e.envio_id,
    encuestaId: e.encuesta_id,
    titulo: e.titulo,
    objetivo: e.descripcion || '',
    estado: e.estado, // 'pendiente' | 'respondida'
    enviadoEn: e.enviado_en,
    respondidoEn: e.respondido_en,
    preguntasCount: e.n_preguntas,
    duracionMin: Math.max(1, Math.round((e.n_preguntas || 1) * 0.6))
  }));
}

export async function fetchPreguntasEncuesta(encuestaId) {
  return (
    (await ejecutar(
      supabase
        .from('preguntas')
        .select('id, orden, texto, tipo, opciones')
        .eq('encuesta_id', encuestaId)
        .order('orden', { ascending: true })
    )) || []
  );
}

/**
 * Guarda todas las respuestas y marca el envío como respondido, en una transacción.
 * respuestas: { [preguntaId]: valor }
 */
export async function responderEncuestaSegura({ envioId, respuestas }) {
  await rpc('responder_encuesta', { p_envio_id: envioId, p_respuestas: respuestas });
}

/**
 * Resultados agregados (solo el autor). Nunca incluyen quién respondió qué.
 */
export async function obtenerResultadosAgregados(encuestaId) {
  const r = await rpc('obtener_resultados_encuesta', { p_encuesta_id: encuestaId });
  return {
    ...r,
    preguntas: (r?.preguntas || []).map((q) => ({ ...q, conteo_respuestas: q.conteo || {} }))
  };
}

export async function fetchMisEncuestasCreadas() {
  const filas = (await rpc('mis_encuestas_creadas')) || [];
  return filas.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion,
    alcanceCalculado: e.alcance_calculado,
    alcanceEnviado: e.alcance_enviado,
    respuestasCount: e.respuestas,
    encoladas: e.encoladas,
    estado: e.estado,
    creadoEn: e.creado_en
  }));
}
