-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 005: Habilidades Calculadas (Spec 5.1 & 5.3)
-- Nivel y alcance son derivados de los hechos observados en la base de datos
-- ==============================================================================

create or replace function public.calcular_habilidades_usuario(p_usuario_id uuid)
returns jsonb as $$
declare
    v_encuestas_count integer := 0;
    v_nivel_inv integer := 0;
    v_alcance_semanal integer := 0;

    v_asesorias_count integer := 0;
    v_estrellas_ayuda integer := 0;
    v_nivel_ayu integer := 0;

    v_membresias_count integer := 0;
    v_nivel_con integer := 0;

    v_grupos_creados_count integer := 0;
    v_nivel_lid integer := 0;

    v_resultado jsonb;
begin
    -- 1. Apoyo a la investigación (encuestas respondidas)
    select count(*) into v_encuestas_count
    from public.envios_encuesta
    where destinatario_id = p_usuario_id and estado = 'respondida';

    if v_encuestas_count >= 8 then
        v_nivel_inv := 3;
        v_alcance_semanal := 200;
    elsif v_encuestas_count >= 3 then
        v_nivel_inv := 2;
        v_alcance_semanal := 80;
    elsif v_encuestas_count >= 1 then
        v_nivel_inv := 1;
        v_alcance_semanal := 30;
    else
        v_nivel_inv := 0;
        v_alcance_semanal := 0;
    end if;

    -- 2. Predisposición a ayudar (asesorías valoradas útiles)
    select count(distinct a.id), coalesce(sum(a.estrellas_acreditadas), 0)
    into v_asesorias_count, v_estrellas_ayuda
    from public.asesorias a
    join public.valoraciones_asesoria v on v.asesoria_id = a.id
    where a.asesor_id = p_usuario_id and v.util = true;

    if v_asesorias_count >= 5 then
        v_nivel_ayu := 3;
    elsif v_asesorias_count >= 2 then
        v_nivel_ayu := 2;
    elsif v_asesorias_count >= 1 then
        v_nivel_ayu := 1;
    else
        v_nivel_ayu := 0;
    end if;

    -- 3. Constancia (membresías en talleres y espacios)
    select count(*) into v_membresias_count
    from public.membresias
    where usuario_id = p_usuario_id;

    if v_membresias_count >= 5 then
        v_nivel_con := 3;
    elsif v_membresias_count >= 3 then
        v_nivel_con := 2;
    elsif v_membresias_count >= 1 then
        v_nivel_con := 1;
    else
        v_nivel_con := 0;
    end if;

    -- 4. Liderazgo (grupos de interés creados)
    select count(*) into v_grupos_creados_count
    from public.espacios
    where creador_id = p_usuario_id and tipo = 'interes';

    if v_grupos_creados_count >= 3 then
        v_nivel_lid := 3;
    elsif v_grupos_creados_count >= 2 then
        v_nivel_lid := 2;
    elsif v_grupos_creados_count >= 1 then
        v_nivel_lid := 1;
    else
        v_nivel_lid := 0;
    end if;

    v_resultado := jsonb_build_object(
        'apoyo_investigacion', jsonb_build_object(
            'id', 'apoyo_investigacion',
            'nombre', 'Apoyo a la investigación',
            'nivel', v_nivel_inv,
            'alcance_semanal', v_alcance_semanal,
            'progreso_actual', v_encuestas_count,
            'siguiente_meta', case when v_nivel_inv = 0 then 1 when v_nivel_inv = 1 then 3 else 8 end,
            'estrellas', v_encuestas_count
        ),
        'predisposicion_ayudar', jsonb_build_object(
            'id', 'predisposicion_ayudar',
            'nombre', 'Predisposición a ayudar',
            'nivel', v_nivel_ayu,
            'progreso_actual', v_asesorias_count,
            'siguiente_meta', case when v_nivel_ayu = 0 then 1 when v_nivel_ayu = 1 then 2 else 5 end,
            'estrellas', v_estrellas_ayuda
        ),
        'constancia', jsonb_build_object(
            'id', 'constancia',
            'nombre', 'Constancia',
            'nivel', v_nivel_con,
            'progreso_actual', v_membresias_count,
            'siguiente_meta', case when v_nivel_con = 0 then 1 when v_nivel_con = 1 then 3 else 5 end,
            'estrellas', v_membresias_count
        ),
        'liderazgo', jsonb_build_object(
            'id', 'liderazgo',
            'nombre', 'Liderazgo',
            'nivel', v_nivel_lid,
            'progreso_actual', v_grupos_creados_count,
            'siguiente_meta', case when v_nivel_lid = 0 then 1 when v_nivel_lid = 1 then 2 else 3 end,
            'estrellas', v_grupos_creados_count * 3
        )
    );

    return v_resultado;
end;
$$ language plpgsql security definer;
