-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 009: Autenticación real y validación de dominio en servidor
-- Auditoría (docs/PROMPT_CLAUDE_CODE_AUDITORIA.md, paso 2).
--
-- - La validación de dominio vive SOLO en el servidor (trigger en auth.users).
-- - correos_invitados deja de ser legible por anon/authenticated.
-- - Nombre de usuario único (case-insensitive) y RPC de disponibilidad.
-- - El cliente no puede fijarse rol, correo ni origen de campos en su perfil.
-- - Edad mínima de registro (config edad_minima_registro, 14 por defecto) validada en el servidor.
--
-- Idempotente: se puede ejecutar sobre una base con 001–003 o con 001–008.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORREOS INVITADOS: privados, con estado activo y motivo
-- ------------------------------------------------------------------------------
alter table public.correos_invitados add column if not exists activo boolean not null default true;
alter table public.correos_invitados add column if not exists motivo text;

-- Antes era legible por anon: cualquiera podía listar los correos invitados.
drop policy if exists "Correos invitados visible durante auth" on public.correos_invitados;

-- Placeholders del seed original (correos genéricos que no controla el equipo).
delete from public.correos_invitados
where lower(correo) in (
    'profesor.utp.demo@gmail.com',
    'jurado.evaluador@gmail.com',
    'demo.tester1@gmail.com',
    'demo.tester2@gmail.com'
);

create or replace function public.correo_permitido(p_correo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select p_correo is not null and (
        lower(trim(p_correo)) like '%@utp.edu.pe'
        or exists (
            select 1 from public.correos_invitados ci
            where lower(ci.correo) = lower(trim(p_correo)) and ci.activo
        )
    );
$$;

revoke all on function public.correo_permitido(text) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER DE DOMINIO EN auth.users (reemplaza 004)
--    Supabase devuelve "Database error saving new user" al cliente; el cliente
--    lo traduce a "Este correo no está habilitado en Kampuz".
-- ------------------------------------------------------------------------------
create or replace function public.validar_dominio_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.correo_permitido(new.email) then
        raise exception 'KAMPUZ_CORREO_NO_PERMITIDO: % no es @utp.edu.pe ni está invitado', new.email;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_validar_auth_user on auth.users;
create trigger trg_validar_auth_user
    before insert or update of email on auth.users
    for each row
    execute function public.validar_dominio_auth_user();

-- ------------------------------------------------------------------------------
-- 3. NOMBRE DE USUARIO ÚNICO (@usuario)
-- ------------------------------------------------------------------------------
alter table public.perfiles add column if not exists usuario text;

do $$
begin
    alter table public.perfiles
        add constraint perfiles_usuario_formato check (usuario ~ '^[a-z0-9._]{3,30}$');
exception when duplicate_object then null;
end $$;

create unique index if not exists perfiles_usuario_lower_key on public.perfiles (lower(usuario));

-- ¿Está libre el @usuario? Considera también los nombres reservados en un registro
-- que todavía no terminó su perfil (metadata de auth.users).
create or replace function public.usuario_disponible(p_usuario text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select lower(trim(p_usuario)) ~ '^[a-z0-9._]{3,30}$'
       and not exists (
           select 1 from public.perfiles p
           where lower(p.usuario) = lower(trim(p_usuario))
       )
       and not exists (
           select 1 from auth.users u
           where lower(u.raw_user_meta_data->>'usuario') = lower(trim(p_usuario))
             and u.id is distinct from auth.uid()
             and not exists (select 1 from public.perfiles p2 where p2.id = u.id)
       );
$$;

revoke all on function public.usuario_disponible(text) from public;
grant execute on function public.usuario_disponible(text) to anon, authenticated;

-- Login con @usuario: devuelve el correo de ese usuario, o null si no existe.
create or replace function public.obtener_correo_por_identificador(p_identificador text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_clean text := lower(trim(p_identificador));
    v_correo text;
begin
    if position('@' in v_clean) > 0 then
        return v_clean;
    end if;

    select correo_institucional into v_correo
    from public.perfiles
    where lower(usuario) = v_clean
    limit 1;

    return v_correo;
end;
$$;

revoke all on function public.obtener_correo_por_identificador(text) from public;
grant execute on function public.obtener_correo_por_identificador(text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4a. EDAD MÍNIMA PARA REGISTRARSE (configurable)
--    La spec 6.1 pedía mayores de 18, pero hay alumnos que entran a la UTP desde
--    los 15. Decisión del equipo: edad mínima en config (clave edad_minima_registro),
--    14 por defecto. En Perú, el tratamiento de datos de menores de 14 años requiere
--    el consentimiento de sus padres (reglamento de la Ley 29733); Kampuz no tiene
--    ese flujo, por eso no se baja de 14. Validar con un especialista legal.
-- ------------------------------------------------------------------------------
insert into public.config (clave, valor, descripcion)
values ('edad_minima_registro', '14', 'Edad mínima para crear un perfil en Kampuz (años cumplidos)')
on conflict (clave) do nothing;

create or replace function public.edad_minima_registro()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select greatest(14, coalesce(
        (select nullif(valor, '')::integer from public.config where clave = 'edad_minima_registro'),
        14
    ));
$$;

revoke all on function public.edad_minima_registro() from public, anon;
grant execute on function public.edad_minima_registro() to authenticated;

-- ------------------------------------------------------------------------------
-- 4. PROTECCIÓN DEL PERFIL
--    Las políticas RLS permiten al alumno insertar y editar su fila, pero no deben
--    dejarle cambiarse el rol (escalar a moderador), el correo verificado ni el
--    origen de los campos. SECURITY INVOKER a propósito: current_user es el rol
--    real de la petición (anon/authenticated) y no el dueño de la función.
-- ------------------------------------------------------------------------------
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
as $$
begin
    if current_user not in ('anon', 'authenticated') then
        return new; -- SQL Editor / service_role: sin restricciones
    end if;

    if tg_op = 'INSERT' then
        new.correo_institucional := lower(coalesce(auth.email(), new.correo_institucional));
        new.rol := 'alumno';
        new.origen_campos := default_origen_campos();
        new.creado_en := now();
    else
        new.id := old.id;
        new.correo_institucional := old.correo_institucional;
        new.rol := old.rol;
        new.origen_campos := old.origen_campos;
        new.creado_en := old.creado_en;
    end if;

    if new.usuario is not null then
        new.usuario := lower(trim(new.usuario));
    end if;

    if new.fecha_nacimiento > (current_date - make_interval(years => public.edad_minima_registro()))::date then
        raise exception 'KAMPUZ_EDAD_MINIMA: Para usar Kampuz debes tener al menos % años.', public.edad_minima_registro();
    end if;
    if new.fecha_nacimiento < date '1940-01-01' then
        raise exception 'KAMPUZ_EDAD_MINIMA: Revisa tu fecha de nacimiento.';
    end if;

    new.actualizado_en := now();
    return new;
end;
$$;

create or replace function public.default_origen_campos()
returns jsonb
language sql
immutable
as $$
    select '{
        "nombre": "declarado",
        "apellido": "declarado",
        "correo_institucional": "verificado",
        "carrera": "declarado",
        "ciclo": "declarado",
        "sede": "declarado",
        "fecha_nacimiento": "declarado"
    }'::jsonb;
$$;

drop trigger if exists trg_proteger_perfil on public.perfiles;
create trigger trg_proteger_perfil
    before insert or update on public.perfiles
    for each row
    execute function public.proteger_perfil();
