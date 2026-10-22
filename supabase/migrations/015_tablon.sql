-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 015: Tablón "Pasando hoy"
-- Sprint de 2 días (docs/PROMPT_SPRINT_2_DIAS.md, punto 2).
-- Un solo tablón con 4 tipos: plan, ayuda, evento y mercadito.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Permisos: Supabase da EXECUTE a anon y authenticated en cada función nueva.
-- Aquí cada función empieza quitándoselo a public y anon; solo las que llama la
-- app se le dan a authenticated. Las de trigger no se le dan a nadie.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. UNIVERSIDAD EN EL PERFIL
--    El tablón se lee por universidad. Hoy todos son de la UTP; la columna deja
--    lista la base para otra universidad (punto 4 del sprint). El alumno no puede
--    cambiársela.
-- ------------------------------------------------------------------------------
alter table public.perfiles add column if not exists universidad text not null default 'UTP';

create or replace function public.proteger_universidad_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'INSERT' then
            new.universidad := 'UTP';
        else
            new.universidad := old.universidad;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_proteger_universidad_perfil on public.perfiles;
create trigger trg_proteger_universidad_perfil
    before insert or update on public.perfiles
    for each row
    execute function public.proteger_universidad_perfil();

revoke all on function public.proteger_universidad_perfil() from public, anon, authenticated;

create or replace function public.mi_universidad()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select universidad from public.perfiles where id = auth.uid();
$$;

revoke all on function public.mi_universidad() from public, anon;
grant execute on function public.mi_universidad() to authenticated;

-- ------------------------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------------------------
create table if not exists public.publicaciones (
    id uuid primary key default gen_random_uuid(),
    autor_id uuid not null references public.perfiles(id) on delete cascade,
    universidad text not null,
    sede text,
    tipo text not null check (tipo in ('plan', 'ayuda', 'evento', 'mercadito')),
    titulo text not null check (char_length(titulo) between 3 and 80),
    descripcion text check (descripcion is null or char_length(descripcion) <= 500),
    lugar text check (lugar is null or char_length(lugar) <= 80),
    empieza_en timestamptz,
    vence_en timestamptz not null,
    cupo integer check (cupo is null or cupo between 1 and 200),
    precio numeric(8, 2) check (precio is null or precio between 0 and 10000),
    foto_url text check (foto_url is null or (foto_url not like 'data:%' and char_length(foto_url) <= 500)),
    estado text not null default 'activa' check (estado in ('activa', 'cerrada', 'eliminada')),
    creado_en timestamptz not null default now(),
    constraint publicaciones_precio_solo_mercadito check (precio is null or tipo = 'mercadito')
);

create index if not exists idx_publicaciones_tablon
    on public.publicaciones (universidad, sede, vence_en)
    where estado = 'activa';
create index if not exists idx_publicaciones_autor on public.publicaciones (autor_id, estado);

create table if not exists public.publicacion_respuestas (
    publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
    usuario_id uuid not null references public.perfiles(id) on delete cascade,
    tipo text not null check (tipo in ('voy', 'ayudo', 'asistire', 'interesa')),
    creado_en timestamptz not null default now(),
    primary key (publicacion_id, usuario_id)
);

create index if not exists idx_publicacion_respuestas_usuario on public.publicacion_respuestas (usuario_id);

-- ------------------------------------------------------------------------------
-- 2. MODERACIÓN ANTI-TRAMPA (mercadito y ayuda)
--    Mismo enfoque que la moderación de consultas: expresiones regulares en el
--    servidor. Se detecta ofrecer resolver evaluaciones, hacer trabajos o vender
--    respuestas. "Tutorías de Cálculo" o "vendo mis apuntes" sí se permiten.
-- ------------------------------------------------------------------------------
create or replace function public.texto_ofrece_trampa(p_texto text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
    t text := translate(lower(coalesce(p_texto, '')), 'áéíóúü', 'aeiouu');
    v_eval text := '(examen|examenes|parcial|parciales|final|finales|practica|practicas|pc|pcs|quiz|quices|evaluacion|evaluaciones|trabajo|trabajos|tarea|tareas|tesis|laboratorio|laboratorios|monografia|monografias)';
begin
    return
        -- "resuelvo tu examen", "hago tu trabajo", "hacemos tareas"
        t ~ ('\m(resuelvo|resolvemos|resuelve|resolver|hago|hacemos|te hago|les hago|realizo|realizamos|desarrollo|desarrollamos)\s+((tu|tus|el|los|la|las|su|sus|cualquier)\s+)?' || v_eval || '\M')
        -- "te paso las respuestas", "vendo solucionario", "tengo las claves"
        or t ~ '\m(te paso|les paso|paso|vendo|venta de|ofrezco|tengo)\s+((las|los|el|la)\s+)?(respuestas|solucionario|solucionarios|claves)\M'
        -- "solucionario del examen", "respuestas del parcial"
        or t ~ '\m(solucionarios?|respuestas|claves)\s+(del|de la|de los|de las|de|para el|para la|para)\s+(examen|examenes|parcial|parciales|final|pc|practica|evaluacion|quiz)\M'
        -- "exámenes resueltos", "tareas resueltas"
        or t ~ ('\m' || v_eval || '\s+(resuelto|resueltos|resuelta|resueltas)\M')
        -- "rindo tu examen", "doy tu parcial"
        or t ~ '\m(rindo|doy|rendimos)\s+(tu|tus|el|los|su)\s+(examen|examenes|parcial|parciales|final|evaluacion)\M';
end;
$$;

-- La llama el trigger preparar_publicacion con los permisos del alumno. Es una
-- función pura (no lee datos), así que authenticated puede ejecutarla; anon no.
revoke all on function public.texto_ofrece_trampa(text) from public, anon;
grant execute on function public.texto_ofrece_trampa(text) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. REGLAS DE UNA PUBLICACIÓN (trigger): autor, sede, vencimiento, límites,
--    antispam y moderación. Lo que mande el cliente en esos campos se ignora.
-- ------------------------------------------------------------------------------
create or replace function public.preparar_publicacion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_univ text;
    v_sede text;
    v_activas integer;
    v_mercadito integer;
    v_fin_dia timestamptz := (date_trunc('day', now() at time zone 'America/Lima') + interval '1 day') at time zone 'America/Lima';
    v_desde_app boolean := current_user in ('anon', 'authenticated');
begin
    new.titulo := trim(coalesce(new.titulo, ''));
    new.descripcion := nullif(trim(coalesce(new.descripcion, '')), '');
    new.lugar := nullif(trim(coalesce(new.lugar, '')), '');

    if char_length(new.titulo) < 3 then
        raise exception 'KAMPUZ_TABLON: Escribe un título de al menos 3 caracteres.';
    end if;
    if char_length(new.titulo) > 80 then
        raise exception 'KAMPUZ_TABLON: El título es muy largo (máximo 80 caracteres).';
    end if;
    if char_length(coalesce(new.descripcion, '')) > 500 then
        raise exception 'KAMPUZ_TABLON: La descripción es muy larga (máximo 500 caracteres).';
    end if;
    if char_length(coalesce(new.lugar, '')) > 80 then
        raise exception 'KAMPUZ_TABLON: El lugar es muy largo (máximo 80 caracteres).';
    end if;

    if tg_op = 'INSERT' then
        if v_desde_app then
            new.autor_id := auth.uid();
        end if;
        select universidad, sede into v_univ, v_sede from public.perfiles where id = new.autor_id;
        if not found then
            raise exception 'KAMPUZ_TABLON: Completa tu perfil antes de publicar.';
        end if;
        new.universidad := v_univ;
        new.sede := v_sede;
        new.estado := 'activa';
        new.creado_en := now();

        -- Campos que solo tienen sentido en algunos tipos
        if new.tipo <> 'mercadito' then
            new.precio := null;
        end if;
        if new.tipo in ('ayuda', 'mercadito') then
            new.cupo := null;
        end if;

        -- Vencimiento según el tipo
        if new.tipo = 'plan' then
            new.empieza_en := coalesce(new.empieza_en, now());
            new.vence_en := least(coalesce(new.vence_en, now() + interval '3 hours'), v_fin_dia);
        elsif new.tipo = 'ayuda' then
            new.empieza_en := now();
            new.vence_en := least(coalesce(new.vence_en, now() + interval '2 hours'), now() + interval '24 hours');
        elsif new.tipo = 'evento' then
            if new.empieza_en is null then
                raise exception 'KAMPUZ_TABLON: Indica la fecha y hora del evento.';
            end if;
            if new.empieza_en < now() - interval '1 hour' then
                raise exception 'KAMPUZ_TABLON: La fecha del evento ya pasó.';
            end if;
            if new.empieza_en > now() + interval '90 days' then
                raise exception 'KAMPUZ_TABLON: El evento debe ser dentro de los próximos 90 días.';
            end if;
            new.vence_en := coalesce(new.vence_en, new.empieza_en + interval '3 hours');
            if new.vence_en <= new.empieza_en then
                new.vence_en := new.empieza_en + interval '3 hours';
            end if;
        else -- mercadito
            new.empieza_en := now();
            new.vence_en := now() + interval '7 days';
        end if;

        if new.vence_en <= now() then
            raise exception 'KAMPUZ_TABLON: Esa hora ya pasó. Elige una más tarde.';
        end if;

        -- Antispam: 5 publicaciones activas por alumno y 3 en el mercadito
        select count(*), count(*) filter (where tipo = 'mercadito')
        into v_activas, v_mercadito
        from public.publicaciones
        where autor_id = new.autor_id and estado = 'activa' and vence_en > now();

        if v_activas >= 5 then
            raise exception 'KAMPUZ_TABLON: Ya tienes 5 publicaciones activas. Cierra alguna para publicar otra.';
        end if;
        if new.tipo = 'mercadito' and v_mercadito >= 3 then
            raise exception 'KAMPUZ_TABLON: Ya tienes 3 publicaciones en el mercadito. Cierra alguna para publicar otra.';
        end if;
    else
        -- El autor puede editar textos, precio, cupo y cerrar; nada más
        new.id := old.id;
        new.autor_id := old.autor_id;
        new.universidad := old.universidad;
        new.sede := old.sede;
        new.tipo := old.tipo;
        new.empieza_en := old.empieza_en;
        new.vence_en := old.vence_en;
        new.creado_en := old.creado_en;
        if old.estado <> 'activa' and new.estado = 'activa' then
            raise exception 'KAMPUZ_TABLON: Una publicación cerrada no se puede volver a abrir. Crea una nueva.';
        end if;
        if old.estado = 'eliminada' then
            new.estado := 'eliminada';
        end if;
        if new.tipo <> 'mercadito' then
            new.precio := null;
        end if;
    end if;

    if new.tipo in ('ayuda', 'mercadito')
       and public.texto_ofrece_trampa(new.titulo || ' ' || coalesce(new.descripcion, '')) then
        raise exception 'KAMPUZ_TRAMPA: Kampuz no permite ofrecer ayuda para hacer trampa en evaluaciones. Puedes ofrecer tutorías o apuntes propios.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_preparar_publicacion on public.publicaciones;
create trigger trg_preparar_publicacion
    before insert or update on public.publicaciones
    for each row
    execute function public.preparar_publicacion();

revoke all on function public.preparar_publicacion() from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. REGLAS DE UNA RESPUESTA (trigger): solo publicaciones activas y vigentes,
--    nunca la propia, la acción que corresponde al tipo y sin pasarse del cupo.
--    Bloquea la fila de la publicación para que dos "¡Voy!" a la vez no superen
--    el cupo.
-- ------------------------------------------------------------------------------
create or replace function public.validar_respuesta_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pub record;
    v_esperado text;
    v_total integer;
begin
    select * into v_pub from public.publicaciones where id = new.publicacion_id for update;
    if not found or v_pub.estado <> 'activa' or v_pub.vence_en <= now() then
        raise exception 'KAMPUZ_TABLON: Esta publicación ya terminó.';
    end if;
    if v_pub.autor_id = new.usuario_id then
        raise exception 'KAMPUZ_TABLON: No puedes responder tu propia publicación.';
    end if;
    if public.hay_bloqueo(v_pub.autor_id, new.usuario_id)
       or v_pub.universidad is distinct from (select universidad from public.perfiles where id = new.usuario_id) then
        raise exception 'KAMPUZ_TABLON: No puedes responder esta publicación.';
    end if;

    v_esperado := case v_pub.tipo
        when 'plan' then 'voy'
        when 'ayuda' then 'ayudo'
        when 'evento' then 'asistire'
        else 'interesa'
    end;
    new.tipo := v_esperado;
    new.creado_en := now();

    if v_pub.cupo is not null then
        select count(*) into v_total from public.publicacion_respuestas where publicacion_id = new.publicacion_id;
        if v_total >= v_pub.cupo then
            raise exception 'KAMPUZ_TABLON: Ya no quedan cupos.';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_validar_respuesta_publicacion on public.publicacion_respuestas;
create trigger trg_validar_respuesta_publicacion
    before insert on public.publicacion_respuestas
    for each row
    execute function public.validar_respuesta_publicacion();

revoke all on function public.validar_respuesta_publicacion() from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------------------------
alter table public.publicaciones enable row level security;
alter table public.publicacion_respuestas enable row level security;

revoke all on public.publicaciones from anon;
revoke all on public.publicacion_respuestas from anon;
grant select, insert, update on public.publicaciones to authenticated;
revoke delete on public.publicaciones from authenticated; -- no se borran datos: se cierran
grant select, insert, delete on public.publicacion_respuestas to authenticated;
revoke update on public.publicacion_respuestas from authenticated;

-- Leen los alumnos de la misma universidad (sin bloqueos). Las vencidas se filtran
-- en las consultas (vence_en > now()) para que el autor siga viendo su historial.
drop policy if exists "Alumnos de la universidad leen publicaciones" on public.publicaciones;
create policy "Alumnos de la universidad leen publicaciones"
    on public.publicaciones for select
    to authenticated
    using (
        autor_id = auth.uid()
        or (
            estado <> 'eliminada'
            and universidad = public.mi_universidad()
            and not public.hay_bloqueo(autor_id, auth.uid())
        )
    );

drop policy if exists "Alumnos publican a su nombre" on public.publicaciones;
create policy "Alumnos publican a su nombre"
    on public.publicaciones for insert
    to authenticated
    with check (autor_id = auth.uid());

drop policy if exists "Solo el autor edita o cierra" on public.publicaciones;
create policy "Solo el autor edita o cierra"
    on public.publicaciones for update
    to authenticated
    using (autor_id = auth.uid())
    with check (autor_id = auth.uid());

-- Quién va a un plan o evento lo ven todos; quién ofreció ayuda o se interesó en
-- el mercadito solo lo ven el autor de la publicación y quien respondió.
drop policy if exists "Ver respuestas de publicaciones" on public.publicacion_respuestas;
create policy "Ver respuestas de publicaciones"
    on public.publicacion_respuestas for select
    to authenticated
    using (
        usuario_id = auth.uid()
        or exists (
            select 1 from public.publicaciones p
            where p.id = publicacion_respuestas.publicacion_id
              and (
                  p.autor_id = auth.uid()
                  or (
                      p.tipo in ('plan', 'evento')
                      and p.estado <> 'eliminada'
                      and p.universidad = public.mi_universidad()
                      and not public.hay_bloqueo(p.autor_id, auth.uid())
                  )
              )
        )
    );

drop policy if exists "Cada alumno agrega su respuesta" on public.publicacion_respuestas;
create policy "Cada alumno agrega su respuesta"
    on public.publicacion_respuestas for insert
    to authenticated
    with check (usuario_id = auth.uid());

drop policy if exists "Cada alumno quita su respuesta" on public.publicacion_respuestas;
create policy "Cada alumno quita su respuesta"
    on public.publicacion_respuestas for delete
    to authenticated
    using (usuario_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 6. "YO TE AYUDO": chat directo sin solicitud, solo para esa publicación
--    La conversación queda marcada con origen 'ayuda' y la publicación. No cuenta
--    como contacto y se puede escribir hasta 2 días después de que vence la
--    publicación. Si después se aceptan como contactos, pasa a origen 'solicitud'.
-- ------------------------------------------------------------------------------
alter table public.conversaciones add column if not exists origen text not null default 'solicitud';
alter table public.conversaciones add column if not exists publicacion_id uuid references public.publicaciones(id) on delete set null;

do $$
begin
    alter table public.conversaciones
        add constraint conversaciones_origen_valido check (origen in ('solicitud', 'ayuda'));
exception when duplicate_object then null;
end $$;

create or replace function public.puede_escribir_conversacion(p_conversacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.conversaciones c
        left join public.publicaciones p on p.id = c.publicacion_id
        where c.id = p_conversacion_id
          and auth.uid() in (c.usuario_a_id, c.usuario_b_id)
          and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
          and (
              c.origen = 'solicitud'
              or (p.id is not null and p.estado <> 'eliminada' and now() < p.vence_en + interval '2 days')
          )
    );
$$;

revoke all on function public.puede_escribir_conversacion(uuid) from public, anon;
grant execute on function public.puede_escribir_conversacion(uuid) to authenticated;

drop policy if exists "Interlocutores envian mensajes directos" on public.mensajes_directos;
create policy "Interlocutores envian mensajes directos"
    on public.mensajes_directos for insert
    to authenticated
    with check (
        auth.uid() = autor_id
        and length(trim(texto)) between 1 and 2000
        and public.puede_escribir_conversacion(conversacion_id)
    );

create or replace function public.ofrecer_ayuda(p_publicacion_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
    v_pub record;
    v_conv uuid;
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    select * into v_pub from public.publicaciones where id = p_publicacion_id;
    if not found or v_pub.tipo <> 'ayuda' then
        raise exception 'KAMPUZ_TABLON: No encontramos esta publicación.';
    end if;

    -- El trigger valida que siga activa, que no sea propia y que no haya bloqueo
    insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo)
    values (p_publicacion_id, v_yo, 'ayudo')
    on conflict (publicacion_id, usuario_id) do nothing;

    select id into v_conv from public.conversaciones
    where usuario_a_id = least(v_yo, v_pub.autor_id) and usuario_b_id = greatest(v_yo, v_pub.autor_id);

    if v_conv is null then
        insert into public.conversaciones (usuario_a_id, usuario_b_id, origen, publicacion_id)
        values (least(v_yo, v_pub.autor_id), greatest(v_yo, v_pub.autor_id), 'ayuda', p_publicacion_id)
        returning id into v_conv;
    else
        -- Ya tenían un chat de ayuda por otra publicación: se vincula a esta
        update public.conversaciones
        set publicacion_id = p_publicacion_id
        where id = v_conv and origen = 'ayuda';
    end if;

    return v_conv;
end;
$$;

revoke all on function public.ofrecer_ayuda(uuid) from public, anon;
grant execute on function public.ofrecer_ayuda(uuid) to authenticated;

-- Solicitudes: un chat de ayuda no impide agregarse como contactos (013 + origen)
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
          and origen = 'solicitud'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Ya son contactos. Abre el chat desde "Chats".';
    end if;
    if exists (
        select 1 from public.solicitudes_mensaje
        where de_id = p_a_id and a_id = v_de and estado = 'pendiente'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Esta persona ya te envió una solicitud. Revísala en Solicitudes.';
    end if;

    select * into v_previa from public.solicitudes_mensaje where de_id = v_de and a_id = p_a_id;
    if found then
        if v_previa.estado = 'pendiente' then
            raise exception 'KAMPUZ_SOLICITUD: Ya le enviaste una solicitud. Espera su respuesta.';
        elsif v_previa.estado = 'rechazada' then
            raise exception 'KAMPUZ_SOLICITUD: Esta persona no aceptó tu solicitud anterior.';
        else
            raise exception 'KAMPUZ_SOLICITUD: Ya son contactos. Abre el chat desde "Chats".';
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

create or replace function public.responder_solicitud(p_solicitud_id uuid, p_aceptar boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sol record;
    v_conv uuid;
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
            raise exception 'KAMPUZ_SOLICITUD: No puedes agregar a este estudiante como contacto.';
        end if;
        v_conv := public.asegurar_conversacion(v_sol.de_id, v_sol.a_id);
        -- Si venían de un chat de ayuda, ahora son contactos
        update public.conversaciones set origen = 'solicitud', publicacion_id = null
        where id = v_conv and origen <> 'solicitud';
        return v_conv;
    end if;
    return null;
end;
$$;

revoke all on function public.responder_solicitud(uuid, boolean) from public, anon;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;

-- Bandeja de chats: ahora dice si el chat es de un contacto o de una ayuda
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
    no_leidos integer,
    origen text,
    publicacion_id uuid,
    publicacion_titulo text,
    puede_escribir boolean
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
        ),
        c.origen,
        c.publicacion_id,
        pub.titulo,
        public.puede_escribir_conversacion(c.id)
    from public.conversaciones c
    join public.perfiles p
      on p.id = case when c.usuario_a_id = auth.uid() then c.usuario_b_id else c.usuario_a_id end
    left join public.publicaciones pub on pub.id = c.publicacion_id
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
-- 7. "ME INTERESA" (mercadito): registra el interés y manda una solicitud de
--    mensaje con el motivo ya escrito (si todavía no son contactos).
--    Devuelve: 'contacto' | 'solicitud_enviada' | 'solicitud_pendiente' | 'registrado'
-- ------------------------------------------------------------------------------
create or replace function public.me_interesa(p_publicacion_id uuid, p_motivo text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
    v_pub record;
    v_motivo text;
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    select * into v_pub from public.publicaciones where id = p_publicacion_id;
    if not found or v_pub.tipo <> 'mercadito' then
        raise exception 'KAMPUZ_TABLON: No encontramos esta publicación.';
    end if;

    insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo)
    values (p_publicacion_id, v_yo, 'interesa')
    on conflict (publicacion_id, usuario_id) do nothing;

    if exists (
        select 1 from public.conversaciones
        where usuario_a_id = least(v_yo, v_pub.autor_id) and usuario_b_id = greatest(v_yo, v_pub.autor_id)
          and origen = 'solicitud'
    ) then
        return 'contacto';
    end if;

    if exists (
        select 1 from public.solicitudes_mensaje
        where estado = 'pendiente'
          and ((de_id = v_yo and a_id = v_pub.autor_id) or (de_id = v_pub.autor_id and a_id = v_yo))
    ) then
        return 'solicitud_pendiente';
    end if;

    if exists (select 1 from public.solicitudes_mensaje where de_id = v_yo and a_id = v_pub.autor_id) then
        return 'registrado'; -- ya hubo una solicitud que no se aceptó: no se insiste
    end if;

    v_motivo := left(coalesce(nullif(trim(p_motivo), ''),
        'Hola, me interesa tu publicación "' || v_pub.titulo || '" del mercadito.'), 300);
    perform public.enviar_solicitud(v_pub.autor_id, v_motivo);
    return 'solicitud_enviada';
end;
$$;

revoke all on function public.me_interesa(uuid, text) from public, anon;
grant execute on function public.me_interesa(uuid, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 8. LECTURA DEL TABLÓN (una sola llamada)
--    Publicaciones activas y vigentes de mi sede, con el autor, si es mía, mi
--    respuesta, el total de respuestas y hasta 5 participantes (solo en planes y
--    eventos, o si la publicación es mía).
-- ------------------------------------------------------------------------------
create or replace function public.tablon(p_tipo text default null)
returns table (
    id uuid,
    tipo text,
    titulo text,
    descripcion text,
    lugar text,
    empieza_en timestamptz,
    vence_en timestamptz,
    cupo integer,
    precio numeric,
    foto_url text,
    creado_en timestamptz,
    autor_id uuid,
    autor_nombre text,
    autor_apellido text,
    autor_usuario text,
    autor_foto_url text,
    autor_carrera text,
    autor_ciclo integer,
    es_mia boolean,
    mi_respuesta text,
    total_respuestas integer,
    participantes jsonb
)
language sql
stable
security definer
set search_path = public
as $$
    with yo as (
        select id, universidad, sede from public.perfiles where id = auth.uid()
    )
    select
        pu.id, pu.tipo, pu.titulo, pu.descripcion, pu.lugar, pu.empieza_en, pu.vence_en,
        pu.cupo, pu.precio, pu.foto_url, pu.creado_en,
        a.id, a.nombre, a.apellido, a.usuario, a.foto_url, a.carrera, a.ciclo,
        pu.autor_id = yo.id,
        (select r.tipo from public.publicacion_respuestas r where r.publicacion_id = pu.id and r.usuario_id = yo.id),
        (select count(*)::integer from public.publicacion_respuestas r where r.publicacion_id = pu.id),
        case when pu.tipo in ('plan', 'evento') or pu.autor_id = yo.id then
            coalesce((
                select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'foto_url', x.foto_url) order by x.creado_en)
                from (
                    select pe.id, pe.nombre, pe.foto_url, r.creado_en
                    from public.publicacion_respuestas r
                    join public.perfiles pe on pe.id = r.usuario_id
                    where r.publicacion_id = pu.id and not public.hay_bloqueo(pe.id, yo.id)
                    order by r.creado_en
                    limit 5
                ) x
            ), '[]'::jsonb)
        else '[]'::jsonb end
    from public.publicaciones pu
    cross join yo
    join public.perfiles a on a.id = pu.autor_id
    where pu.estado = 'activa'
      and pu.vence_en > now()
      and pu.universidad = yo.universidad
      and pu.sede is not distinct from yo.sede
      and (p_tipo is null or pu.tipo = p_tipo)
      and not public.hay_bloqueo(pu.autor_id, yo.id)
    order by
        case when pu.tipo = 'evento' then pu.empieza_en end asc nulls last,
        pu.creado_en desc
    limit 100;
$$;

revoke all on function public.tablon(text) from public, anon;
grant execute on function public.tablon(text) to authenticated;

-- Quiénes respondieron una publicación mía (para "Ver quiénes respondieron")
create or replace function public.respuestas_publicacion(p_publicacion_id uuid)
returns table (
    usuario_id uuid,
    nombre text,
    apellido text,
    usuario text,
    foto_url text,
    carrera text,
    ciclo integer,
    tipo text,
    creado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.publicaciones where id = p_publicacion_id and autor_id = auth.uid()) then
        raise exception 'KAMPUZ_TABLON: Solo el autor ve quiénes respondieron.';
    end if;
    return query
        select pe.id, pe.nombre, pe.apellido, pe.usuario, pe.foto_url, pe.carrera, pe.ciclo, r.tipo, r.creado_en
        from public.publicacion_respuestas r
        join public.perfiles pe on pe.id = r.usuario_id
        where r.publicacion_id = p_publicacion_id
          and not public.hay_bloqueo(pe.id, auth.uid())
        order by r.creado_en;
end;
$$;

revoke all on function public.respuestas_publicacion(uuid) from public, anon;
grant execute on function public.respuestas_publicacion(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 9. REPORTES DE PUBLICACIONES (tabla reportes existente)
-- ------------------------------------------------------------------------------
alter table public.reportes drop constraint if exists reportes_tipo_check;
alter table public.reportes
    add constraint reportes_tipo_check
    check (tipo in ('mensaje', 'perfil', 'espacio', 'consulta', 'mensaje_directo', 'publicacion'));

-- ------------------------------------------------------------------------------
-- 10. FOTO OPCIONAL (eventos y mercadito) en Storage
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('publicaciones', 'publicaciones', true)
on conflict (id) do update set public = true;

update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'publicaciones';

drop policy if exists "Fotos de publicaciones son publicas" on storage.objects;
create policy "Fotos de publicaciones son publicas"
    on storage.objects for select
    to public
    using (bucket_id = 'publicaciones');

drop policy if exists "Alumnos suben fotos de publicaciones en su carpeta" on storage.objects;
create policy "Alumnos suben fotos de publicaciones en su carpeta"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Alumnos borran fotos de publicaciones de su carpeta" on storage.objects;
create policy "Alumnos borran fotos de publicaciones de su carpeta"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------------------------
-- 11. REALTIME: los "¡Voy!" y las publicaciones nuevas se ven en vivo
-- ------------------------------------------------------------------------------
do $$
begin
    begin
        alter publication supabase_realtime add table public.publicaciones;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.publicacion_respuestas;
    exception when duplicate_object then null;
    end;
end $$;
