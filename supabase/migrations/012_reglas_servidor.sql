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

-- ------------------------------------------------------------------------------
-- 2. SIN ATAJOS ALREDEDOR DE LAS FUNCIONES DEL SERVIDOR (paso 7)
--    Estas políticas de 002/006 dejaban escribir directo en las tablas y saltarse
--    las reglas que aplican las RPC de 010:
--    - envios_encuesta UPDATE: marcar "respondida" sin responder → subir de nivel de
--      Apoyo a la investigación y desbloquear alcance (spec 5.2) sin ayudar a nadie.
--    - asesorias INSERT: orientar sin ciclo >= 5 / mayor que los autores y fijarse
--      estrellas_acreditadas a mano (spec 7.1).
--    - valoraciones_asesoria INSERT: valorar sin ser autor de la consulta.
--    - consultas INSERT: crear consultas sin agrupar (nAlumnos falso).
--    - encuestas / preguntas / respuestas INSERT: encuestas sin umbral ni alcance,
--      respuestas sin envío pendiente.
--    Ahora solo se escribe en ellas a través de las funciones del servidor.
-- ------------------------------------------------------------------------------
drop policy if exists "Destinatario actualiza su estado de envio" on public.envios_encuesta;
drop policy if exists "Asesor inserta su orientacion" on public.asesorias;
drop policy if exists "Alumnos ciclo 5 o superior orientan" on public.asesorias;
drop policy if exists "Autores de la consulta valoran la asesoria" on public.valoraciones_asesoria;
drop policy if exists "Solo autor valora orientacion" on public.valoraciones_asesoria;
drop policy if exists "Alumnos crean sus propias consultas" on public.consultas;
drop policy if exists "Insercion de consultas para autenticados" on public.consultas;
drop policy if exists "Autores crean encuestas" on public.encuestas;
drop policy if exists "Autores insertan preguntas en sus encuestas" on public.preguntas;
drop policy if exists "Destinatario inserta sus respuestas" on public.respuestas;

-- ------------------------------------------------------------------------------
-- 3. CERTIFICADOS (spec 5.5): el nivel y el origen los decide el servidor
--    El alumno podía guardar nivel "Avanzado" u origen "verificada" a mano.
-- ------------------------------------------------------------------------------
create or replace function public.clasificar_certificado()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        new.habilidad := trim(new.habilidad);
        new.emisor := trim(new.emisor);
        if length(new.habilidad) < 2 or length(new.emisor) < 2 then
            raise exception 'KAMPUZ_CERTIFICADO: Indica la habilidad y quién emitió el certificado.';
        end if;
        new.horas := greatest(coalesce(new.horas, 0), 0);
        new.tiene_evaluacion := coalesce(new.tiene_evaluacion, false);
        -- clasificar(horas, tieneEvaluacion): > 60 Avanzado; >= 20 o evaluación Intermedio; si no Básico
        new.nivel := case
            when new.horas > 60 then 'Avanzado'
            when new.horas >= 20 or new.tiene_evaluacion then 'Intermedio'
            else 'Básico'
        end;
        -- Con enlace verificable es "con evidencia"; sin enlace queda un escalón abajo (declarada).
        -- "respaldada" y "verificada" no las puede poner el alumno.
        new.url := nullif(trim(coalesce(new.url, '')), '');
        if new.url is not null and new.url !~* '^https?://' then
            raise exception 'KAMPUZ_CERTIFICADO: El enlace de verificación debe empezar con https://';
        end if;
        new.origen := case when new.url is not null or new.archivo_url is not null then 'con_evidencia' else 'declarada' end;
        new.propuesto_por_agente := false;
        new.aprobado := true;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_clasificar_certificado on public.certificados;
create trigger trg_clasificar_certificado
    before insert or update on public.certificados
    for each row
    execute function public.clasificar_certificado();

-- ------------------------------------------------------------------------------
-- 4. STORAGE: el bucket de avatares solo acepta imágenes pequeñas
-- ------------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 1048576, -- 1 MB (el cliente comprime a < 300 KB)
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatares';

-- ------------------------------------------------------------------------------
-- 5. FUNCIONES: nada de negocio ejecutable sin sesión
-- ------------------------------------------------------------------------------
revoke all on function public.umbral_visibilidad() from public, anon;
grant execute on function public.umbral_visibilidad() to authenticated;
