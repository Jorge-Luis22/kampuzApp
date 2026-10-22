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
