-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 003: Funciones RPC, Triggers y Reglas en Base de Datos
-- Basado en PROMPT_ANTIGRAVITY_MVP.md (Reglas 3, 4, 5 y Fases 5, 6, 7)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VALIDACIÓN DE CORREO INSTITUCIONAL O INVITADO
-- ------------------------------------------------------------------------------
create or replace function public.validar_correo_institucional()
returns trigger as $$
begin
    if not (
        new.correo_institucional ilike '%@utp.edu.pe'
        or exists (
            select 1 from public.correos_invitados
            where lower(correo) = lower(new.correo_institucional)
        )
    ) then
        raise exception 'Acceso restringido: El correo % no pertenece al dominio @utp.edu.pe ni está en la lista de invitados autorizados.', new.correo_institucional;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_validar_correo_perfil on public.perfiles;
create trigger trg_validar_correo_perfil
    before insert or update of correo_institucional
    on public.perfiles
    for each row
    execute function public.validar_correo_institucional();

-- ------------------------------------------------------------------------------
-- 2. AUTO-ASIGNACIÓN A GRUPO DE CARRERA Y CICLO Y ESPACIO DE CARRERA
-- ------------------------------------------------------------------------------
create or replace function public.auto_asignar_espacios_alumno()
returns trigger as $$
declare
    v_espacio_carrera_id uuid;
    v_espacio_ciclo_id uuid;
    v_nombre_carrera text;
    v_nombre_ciclo text;
begin
    v_nombre_carrera := 'Comunidad de ' || new.carrera || ' UTP';
    v_nombre_ciclo := new.carrera || ' — Ciclo ' || new.ciclo;

    -- 1. Espacio de carrera (Cruza ciclos 1 al 10)
    select id into v_espacio_carrera_id
    from public.espacios
    where tipo = 'carrera' and carrera = new.carrera and sede = new.sede
    limit 1;

    if v_espacio_carrera_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
        values (
            'carrera',
            v_nombre_carrera,
            'Espacio académico general para todos los ciclos de ' || new.carrera || ' ' || new.sede || '. Consultas, orientación y proyectos.',
            '/grupos/carrera_default.jpg',
            new.carrera,
            new.sede,
            false,
            'visible'
        )
        returning id into v_espacio_carrera_id;
    end if;

    -- 2. Espacio de carrera y ciclo (Cohorte de salón)
    select id into v_espacio_ciclo_id
    from public.espacios
    where tipo = 'carrera_ciclo' and carrera = new.carrera and ciclo = new.ciclo and sede = new.sede
    limit 1;

    if v_espacio_ciclo_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, ciclo, sede, oficial, estado)
        values (
            'carrera_ciclo',
            v_nombre_ciclo,
            'Grupo exclusivo de compañeros de salón de ' || new.carrera || ' — Ciclo ' || new.ciclo || ' ' || new.sede || '.',
            '/grupos/ciclo_default.jpg',
            new.carrera,
            new.ciclo,
            new.sede,
            false,
            'visible'
        )
        returning id into v_espacio_ciclo_id;
    end if;

    -- Asegurar membresía en espacio de carrera
    insert into public.membresias (usuario_id, espacio_id, rol)
    values (new.id, v_espacio_carrera_id, 'miembro')
    on conflict (usuario_id, espacio_id) do nothing;

    -- Asegurar membresía en espacio de ciclo
    insert into public.membresias (usuario_id, espacio_id, rol)
    values (new.id, v_espacio_ciclo_id, 'miembro')
    on conflict (usuario_id, espacio_id) do nothing;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_asignar_espacios on public.perfiles;
create trigger trg_auto_asignar_espacios
    after insert or update of carrera, ciclo, sede
    on public.perfiles
    for each row
    execute function public.auto_asignar_espacios_alumno();

-- ------------------------------------------------------------------------------
-- 3. MODERACIÓN DE DOCENTES EN CONSULTAS (Sección 7.1)
-- ------------------------------------------------------------------------------
-- Regla: "Se habla del curso, no de la persona".
-- Regex sin flag /i para nombres propios (Profesor [A-Z]...).
create or replace function public.moderar_consulta_servidor()
returns trigger as $$
declare
    v_menciona_docente boolean;
    v_emite_juicio boolean;
    v_nombre_propio boolean;
begin
    -- 1. Mención a docente con juicio de valor (insensible a mayúsculas)
    v_menciona_docente := new.texto ~* '\m(profe|profesor|profesora|docente|maestro|maestra)\M';
    v_emite_juicio := new.texto ~* '\m(mejor|peor|cuál|recomienda|evita|jala|regala|bueno|malo|filtro|fácil|difícil)\M';

    if v_menciona_docente and v_emite_juicio then
        raise exception 'Moderación activa: Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones o qué material conviene.';
    end if;

    -- 2. Nombre propio de docente: sensible a mayúsculas
    v_nombre_propio := new.texto ~ '\m(profesor|profesora|docente|profe)\s+[A-ZÁÉÍÓÚ]';
    if v_nombre_propio then
        raise exception 'Moderación activa: Mencionaste a un docente por su nombre. En Kampus se habla del curso, no de la persona.';
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_moderar_consulta on public.consultas;
create trigger trg_moderar_consulta
    before insert on public.consultas
    for each row
    execute function public.moderar_consulta_servidor();

-- ------------------------------------------------------------------------------
-- 4. UMBRAL DINÁMICO DE PROPUESTA DE GRUPOS (Sección 7.2)
-- ------------------------------------------------------------------------------
create or replace function public.verificar_umbral_propuesta()
returns trigger as $$
declare
    v_total_apoyos integer;
    v_base_activa integer;
    v_umbral integer;
begin
    -- Contar apoyos acumulados para este espacio
    select count(*) into v_total_apoyos
    from public.apoyos_propuesta
    where espacio_id = new.espacio_id;

    -- Base activa aproximada (usuarios registrados)
    select count(*) into v_base_activa from public.perfiles;
    v_umbral := greatest(15, round(v_base_activa * 0.03));

    if v_total_apoyos >= v_umbral then
        update public.espacios
        set estado = 'visible'
        where id = new.espacio_id and estado = 'oculto';
    end if;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_verificar_umbral_propuesta on public.apoyos_propuesta;
create trigger trg_verificar_umbral_propuesta
    after insert on public.apoyos_propuesta
    for each row
    execute function public.verificar_umbral_propuesta();

-- ------------------------------------------------------------------------------
-- 5. RPC: CALCULAR ALCANCE EN VIVO (Flujo Encuestas - Sección 6.5)
-- Devuelve SOLO un número entero. El emisor NUNCA recibe la lista de personas.
-- ------------------------------------------------------------------------------
create or replace function public.calcular_alcance_encuesta(p_filtro jsonb)
returns integer as $$
declare
    v_carrera text;
    v_ciclo_min integer;
    v_ciclo_max integer;
    v_edad_min integer;
    v_edad_max integer;
    v_intereses text[];
    v_alcance integer;
begin
    v_carrera := nullif(p_filtro->>'carrera', '');
    v_ciclo_min := coalesce((p_filtro->>'cicloMin')::integer, 1);
    v_ciclo_max := coalesce((p_filtro->>'cicloMax')::integer, 10);
    v_edad_min := coalesce((p_filtro->>'edadMin')::integer, 16);
    v_edad_max := coalesce((p_filtro->>'edadMax')::integer, 99);

    if p_filtro ? 'intereses' and jsonb_array_length(p_filtro->'intereses') > 0 then
        select array_agg(elem::text) into v_intereses
        from jsonb_array_elements_text(p_filtro->'intereses') as elem;
    else
        v_intereses := '{}';
    end if;

    select count(*) into v_alcance
    from public.perfiles p
    where p.id <> auth.uid()
      and (v_carrera is null or p.carrera = v_carrera)
      and p.ciclo between v_ciclo_min and v_ciclo_max
      and extract(year from age(p.fecha_nacimiento)) between v_edad_min and v_edad_max
      and (
          array_length(v_intereses, 1) is null 
          or p.intereses && v_intereses
      );

    return v_alcance;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- 6. RPC: ENVÍO SEGURO DE ENCUESTAS (Flujo Encuestas - Sección 5.2, 6.5 y 7.4)
-- Valida umbral mínimo de 30, alcance semanal por nivel, y tope de 3 por semana
-- ------------------------------------------------------------------------------
create or replace function public.enviar_encuesta_segura(
    p_titulo text,
    p_descripcion text,
    p_filtro jsonb,
    p_preguntas jsonb
)
returns jsonb as $$
declare
    v_emisor_id uuid := auth.uid();
    v_umbral_minimo integer := 30;
    v_alcance_total integer;
    v_nivel_investigacion integer := 0;
    v_alcance_semanal integer := 0;
    v_cupo_maximo integer;
    v_encuesta_id uuid;
    v_pregunta record;
    v_dest record;
    v_enviados_count integer := 0;
    v_encolados_count integer := 0;
    v_recibidas_semana integer;
begin
    if v_emisor_id is null then
        raise exception 'Debes estar autenticado para enviar encuestas.';
    end if;

    -- 1. Leer umbral de configuración
    select coalesce(valor::integer, 30) into v_umbral_minimo
    from public.config
    where clave = 'umbral_minimo_segmento';

    -- 2. Calcular alcance del filtro
    v_alcance_total := public.calcular_alcance_encuesta(p_filtro);

    -- Regla dura de umbral mínimo
    if v_alcance_total < v_umbral_minimo then
        raise exception 'Segmento insuficiente (% personas). El mínimo requerido para garantizar el anonimato es % personas. Amplía el rango de ciclos o flexibiliza el filtro.', v_alcance_total, v_umbral_minimo;
    end if;

    -- 3. Calcular nivel de "Apoyo a la investigación" del emisor
    -- Nivel 0 = 0, Nivel 1 = 1 encuesta respondida, Nivel 2 = 3, Nivel 3 = 8
    select count(*) into v_nivel_investigacion
    from public.envios_encuesta
    where destinatario_id = v_emisor_id and estado = 'respondida';

    if v_nivel_investigacion >= 8 then
        v_alcance_semanal := 200;
    elsif v_nivel_investigacion >= 3 then
        v_alcance_semanal := 80;
    elsif v_nivel_investigacion >= 1 then
        v_alcance_semanal := 30;
    else
        v_alcance_semanal := 0;
    end if;

    if v_alcance_semanal = 0 then
        raise exception 'Alcance semanal agotado (0 destinatarios). En Kampus el primer gesto es ayudar: responde una encuesta en tu bandeja para desbloquear 30 envíos.';
    end if;

    v_cupo_maximo := least(v_alcance_total, v_alcance_semanal);

    -- 4. Crear registro de encuesta
    insert into public.encuestas (autor_id, titulo, descripcion, filtro, alcance_calculado, alcance_enviado, estado)
    values (v_emisor_id, p_titulo, p_descripcion, p_filtro, v_alcance_total, v_cupo_maximo, 'enviada')
    returning id into v_encuesta_id;

    -- 5. Insertar preguntas
    for v_pregunta in select * from jsonb_to_recordset(p_preguntas) as x(orden int, texto text, tipo text, opciones jsonb) loop
        insert into public.preguntas (encuesta_id, orden, texto, tipo, opciones)
        values (v_encuesta_id, v_pregunta.orden, v_pregunta.texto, v_pregunta.tipo, coalesce(v_pregunta.opciones, '[]'::jsonb));
    end loop;

    -- 6. Seleccionar muestra aleatoria de destinatarios
    for v_dest in (
        select p.id
        from public.perfiles p
        where p.id <> v_emisor_id
          and (nullif(p_filtro->>'carrera', '') is null or p.carrera = p_filtro->>'carrera')
          and p.ciclo between coalesce((p_filtro->>'cicloMin')::integer, 1) and coalesce((p_filtro->>'cicloMax')::integer, 10)
        order by random()
        limit v_cupo_maximo
    ) loop
        -- Verificar si el alumno ya recibió 3 encuestas esta semana (Tope de 3 / semana)
        select count(*) into v_recibidas_semana
        from public.envios_encuesta
        where destinatario_id = v_dest.id
          and enviado_en >= now() - interval '7 days'
          and estado in ('pendiente', 'respondida');

        if v_recibidas_semana >= 3 then
            -- Excedente a la cola (no se descarta - Sección 6.5)
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado)
            values (v_encuesta_id, v_dest.id, 'encolada');
            v_encolados_count := v_encolados_count + 1;
        else
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado)
            values (v_encuesta_id, v_dest.id, 'pendiente');
            v_enviados_count := v_enviados_count + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'encuesta_id', v_encuesta_id,
        'alcance_calculado', v_alcance_total,
        'enviados', v_enviados_count,
        'encolados', v_encolados_count
    );
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- 7. RPC: OBTENER RESULTADOS AGREGADOS (Ley 29733 - Respuestas Agregadas)
-- ------------------------------------------------------------------------------
create or replace function public.obtener_resultados_encuesta(p_encuesta_id uuid)
returns jsonb as $$
declare
    v_autor_id uuid;
    v_total_respuestas integer;
    v_resultado jsonb;
begin
    select autor_id into v_autor_id from public.encuestas where id = p_encuesta_id;
    if v_autor_id is null then
        raise exception 'Encuesta no encontrada.';
    end if;

    select count(distinct envio_id) into v_total_respuestas
    from public.respuestas
    where encuesta_id = p_encuesta_id;

    select jsonb_build_object(
        'encuesta_id', p_encuesta_id,
        'total_respuestas', v_total_respuestas,
        'preguntas', coalesce(jsonb_agg(
            jsonb_build_object(
                'pregunta_id', pr.id,
                'texto', pr.texto,
                'tipo', pr.tipo,
                'opciones', pr.opciones,
                'conteo_respuestas', (
                    select jsonb_object_agg(coalesce(r.valor #>> '{}', 'Sin respuesta'), count(*))
                    from public.respuestas r
                    where r.pregunta_id = pr.id
                    group by r.pregunta_id
                )
            ) order by pr.orden
        ), '[]'::jsonb)
    ) into v_resultado
    from public.preguntas pr
    where pr.encuesta_id = p_encuesta_id;

    return v_resultado;
end;
$$ language plpgsql security definer;
