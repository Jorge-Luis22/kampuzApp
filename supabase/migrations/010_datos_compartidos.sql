-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 010: Datos compartidos solo en Supabase
-- Auditoría (docs/PROMPT_CLAUDE_CODE_AUDITORIA.md, paso 3).
--
-- El cliente deja de usar localStorage como base de datos. Esta migración agrega
-- las funciones del servidor que el cliente necesita para leer y escribir con la
-- sesión real (auth.uid()), con las reglas aplicadas aquí y no en React:
--   - Perfiles: enlaces y estado opcional; los bloqueos ocultan perfiles en ambos sentidos.
--   - Grupo de carrera y ciclo: al cambiar de carrera/ciclo se sale del grupo anterior.
--   - Solicitudes y conversaciones: no hay chat sin solicitud aceptada (spec 6.4).
--   - Espacios: listado con conteos en una sola llamada; unirse solo a talleres y
--     grupos de interés visibles; propuestas creadas por el servidor (spec 7.2).
--   - Consultas agrupadas sobre el esquema de 001 (spec 7.1).
--   - Encuestas: bandeja con cola, respuesta atómica y resultados solo para el autor.
--   - Habilidades derivadas de los hechos (spec 5.3).
--
-- Los errores de negocio se lanzan como 'KAMPUZ_<AREA>: mensaje en español'.
-- Idempotente.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERFILES: enlaces profesionales y estado opcional
-- ------------------------------------------------------------------------------
alter table public.perfiles add column if not exists enlaces jsonb not null default '{}'::jsonb;

-- Estado en vivo: opcional y vacío por defecto ("Sin estado"). Ver docs/DECISIONES.md.
alter table public.perfiles add column if not exists estado_en_vivo text;
do $$
begin
    alter table public.perfiles
        add constraint perfiles_estado_en_vivo_valido
        check (estado_en_vivo is null or estado_en_vivo in ('campus', 'clase', 'biblioteca', 'buscando_equipo', 'examen'));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------------------
-- 2. BLOQUEOS: ocultan el perfil en ambos sentidos
-- ------------------------------------------------------------------------------
create or replace function public.hay_bloqueo(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.bloqueos
        where (bloqueador_id = p_a and bloqueado_id = p_b)
           or (bloqueador_id = p_b and bloqueado_id = p_a)
    );
$$;

revoke all on function public.hay_bloqueo(uuid, uuid) from public, anon;
grant execute on function public.hay_bloqueo(uuid, uuid) to authenticated;

-- ¿Este alumno me bloqueó? (su perfil deja de ser visible para mí)
create or replace function public.me_bloqueo(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.bloqueos where bloqueador_id = p_otro and bloqueado_id = auth.uid()
    );
$$;

revoke all on function public.me_bloqueo(uuid) from public, anon;
grant execute on function public.me_bloqueo(uuid) to authenticated;

-- Quien bloquea sigue viendo a quién bloqueó (para poder desbloquear); el bloqueado
-- deja de ver al que lo bloqueó. Explorar excluye además a los que yo bloqueé.
drop policy if exists "Perfiles visibles para alumnos autenticados" on public.perfiles;
drop policy if exists "Perfiles visibles salvo bloqueo" on public.perfiles;
create policy "Perfiles visibles salvo bloqueo"
    on public.perfiles for select
    to authenticated
    using (id = auth.uid() or not public.me_bloqueo(id));

-- Al bloquear, las solicitudes pendientes entre ambos se cierran.
create or replace function public.cerrar_solicitudes_al_bloquear()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.solicitudes_mensaje
    set estado = 'rechazada', respondido_en = now()
    where estado = 'pendiente'
      and ((de_id = new.bloqueador_id and a_id = new.bloqueado_id)
        or (de_id = new.bloqueado_id and a_id = new.bloqueador_id));
    return new;
end;
$$;

drop trigger if exists trg_cerrar_solicitudes_al_bloquear on public.bloqueos;
create trigger trg_cerrar_solicitudes_al_bloquear
    after insert on public.bloqueos
    for each row
    execute function public.cerrar_solicitudes_al_bloquear();

-- ------------------------------------------------------------------------------
-- 3. GRUPO DE CARRERA Y CICLO: membresía automática y exclusiva
-- ------------------------------------------------------------------------------
create or replace function public.auto_asignar_espacios_alumno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_espacio_carrera_id uuid;
    v_espacio_ciclo_id uuid;
begin
    select id into v_espacio_carrera_id
    from public.espacios
    where tipo = 'carrera' and carrera = new.carrera and sede = new.sede
    order by creado_en
    limit 1;

    if v_espacio_carrera_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
        values (
            'carrera',
            'Comunidad de ' || new.carrera || ' UTP',
            'Espacio de todos los ciclos de ' || new.carrera || ' (' || new.sede || '). Consultas, orientación y proyectos.',
            '/grupos/carrera_default.jpg',
            new.carrera, new.sede, false, 'visible'
        )
        returning id into v_espacio_carrera_id;
    end if;

    select id into v_espacio_ciclo_id
    from public.espacios
    where tipo = 'carrera_ciclo' and carrera = new.carrera and ciclo = new.ciclo and sede = new.sede
    order by creado_en
    limit 1;

    if v_espacio_ciclo_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, ciclo, sede, oficial, estado)
        values (
            'carrera_ciclo',
            new.carrera || ' — Ciclo ' || new.ciclo,
            'Grupo de tus compañeros de ' || new.carrera || ', ciclo ' || new.ciclo || ' (' || new.sede || ').',
            '/grupos/ciclo_default.jpg',
            new.carrera, new.ciclo, new.sede, false, 'visible'
        )
        returning id into v_espacio_ciclo_id;
    end if;

    -- Solo accedes a TU grupo de carrera y ciclo (spec 4): al cambiar, sales del anterior.
    delete from public.membresias m
    using public.espacios e
    where m.espacio_id = e.id
      and m.usuario_id = new.id
      and e.tipo in ('carrera', 'carrera_ciclo')
      and e.id not in (v_espacio_carrera_id, v_espacio_ciclo_id);

    insert into public.membresias (usuario_id, espacio_id, rol)
    values (new.id, v_espacio_carrera_id, 'miembro'), (new.id, v_espacio_ciclo_id, 'miembro')
    on conflict (usuario_id, espacio_id) do nothing;

    return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. SOLICITUDES Y CONVERSACIONES (spec 6.4)
-- ------------------------------------------------------------------------------
create or replace function public.asegurar_conversacion(p_a uuid, p_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    insert into public.conversaciones (usuario_a_id, usuario_b_id)
    values (least(p_a, p_b), greatest(p_a, p_b))
    on conflict (usuario_a_id, usuario_b_id) do nothing;

    select id into v_id from public.conversaciones
    where usuario_a_id = least(p_a, p_b) and usuario_b_id = greatest(p_a, p_b);
    return v_id;
end;
$$;

revoke all on function public.asegurar_conversacion(uuid, uuid) from public, anon, authenticated;

create or replace function public.enviar_solicitud(p_a_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_de uuid := auth.uid();
    v_motivo text := trim(coalesce(p_motivo, ''));
    v_previa record;
    v_id uuid;
begin
    if v_de is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    if p_a_id = v_de then
        raise exception 'KAMPUZ_SOLICITUD: No puedes enviarte una solicitud a ti mismo.';
    end if;
    if length(v_motivo) < 5 then
        raise exception 'KAMPUZ_SOLICITUD: Escribe el motivo de tu solicitud (mínimo 5 caracteres).';
    end if;
    if length(v_motivo) > 300 then
        raise exception 'KAMPUZ_SOLICITUD: El motivo es muy largo (máximo 300 caracteres).';
    end if;
    if not exists (select 1 from public.perfiles where id = v_de) then
        raise exception 'KAMPUZ_SOLICITUD: Completa tu perfil antes de enviar solicitudes.';
    end if;
    if not exists (select 1 from public.perfiles where id = p_a_id) or public.hay_bloqueo(v_de, p_a_id) then
        raise exception 'KAMPUZ_SOLICITUD: No puedes contactar a este estudiante.';
    end if;
    if exists (
        select 1 from public.conversaciones
        where usuario_a_id = least(v_de, p_a_id) and usuario_b_id = greatest(v_de, p_a_id)
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Ya están conectados. Abre el chat desde "Chats 1 a 1".';
    end if;
    if exists (
        select 1 from public.solicitudes_mensaje
        where de_id = p_a_id and a_id = v_de and estado = 'pendiente'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Esta persona ya te envió una solicitud. Revísala en Solicitudes → Recibidas.';
    end if;

    select * into v_previa from public.solicitudes_mensaje where de_id = v_de and a_id = p_a_id;
    if found then
        if v_previa.estado = 'pendiente' then
            raise exception 'KAMPUZ_SOLICITUD: Ya le enviaste una solicitud. Espera su respuesta.';
        elsif v_previa.estado = 'rechazada' then
            raise exception 'KAMPUZ_SOLICITUD: Esta persona no aceptó tu solicitud anterior.';
        else
            raise exception 'KAMPUZ_SOLICITUD: Ya están conectados. Abre el chat desde "Chats 1 a 1".';
        end if;
    end if;

    insert into public.solicitudes_mensaje (de_id, a_id, motivo, estado)
    values (v_de, p_a_id, v_motivo, 'pendiente')
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.enviar_solicitud(uuid, text) from public, anon;
grant execute on function public.enviar_solicitud(uuid, text) to authenticated;

-- Acepta o ignora una solicitud recibida. Si se acepta, crea la conversación en la
-- misma transacción y devuelve su id.
create or replace function public.responder_solicitud(p_solicitud_id uuid, p_aceptar boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sol record;
begin
    select * into v_sol from public.solicitudes_mensaje where id = p_solicitud_id for update;
    if not found or v_sol.a_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_SOLICITUD: No encontramos esta solicitud.';
    end if;

    if v_sol.estado = 'pendiente' then
        update public.solicitudes_mensaje
        set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
            respondido_en = now()
        where id = p_solicitud_id;
    elsif v_sol.estado = 'rechazada' and p_aceptar then
        raise exception 'KAMPUZ_SOLICITUD: Ya ignoraste esta solicitud.';
    end if;

    if p_aceptar then
        if public.hay_bloqueo(v_sol.de_id, v_sol.a_id) then
            raise exception 'KAMPUZ_SOLICITUD: No puedes conectar con este estudiante.';
        end if;
        return public.asegurar_conversacion(v_sol.de_id, v_sol.a_id);
    end if;
    return null;
end;
$$;

revoke all on function public.responder_solicitud(uuid, boolean) from public, anon;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;

-- Las solicitudes y conversaciones solo se crean/actualizan por las funciones de arriba.
drop policy if exists "Emisor crea solicitud de mensaje" on public.solicitudes_mensaje;
drop policy if exists "Receptor actualiza solicitud de mensaje" on public.solicitudes_mensaje;
drop policy if exists "Creacion de conversacion por participantes" on public.conversaciones;

-- Mensajes directos: solo dentro de una conversación propia y sin bloqueo.
drop policy if exists "Interlocutores envian mensajes directos" on public.mensajes_directos;
create policy "Interlocutores envian mensajes directos"
    on public.mensajes_directos for insert
    to authenticated
    with check (
        auth.uid() = autor_id
        and length(trim(texto)) between 1 and 2000
        and exists (
            select 1 from public.conversaciones c
            where c.id = mensajes_directos.conversacion_id
              and auth.uid() in (c.usuario_a_id, c.usuario_b_id)
              and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
        )
    );

-- El receptor solo puede marcar "leído"; nadie edita el texto de otro.
revoke update on public.mensajes_directos from anon, authenticated;
grant update (leido) on public.mensajes_directos to authenticated;

create or replace function public.tocar_conversacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.conversaciones set ultimo_mensaje_en = new.creado_en where id = new.conversacion_id;
    return new;
end;
$$;

drop trigger if exists trg_tocar_conversacion on public.mensajes_directos;
create trigger trg_tocar_conversacion
    after insert on public.mensajes_directos
    for each row
    execute function public.tocar_conversacion();

-- Bandeja de chats: interlocutor, último mensaje y no leídos en una sola llamada.
-- drop: la 015 agrega columnas al resultado; sin esto, volver a correr 010 fallaría
drop function if exists public.mis_conversaciones();
create function public.mis_conversaciones()
returns table (
    id uuid,
    otro_id uuid,
    otro_nombre text,
    otro_apellido text,
    otro_usuario text,
    otro_foto_url text,
    otro_carrera text,
    otro_ciclo integer,
    otro_sede text,
    ultimo_texto text,
    ultimo_autor_id uuid,
    ultimo_en timestamptz,
    no_leidos integer
)
language sql
stable
security definer
set search_path = public
as $$
    select
        c.id,
        p.id, p.nombre, p.apellido, p.usuario, p.foto_url, p.carrera, p.ciclo, p.sede,
        um.texto, um.autor_id,
        coalesce(um.creado_en, c.abierta_en),
        (
            select count(*)::integer from public.mensajes_directos m
            where m.conversacion_id = c.id and m.autor_id <> auth.uid() and not m.leido
        )
    from public.conversaciones c
    join public.perfiles p
      on p.id = case when c.usuario_a_id = auth.uid() then c.usuario_b_id else c.usuario_a_id end
    left join lateral (
        select m.texto, m.autor_id, m.creado_en
        from public.mensajes_directos m
        where m.conversacion_id = c.id
        order by m.creado_en desc
        limit 1
    ) um on true
    where auth.uid() in (c.usuario_a_id, c.usuario_b_id)
      and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
    order by coalesce(um.creado_en, c.abierta_en) desc;
$$;

revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mis_conversaciones() to authenticated;

-- ------------------------------------------------------------------------------
-- 5. ESPACIOS, MEMBRESÍAS Y PROPUESTAS (spec 4 y 7.2)
-- ------------------------------------------------------------------------------
create or replace function public.es_miembro(p_espacio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.membresias
        where espacio_id = p_espacio_id and usuario_id = auth.uid()
    );
$$;

revoke all on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_miembro(uuid) to authenticated;

create or replace function public.umbral_visibilidad()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select greatest(15, round((select count(*) from public.perfiles) * 0.03))::integer;
$$;

-- Antes cualquiera veía todas las membresías (quién está en qué grupo).
drop policy if exists "Membresias visibles para autenticados" on public.membresias;
drop policy if exists "Membresias visibles para miembros del espacio" on public.membresias;
create policy "Membresias visibles para miembros del espacio"
    on public.membresias for select
    to authenticated
    using (usuario_id = auth.uid() or public.es_miembro(espacio_id));

-- Unirse solo a talleres y grupos de interés visibles. Los de carrera los asigna el trigger.
drop policy if exists "Usuarios pueden unirse a espacios" on public.membresias;
create policy "Usuarios pueden unirse a espacios"
    on public.membresias for insert
    to authenticated
    with check (
        auth.uid() = usuario_id
        and rol = 'miembro'
        and exists (
            select 1 from public.espacios e
            where e.id = membresias.espacio_id
              and e.tipo in ('taller', 'interes')
              and e.estado = 'visible'
        )
    );

drop policy if exists "Usuarios pueden salirse de espacios" on public.membresias;
create policy "Usuarios pueden salirse de espacios"
    on public.membresias for delete
    to authenticated
    using (
        auth.uid() = usuario_id
        and exists (
            select 1 from public.espacios e
            where e.id = membresias.espacio_id and e.tipo in ('taller', 'interes')
        )
    );

-- Listado de espacios con conteos (antes: 2 consultas por espacio desde el cliente).
-- Incluye las propuestas ocultas para que otros puedan apoyarlas: el umbral controla
-- si aparecen en Explorar, no si existen (spec 7.2).
create or replace function public.listar_espacios()
returns table (
    id uuid,
    tipo text,
    nombre text,
    descripcion text,
    portada_url text,
    carrera text,
    ciclo integer,
    sede text,
    horario text,
    oficial boolean,
    estado text,
    umbral integer,
    link_inscripcion text,
    creador_id uuid,
    creado_en timestamptz,
    miembros integer,
    apoyos integer,
    es_miembro boolean,
    ya_apoye boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        e.id, e.tipo, e.nombre, e.descripcion, e.portada_url, e.carrera, e.ciclo, e.sede,
        e.horario, coalesce(e.oficial, false), e.estado, public.umbral_visibilidad(),
        e.link_inscripcion, e.creador_id, e.creado_en,
        (select count(*)::integer from public.membresias m where m.espacio_id = e.id),
        (select count(*)::integer from public.apoyos_propuesta a where a.espacio_id = e.id),
        exists (select 1 from public.membresias m where m.espacio_id = e.id and m.usuario_id = auth.uid()),
        exists (select 1 from public.apoyos_propuesta a where a.espacio_id = e.id and a.usuario_id = auth.uid())
    from public.espacios e
    where auth.uid() is not null
      and (
          (e.tipo in ('carrera', 'carrera_ciclo')
              and exists (select 1 from public.membresias m where m.espacio_id = e.id and m.usuario_id = auth.uid()))
          or e.tipo in ('taller', 'interes')
      )
    order by
        case e.tipo when 'carrera_ciclo' then 0 when 'carrera' then 1 when 'taller' then 2 else 3 end,
        e.creado_en;
$$;

revoke all on function public.listar_espacios() from public, anon;
grant execute on function public.listar_espacios() to authenticated;

-- Proponer un grupo de interés: nace oculto, con su creador como admin y primer apoyo.
create or replace function public.proponer_grupo(p_nombre text, p_descripcion text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_nombre text := trim(coalesce(p_nombre, ''));
    v_id uuid;
begin
    if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_GRUPO: Completa tu perfil antes de proponer un grupo.';
    end if;
    if length(v_nombre) < 3 or length(v_nombre) > 60 then
        raise exception 'KAMPUZ_GRUPO: El nombre debe tener entre 3 y 60 caracteres.';
    end if;
    if exists (select 1 from public.espacios where lower(nombre) = lower(v_nombre)) then
        raise exception 'KAMPUZ_GRUPO: Ya existe un grupo con ese nombre.';
    end if;
    -- Anti-spam: como máximo 2 propuestas ocultas a la vez por alumno.
    if (select count(*) from public.espacios
        where creador_id = v_uid and tipo = 'interes' and estado = 'oculto') >= 2 then
        raise exception 'KAMPUZ_GRUPO: Ya tienes 2 propuestas esperando apoyos. Consigue apoyos antes de proponer otra.';
    end if;

    insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, oficial, creador_id, estado, umbral_apoyos)
    select 'interes', v_nombre,
           coalesce(nullif(trim(p_descripcion), ''), 'Comunidad estudiantil en formación.'),
           null, p.sede, false, v_uid, 'oculto', public.umbral_visibilidad()
    from public.perfiles p where p.id = v_uid
    returning id into v_id;

    insert into public.membresias (usuario_id, espacio_id, rol) values (v_uid, v_id, 'admin');
    insert into public.apoyos_propuesta (espacio_id, usuario_id) values (v_id, v_uid);
    return v_id;
end;
$$;

revoke all on function public.proponer_grupo(text, text) from public, anon;
grant execute on function public.proponer_grupo(text, text) to authenticated;

-- Apoyar una propuesta: uno por alumno (restricción única) y el trigger la hace visible.
create or replace function public.apoyar_propuesta(p_espacio_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_estado text;
begin
    if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_GRUPO: Completa tu perfil antes de apoyar propuestas.';
    end if;
    if not exists (select 1 from public.espacios where id = p_espacio_id and tipo = 'interes') then
        raise exception 'KAMPUZ_GRUPO: Esta propuesta ya no existe.';
    end if;
    begin
        insert into public.apoyos_propuesta (espacio_id, usuario_id) values (p_espacio_id, v_uid);
    exception when unique_violation then
        raise exception 'KAMPUZ_GRUPO: Ya apoyaste esta propuesta.';
    end;
    select estado into v_estado from public.espacios where id = p_espacio_id;
    return v_estado;
end;
$$;

revoke all on function public.apoyar_propuesta(uuid) from public, anon;
grant execute on function public.apoyar_propuesta(uuid) to authenticated;

-- Las propuestas solo se crean por proponer_grupo y su estado solo lo cambia el umbral.
drop policy if exists "Alumnos pueden proponer espacios" on public.espacios;
drop policy if exists "Creador puede actualizar su espacio propuesto" on public.espacios;
drop policy if exists "Usuarios pueden apoyar propuestas" on public.apoyos_propuesta;

-- El umbral usa la base activa del momento (max(15, 3%)).
create or replace function public.verificar_umbral_propuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select count(*) from public.apoyos_propuesta where espacio_id = new.espacio_id)
        >= public.umbral_visibilidad() then
        update public.espacios set estado = 'visible' where id = new.espacio_id and estado = 'oculto';
    end if;
    return new;
end;
$$;

-- Mensajes de grupo: texto acotado.
drop policy if exists "Miembros escriben mensajes en el espacio" on public.mensajes;
create policy "Miembros escriben mensajes en el espacio"
    on public.mensajes for insert
    to authenticated
    with check (
        auth.uid() = autor_id
        and length(trim(texto)) between 1 and 2000
        and public.es_miembro(espacio_id)
    );

-- ------------------------------------------------------------------------------
-- 6. CONSULTAS AGRUPADAS (spec 7.1) sobre grupos_consulta + consultas + asesorías
-- ------------------------------------------------------------------------------
-- Moderación (spec 7.1). Corrige 003: el nombre propio solo se detectaba con
-- "profesor" en minúscula; "Profesor García" al inicio de una frase pasaba.
-- "el profesor dijo..." sigue permitido (no hay mayúscula después).
create or replace function public.moderar_consulta_servidor()
returns trigger
language plpgsql
as $$
begin
    if new.texto ~* '\m(profe|profesor|profesora|docente|maestro|maestra)\M'
       and new.texto ~* '\m(mejor|peor|cuál|cual|recomienda|evita|jala|regala|bueno|malo|filtro|fácil|facil|difícil|dificil)\M' then
        raise exception 'KAMPUZ_MODERACION: Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones o qué material conviene.';
    end if;

    if new.texto ~ '\m([Pp]rofesora?|[Pp]rofe|[Dd]ocente|[Mm]aestra?)\s+[A-ZÁÉÍÓÚÑ]' then
        raise exception 'KAMPUZ_MODERACION: Mencionaste a un docente por su nombre. Se habla del curso, no de la persona.';
    end if;

    return new;
end;
$$;

-- La misma moderación se aplica a las respuestas.
drop trigger if exists trg_moderar_asesoria on public.asesorias;
create trigger trg_moderar_asesoria
    before insert on public.asesorias
    for each row
    execute function public.moderar_consulta_servidor();

create or replace function public.firma_alumno(p_nombre text, p_apellido text, p_ciclo integer)
returns text
language sql
immutable
as $$
    select p_nombre || ' ' || left(coalesce(p_apellido, ''), 1) || '. (Ciclo ' || p_ciclo || ')';
$$;

-- Crea la consulta o la agrupa con otras de la misma carrera + curso + tema.
-- nAlumnos = autores DISTINTOS: preguntar dos veces no suma.
create or replace function public.crear_consulta(p_curso text, p_tema text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_perfil record;
    v_grupo_id uuid;
    v_n integer;
begin
    select * into v_perfil from public.perfiles where id = v_uid;
    if not found then
        raise exception 'KAMPUZ_CONSULTA: Completa tu perfil antes de consultar.';
    end if;
    if length(trim(coalesce(p_curso, ''))) < 2 or length(trim(coalesce(p_tema, ''))) < 2 then
        raise exception 'KAMPUZ_CONSULTA: Indica el curso y el tema.';
    end if;
    if length(trim(coalesce(p_texto, ''))) < 10 then
        raise exception 'KAMPUZ_CONSULTA: Cuéntanos tu duda con un poco más de detalle (mínimo 10 caracteres).';
    end if;

    select id into v_grupo_id
    from public.grupos_consulta
    where carrera = v_perfil.carrera
      and lower(trim(curso)) = lower(trim(p_curso))
      and lower(trim(tema)) = lower(trim(p_tema))
      and estado = 'abierto'
    order by creado_en
    limit 1
    for update;

    if v_grupo_id is not null and exists (
        select 1 from public.consultas where grupo_consulta_id = v_grupo_id and autor_id = v_uid
    ) then
        return jsonb_build_object('grupo_id', v_grupo_id, 'agrupada', true, 'ya_estabas', true);
    end if;

    if v_grupo_id is null then
        insert into public.grupos_consulta (carrera, curso, tema, n_alumnos, estado)
        values (v_perfil.carrera, trim(p_curso), trim(p_tema), 0, 'abierto')
        returning id into v_grupo_id;
    end if;

    -- trg_moderar_consulta bloquea aquí si se habla del docente y no del curso
    insert into public.consultas (autor_id, carrera, ciclo_autor, curso, tema, texto, estado, grupo_consulta_id)
    values (v_uid, v_perfil.carrera, v_perfil.ciclo, trim(p_curso), trim(p_tema), trim(p_texto), 'abierta', v_grupo_id);

    select count(distinct autor_id) into v_n from public.consultas where grupo_consulta_id = v_grupo_id;
    update public.grupos_consulta set n_alumnos = v_n where id = v_grupo_id;
    if v_n >= 2 then
        update public.consultas set estado = 'agrupada' where grupo_consulta_id = v_grupo_id and estado = 'abierta';
    end if;

    return jsonb_build_object('grupo_id', v_grupo_id, 'agrupada', v_n >= 2, 'ya_estabas', false);
end;
$$;

revoke all on function public.crear_consulta(text, text, text) from public, anon;
grant execute on function public.crear_consulta(text, text, text) to authenticated;

-- Consultas de MI carrera (espacio de carrera) con sus respuestas, en una sola llamada.
create or replace function public.listar_consultas_carrera()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    with yo as (select id, carrera from public.perfiles where id = auth.uid())
    select coalesce(jsonb_agg(g.obj order by g.orden_estado, g.creado_en desc), '[]'::jsonb)
    from (
        select
            gc.creado_en,
            case gc.estado when 'abierto' then 0 else 1 end as orden_estado,
            jsonb_build_object(
                'id', gc.id,
                'carrera', gc.carrera,
                'curso', gc.curso,
                'tema', gc.tema,
                'estado', gc.estado,
                'n_alumnos', gc.n_alumnos,
                'creado_en', gc.creado_en,
                'soy_autor', exists (select 1 from public.consultas c where c.grupo_consulta_id = gc.id and c.autor_id = yo.id),
                'ciclo_max_autores', (select coalesce(max(c.ciclo_autor), 0) from public.consultas c where c.grupo_consulta_id = gc.id),
                'textos', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'texto', c.texto,
                        'firma', public.firma_alumno(p.nombre, p.apellido, c.ciclo_autor)
                    ) order by c.creado_en), '[]'::jsonb)
                    from public.consultas c
                    join public.perfiles p on p.id = c.autor_id
                    where c.grupo_consulta_id = gc.id
                ),
                'respuestas', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'id', a.id,
                        'asesor_id', a.asesor_id,
                        'asesor_nombre', p.nombre || ' ' || coalesce(p.apellido, ''),
                        'asesor_ciclo', p.ciclo,
                        'asesor_carrera', p.carrera,
                        'asesor_foto', p.foto_url,
                        'texto', a.texto,
                        'modo', a.modo,
                        'estrellas_pendientes', a.estrellas_pendientes,
                        'estrellas_acreditadas', a.estrellas_acreditadas,
                        'valorada', exists (select 1 from public.valoraciones_asesoria v where v.asesoria_id = a.id),
                        'mi_valoracion', (select v.util from public.valoraciones_asesoria v where v.asesoria_id = a.id and v.usuario_id = yo.id),
                        'creado_en', a.creado_en
                    ) order by a.creado_en), '[]'::jsonb)
                    from public.asesorias a
                    join public.perfiles p on p.id = a.asesor_id
                    where a.grupo_consulta_id = gc.id
                )
            ) as obj
        from public.grupos_consulta gc, yo
        where gc.carrera = yo.carrera
    ) g;
$$;

revoke all on function public.listar_consultas_carrera() from public, anon;
grant execute on function public.listar_consultas_carrera() to authenticated;

-- Orientar: ciclo >= 5, ciclo MAYOR que el de todos los autores, misma carrera y no ser autor.
-- Solo por mensaje: la opción "llamada" (×3) se quitó porque la llamada no existe en la app
-- (spec 11.3) y el modo lo declaraba quien respondía. Estrellas = nAlumnos si son 2 o más,
-- pendientes hasta que un autor valore "me sirvió". p_modo se mantiene por compatibilidad.
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

    insert into public.asesorias (grupo_consulta_id, asesor_id, modo, texto, estrellas_pendientes, estrellas_acreditadas)
    values (
        p_grupo_id, v_uid, 'mensaje', trim(p_texto),
        case when v_grupo.n_alumnos >= 2 then v_grupo.n_alumnos else 0 end,
        0
    )
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.responder_consulta(uuid, text, text) from public, anon;
grant execute on function public.responder_consulta(uuid, text, text) to authenticated;

-- Valorar una respuesta: SOLO un autor de la consulta. Recién aquí se acreditan las
-- estrellas, una sola vez por respuesta, y solo si:
--   - la consulta está agrupada (nAlumnos >= 2), y
--   - quien valora no tiene una conexión aceptada con el asesor (anti-gaming 3).
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
    v_estrellas integer := 0;
begin
    select * into v_as from public.asesorias where id = p_asesoria_id for update;
    if not found then
        raise exception 'KAMPUZ_CONSULTA: No encontramos esta respuesta.';
    end if;
    if not exists (
        select 1 from public.consultas where grupo_consulta_id = v_as.grupo_consulta_id and autor_id = v_uid
    ) then
        raise exception 'KAMPUZ_CONSULTA: Solo quienes hicieron la consulta pueden valorar la respuesta.';
    end if;
    if exists (select 1 from public.valoraciones_asesoria where asesoria_id = p_asesoria_id and usuario_id = v_uid) then
        raise exception 'KAMPUZ_CONSULTA: Ya valoraste esta respuesta.';
    end if;

    insert into public.valoraciones_asesoria (asesoria_id, usuario_id, util)
    values (p_asesoria_id, v_uid, p_util);

    if p_util and v_as.estrellas_acreditadas = 0 then
        select * into v_grupo from public.grupos_consulta where id = v_as.grupo_consulta_id;
        v_conectados := exists (
            select 1 from public.conversaciones
            where usuario_a_id = least(v_uid, v_as.asesor_id) and usuario_b_id = greatest(v_uid, v_as.asesor_id)
        );
        if v_grupo.n_alumnos >= 2 and not v_conectados then
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

-- ------------------------------------------------------------------------------
-- 7. ENCUESTAS: destinatarios, envío, bandeja con cola, respuesta y resultados
-- ------------------------------------------------------------------------------
-- Las políticas de 002 de encuestas y envios_encuesta se referenciaban entre sí
-- ("infinite recursion detected in policy"): cualquier lectura desde el cliente fallaba.
-- Además el autor podía leer los envíos y saber QUIÉN respondió. Ahora:
--   - encuestas/preguntas: visibles para el autor o un destinatario (helper sin RLS);
--   - envios_encuesta: solo el destinatario ve su fila; el autor ve conteos por RPC.
create or replace function public.soy_destinatario(p_encuesta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.envios_encuesta
        where encuesta_id = p_encuesta_id and destinatario_id = auth.uid()
    );
$$;

create or replace function public.soy_autor_encuesta(p_encuesta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.encuestas where id = p_encuesta_id and autor_id = auth.uid());
$$;

revoke all on function public.soy_destinatario(uuid) from public, anon;
revoke all on function public.soy_autor_encuesta(uuid) from public, anon;
grant execute on function public.soy_destinatario(uuid) to authenticated;
grant execute on function public.soy_autor_encuesta(uuid) to authenticated;

drop policy if exists "Encuestas visibles para creador y destinatarios asignados" on public.encuestas;
create policy "Encuestas visibles para creador y destinatarios asignados"
    on public.encuestas for select
    to authenticated
    using (autor_id = auth.uid() or public.soy_destinatario(id));

drop policy if exists "Preguntas visibles para autor y destinatarios" on public.preguntas;
create policy "Preguntas visibles para autor y destinatarios"
    on public.preguntas for select
    to authenticated
    using (public.soy_autor_encuesta(encuesta_id) or public.soy_destinatario(encuesta_id));

drop policy if exists "Destinatarios ven sus envios asignados" on public.envios_encuesta;
create policy "Destinatarios ven sus envios asignados"
    on public.envios_encuesta for select
    to authenticated
    using (destinatario_id = auth.uid());

-- Un único filtro para contar y para enviar (antes el envío ignoraba edad e intereses).
-- En 011 se agrega el consentimiento 2 ("Recibir encuestas").
create or replace function public.destinatarios_filtro(p_filtro jsonb, p_emisor uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_carreras text[] := '{}';
    v_ciclo_min integer := coalesce(nullif(p_filtro->>'cicloMin', '')::integer, 1);
    v_ciclo_max integer := coalesce(nullif(p_filtro->>'cicloMax', '')::integer, 10);
    v_edad_min integer := coalesce(nullif(p_filtro->>'edadMin', '')::integer, 0);
    v_edad_max integer := coalesce(nullif(p_filtro->>'edadMax', '')::integer, 99);
    v_intereses text[] := '{}';
begin
    -- "carreras": lista (vacía = todas). Se acepta también "carrera" suelta.
    if jsonb_typeof(p_filtro->'carreras') = 'array' then
        select coalesce(array_agg(x), '{}') into v_carreras
        from jsonb_array_elements_text(p_filtro->'carreras') as x;
    elsif nullif(p_filtro->>'carrera', '') is not null then
        v_carreras := array[p_filtro->>'carrera'];
    end if;
    if jsonb_typeof(p_filtro->'intereses') = 'array' then
        select coalesce(array_agg(x), '{}') into v_intereses
        from jsonb_array_elements_text(p_filtro->'intereses') as x;
    end if;

    return query
    select p.id
    from public.perfiles p
    where p.id is distinct from p_emisor
      and (cardinality(v_carreras) = 0 or p.carrera = any(v_carreras))
      and p.ciclo between v_ciclo_min and v_ciclo_max
      and extract(year from age(p.fecha_nacimiento)) between v_edad_min and v_edad_max
      and (cardinality(v_intereses) = 0 or p.intereses && v_intereses);
end;
$$;

revoke all on function public.destinatarios_filtro(jsonb, uuid) from public, anon, authenticated;

-- Conteo en vivo: devuelve SOLO un número.
create or replace function public.calcular_alcance_encuesta(p_filtro jsonb)
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select case when auth.uid() is null then 0
                else (select count(*)::integer from public.destinatarios_filtro(p_filtro, auth.uid()))
           end;
$$;

revoke all on function public.calcular_alcance_encuesta(jsonb) from public, anon;
grant execute on function public.calcular_alcance_encuesta(jsonb) to authenticated;

-- Nivel de "Apoyo a la investigación" y su alcance semanal (spec 5.2).
create or replace function public.alcance_semanal(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select case
        when n >= 8 then 200
        when n >= 3 then 80
        when n >= 1 then 30
        else 0
    end
    from (
        select count(*) as n from public.envios_encuesta
        where destinatario_id = p_usuario and estado = 'respondida'
    ) t;
$$;

revoke all on function public.alcance_semanal(uuid) from public, anon;
grant execute on function public.alcance_semanal(uuid) to authenticated;

-- Envío seguro: umbral mínimo, alcance semanal del emisor (acumulado en 7 días),
-- muestra aleatoria y tope de 3 encuestas por alumno por semana con cola.
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
        if v_p.tipo <> 'abierta' and (jsonb_typeof(v_p.opciones) <> 'array' or jsonb_array_length(v_p.opciones) < 2) then
            raise exception 'KAMPUZ_ENCUESTA: Las preguntas de opción necesitan al menos 2 opciones.';
        end if;
        insert into public.preguntas (encuesta_id, orden, texto, tipo, opciones)
        values (v_encuesta_id, v_p.orden, trim(v_p.texto), v_p.tipo, coalesce(v_p.opciones, '[]'::jsonb));
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

-- Bandeja: primero libera de la cola lo que quepa en el tope semanal (3), luego lista.
create or replace function public.mi_bandeja_encuestas()
returns table (
    envio_id uuid,
    encuesta_id uuid,
    titulo text,
    descripcion text,
    estado text,
    enviado_en timestamptz,
    respondido_en timestamptz,
    n_preguntas integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_uid uuid := auth.uid();
    v_libres integer;
begin
    if v_uid is null then
        return;
    end if;

    select 3 - count(*) into v_libres
    from public.envios_encuesta
    where destinatario_id = v_uid
      and estado in ('pendiente', 'respondida')
      and enviado_en >= now() - interval '7 days';

    if v_libres > 0 then
        update public.envios_encuesta
        set estado = 'pendiente', enviado_en = now()
        where id in (
            select id from public.envios_encuesta
            where destinatario_id = v_uid and estado = 'encolada'
            order by enviado_en
            limit v_libres
        );
    end if;

    return query
    select e.id, e.encuesta_id, enc.titulo, enc.descripcion, e.estado, e.enviado_en, e.respondido_en,
           (select count(*)::integer from public.preguntas pr where pr.encuesta_id = e.encuesta_id)
    from public.envios_encuesta e
    join public.encuestas enc on enc.id = e.encuesta_id
    where e.destinatario_id = v_uid and e.estado in ('pendiente', 'respondida')
    order by (e.estado = 'pendiente') desc, e.enviado_en desc;
end;
$$;

revoke all on function public.mi_bandeja_encuestas() from public, anon;
grant execute on function public.mi_bandeja_encuestas() to authenticated;

-- Responder: valida que el envío sea mío y esté pendiente, que cada respuesta sea de una
-- pregunta de esa encuesta y que todas estén respondidas. Todo en una transacción.
-- p_respuestas: { "<pregunta_id>": "opción" | ["opción", ...] | "texto libre" }
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

    for v_pr in select * from public.preguntas where encuesta_id = v_envio.encuesta_id loop
        v_valor := p_respuestas -> v_pr.id::text;
        if v_valor is null
           or (jsonb_typeof(v_valor) = 'string' and length(trim(v_valor #>> '{}')) = 0)
           or (jsonb_typeof(v_valor) = 'array' and jsonb_array_length(v_valor) = 0) then
            raise exception 'KAMPUZ_ENCUESTA: Responde todas las preguntas antes de enviar.';
        end if;
        if v_pr.tipo = 'multiple' and jsonb_typeof(v_valor) <> 'array' then
            v_valor := jsonb_build_array(v_valor);
        end if;
        if v_pr.tipo <> 'multiple' and jsonb_typeof(v_valor) <> 'string' then
            raise exception 'KAMPUZ_ENCUESTA: Respuesta no válida.';
        end if;
        insert into public.respuestas (envio_id, encuesta_id, pregunta_id, valor)
        values (p_envio_id, v_envio.encuesta_id, v_pr.id, v_valor);
    end loop;

    update public.envios_encuesta set estado = 'respondida', respondido_en = now() where id = p_envio_id;
end;
$$;

revoke all on function public.responder_encuesta(uuid, jsonb) from public, anon;
grant execute on function public.responder_encuesta(uuid, jsonb) to authenticated;

-- Resultados agregados: SOLO para el autor. Nunca devuelve quién respondió qué.
-- (La versión de 003 anidaba agregados y no verificaba al autor.)
create or replace function public.obtener_resultados_encuesta(p_encuesta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_enc record;
begin
    select * into v_enc from public.encuestas where id = p_encuesta_id;
    if not found or v_enc.autor_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_ENCUESTA: Solo quien creó la encuesta puede ver sus resultados.';
    end if;

    return jsonb_build_object(
        'encuesta_id', v_enc.id,
        'titulo', v_enc.titulo,
        'alcance_enviado', v_enc.alcance_enviado,
        'total_respuestas', (
            select count(*) from public.envios_encuesta where encuesta_id = v_enc.id and estado = 'respondida'
        ),
        'preguntas', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'pregunta_id', pr.id,
                'texto', pr.texto,
                'tipo', pr.tipo,
                'opciones', pr.opciones,
                'conteo', case when pr.tipo = 'abierta' then null else (
                    select coalesce(jsonb_object_agg(t.opcion, t.n), '{}'::jsonb)
                    from (
                        select x.opcion, count(*) as n
                        from public.respuestas r
                        cross join lateral (
                            select jsonb_array_elements_text(
                                case when jsonb_typeof(r.valor) = 'array' then r.valor else jsonb_build_array(r.valor) end
                            ) as opcion
                        ) x
                        where r.pregunta_id = pr.id
                        group by x.opcion
                    ) t
                ) end,
                -- Textos libres sin ningún vínculo con quién los escribió, en orden aleatorio
                'textos', case when pr.tipo = 'abierta' then (
                    select coalesce(jsonb_agg(r.valor #>> '{}' order by random()), '[]'::jsonb)
                    from public.respuestas r where r.pregunta_id = pr.id
                ) else null end
            ) order by pr.orden), '[]'::jsonb)
            from public.preguntas pr where pr.encuesta_id = v_enc.id
        )
    );
end;
$$;

revoke all on function public.obtener_resultados_encuesta(uuid) from public, anon;
grant execute on function public.obtener_resultados_encuesta(uuid) to authenticated;

-- Mis encuestas creadas, con conteos agregados (el autor no lee los envíos individuales).
create or replace function public.mis_encuestas_creadas()
returns table (
    id uuid,
    titulo text,
    descripcion text,
    alcance_calculado integer,
    alcance_enviado integer,
    respuestas integer,
    encoladas integer,
    estado text,
    creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select enc.id, enc.titulo, enc.descripcion, enc.alcance_calculado, enc.alcance_enviado,
           (select count(*)::integer from public.envios_encuesta e where e.encuesta_id = enc.id and e.estado = 'respondida'),
           (select count(*)::integer from public.envios_encuesta e where e.encuesta_id = enc.id and e.estado = 'encolada'),
           enc.estado, enc.creado_en
    from public.encuestas enc
    where enc.autor_id = auth.uid()
    order by enc.creado_en desc;
$$;

revoke all on function public.mis_encuestas_creadas() from public, anon;
grant execute on function public.mis_encuestas_creadas() to authenticated;

-- ------------------------------------------------------------------------------
-- 8. HABILIDADES DERIVADAS DE LOS HECHOS (spec 5.1, 5.3 y 5.6)
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
    v_asesorias integer;
    v_estrellas_ayuda integer;
    v_grupos_activos integer;
    v_grupos_creados integer;
    v_semanal integer;
begin
    if auth.uid() is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;

    select count(*) into v_encuestas
    from public.envios_encuesta where destinatario_id = p_usuario_id and estado = 'respondida';

    -- Solo cuentan las asesorías que acreditaron estrellas (agrupadas y valoradas)
    select count(*), coalesce(sum(estrellas_acreditadas), 0) into v_asesorias, v_estrellas_ayuda
    from public.asesorias where asesor_id = p_usuario_id and estrellas_acreditadas > 0;

    -- "Grupo con actividad": taller o grupo de interés donde es miembro Y escribió.
    -- Estar inscrito no basta (spec 5.6: asistir no es evidencia).
    select count(distinct m.espacio_id) into v_grupos_activos
    from public.membresias m
    join public.espacios e on e.id = m.espacio_id and e.tipo in ('taller', 'interes')
    where m.usuario_id = p_usuario_id
      and exists (select 1 from public.mensajes ms where ms.espacio_id = m.espacio_id and ms.autor_id = p_usuario_id);

    -- Liderazgo: grupos creados que alcanzaron el umbral (una propuesta oculta no es un grupo)
    select count(*) into v_grupos_creados
    from public.espacios where creador_id = p_usuario_id and tipo = 'interes' and estado = 'visible';

    v_semanal := public.alcance_semanal(p_usuario_id);

    return jsonb_build_object(
        'apoyo_investigacion', jsonb_build_object(
            'progreso', v_encuestas,
            'nivel', case when v_encuestas >= 8 then 3 when v_encuestas >= 3 then 2 when v_encuestas >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 3, 8),
            'estrellas', v_encuestas,
            'alcance_semanal', v_semanal
        ),
        'predisposicion_ayudar', jsonb_build_object(
            'progreso', v_asesorias,
            'nivel', case when v_asesorias >= 5 then 3 when v_asesorias >= 2 then 2 when v_asesorias >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 2, 5),
            'estrellas', v_estrellas_ayuda
        ),
        'constancia', jsonb_build_object(
            'progreso', v_grupos_activos,
            'nivel', case when v_grupos_activos >= 5 then 3 when v_grupos_activos >= 3 then 2 when v_grupos_activos >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 3, 5),
            'estrellas', v_grupos_activos
        ),
        'liderazgo', jsonb_build_object(
            'progreso', v_grupos_creados,
            'nivel', case when v_grupos_creados >= 3 then 3 when v_grupos_creados >= 2 then 2 when v_grupos_creados >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 2, 3),
            'estrellas', v_grupos_creados * 3
        )
    );
end;
$$;

revoke all on function public.calcular_habilidades_usuario(uuid) from public, anon;
grant execute on function public.calcular_habilidades_usuario(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 9. ELIMINAR CUENTA (corrige 007: respuestas no tiene usuario_id y los errores se
--    devolvían como "success: false" que el cliente trataba como éxito)
--    Las fotos se borran antes desde el cliente con la API de Storage: Supabase no
--    permite borrar filas de storage.objects con SQL directo.
-- ------------------------------------------------------------------------------
create or replace function public.eliminar_mi_cuenta()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;

    -- perfiles tiene ON DELETE CASCADE hacia mensajes, membresías, solicitudes,
    -- conversaciones, consultas, envíos (y sus respuestas), consentimientos, etc.
    delete from public.perfiles where id = v_user_id;
    delete from auth.users where id = v_user_id;

    return json_build_object('success', true);
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- ------------------------------------------------------------------------------
-- 10. REALTIME: avisos en vivo de solicitudes (mensajes y mensajes_directos ya estaban)
-- ------------------------------------------------------------------------------
do $$
begin
    begin
        alter publication supabase_realtime add table public.solicitudes_mensaje;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.mensajes;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.mensajes_directos;
    exception when duplicate_object then null;
    end;
end $$;
