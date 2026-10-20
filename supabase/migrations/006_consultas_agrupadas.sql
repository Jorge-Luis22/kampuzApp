-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 006: CONSULTAS AGRUPADAS Y ASESORÍAS (Flujo 1 - M19-M22)
-- ==============================================================================

-- 1. RPC para crear o agrupar consultas automáticamente por carrera, curso y tema
create or replace function public.crear_o_agrupar_consulta(
    p_carrera text,
    p_curso text,
    p_tema text,
    p_texto text,
    p_autor_id uuid,
    p_autor_nombre text
)
returns jsonb as $$
declare
    v_existente record;
    v_consulta_id uuid;
    v_autores uuid[];
    v_nombres text[];
begin
    -- 1. Buscar si ya existe una consulta abierta con misma carrera, curso y tema
    select * into v_existente
    from public.consultas
    where lower(trim(carrera)) = lower(trim(p_carrera))
      and lower(trim(curso)) = lower(trim(p_curso))
      and lower(trim(tema)) = lower(trim(p_tema))
      and estado in ('activa', 'respondida')
    limit 1;

    if v_existente.id is not null then
        v_autores := coalesce(v_existente.autores_ids, '{}');
        v_nombres := coalesce(v_existente.autores_nombres, '{}');

        -- Si el autor no estaba ya registrado en esta consulta agrupada, agregarlo
        if not (p_autor_id = any(v_autores)) then
            v_autores := array_append(v_autores, p_autor_id);
            v_nombres := array_append(v_nombres, p_autor_nombre);

            update public.consultas
            set autores_ids = v_autores,
                autores_nombres = v_nombres,
                texto_resumen = v_existente.texto_resumen || E'\n---\n' || p_texto
            where id = v_existente.id;
        end if;
        v_consulta_id := v_existente.id;
    else
        -- Crear nueva consulta
        insert into public.consultas (
            carrera,
            curso,
            tema,
            texto_resumen,
            autores_ids,
            autores_nombres,
            estado
        )
        values (
            trim(p_carrera),
            trim(p_curso),
            trim(p_tema),
            trim(p_texto),
            array[p_autor_id],
            array[p_autor_nombre],
            'activa'
        )
        returning id into v_consulta_id;
    end if;

    return jsonb_build_object(
        'consulta_id', v_consulta_id,
        'agrupada', (v_existente.id is not null)
    );
end;
$$ language plpgsql security definer;

-- 2. Asegurar RLS en consultas, asesorías y valoraciones
alter table public.consultas enable row level security;
alter table public.asesorias enable row level security;
alter table public.valoraciones_asesoria enable row level security;

-- Lectura pública para autenticados
drop policy if exists "Consultas visibles para autenticados" on public.consultas;
create policy "Consultas visibles para autenticados"
    on public.consultas for select
    to authenticated
    using (true);

drop policy if exists "Insercion de consultas para autenticados" on public.consultas;
create policy "Insercion de consultas para autenticados"
    on public.consultas for insert
    to authenticated
    with check (true);

drop policy if exists "Asesorias visibles para autenticados" on public.asesorias;
create policy "Asesorias visibles para autenticados"
    on public.asesorias for select
    to authenticated
    using (true);

drop policy if exists "Alumnos ciclo 5 o superior orientan" on public.asesorias;
create policy "Alumnos ciclo 5 o superior orientan"
    on public.asesorias for insert
    to authenticated
    with check (auth.uid() = asesor_id);

drop policy if exists "Valoraciones visibles para autenticados" on public.valoraciones_asesoria;
create policy "Valoraciones visibles para autenticados"
    on public.valoraciones_asesoria for select
    to authenticated
    using (true);

drop policy if exists "Solo autor valora orientacion" on public.valoraciones_asesoria;
create policy "Solo autor valora orientacion"
    on public.valoraciones_asesoria for insert
    to authenticated
    with check (auth.uid() = evaluador_id);
