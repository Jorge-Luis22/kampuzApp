-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 016: Arreglos del tablón y del chat
-- Idempotente: se puede ejecutar más de una vez.
-- Funciones nuevas: sin EXECUTE para public ni anon; authenticated solo en las
-- que llama la app.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. "ME INTERESA" ENTRE CONTACTOS
--    Si ya son contactos, en vez de una solicitud se envía un mensaje en su chat:
--    'Hola, me interesa tu publicación «TÍTULO» del mercadito.' (solo la primera
--    vez que se toca). Si no son contactos, la solicitud lleva ese mismo motivo.
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
    v_nueva integer;
    v_conv uuid;
    v_texto text;
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    select * into v_pub from public.publicaciones where id = p_publicacion_id;
    if not found or v_pub.tipo <> 'mercadito' then
        raise exception 'KAMPUZ_TABLON: No encontramos esta publicación.';
    end if;

    -- El trigger valida que siga activa, que no sea propia y que no haya bloqueo
    insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo)
    values (p_publicacion_id, v_yo, 'interesa')
    on conflict (publicacion_id, usuario_id) do nothing;
    get diagnostics v_nueva = row_count;

    v_texto := left('Hola, me interesa tu publicación «' || v_pub.titulo || '» del mercadito.', 300);

    select id into v_conv from public.conversaciones
    where usuario_a_id = least(v_yo, v_pub.autor_id) and usuario_b_id = greatest(v_yo, v_pub.autor_id)
      and origen = 'solicitud';

    if v_conv is not null then
        if v_nueva > 0 and not public.hay_bloqueo(v_yo, v_pub.autor_id) then
            insert into public.mensajes_directos (conversacion_id, autor_id, texto)
            values (v_conv, v_yo, v_texto);
        end if;
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

    perform public.enviar_solicitud(v_pub.autor_id, left(coalesce(nullif(trim(p_motivo), ''), v_texto), 300));
    return 'solicitud_enviada';
end;
$$;

revoke all on function public.me_interesa(uuid, text) from public, anon;
grant execute on function public.me_interesa(uuid, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. "QUIÉNES RESPONDIERON": con qué chat se abre cada persona
--    Para cada persona: su chat conmigo (de contacto o de ayuda) o, si no hay,
--    el estado de una solicitud pendiente entre los dos ('enviada' o 'recibida').
-- ------------------------------------------------------------------------------
drop function if exists public.respuestas_publicacion(uuid);
create function public.respuestas_publicacion(p_publicacion_id uuid)
returns table (
    usuario_id uuid,
    nombre text,
    apellido text,
    usuario text,
    foto_url text,
    carrera text,
    ciclo integer,
    tipo text,
    creado_en timestamptz,
    conversacion_id uuid,
    conversacion_origen text,
    puede_escribir boolean,
    solicitud_pendiente text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
begin
    if not exists (select 1 from public.publicaciones where id = p_publicacion_id and autor_id = v_yo) then
        raise exception 'KAMPUZ_TABLON: Solo el autor ve quiénes respondieron.';
    end if;
    return query
        select pe.id, pe.nombre, pe.apellido, pe.usuario, pe.foto_url, pe.carrera, pe.ciclo, r.tipo, r.creado_en,
               c.id,
               c.origen,
               case when c.id is null then false else public.puede_escribir_conversacion(c.id) end,
               case
                   when exists (select 1 from public.solicitudes_mensaje s where s.de_id = v_yo and s.a_id = pe.id and s.estado = 'pendiente') then 'enviada'
                   when exists (select 1 from public.solicitudes_mensaje s where s.de_id = pe.id and s.a_id = v_yo and s.estado = 'pendiente') then 'recibida'
               end
        from public.publicacion_respuestas r
        join public.perfiles pe on pe.id = r.usuario_id
        left join public.conversaciones c
          on c.usuario_a_id = least(pe.id, v_yo) and c.usuario_b_id = greatest(pe.id, v_yo)
        where r.publicacion_id = p_publicacion_id
          and not public.hay_bloqueo(pe.id, v_yo)
        order by r.creado_en;
end;
$$;

revoke all on function public.respuestas_publicacion(uuid) from public, anon;
grant execute on function public.respuestas_publicacion(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. ELIMINAR EN EL CHAT (sin borrar datos)
-- ------------------------------------------------------------------------------

-- 3a. Al enviar un mensaje, la app solo elige la conversación, el autor y el texto.
--     La fecha y "eliminado" los pone el servidor (sin esto se podría antedatar un
--     mensaje o crearlo ya "eliminado").
revoke insert on public.mensajes_directos from anon, authenticated;
grant insert (conversacion_id, autor_id, texto) on public.mensajes_directos to authenticated;

-- 3b. "ELIMINAR CHAT PARA MÍ"
--     Se guarda hasta qué momento lo oculté. El chat sale de mi lista y solo veo los
--     mensajes posteriores; si llega uno nuevo, reaparece. La otra persona no ve cambios.
create table if not exists public.conversaciones_ocultas (
    conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
    usuario_id uuid not null references public.perfiles(id) on delete cascade,
    oculta_hasta timestamptz not null default now(),
    primary key (conversacion_id, usuario_id)
);

alter table public.conversaciones_ocultas enable row level security;
revoke all on public.conversaciones_ocultas from anon, authenticated;
grant select on public.conversaciones_ocultas to authenticated;

drop policy if exists "Cada alumno ve sus chats ocultos" on public.conversaciones_ocultas;
create policy "Cada alumno ve sus chats ocultos"
    on public.conversaciones_ocultas for select
    to authenticated
    using (usuario_id = auth.uid());

-- Desde cuándo veo los mensajes de una conversación (-infinity si nunca la oculté)
create or replace function public.chat_visible_desde(p_conversacion_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select oculta_hasta from public.conversaciones_ocultas
         where conversacion_id = p_conversacion_id and usuario_id = auth.uid()),
        '-infinity'::timestamptz
    );
$$;

revoke all on function public.chat_visible_desde(uuid) from public, anon;
grant execute on function public.chat_visible_desde(uuid) to authenticated;

create or replace function public.ocultar_conversacion(p_conversacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1 from public.conversaciones
        where id = p_conversacion_id and auth.uid() in (usuario_a_id, usuario_b_id)
    ) then
        raise exception 'KAMPUZ_CHAT: No encontramos este chat.';
    end if;
    insert into public.conversaciones_ocultas (conversacion_id, usuario_id, oculta_hasta)
    values (p_conversacion_id, auth.uid(), now())
    on conflict (conversacion_id, usuario_id) do update set oculta_hasta = excluded.oculta_hasta;
end;
$$;

revoke all on function public.ocultar_conversacion(uuid) from public, anon;
grant execute on function public.ocultar_conversacion(uuid) to authenticated;

-- Solo leo mensajes de mis conversaciones y posteriores a cuando la oculté.
-- (Realtime aplica la misma regla.)
drop policy if exists "Interlocutores leen mensajes directos" on public.mensajes_directos;
create policy "Interlocutores leen mensajes directos"
    on public.mensajes_directos for select
    to authenticated
    using (
        exists (
            select 1 from public.conversaciones c
            where c.id = mensajes_directos.conversacion_id
              and auth.uid() in (c.usuario_a_id, c.usuario_b_id)
        )
        and creado_en > public.chat_visible_desde(conversacion_id)
    );

-- 3c. "ELIMINAR PARA TODOS" (mensaje propio, dentro de 24 h)
--     Ambos ven "Este mensaje fue eliminado". El texto original se guarda aparte y
--     la app no puede leerlo: solo moderación, para revisar reportes.
alter table public.mensajes_directos add column if not exists eliminado_en timestamptz;

create table if not exists public.mensajes_directos_eliminados (
    mensaje_id uuid primary key references public.mensajes_directos(id) on delete cascade,
    conversacion_id uuid references public.conversaciones(id) on delete cascade,
    autor_id uuid references public.perfiles(id) on delete cascade,
    texto text not null,
    creado_en timestamptz,
    eliminado_en timestamptz not null default now()
);

alter table public.mensajes_directos_eliminados enable row level security;
revoke all on public.mensajes_directos_eliminados from anon, authenticated;
grant select on public.mensajes_directos_eliminados to authenticated;

drop policy if exists "Solo moderacion lee mensajes eliminados" on public.mensajes_directos_eliminados;
create policy "Solo moderacion lee mensajes eliminados"
    on public.mensajes_directos_eliminados for select
    to authenticated
    using (
        exists (
            select 1 from public.perfiles p
            where p.id = auth.uid() and p.rol in ('moderador', 'admin_universidad')
        )
    );

create or replace function public.eliminar_mensaje_para_todos(p_mensaje_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_msj record;
begin
    select * into v_msj from public.mensajes_directos where id = p_mensaje_id for update;
    if not found or v_msj.autor_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_CHAT: Solo puedes eliminar tus propios mensajes.';
    end if;
    if v_msj.eliminado_en is not null then
        return; -- ya estaba eliminado
    end if;
    if v_msj.creado_en < now() - interval '24 hours' then
        raise exception 'KAMPUZ_CHAT: Solo puedes eliminar para todos un mensaje enviado en las últimas 24 horas.';
    end if;

    insert into public.mensajes_directos_eliminados (mensaje_id, conversacion_id, autor_id, texto, creado_en)
    values (v_msj.id, v_msj.conversacion_id, v_msj.autor_id, v_msj.texto, v_msj.creado_en)
    on conflict (mensaje_id) do nothing;

    update public.mensajes_directos
    set texto = '', eliminado_en = now()
    where id = p_mensaje_id;
end;
$$;

revoke all on function public.eliminar_mensaje_para_todos(uuid) from public, anon;
grant execute on function public.eliminar_mensaje_para_todos(uuid) to authenticated;

-- 3d. Bandeja de chats: sin los chats ocultos (salvo que llegue algo nuevo), con el
--     último mensaje y los no leídos posteriores a cuando lo oculté.
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
        case when um.eliminado_en is not null then 'Este mensaje fue eliminado' else um.texto end,
        um.autor_id,
        coalesce(um.creado_en, c.abierta_en),
        (
            select count(*)::integer from public.mensajes_directos m
            where m.conversacion_id = c.id and m.autor_id <> auth.uid() and not m.leido
              and m.creado_en > coalesce(o.oculta_hasta, '-infinity'::timestamptz)
        ),
        c.origen,
        c.publicacion_id,
        pub.titulo,
        public.puede_escribir_conversacion(c.id)
    from public.conversaciones c
    join public.perfiles p
      on p.id = case when c.usuario_a_id = auth.uid() then c.usuario_b_id else c.usuario_a_id end
    left join public.publicaciones pub on pub.id = c.publicacion_id
    left join public.conversaciones_ocultas o
      on o.conversacion_id = c.id and o.usuario_id = auth.uid()
    left join lateral (
        select m.texto, m.autor_id, m.creado_en, m.eliminado_en
        from public.mensajes_directos m
        where m.conversacion_id = c.id
          and m.creado_en > coalesce(o.oculta_hasta, '-infinity'::timestamptz)
        order by m.creado_en desc
        limit 1
    ) um on true
    where auth.uid() in (c.usuario_a_id, c.usuario_b_id)
      and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
      -- oculto: solo vuelve si llegó un mensaje después
      and (o.oculta_hasta is null or um.creado_en is not null)
    order by coalesce(um.creado_en, c.abierta_en) desc;
$$;

revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mis_conversaciones() to authenticated;
