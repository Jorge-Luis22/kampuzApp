-- ==============================================================================
-- 018: encuestas más robustas y habilidades de otros alumnos con permiso
-- ==============================================================================
-- 1. responder_encuesta: cada respuesta de opción debe ser una opción real de la
--    pregunta (antes un alumno podía mandar cualquier texto como "opción" y el autor
--    lo veía como una opción nueva en sus resultados). Las preguntas de varias
--    opciones no repiten ni aceptan opciones inventadas y el texto libre se limita
--    a 500 caracteres.
-- 2. enviar_encuesta_segura: las opciones se guardan limpias (sin espacios sobrantes),
--    distintas entre sí, de 2 a 6 por pregunta y de hasta 100 caracteres; una pregunta
--    abierta no guarda opciones. Mismos límites que usa la app al redactar.
-- 3. calcular_habilidades_usuario: antes cualquier alumno podía pedir las habilidades
--    de cualquier UUID (incluso de quien lo bloqueó o de otra universidad) y obtener
--    datos privados como su alcance semanal. Ahora:
--      - la propia persona recibe todo, igual que antes;
--      - otro alumno solo recibe nombre, nivel y estrellas de las habilidades que ya
--        alcanzó (nivel 1 o más), y solo si son de la misma universidad y no hay un
--        bloqueo entre ambos;
--      - en cualquier otro caso el mensaje es el mismo que si el alumno no existiera.
--    La lógica de cálculo (017) pasa a calcular_habilidades_base, que ya no puede
--    llamar ningún alumno directamente.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Responder encuesta con validación de opciones y de texto libre
-- ------------------------------------------------------------------------------
create or replace function public.responder_encuesta(p_envio_id uuid, p_respuestas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_envio record;
    v_pr record;
    v_valor jsonb;
begin
    select * into v_envio from public.envios_encuesta where id = p_envio_id for update;
    if not found or v_envio.destinatario_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_ENCUESTA: No encontramos esta encuesta en tu bandeja.';
    end if;
    if v_envio.estado = 'respondida' then
        raise exception 'KAMPUZ_ENCUESTA: Ya respondiste esta encuesta.';
    end if;
    if v_envio.estado <> 'pendiente' then
        raise exception 'KAMPUZ_ENCUESTA: Esta encuesta todavía no está disponible.';
    end if;
    if p_respuestas is null or jsonb_typeof(p_respuestas) <> 'object' then
        raise exception 'KAMPUZ_ENCUESTA: Responde todas las preguntas antes de enviar.';
    end if;

    for v_pr in select * from public.preguntas where encuesta_id = v_envio.encuesta_id loop
        v_valor := p_respuestas -> v_pr.id::text;
        if v_valor is null
           or (jsonb_typeof(v_valor) = 'string' and length(trim(v_valor #>> '{}')) = 0)
           or (jsonb_typeof(v_valor) = 'array' and jsonb_array_length(v_valor) = 0) then
            raise exception 'KAMPUZ_ENCUESTA: Responde todas las preguntas antes de enviar.';
        end if;

        if v_pr.tipo = 'abierta' then
            if jsonb_typeof(v_valor) <> 'string' then
                raise exception 'KAMPUZ_ENCUESTA: Respuesta no válida.';
            end if;
            if length(trim(v_valor #>> '{}')) > 500 then
                raise exception 'KAMPUZ_ENCUESTA: Las respuestas escritas admiten hasta 500 caracteres.';
            end if;
            v_valor := to_jsonb(trim(v_valor #>> '{}'));

        elsif v_pr.tipo = 'unica' then
            if jsonb_typeof(v_valor) <> 'string' or not (v_pr.opciones @> jsonb_build_array(v_valor)) then
                raise exception 'KAMPUZ_ENCUESTA: Respuesta no válida.';
            end if;

        else -- 'multiple'
            if jsonb_typeof(v_valor) = 'string' then
                v_valor := jsonb_build_array(v_valor);
            end if;
            if jsonb_typeof(v_valor) <> 'array' then
                raise exception 'KAMPUZ_ENCUESTA: Respuesta no válida.';
            end if;
            if exists (
                select 1 from jsonb_array_elements(v_valor) e
                where jsonb_typeof(e) <> 'string' or not (v_pr.opciones @> jsonb_build_array(e))
            ) or (select count(distinct e) from jsonb_array_elements(v_valor) e) <> jsonb_array_length(v_valor) then
                raise exception 'KAMPUZ_ENCUESTA: Respuesta no válida.';
            end if;
        end if;

        insert into public.respuestas (envio_id, encuesta_id, pregunta_id, valor)
        values (p_envio_id, v_envio.encuesta_id, v_pr.id, v_valor);
    end loop;

    update public.envios_encuesta set estado = 'respondida', respondido_en = now() where id = p_envio_id;
end;
$$;

revoke all on function public.responder_encuesta(uuid, jsonb) from public, anon;
grant execute on function public.responder_encuesta(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. Enviar encuesta: preguntas y opciones limpias (misma lógica de 010 + límites)
-- ------------------------------------------------------------------------------
create or replace function public.enviar_encuesta_segura(
    p_titulo text,
    p_descripcion text,
    p_filtro jsonb,
    p_preguntas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_emisor uuid := auth.uid();
    v_umbral integer;
    v_alcance_total integer;
    v_semanal integer;
    v_usado integer;
    v_cupo integer;
    v_encuesta_id uuid;
    v_p record;
    v_opciones jsonb;
    v_dest uuid;
    v_enviados integer := 0;
    v_encolados integer := 0;
begin
    if v_emisor is null or not exists (select 1 from public.perfiles where id = v_emisor) then
        raise exception 'KAMPUZ_ENCUESTA: Completa tu perfil antes de enviar encuestas.';
    end if;
    if length(trim(coalesce(p_titulo, ''))) < 5 then
        raise exception 'KAMPUZ_ENCUESTA: Escribe un título (mínimo 5 caracteres).';
    end if;
    if jsonb_typeof(p_preguntas) <> 'array' or jsonb_array_length(p_preguntas) = 0 then
        raise exception 'KAMPUZ_ENCUESTA: Agrega al menos una pregunta.';
    end if;
    if jsonb_array_length(p_preguntas) > 15 then
        raise exception 'KAMPUZ_ENCUESTA: Máximo 15 preguntas por encuesta.';
    end if;

    select coalesce((select valor::integer from public.config where clave = 'umbral_minimo_segmento'), 30)
    into v_umbral;

    select count(*) into v_alcance_total from public.destinatarios_filtro(p_filtro, v_emisor);
    if v_alcance_total < v_umbral then
        raise exception 'KAMPUZ_ENCUESTA: Muy pocos (% alumnos). Con menos de % alguien podría quedar identificado. Amplía el ciclo o quita un filtro.', v_alcance_total, v_umbral;
    end if;

    v_semanal := public.alcance_semanal(v_emisor);
    if v_semanal = 0 then
        raise exception 'KAMPUZ_ENCUESTA: Responde una encuesta de otro alumno para desbloquear 30 destinatarios.';
    end if;

    select coalesce(sum(alcance_enviado), 0) into v_usado
    from public.encuestas
    where autor_id = v_emisor and creado_en >= now() - interval '7 days';

    v_cupo := least(v_alcance_total, v_semanal - v_usado);
    if v_cupo <= 0 then
        raise exception 'KAMPUZ_ENCUESTA: Ya usaste tu alcance de esta semana (% destinatarios). Podrás enviar de nuevo en unos días.', v_semanal;
    end if;

    insert into public.encuestas (autor_id, titulo, descripcion, filtro, alcance_calculado, alcance_enviado, estado)
    values (v_emisor, trim(p_titulo), nullif(trim(coalesce(p_descripcion, '')), ''), p_filtro, v_alcance_total, v_cupo, 'enviada')
    returning id into v_encuesta_id;

    for v_p in
        select * from jsonb_to_recordset(p_preguntas) as x(orden int, texto text, tipo text, opciones jsonb)
    loop
        if length(trim(coalesce(v_p.texto, ''))) = 0 or v_p.tipo not in ('unica', 'multiple', 'abierta') then
            raise exception 'KAMPUZ_ENCUESTA: Revisa las preguntas: cada una necesita texto y un tipo válido.';
        end if;
        if length(trim(v_p.texto)) > 300 then
            raise exception 'KAMPUZ_ENCUESTA: Cada pregunta admite hasta 300 caracteres.';
        end if;

        if v_p.tipo = 'abierta' then
            v_opciones := '[]'::jsonb;
        else
            if jsonb_typeof(v_p.opciones) <> 'array' or jsonb_array_length(v_p.opciones) < 2 then
                raise exception 'KAMPUZ_ENCUESTA: Las preguntas de opción necesitan al menos 2 opciones.';
            end if;
            if jsonb_array_length(v_p.opciones) > 6 then
                raise exception 'KAMPUZ_ENCUESTA: Cada pregunta admite hasta 6 opciones.';
            end if;
            if exists (select 1 from jsonb_array_elements(v_p.opciones) e where jsonb_typeof(e) <> 'string') then
                raise exception 'KAMPUZ_ENCUESTA: Las opciones deben ser texto.';
            end if;
            select coalesce(jsonb_agg(trim(t.o) order by t.n), '[]'::jsonb) into v_opciones
            from jsonb_array_elements_text(v_p.opciones) with ordinality as t(o, n);
            if exists (select 1 from jsonb_array_elements_text(v_opciones) e where length(e) = 0 or length(e) > 100) then
                raise exception 'KAMPUZ_ENCUESTA: Cada opción necesita texto (hasta 100 caracteres).';
            end if;
            if (select count(distinct e) from jsonb_array_elements_text(v_opciones) e) <> jsonb_array_length(v_opciones) then
                raise exception 'KAMPUZ_ENCUESTA: Las opciones de una pregunta no pueden repetirse.';
            end if;
        end if;

        insert into public.preguntas (encuesta_id, orden, texto, tipo, opciones)
        values (v_encuesta_id, v_p.orden, trim(v_p.texto), v_p.tipo, v_opciones);
    end loop;

    for v_dest in
        select d from public.destinatarios_filtro(p_filtro, v_emisor) d order by random() limit v_cupo
    loop
        if (select count(*) from public.envios_encuesta
            where destinatario_id = v_dest
              and estado in ('pendiente', 'respondida')
              and enviado_en >= now() - interval '7 days') >= 3 then
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado) values (v_encuesta_id, v_dest, 'encolada');
            v_encolados := v_encolados + 1;
        else
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado) values (v_encuesta_id, v_dest, 'pendiente');
            v_enviados := v_enviados + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'encuesta_id', v_encuesta_id,
        'alcance_calculado', v_alcance_total,
        'enviados', v_enviados,
        'encolados', v_encolados
    );
end;
$$;

revoke all on function public.enviar_encuesta_segura(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.enviar_encuesta_segura(text, text, jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. Habilidades: el cálculo queda interno y la lectura pasa por una puerta con permiso
-- ------------------------------------------------------------------------------
-- Debe poder ejecutarse más de una vez (full_schema.sql lo promete). Hay dos casos:
--   a) calcular_habilidades_usuario es la lógica completa de la 017 (primera vez, o la
--      017 se volvió a ejecutar y pisó la puerta): pasa a ser la base.
--   b) ya es la puerta con permiso (solo se repitió esta migración): no se toca; renombrarla
--      la dejaría llamándose a sí misma.
do $$
declare
    v_def text;
begin
    select pg_get_functiondef('public.calcular_habilidades_usuario(uuid)'::regprocedure) into v_def;
    if v_def not like '%calcular_habilidades_base%' then
        if to_regprocedure('public.calcular_habilidades_base(uuid)') is not null then
            drop function public.calcular_habilidades_base(uuid);
        end if;
        alter function public.calcular_habilidades_usuario(uuid) rename to calcular_habilidades_base;
    end if;
end;
$$;

revoke all on function public.calcular_habilidades_base(uuid) from public, anon, authenticated;

create or replace function public.calcular_habilidades_usuario(p_usuario_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;

    -- Mi propio perfil: todo el detalle (progreso, metas y alcance semanal).
    if p_usuario_id is not distinct from v_yo then
        return public.calcular_habilidades_base(p_usuario_id);
    end if;

    -- Otro alumno: misma universidad y sin bloqueos. El mensaje no distingue entre
    -- "no existe", "es de otra universidad" y "hay un bloqueo".
    if p_usuario_id is null
       or not exists (
           select 1
           from public.perfiles otro
           join public.perfiles yo on yo.id = v_yo
           where otro.id = p_usuario_id and otro.universidad = yo.universidad
       )
       or public.hay_bloqueo(v_yo, p_usuario_id) then
        raise exception 'KAMPUZ_PERFIL: No encontramos a ese alumno.';
    end if;

    -- Solo lo que ya alcanzó y sin datos privados (alcance semanal, progreso exacto, metas).
    return coalesce((
        select jsonb_object_agg(
            t.k,
            jsonb_build_object(
                'nombre', t.v -> 'nombre',
                'nivel', t.v -> 'nivel',
                'estrellas', t.v -> 'estrellas',
                'taller', coalesce(t.v -> 'taller', 'false'::jsonb)
            )
        )
        from jsonb_each(public.calcular_habilidades_base(p_usuario_id)) as t(k, v)
        where (t.v ->> 'nivel')::integer >= 1
    ), '{}'::jsonb);
end;
$$;

revoke all on function public.calcular_habilidades_usuario(uuid) from public, anon;
grant execute on function public.calcular_habilidades_usuario(uuid) to authenticated;
