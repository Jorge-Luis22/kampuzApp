-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 014: Arreglos de seguridad que marcó la auditoría de Supabase
-- (Security Advisor). No cambia ninguna regla de negocio.
-- Idempotente: se puede ejecutar más de una vez.
-- El tablón del sprint usará la migración 015.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIONES DE TRIGGER: nadie las llama desde la app
--    Un trigger se dispara aunque el usuario no tenga EXECUTE sobre su función
--    (Postgres solo lo exige al crear el trigger), así que se les quita a public,
--    anon y authenticated. Hoy son: auto_asignar_espacios_alumno,
--    cerrar_solicitudes_al_bloquear, clasificar_certificado,
--    descartar_encuestas_al_revocar, moderar_consulta_servidor, proteger_perfil,
--    registrar_historial_consentimiento, tocar_conversacion, validar_consentimiento,
--    validar_correo_institucional, validar_dominio_auth_user y
--    verificar_umbral_propuesta. El bucle incluye cualquier otra de trigger o de
--    event trigger del esquema public (por ejemplo rls_auto_enable).
-- ------------------------------------------------------------------------------
do $$
declare
    f regprocedure;
begin
    for f in
        select p.oid::regprocedure
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
    loop
        execute format('revoke all on function %s from public, anon, authenticated', f);
    end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 2. rls_auto_enable
--    La crea Supabase (opción de activar RLS automáticamente en tablas nuevas); la
--    app no la llama en ningún lado. Si existe, se le quita EXECUTE a anon y
--    authenticated aunque no fuera de trigger.
-- ------------------------------------------------------------------------------
do $$
declare
    f regprocedure;
begin
    for f in
        select p.oid::regprocedure
        from pg_proc p
        where p.proname = 'rls_auto_enable'
          and p.pronamespace in ('public'::regnamespace)
    loop
        execute format('revoke all on function %s from public, anon, authenticated', f);
    end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 3. search_path FIJO (advertencia "Function Search Path Mutable")
--    Sin search_path fijo, quien llama podría anteponer un esquema propio y hacer
--    que la función use sus tablas o funciones. Estas 7 solo usan funciones de
--    Postgres, auth.email() (con esquema) y objetos de public.
-- ------------------------------------------------------------------------------
do $$
declare
    f regprocedure;
begin
    for f in
        select p.oid::regprocedure
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in (
              'proteger_perfil',
              'default_origen_campos',
              'validar_correo_institucional',
              'validar_consentimiento',
              'moderar_consulta_servidor',
              'firma_alumno',
              'clasificar_certificado'
          )
    loop
        execute format('alter function %s set search_path = public', f);
    end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 4. correos_invitados: nadie la lee desde la app
--    Tenía RLS activado y ninguna política (advertencia "RLS Enabled No Policy").
--    Solo la consultan funciones del servidor con security definer
--    (correo_permitido, que usa el trigger de auth.users, y
--    validar_correo_institucional), que no dependen de estos permisos.
--    Se deja explícito: sin permisos de tabla y una política que lo niega todo.
-- ------------------------------------------------------------------------------
alter table public.correos_invitados enable row level security;
revoke all on table public.correos_invitados from public, anon, authenticated;

drop policy if exists "Nadie accede a correos_invitados desde la app" on public.correos_invitados;
create policy "Nadie accede a correos_invitados desde la app"
    on public.correos_invitados
    for all
    to anon, authenticated
    using (false)
    with check (false);
