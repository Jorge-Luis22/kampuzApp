-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 012: Reglas que deben vivir en el servidor
-- Auditoría (docs/PROMPT_CLAUDE_CODE_AUDITORIA.md, pasos 5 y 7).
-- Ver la tabla completa "Dónde se aplica cada regla" en docs/DECISIONES.md.
-- Idempotente.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FOTOS DE PERFIL: solo URLs de Storage, nunca imágenes en base64 (paso 5, punto 11)
--    El cliente guardaba la foto como Data URL en foto_url cuando Storage fallaba.
-- ------------------------------------------------------------------------------
update public.perfiles set foto_url = null where foto_url like 'data:%';

do $$
begin
    alter table public.perfiles
        add constraint perfiles_foto_url_no_base64
        check (foto_url is null or (foto_url not like 'data:%' and length(foto_url) <= 500));
exception when duplicate_object then null;
end $$;
