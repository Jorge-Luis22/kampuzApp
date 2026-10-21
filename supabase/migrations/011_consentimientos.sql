-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 011: Cuatro consentimientos separados (spec 6.8, Ley 29733)
-- Auditoría (docs/PROMPT_CLAUDE_CODE_AUDITORIA.md, paso 4).
--
--   1 cuenta              Crear la cuenta                       Activo y bloqueado ("Necesario")
--   2 encuestas           Recibir encuestas de otros alumnos    Activo
--   3 metricas            Métricas agregadas para la universidad Activo
--   4 perfil_universidad  Compartir mi perfil de habilidades    APAGADO
--
-- - Cada cambio queda en consentimientos_historial (demostrable: quién, qué, versión, cuándo).
-- - El consentimiento 1 no se revoca desde la app: para eso está "Eliminar mi cuenta".
-- - Las encuestas solo llegan a quien tiene el consentimiento 2 otorgado.
-- Idempotente.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Reglas sobre la fila vigente
-- ------------------------------------------------------------------------------
create or replace function public.validar_consentimiento()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if new.finalidad = 'cuenta' and not new.otorgado then
            raise exception 'KAMPUZ_CONSENTIMIENTO: El consentimiento para tener una cuenta es necesario. Si no lo quieres, elimina tu cuenta.';
        end if;
        -- Las fechas las pone el servidor
        if tg_op = 'INSERT' or new.otorgado is distinct from old.otorgado then
            if new.otorgado then
                new.otorgado_en := now();
                new.revocado_en := null;
            else
                new.revocado_en := now();
                if tg_op = 'INSERT' then
                    new.otorgado_en := null;
                end if;
            end if;
        else
            new.otorgado_en := old.otorgado_en;
            new.revocado_en := old.revocado_en;
        end if;
    end if;
    return new;
end;
$$;

-- otorgado_en tenía default now(): una fila "no otorgada" quedaba con fecha de otorgamiento
alter table public.consentimientos alter column otorgado_en drop default;

drop trigger if exists trg_validar_consentimiento on public.consentimientos;
create trigger trg_validar_consentimiento
    before insert or update on public.consentimientos
    for each row
    execute function public.validar_consentimiento();

-- ------------------------------------------------------------------------------
-- 2. Historial demostrable (solo lectura para el propio alumno)
-- ------------------------------------------------------------------------------
create table if not exists public.consentimientos_historial (
    id uuid primary key default uuid_generate_v4(),
    usuario_id uuid references public.perfiles(id) on delete cascade,
    finalidad text not null,
    otorgado boolean not null,
    version_politica text not null,
    registrado_en timestamp with time zone not null default now()
);

alter table public.consentimientos_historial enable row level security;

drop policy if exists "Alumno ve su historial de consentimientos" on public.consentimientos_historial;
create policy "Alumno ve su historial de consentimientos"
    on public.consentimientos_historial for select
    to authenticated
    using (usuario_id = auth.uid());

create index if not exists idx_consentimientos_historial_usuario
    on public.consentimientos_historial (usuario_id, registrado_en desc);

create or replace function public.registrar_historial_consentimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' or new.otorgado is distinct from old.otorgado
       or new.version_politica is distinct from old.version_politica then
        insert into public.consentimientos_historial (usuario_id, finalidad, otorgado, version_politica)
        values (new.usuario_id, new.finalidad, new.otorgado, new.version_politica);
    end if;
    return new;
end;
$$;

drop trigger if exists trg_historial_consentimiento on public.consentimientos;
create trigger trg_historial_consentimiento
    after insert or update on public.consentimientos
    for each row
    execute function public.registrar_historial_consentimiento();

-- Nadie borra consentimientos desde la app (se borran solo con la cuenta, en cascada)
drop policy if exists "Usuarios borran sus consentimientos" on public.consentimientos;

-- ------------------------------------------------------------------------------
-- 3. Las encuestas solo llegan a quien aceptó recibirlas (consentimiento 2)
-- ------------------------------------------------------------------------------
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
    join public.consentimientos c
      on c.usuario_id = p.id and c.finalidad = 'encuestas' and c.otorgado
    where p.id is distinct from p_emisor
      and (cardinality(v_carreras) = 0 or p.carrera = any(v_carreras))
      and p.ciclo between v_ciclo_min and v_ciclo_max
      and extract(year from age(p.fecha_nacimiento)) between v_edad_min and v_edad_max
      and (cardinality(v_intereses) = 0 or p.intereses && v_intereses);
end;
$$;

revoke all on function public.destinatarios_filtro(jsonb, uuid) from public, anon, authenticated;

-- Si alguien revoca el consentimiento 2, lo que tenía en cola o pendiente se descarta.
create or replace function public.descartar_encuestas_al_revocar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.finalidad = 'encuestas' and not new.otorgado then
        update public.envios_encuesta
        set estado = 'descartada'
        where destinatario_id = new.usuario_id and estado in ('pendiente', 'encolada');
    end if;
    return new;
end;
$$;

drop trigger if exists trg_descartar_encuestas_al_revocar on public.consentimientos;
create trigger trg_descartar_encuestas_al_revocar
    after insert or update of otorgado on public.consentimientos
    for each row
    execute function public.descartar_encuestas_al_revocar();
