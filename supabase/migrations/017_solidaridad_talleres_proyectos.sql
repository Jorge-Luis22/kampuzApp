-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 017: Solidaridad, talleres con puntos, proyectos reales y
-- umbral de grupos para el piloto.
--
-- Decisiones de producto (Jorge, 2026-10-27):
--   1. Solidaridad: la habilidad "Predisposición a ayudar" pasa a llamarse
--      "Solidaridad" y la alimenta el botón "Me ayudó" de quien preguntó.
--   2. Talleres de la UTP: al terminar, el alumno recibe puntos en una habilidad
--      (liderazgo, IA, datos...) y queda registrada su constancia.
--   3. Proyectos reales (hackatones, startups, tesis) que buscan equipo.
--   4. El mínimo de apoyos para abrir un grupo baja para el piloto.
--
-- Cada función nueva hace revoke de public/anon (docs/DECISIONES.md, migración 014).
-- Es idempotente: se puede ejecutar dos veces.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. CONFIGURACIÓN DEL PILOTO
-- ------------------------------------------------------------------------------
insert into public.config (clave, valor, descripcion)
values
    ('umbral_apoyos_grupo', '5', 'Mínimo de apoyos para que una propuesta de grupo sea visible. PILOTO: 5 (la spec pide 15); volver a 15 al abrir a más alumnos. El umbral real es el mayor entre este valor y el 3 % de la base.'),
    ('min_alumnos_estrellas', '1', 'Alumnos distintos con la misma duda para que "Me ayudó" acredite estrellas. PILOTO: 1 (la spec pedía 2); volver a 2 al abrir a más alumnos.')
on conflict (clave) do nothing;

-- ------------------------------------------------------------------------------
-- 1. UMBRAL DE GRUPOS DE INTERÉS (antes: max(15, 3 % de la base))
--    Ahora: max(config.umbral_apoyos_grupo, 3 % de la base), nunca menos de 2.
-- ------------------------------------------------------------------------------
create or replace function public.umbral_visibilidad()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select greatest(
        coalesce((select nullif(valor, '')::integer from public.config where clave = 'umbral_apoyos_grupo'), 15),
        2,
        round((select count(*) from public.perfiles) * 0.03)
    )::integer;
$$;

-- La app lee estas reglas para mostrar textos correctos (no expone nada más de la tabla config).
create or replace function public.reglas_piloto()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'umbral_apoyos_grupo', public.umbral_visibilidad(),
        'min_alumnos_estrellas', greatest(coalesce((select nullif(valor, '')::integer from public.config where clave = 'min_alumnos_estrellas'), 2), 1)
    )
    where auth.uid() is not null;
$$;

revoke all on function public.reglas_piloto() from public, anon;
grant execute on function public.reglas_piloto() to authenticated;

-- Las propuestas ocultas que ya tienen apoyos suficientes con la regla nueva pasan a visibles.
update public.espacios e
set estado = 'visible'
where e.tipo = 'interes'
  and e.estado = 'oculto'
  and (select count(*) from public.apoyos_propuesta a where a.espacio_id = e.id) >= public.umbral_visibilidad();

-- ------------------------------------------------------------------------------
-- 2. SOLIDARIDAD: el botón "Me ayudó"
--    Cambios respecto a la 010:
--    - Las estrellas ya no exigen 2 alumnos con la misma duda: el mínimo sale de
--      config.min_alumnos_estrellas (piloto: 1).
--    - "Conectados" solo cuenta los contactos reales (origen 'solicitud'); un chat
--      de "Yo te ayudo" del tablón no bloquea las estrellas.
-- ------------------------------------------------------------------------------
create or replace function public.valorar_asesoria(p_asesoria_id uuid, p_util boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_as record;
    v_grupo record;
    v_conectados boolean;
    v_min integer;
    v_estrellas integer := 0;
begin
    select * into v_as from public.asesorias where id = p_asesoria_id for update;
    if not found then
        raise exception 'KAMPUZ_CONSULTA: No encontramos esta respuesta.';
    end if;
    if not exists (
        select 1 from public.consultas where grupo_consulta_id = v_as.grupo_consulta_id and autor_id = v_uid
    ) then
        raise exception 'KAMPUZ_CONSULTA: Solo quienes hicieron la consulta pueden confirmar la ayuda.';
    end if;
    if exists (select 1 from public.valoraciones_asesoria where asesoria_id = p_asesoria_id and usuario_id = v_uid) then
        raise exception 'KAMPUZ_CONSULTA: Ya valoraste esta respuesta.';
    end if;

    insert into public.valoraciones_asesoria (asesoria_id, usuario_id, util)
    values (p_asesoria_id, v_uid, p_util);

    if p_util and v_as.estrellas_acreditadas = 0 then
        select * into v_grupo from public.grupos_consulta where id = v_as.grupo_consulta_id;
        v_min := greatest(coalesce((select nullif(valor, '')::integer from public.config where clave = 'min_alumnos_estrellas'), 2), 1);
        v_conectados := exists (
            select 1 from public.conversaciones
            where usuario_a_id = least(v_uid, v_as.asesor_id)
              and usuario_b_id = greatest(v_uid, v_as.asesor_id)
              and origen = 'solicitud'
        );
        if v_grupo.n_alumnos >= v_min and not v_conectados then
            v_estrellas := v_grupo.n_alumnos;
        end if;
        update public.asesorias
        set estrellas_acreditadas = v_estrellas, estrellas_pendientes = 0
        where id = p_asesoria_id;
        update public.grupos_consulta set estado = 'resuelto', resuelto_en = now()
        where id = v_as.grupo_consulta_id and estado = 'abierto';
        update public.consultas set estado = 'resuelta' where grupo_consulta_id = v_as.grupo_consulta_id;
    end if;

    return jsonb_build_object('estrellas_acreditadas', v_estrellas);
end;
$$;

revoke all on function public.valorar_asesoria(uuid, boolean) from public, anon;
grant execute on function public.valorar_asesoria(uuid, boolean) to authenticated;

-- Al responder, las estrellas pendientes también usan el mínimo configurable.
create or replace function public.responder_consulta(p_grupo_id uuid, p_texto text, p_modo text default 'mensaje')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_perfil record;
    v_grupo record;
    v_ciclo_max integer;
    v_min integer;
    v_id uuid;
begin
    if coalesce(p_modo, 'mensaje') <> 'mensaje' then
        raise exception 'KAMPUZ_CONSULTA: Por ahora solo se puede orientar por mensaje.';
    end if;
    select * into v_perfil from public.perfiles where id = v_uid;
    select * into v_grupo from public.grupos_consulta where id = p_grupo_id;
    if v_perfil.id is null or v_grupo.id is null then
        raise exception 'KAMPUZ_CONSULTA: No encontramos esta consulta.';
    end if;
    if v_grupo.carrera <> v_perfil.carrera then
        raise exception 'KAMPUZ_CONSULTA: Solo puedes orientar consultas de tu carrera.';
    end if;
    if v_perfil.ciclo < 5 then
        raise exception 'KAMPUZ_CONSULTA: Solo alumnos de ciclo 5 o superior pueden orientar.';
    end if;
    if exists (select 1 from public.consultas where grupo_consulta_id = p_grupo_id and autor_id = v_uid) then
        raise exception 'KAMPUZ_CONSULTA: No puedes orientar una consulta en la que tú preguntaste.';
    end if;
    select coalesce(max(ciclo_autor), 0) into v_ciclo_max from public.consultas where grupo_consulta_id = p_grupo_id;
    if v_perfil.ciclo <= v_ciclo_max then
        raise exception 'KAMPUZ_CONSULTA: Para orientar aquí debes estar en un ciclo mayor que %.', v_ciclo_max;
    end if;
    if length(trim(coalesce(p_texto, ''))) < 10 then
        raise exception 'KAMPUZ_CONSULTA: Escribe una orientación un poco más completa (mínimo 10 caracteres).';
    end if;

    v_min := greatest(coalesce((select nullif(valor, '')::integer from public.config where clave = 'min_alumnos_estrellas'), 2), 1);

    insert into public.asesorias (grupo_consulta_id, asesor_id, modo, texto, estrellas_pendientes, estrellas_acreditadas)
    values (
        p_grupo_id, v_uid, 'mensaje', trim(p_texto),
        case when v_grupo.n_alumnos >= v_min then v_grupo.n_alumnos else 0 end,
        0
    )
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.responder_consulta(uuid, text, text) from public, anon;
grant execute on function public.responder_consulta(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. TALLERES DE LA UTP CON PUNTOS DE HABILIDAD
-- ------------------------------------------------------------------------------
alter table public.espacios add column if not exists habilidad_taller text;
alter table public.espacios add column if not exists puntos_taller integer not null default 20;

do $$
begin
    alter table public.espacios
        add constraint espacios_puntos_taller_valido check (puntos_taller between 1 and 60);
exception when duplicate_object then null;
end $$;

-- El taller de IA oficial del seed ya otorga puntos de ejemplo; los deportivos no.
update public.espacios
set habilidad_taller = 'Inteligencia artificial', puntos_taller = 20
where tipo = 'taller' and oficial and habilidad_taller is null and nombre ilike 'Taller de IA%';

create table if not exists public.constancias_taller (
    id uuid primary key default gen_random_uuid(),
    espacio_id uuid not null references public.espacios(id) on delete cascade,
    usuario_id uuid not null references public.perfiles(id) on delete cascade,
    habilidad text not null,
    puntos integer not null check (puntos > 0),
    otorgada_por uuid references public.perfiles(id) on delete set null,
    otorgada_en timestamptz not null default now(),
    constraint constancias_taller_unica unique (espacio_id, usuario_id)
);

alter table public.constancias_taller enable row level security;

-- Personal de la UTP: moderador o admin_universidad (el rol solo se asigna por SQL).
create or replace function public.es_personal_utp()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.perfiles p
        where p.id = auth.uid() and p.rol in ('moderador', 'admin_universidad')
    );
$$;

revoke all on function public.es_personal_utp() from public, anon;
grant execute on function public.es_personal_utp() to authenticated;

-- ¿Puedo gestionar las constancias de este taller? Personal UTP o admin del taller.
create or replace function public.gestiona_taller(p_espacio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.es_personal_utp()
        or exists (
            select 1 from public.membresias m
            join public.espacios e on e.id = m.espacio_id
            where m.espacio_id = p_espacio_id and m.usuario_id = auth.uid()
              and m.rol in ('admin', 'moderador') and e.tipo = 'taller'
        );
$$;

revoke all on function public.gestiona_taller(uuid) from public, anon;
grant execute on function public.gestiona_taller(uuid) to authenticated;

-- Cada alumno lee solo sus constancias; nadie escribe directo (solo las funciones).
drop policy if exists "Constancias propias" on public.constancias_taller;
create policy "Constancias propias"
    on public.constancias_taller for select
    to authenticated
    using (usuario_id = auth.uid() or public.es_personal_utp());

revoke all on public.constancias_taller from anon;
revoke insert, update, delete on public.constancias_taller from authenticated;

-- Lo que la app necesita saber de cada taller: qué habilidad da, cuántos puntos,
-- si ya tengo mi constancia y si puedo gestionarlas.
create or replace function public.info_talleres()
returns table (
    espacio_id uuid,
    habilidad text,
    puntos integer,
    constancia_en timestamptz,
    puedo_gestionar boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        e.id,
        e.habilidad_taller,
        e.puntos_taller,
        (select c.otorgada_en from public.constancias_taller c where c.espacio_id = e.id and c.usuario_id = auth.uid()),
        public.gestiona_taller(e.id)
    from public.espacios e
    where auth.uid() is not null and e.tipo = 'taller';
$$;

revoke all on function public.info_talleres() from public, anon;
grant execute on function public.info_talleres() to authenticated;

-- Crear un taller oficial (solo personal de la UTP). Quien lo crea queda como admin.
create or replace function public.crear_taller(
    p_nombre text,
    p_descripcion text,
    p_horario text,
    p_link text,
    p_habilidad text,
    p_puntos integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_nombre text := trim(coalesce(p_nombre, ''));
    v_habilidad text := nullif(trim(coalesce(p_habilidad, '')), '');
    v_link text := nullif(trim(coalesce(p_link, '')), '');
    v_puntos integer := coalesce(p_puntos, 20);
    v_id uuid;
begin
    if not public.es_personal_utp() then
        raise exception 'KAMPUZ_TALLER: Solo el personal de la UTP puede crear talleres.';
    end if;
    if length(v_nombre) < 3 or length(v_nombre) > 80 then
        raise exception 'KAMPUZ_TALLER: El nombre del taller debe tener entre 3 y 80 caracteres.';
    end if;
    if exists (select 1 from public.espacios where lower(nombre) = lower(v_nombre)) then
        raise exception 'KAMPUZ_TALLER: Ya existe un grupo con ese nombre.';
    end if;
    if v_habilidad is not null and (length(v_habilidad) < 3 or length(v_habilidad) > 40) then
        raise exception 'KAMPUZ_TALLER: La habilidad debe tener entre 3 y 40 caracteres (por ejemplo: Liderazgo).';
    end if;
    if v_puntos < 1 or v_puntos > 60 then
        raise exception 'KAMPUZ_TALLER: Los puntos deben estar entre 1 y 60.';
    end if;
    if v_link is not null and v_link !~* '^https?://' then
        raise exception 'KAMPUZ_TALLER: El enlace de inscripción debe empezar con http:// o https://.';
    end if;

    insert into public.espacios (tipo, nombre, descripcion, sede, horario, oficial, estado, creador_id,
                                 link_inscripcion, habilidad_taller, puntos_taller)
    select 'taller', v_nombre,
           coalesce(nullif(trim(p_descripcion), ''), 'Taller oficial de la UTP.'),
           p.sede, nullif(trim(p_horario), ''), true, 'visible', v_uid,
           v_link, v_habilidad, v_puntos
    from public.perfiles p where p.id = v_uid
    returning id into v_id;

    insert into public.membresias (usuario_id, espacio_id, rol) values (v_uid, v_id, 'admin');
    return v_id;
end;
$$;

revoke all on function public.crear_taller(text, text, text, text, text, integer) from public, anon;
grant execute on function public.crear_taller(text, text, text, text, text, integer) to authenticated;

-- Participantes del taller y quién ya tiene constancia (solo quien gestiona el taller).
create or replace function public.miembros_taller(p_espacio_id uuid)
returns table (
    usuario_id uuid,
    nombre text,
    apellido text,
    carrera text,
    ciclo integer,
    mensajes integer,
    constancia_en timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.gestiona_taller(p_espacio_id) then
        raise exception 'KAMPUZ_TALLER: No puedes gestionar las constancias de este taller.';
    end if;
    return query
    select p.id, p.nombre, p.apellido, p.carrera, p.ciclo,
           (select count(*)::integer from public.mensajes ms where ms.espacio_id = p_espacio_id and ms.autor_id = p.id),
           c.otorgada_en
    from public.membresias m
    join public.perfiles p on p.id = m.usuario_id
    left join public.constancias_taller c on c.espacio_id = p_espacio_id and c.usuario_id = p.id
    where m.espacio_id = p_espacio_id and m.rol = 'miembro'
    order by (c.otorgada_en is not null), p.apellido, p.nombre;
end;
$$;

revoke all on function public.miembros_taller(uuid) from public, anon;
grant execute on function public.miembros_taller(uuid) to authenticated;

-- Entrega la constancia (y los puntos de la habilidad) a los alumnos que terminaron.
-- Solo a miembros del taller y una vez por alumno. Devuelve cuántas se entregaron.
create or replace function public.otorgar_constancias_taller(p_espacio_id uuid, p_usuarios uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_taller record;
    v_n integer;
begin
    if not public.gestiona_taller(p_espacio_id) then
        raise exception 'KAMPUZ_TALLER: No puedes entregar constancias de este taller.';
    end if;
    select * into v_taller from public.espacios where id = p_espacio_id and tipo = 'taller';
    if not found then
        raise exception 'KAMPUZ_TALLER: No encontramos este taller.';
    end if;
    if v_taller.habilidad_taller is null then
        raise exception 'KAMPUZ_TALLER: Este taller no otorga puntos de habilidad.';
    end if;
    if coalesce(array_length(p_usuarios, 1), 0) = 0 then
        raise exception 'KAMPUZ_TALLER: Elige al menos un alumno.';
    end if;
    if array_length(p_usuarios, 1) > 300 then
        raise exception 'KAMPUZ_TALLER: Entrega las constancias en grupos de hasta 300 alumnos.';
    end if;

    insert into public.constancias_taller (espacio_id, usuario_id, habilidad, puntos, otorgada_por)
    select p_espacio_id, m.usuario_id, v_taller.habilidad_taller, v_taller.puntos_taller, auth.uid()
    from public.membresias m
    where m.espacio_id = p_espacio_id
      and m.rol = 'miembro'
      and m.usuario_id = any (p_usuarios)
    on conflict (espacio_id, usuario_id) do nothing;

    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

revoke all on function public.otorgar_constancias_taller(uuid, uuid[]) from public, anon;
grant execute on function public.otorgar_constancias_taller(uuid, uuid[]) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. HABILIDADES DERIVADAS (reemplaza la de la 010)
--    - predisposicion_ayudar se muestra como "Solidaridad" y cuenta a los alumnos
--      DISTINTOS que confirmaron "Me ayudó" (varias confirmaciones del mismo alumno
--      al mismo asesor no suben el nivel; un contacto directo tampoco cuenta).
--    - Una habilidad nueva por cada habilidad de taller con constancias:
--      20 puntos = nivel 1, 40 = nivel 2, 60 = nivel 3.
-- ------------------------------------------------------------------------------
create or replace function public.calcular_habilidades_usuario(p_usuario_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_encuestas integer;
    v_ayudados integer;
    v_estrellas_ayuda integer;
    v_grupos_activos integer;
    v_grupos_creados integer;
    v_semanal integer;
    v_base jsonb;
    v_talleres jsonb := '{}'::jsonb;
    r record;
begin
    if auth.uid() is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;

    select count(*) into v_encuestas
    from public.envios_encuesta where destinatario_id = p_usuario_id and estado = 'respondida';

    -- Solidaridad: alumnos distintos que dijeron "Me ayudó" en respuestas que acreditaron
    -- estrellas, sin contar a quienes ya son contactos directos del asesor.
    select count(distinct v.usuario_id) into v_ayudados
    from public.asesorias a
    join public.valoraciones_asesoria v on v.asesoria_id = a.id and v.util
    where a.asesor_id = p_usuario_id
      and a.estrellas_acreditadas > 0
      and not exists (
          select 1 from public.conversaciones c
          where c.origen = 'solicitud'
            and c.usuario_a_id = least(v.usuario_id, a.asesor_id)
            and c.usuario_b_id = greatest(v.usuario_id, a.asesor_id)
      );

    select coalesce(sum(estrellas_acreditadas), 0) into v_estrellas_ayuda
    from public.asesorias where asesor_id = p_usuario_id and estrellas_acreditadas > 0;

    select count(distinct m.espacio_id) into v_grupos_activos
    from public.membresias m
    join public.espacios e on e.id = m.espacio_id and e.tipo in ('taller', 'interes')
    where m.usuario_id = p_usuario_id
      and exists (select 1 from public.mensajes ms where ms.espacio_id = m.espacio_id and ms.autor_id = p_usuario_id);

    select count(*) into v_grupos_creados
    from public.espacios where creador_id = p_usuario_id and tipo = 'interes' and estado = 'visible';

    v_semanal := public.alcance_semanal(p_usuario_id);

    v_base := jsonb_build_object(
        'apoyo_investigacion', jsonb_build_object(
            'nombre', 'Apoyo a la investigación',
            'progreso', v_encuestas,
            'nivel', case when v_encuestas >= 8 then 3 when v_encuestas >= 3 then 2 when v_encuestas >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 3, 8),
            'estrellas', v_encuestas,
            'alcance_semanal', v_semanal
        ),
        'predisposicion_ayudar', jsonb_build_object(
            'nombre', 'Solidaridad',
            'progreso', v_ayudados,
            'nivel', case when v_ayudados >= 5 then 3 when v_ayudados >= 2 then 2 when v_ayudados >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 2, 5),
            'estrellas', v_estrellas_ayuda
        ),
        'constancia', jsonb_build_object(
            'nombre', 'Constancia',
            'progreso', v_grupos_activos,
            'nivel', case when v_grupos_activos >= 5 then 3 when v_grupos_activos >= 3 then 2 when v_grupos_activos >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 3, 5),
            'estrellas', v_grupos_activos
        ),
        'liderazgo', jsonb_build_object(
            'nombre', 'Liderazgo',
            'progreso', v_grupos_creados,
            'nivel', case when v_grupos_creados >= 3 then 3 when v_grupos_creados >= 2 then 2 when v_grupos_creados >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 2, 3),
            'estrellas', v_grupos_creados * 3
        )
    );

    -- Habilidades que vienen de talleres terminados: una por habilidad (sin importar
    -- mayúsculas ni tildes), con los puntos acumulados de todos sus talleres.
    for r in
        select regexp_replace(translate(lower(habilidad), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '_', 'g') as clave,
               (array_agg(habilidad order by otorgada_en))[1] as nombre,
               sum(puntos)::integer as puntos,
               count(*)::integer as talleres
        from public.constancias_taller
        where usuario_id = p_usuario_id
        group by 1
        order by 1
    loop
        v_talleres := v_talleres || jsonb_build_object(
            'taller_' || r.clave,
            jsonb_build_object(
                'nombre', r.nombre,
                'progreso', r.puntos,
                'nivel', case when r.puntos >= 60 then 3 when r.puntos >= 40 then 2 when r.puntos >= 20 then 1 else 0 end,
                'metas', jsonb_build_array(20, 40, 60),
                'estrellas', r.talleres,
                'talleres', r.talleres,
                'taller', true
            )
        );
    end loop;

    return v_base || v_talleres;
end;
$$;

revoke all on function public.calcular_habilidades_usuario(uuid) from public, anon;
grant execute on function public.calcular_habilidades_usuario(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. PROYECTOS REALES BUSCANDO EQUIPO (hackatones, startups, tesis...)
--    Las tablas no se leen ni escriben directo desde la app: todo pasa por las
--    funciones de abajo, que fijan autor, universidad y reglas.
-- ------------------------------------------------------------------------------
create table if not exists public.proyectos (
    id uuid primary key default gen_random_uuid(),
    autor_id uuid not null references public.perfiles(id) on delete cascade,
    tipo text not null check (tipo in ('hackaton', 'startup', 'tesis', 'concurso', 'investigacion', 'otro')),
    titulo text not null check (length(trim(titulo)) between 4 and 80),
    descripcion text not null check (length(trim(descripcion)) between 20 and 800),
    roles_buscados text[] not null default '{}',
    cupos integer not null default 3 check (cupos between 1 and 20),
    fecha_limite date,
    enlace text check (enlace is null or (length(enlace) <= 300 and enlace ~* '^https?://')),
    universidad text not null default 'UTP',
    estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
    creado_en timestamptz not null default now()
);

create table if not exists public.postulaciones_proyecto (
    id uuid primary key default gen_random_uuid(),
    proyecto_id uuid not null references public.proyectos(id) on delete cascade,
    usuario_id uuid not null references public.perfiles(id) on delete cascade,
    rol_deseado text check (rol_deseado is null or length(rol_deseado) <= 40),
    mensaje text not null check (length(trim(mensaje)) between 10 and 400),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
    creado_en timestamptz not null default now(),
    respondida_en timestamptz,
    constraint postulaciones_proyecto_unica unique (proyecto_id, usuario_id)
);

create index if not exists idx_proyectos_estado on public.proyectos (estado, creado_en desc);
create index if not exists idx_postulaciones_proyecto on public.postulaciones_proyecto (proyecto_id, estado);

alter table public.proyectos enable row level security;
alter table public.postulaciones_proyecto enable row level security;
revoke all on public.proyectos from anon, authenticated;
revoke all on public.postulaciones_proyecto from anon, authenticated;

drop policy if exists "Proyectos solo por funciones" on public.proyectos;
create policy "Proyectos solo por funciones" on public.proyectos for all to authenticated using (false) with check (false);
drop policy if exists "Postulaciones solo por funciones" on public.postulaciones_proyecto;
create policy "Postulaciones solo por funciones" on public.postulaciones_proyecto for all to authenticated using (false) with check (false);

create or replace function public.crear_proyecto(
    p_tipo text,
    p_titulo text,
    p_descripcion text,
    p_roles text[],
    p_cupos integer,
    p_fecha_limite date,
    p_enlace text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_titulo text := trim(coalesce(p_titulo, ''));
    v_desc text := trim(coalesce(p_descripcion, ''));
    v_enlace text := nullif(trim(coalesce(p_enlace, '')), '');
    v_roles text[];
    v_hoy date := (now() at time zone 'America/Lima')::date;
    v_id uuid;
begin
    if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_PROYECTO: Completa tu perfil antes de publicar un proyecto.';
    end if;
    if p_tipo is null or p_tipo not in ('hackaton', 'startup', 'tesis', 'concurso', 'investigacion', 'otro') then
        raise exception 'KAMPUZ_PROYECTO: Elige qué tipo de proyecto es.';
    end if;
    if length(v_titulo) < 4 or length(v_titulo) > 80 then
        raise exception 'KAMPUZ_PROYECTO: El título debe tener entre 4 y 80 caracteres.';
    end if;
    if length(v_desc) < 20 or length(v_desc) > 800 then
        raise exception 'KAMPUZ_PROYECTO: Cuenta tu proyecto en 20 a 800 caracteres.';
    end if;
    if coalesce(p_cupos, 0) < 1 or p_cupos > 20 then
        raise exception 'KAMPUZ_PROYECTO: Indica cuántas personas buscas (de 1 a 20).';
    end if;
    if p_fecha_limite is not null and (p_fecha_limite < v_hoy or p_fecha_limite > v_hoy + 730) then
        raise exception 'KAMPUZ_PROYECTO: La fecha límite debe ser de hoy en adelante y dentro de 2 años.';
    end if;
    if v_enlace is not null and (length(v_enlace) > 300 or v_enlace !~* '^https?://') then
        raise exception 'KAMPUZ_PROYECTO: El enlace debe empezar con http:// o https://.';
    end if;
    if (select count(*) from public.proyectos where autor_id = v_uid and estado = 'abierto') >= 3 then
        raise exception 'KAMPUZ_PROYECTO: Ya tienes 3 proyectos abiertos. Cierra uno antes de publicar otro.';
    end if;

    select coalesce((array_agg(left(trim(r), 40)))[1:6], '{}')
    into v_roles
    from unnest(coalesce(p_roles, '{}')) as r
    where length(trim(r)) > 0;

    insert into public.proyectos (autor_id, tipo, titulo, descripcion, roles_buscados, cupos, fecha_limite, enlace, universidad)
    select v_uid, p_tipo, v_titulo, v_desc, v_roles, p_cupos, p_fecha_limite, v_enlace, p.universidad
    from public.perfiles p where p.id = v_uid
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.crear_proyecto(text, text, text, text[], integer, date, text) from public, anon;
grant execute on function public.crear_proyecto(text, text, text, text[], integer, date, text) to authenticated;

-- Proyectos de mi universidad: los abiertos, los míos y aquellos a los que me postulé.
create or replace function public.listar_proyectos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    with yo as (select id, universidad from public.perfiles where id = auth.uid())
    select coalesce(jsonb_agg(x.obj order by x.orden, x.creado_en desc), '[]'::jsonb)
    from (
        select
            pr.creado_en,
            case when pr.autor_id = yo.id then 0 when pr.estado = 'abierto' then 1 else 2 end as orden,
            jsonb_build_object(
                'id', pr.id,
                'tipo', pr.tipo,
                'titulo', pr.titulo,
                'descripcion', pr.descripcion,
                'roles', to_jsonb(pr.roles_buscados),
                'cupos', pr.cupos,
                'integrantes', (select count(*) from public.postulaciones_proyecto pp where pp.proyecto_id = pr.id and pp.estado = 'aceptada'),
                'fecha_limite', pr.fecha_limite,
                'enlace', pr.enlace,
                'estado', pr.estado,
                'creado_en', pr.creado_en,
                'autor_id', pr.autor_id,
                'autor_nombre', trim(p.nombre || ' ' || coalesce(p.apellido, '')),
                'autor_foto', p.foto_url,
                'autor_carrera', p.carrera,
                'autor_ciclo', p.ciclo,
                'soy_autor', pr.autor_id = yo.id,
                'mi_postulacion', (select pp.estado from public.postulaciones_proyecto pp where pp.proyecto_id = pr.id and pp.usuario_id = yo.id),
                'pendientes', case when pr.autor_id = yo.id
                    then (select count(*) from public.postulaciones_proyecto pp where pp.proyecto_id = pr.id and pp.estado = 'pendiente')
                    else 0 end
            ) as obj
        from public.proyectos pr
        join public.perfiles p on p.id = pr.autor_id
        cross join yo
        where pr.universidad = yo.universidad
          and not public.hay_bloqueo(pr.autor_id, yo.id)
          and (
              pr.autor_id = yo.id
              or exists (select 1 from public.postulaciones_proyecto pp where pp.proyecto_id = pr.id and pp.usuario_id = yo.id)
              or (pr.estado = 'abierto' and (pr.fecha_limite is null or pr.fecha_limite >= (now() at time zone 'America/Lima')::date))
          )
    ) x;
$$;

revoke all on function public.listar_proyectos() from public, anon;
grant execute on function public.listar_proyectos() to authenticated;

create or replace function public.postular_proyecto(p_proyecto_id uuid, p_rol text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_pr record;
    v_mensaje text := trim(coalesce(p_mensaje, ''));
    v_rol text := nullif(left(trim(coalesce(p_rol, '')), 40), '');
    v_id uuid;
begin
    if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_PROYECTO: Completa tu perfil antes de postularte.';
    end if;
    select * into v_pr from public.proyectos where id = p_proyecto_id;
    if not found then
        raise exception 'KAMPUZ_PROYECTO: No encontramos este proyecto.';
    end if;
    if v_pr.autor_id = v_uid then
        raise exception 'KAMPUZ_PROYECTO: No puedes postularte a tu propio proyecto.';
    end if;
    if public.hay_bloqueo(v_pr.autor_id, v_uid)
       or v_pr.universidad is distinct from (select universidad from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_PROYECTO: No encontramos este proyecto.';
    end if;
    if v_pr.estado <> 'abierto' then
        raise exception 'KAMPUZ_PROYECTO: Este proyecto ya no recibe postulaciones.';
    end if;
    if v_pr.fecha_limite is not null and v_pr.fecha_limite < (now() at time zone 'America/Lima')::date then
        raise exception 'KAMPUZ_PROYECTO: Este proyecto ya pasó su fecha límite.';
    end if;
    if length(v_mensaje) < 10 or length(v_mensaje) > 400 then
        raise exception 'KAMPUZ_PROYECTO: Cuéntale al equipo por qué quieres sumarte (10 a 400 caracteres).';
    end if;
    if exists (select 1 from public.postulaciones_proyecto where proyecto_id = p_proyecto_id and usuario_id = v_uid) then
        raise exception 'KAMPUZ_PROYECTO: Ya te postulaste a este proyecto.';
    end if;
    if (select count(*) from public.postulaciones_proyecto where usuario_id = v_uid and estado = 'pendiente') >= 5 then
        raise exception 'KAMPUZ_PROYECTO: Ya tienes 5 postulaciones esperando respuesta. Espera a que te respondan antes de enviar otra.';
    end if;

    insert into public.postulaciones_proyecto (proyecto_id, usuario_id, rol_deseado, mensaje)
    values (p_proyecto_id, v_uid, v_rol, v_mensaje)
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.postular_proyecto(uuid, text, text) from public, anon;
grant execute on function public.postular_proyecto(uuid, text, text) to authenticated;

-- Quién se postuló a mi proyecto (solo el autor).
create or replace function public.listar_postulaciones_proyecto(p_proyecto_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.proyectos where id = p_proyecto_id and autor_id = auth.uid()) then
        raise exception 'KAMPUZ_PROYECTO: Solo quien publicó el proyecto ve las postulaciones.';
    end if;
    return (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', pp.id,
            'usuario_id', p.id,
            'nombre', trim(p.nombre || ' ' || coalesce(p.apellido, '')),
            'foto', p.foto_url,
            'carrera', p.carrera,
            'ciclo', p.ciclo,
            'rol_deseado', pp.rol_deseado,
            'mensaje', pp.mensaje,
            'estado', pp.estado,
            'creado_en', pp.creado_en
        ) order by (pp.estado = 'pendiente') desc, pp.creado_en), '[]'::jsonb)
        from public.postulaciones_proyecto pp
        join public.perfiles p on p.id = pp.usuario_id
        where pp.proyecto_id = p_proyecto_id
    );
end;
$$;

revoke all on function public.listar_postulaciones_proyecto(uuid) from public, anon;
grant execute on function public.listar_postulaciones_proyecto(uuid) to authenticated;

-- Aceptar o ignorar una postulación. Al aceptar, ambos quedan como contactos (chat directo)
-- y, si el equipo se completa, el proyecto se cierra solo.
create or replace function public.responder_postulacion(p_postulacion_id uuid, p_aceptar boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pp record;
    v_pr record;
    v_aceptados integer;
    v_conv uuid := null;
begin
    select * into v_pp from public.postulaciones_proyecto where id = p_postulacion_id for update;
    if not found then
        raise exception 'KAMPUZ_PROYECTO: No encontramos esta postulación.';
    end if;
    select * into v_pr from public.proyectos where id = v_pp.proyecto_id for update;
    if v_pr.autor_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_PROYECTO: Solo quien publicó el proyecto responde las postulaciones.';
    end if;
    if v_pp.estado <> 'pendiente' then
        raise exception 'KAMPUZ_PROYECTO: Ya respondiste esta postulación.';
    end if;

    if p_aceptar then
        select count(*) into v_aceptados from public.postulaciones_proyecto
        where proyecto_id = v_pr.id and estado = 'aceptada';
        if v_aceptados >= v_pr.cupos then
            raise exception 'KAMPUZ_PROYECTO: El equipo ya está completo.';
        end if;
        if public.hay_bloqueo(v_pr.autor_id, v_pp.usuario_id) then
            raise exception 'KAMPUZ_PROYECTO: No puedes aceptar a este estudiante.';
        end if;
        update public.postulaciones_proyecto set estado = 'aceptada', respondida_en = now() where id = p_postulacion_id;
        v_conv := public.asegurar_conversacion(v_pr.autor_id, v_pp.usuario_id);
        if v_aceptados + 1 >= v_pr.cupos then
            update public.proyectos set estado = 'cerrado' where id = v_pr.id;
        end if;
    else
        update public.postulaciones_proyecto set estado = 'rechazada', respondida_en = now() where id = p_postulacion_id;
    end if;
    return v_conv;
end;
$$;

revoke all on function public.responder_postulacion(uuid, boolean) from public, anon;
grant execute on function public.responder_postulacion(uuid, boolean) to authenticated;

create or replace function public.cerrar_proyecto(p_proyecto_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.proyectos where id = p_proyecto_id and autor_id = auth.uid()) then
        raise exception 'KAMPUZ_PROYECTO: Solo quien publicó el proyecto puede cerrarlo.';
    end if;
    update public.proyectos set estado = 'cerrado' where id = p_proyecto_id;
    update public.postulaciones_proyecto set estado = 'rechazada', respondida_en = now()
    where proyecto_id = p_proyecto_id and estado = 'pendiente';
end;
$$;

revoke all on function public.cerrar_proyecto(uuid) from public, anon;
grant execute on function public.cerrar_proyecto(uuid) to authenticated;
