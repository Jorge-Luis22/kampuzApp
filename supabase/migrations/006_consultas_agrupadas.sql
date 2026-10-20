-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 006: CONSULTAS AGRUPADAS (reemplazada)
--
-- La versión original de este archivo usaba columnas que no existen en el esquema
-- de 001 (consultas.autores_ids, consultas.texto_resumen, asesorias.consulta_id,
-- valoraciones_asesoria.evaluador_id, estados 'activa'/'respondida') y fallaba al
-- aplicarse en una base nueva ("column evaluador_id does not exist"). Nunca llegó
-- a la base de producción.
--
-- El flujo de consultas se reimplementa sobre el esquema de 001
-- (grupos_consulta + consultas + asesorias + valoraciones_asesoria) en
-- 012_reglas_servidor.sql. Este archivo queda vacío para que la secuencia
-- 001 → 012 sea reproducible desde cero.
-- ==============================================================================

drop function if exists public.crear_o_agrupar_consulta(text, text, text, text, uuid, text);
