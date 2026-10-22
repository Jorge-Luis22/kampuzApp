-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 013: Login con @usuario sin exponer correos y textos de "Contacto"
-- Sprint de 2 días (docs/PROMPT_SPRINT_2_DIAS.md, punto 1).
-- Idempotente: se puede ejecutar más de una vez.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LOGIN CON @USUARIO
--    obtener_correo_por_identificador (008/009) le devolvía a cualquiera, sin sesión,
--    el correo de un @usuario. Ahora el login con @usuario pasa por la Edge Function
--    `login` (supabase/functions/login), que resuelve el correo con la service role
--    y devuelve solo la sesión. La función pública se elimina.
-- ------------------------------------------------------------------------------
drop function if exists public.obtener_correo_por_identificador(text);

-- ------------------------------------------------------------------------------
-- 2. "CONTACTO" EN LOS MENSAJES DEL SERVIDOR
--    La relación entre dos alumnos que aceptaron una solicitud se llama "Contacto".
--    Mismas reglas que en 010; solo cambian los textos que ve el alumno.
-- ------------------------------------------------------------------------------
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
        return public.asegurar_conversacion(v_sol.de_id, v_sol.a_id);
    end if;
    return null;
end;
$$;

revoke all on function public.responder_solicitud(uuid, boolean) from public, anon;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;
