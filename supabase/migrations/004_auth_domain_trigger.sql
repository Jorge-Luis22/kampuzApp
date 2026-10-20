-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 004: Trigger de Servidor para Dominio @utp.edu.pe
-- Basado en PROMPT_ANTIGRAVITY_MVP.md (Fase 2: Valida en el servidor)
-- ==============================================================================

create or replace function public.validar_dominio_auth_user()
returns trigger as $$
begin
    if not (
        new.email ilike '%@utp.edu.pe'
        or exists (
            select 1 from public.correos_invitados
            where lower(correo) = lower(new.email)
        )
    ) then
        raise exception 'Acceso restringido: El correo % no está autorizado en Kampus. Solo correos @utp.edu.pe o invitados registrados.', new.email;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_validar_auth_user on auth.users;
create trigger trg_validar_auth_user
    before insert on auth.users
    for each row
    execute function public.validar_dominio_auth_user();
