-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 002: Row Level Security (RLS), Realtime y Storage
-- Basado en PROMPT_ANTIGRAVITY_MVP.md (Regla 2 de Seguridad y Especificaciones)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ACTIVACIÓN DE RLS EN TODAS LAS TABLAS
-- ------------------------------------------------------------------------------
alter table public.config enable row level security;
alter table public.correos_invitados enable row level security;
alter table public.sedes enable row level security;
alter table public.carreras enable row level security;
alter table public.cursos enable row level security;
alter table public.intereses_catalogo enable row level security;
alter table public.perfiles enable row level security;
alter table public.consentimientos enable row level security;
alter table public.espacios enable row level security;
alter table public.membresias enable row level security;
alter table public.apoyos_propuesta enable row level security;
alter table public.mensajes enable row level security;
alter table public.solicitudes_mensaje enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes_directos enable row level security;
alter table public.grupos_consulta enable row level security;
alter table public.consultas enable row level security;
alter table public.asesorias enable row level security;
alter table public.valoraciones_asesoria enable row level security;
alter table public.encuestas enable row level security;
alter table public.preguntas enable row level security;
alter table public.envios_encuesta enable row level security;
alter table public.respuestas enable row level security;
alter table public.certificados enable row level security;
alter table public.reportes enable row level security;
alter table public.bloqueos enable row level security;

-- ------------------------------------------------------------------------------
-- 2. POLÍTICAS RLS: CATÁLOGOS Y CONFIGURACIÓN PÚBLICA / AUTENTICADA
-- ------------------------------------------------------------------------------
drop policy if exists "Configuracion visible para autenticados" on public.config;
create policy "Configuracion visible para autenticados"
    on public.config for select
    to authenticated
    using (true);

drop policy if exists "Correos invitados visible durante auth" on public.correos_invitados;
create policy "Correos invitados visible durante auth"
    on public.correos_invitados for select
    to anon, authenticated
    using (true);

drop policy if exists "Sedes son públicas" on public.sedes;
create policy "Sedes son públicas"
    on public.sedes for select
    to anon, authenticated
    using (activo = true);

drop policy if exists "Carreras son públicas" on public.carreras;
create policy "Carreras son públicas"
    on public.carreras for select
    to anon, authenticated
    using (activo = true);

drop policy if exists "Cursos son públicos" on public.cursos;
create policy "Cursos son públicos"
    on public.cursos for select
    to anon, authenticated
    using (activo = true);

drop policy if exists "Intereses catálogo son públicos" on public.intereses_catalogo;
create policy "Intereses catálogo son públicos"
    on public.intereses_catalogo for select
    to anon, authenticated
    using (true);

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS: PERFILES Y CONSENTIMIENTOS
-- ------------------------------------------------------------------------------
drop policy if exists "Perfiles visibles para alumnos autenticados" on public.perfiles;
create policy "Perfiles visibles para alumnos autenticados"
    on public.perfiles for select
    to authenticated
    using (true);

drop policy if exists "Usuarios pueden insertar su propio perfil" on public.perfiles;
create policy "Usuarios pueden insertar su propio perfil"
    on public.perfiles for insert
    to authenticated
    with check (auth.uid() = id);

drop policy if exists "Usuarios pueden actualizar su propio perfil" on public.perfiles;
create policy "Usuarios pueden actualizar su propio perfil"
    on public.perfiles for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

drop policy if exists "Usuarios gestionan sus propios consentimientos" on public.consentimientos;
create policy "Usuarios gestionan sus propios consentimientos"
    on public.consentimientos for select
    to authenticated
    using (auth.uid() = usuario_id);

drop policy if exists "Usuarios insertan sus propios consentimientos" on public.consentimientos;
create policy "Usuarios insertan sus propios consentimientos"
    on public.consentimientos for insert
    to authenticated
    with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios actualizan sus propios consentimientos" on public.consentimientos;
create policy "Usuarios actualizan sus propios consentimientos"
    on public.consentimientos for update
    to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS: ESPACIOS, MEMBRESÍAS Y APOYOS
-- ------------------------------------------------------------------------------
drop policy if exists "Espacios visibles para autenticados" on public.espacios;
create policy "Espacios visibles para autenticados"
    on public.espacios for select
    to authenticated
    using (
        estado = 'visible' 
        or creador_id = auth.uid()
        or exists (
            select 1 from public.membresias m 
            where m.espacio_id = espacios.id and m.usuario_id = auth.uid()
        )
    );

drop policy if exists "Alumnos pueden proponer espacios" on public.espacios;
create policy "Alumnos pueden proponer espacios"
    on public.espacios for insert
    to authenticated
    with check (auth.uid() = creador_id);

drop policy if exists "Creador puede actualizar su espacio propuesto" on public.espacios;
create policy "Creador puede actualizar su espacio propuesto"
    on public.espacios for update
    to authenticated
    using (auth.uid() = creador_id);

drop policy if exists "Membresias visibles para autenticados" on public.membresias;
create policy "Membresias visibles para autenticados"
    on public.membresias for select
    to authenticated
    using (true);

drop policy if exists "Usuarios pueden unirse a espacios" on public.membresias;
create policy "Usuarios pueden unirse a espacios"
    on public.membresias for insert
    to authenticated
    with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios pueden salirse de espacios" on public.membresias;
create policy "Usuarios pueden salirse de espacios"
    on public.membresias for delete
    to authenticated
    using (auth.uid() = usuario_id);

drop policy if exists "Apoyos visibles para autenticados" on public.apoyos_propuesta;
create policy "Apoyos visibles para autenticados"
    on public.apoyos_propuesta for select
    to authenticated
    using (true);

drop policy if exists "Usuarios pueden apoyar propuestas" on public.apoyos_propuesta;
create policy "Usuarios pueden apoyar propuestas"
    on public.apoyos_propuesta for insert
    to authenticated
    with check (auth.uid() = usuario_id);

-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS RLS: MENSAJES Y CHAT
-- ------------------------------------------------------------------------------
drop policy if exists "Miembros leen mensajes del espacio" on public.mensajes;
create policy "Miembros leen mensajes del espacio"
    on public.mensajes for select
    to authenticated
    using (
        exists (
            select 1 from public.membresias m
            where m.espacio_id = mensajes.espacio_id and m.usuario_id = auth.uid()
        )
    );

drop policy if exists "Miembros escriben mensajes en el espacio" on public.mensajes;
create policy "Miembros escriben mensajes en el espacio"
    on public.mensajes for insert
    to authenticated
    with check (
        auth.uid() = autor_id and
        exists (
            select 1 from public.membresias m
            where m.espacio_id = mensajes.espacio_id and m.usuario_id = auth.uid()
        )
    );

drop policy if exists "Participantes ven sus solicitudes de mensaje" on public.solicitudes_mensaje;
create policy "Participantes ven sus solicitudes de mensaje"
    on public.solicitudes_mensaje for select
    to authenticated
    using (auth.uid() = de_id or auth.uid() = a_id);

drop policy if exists "Emisor crea solicitud de mensaje" on public.solicitudes_mensaje;
create policy "Emisor crea solicitud de mensaje"
    on public.solicitudes_mensaje for insert
    to authenticated
    with check (auth.uid() = de_id);

drop policy if exists "Receptor actualiza solicitud de mensaje" on public.solicitudes_mensaje;
create policy "Receptor actualiza solicitud de mensaje"
    on public.solicitudes_mensaje for update
    to authenticated
    using (auth.uid() = a_id);

drop policy if exists "Interlocutores ven su conversacion" on public.conversaciones;
create policy "Interlocutores ven su conversacion"
    on public.conversaciones for select
    to authenticated
    using (auth.uid() = usuario_a_id or auth.uid() = usuario_b_id);

drop policy if exists "Creacion de conversacion por participantes" on public.conversaciones;
create policy "Creacion de conversacion por participantes"
    on public.conversaciones for insert
    to authenticated
    with check (auth.uid() = usuario_a_id or auth.uid() = usuario_b_id);

drop policy if exists "Interlocutores leen mensajes directos" on public.mensajes_directos;
create policy "Interlocutores leen mensajes directos"
    on public.mensajes_directos for select
    to authenticated
    using (
        exists (
            select 1 from public.conversaciones c
            where c.id = mensajes_directos.conversacion_id
              and (c.usuario_a_id = auth.uid() or c.usuario_b_id = auth.uid())
        )
    );

drop policy if exists "Interlocutores envian mensajes directos" on public.mensajes_directos;
create policy "Interlocutores envian mensajes directos"
    on public.mensajes_directos for insert
    to authenticated
    with check (
        auth.uid() = autor_id and
        exists (
            select 1 from public.conversaciones c
            where c.id = mensajes_directos.conversacion_id
              and (c.usuario_a_id = auth.uid() or c.usuario_b_id = auth.uid())
        )
    );

drop policy if exists "Receptor actualiza leido en mensaje directo" on public.mensajes_directos;
create policy "Receptor actualiza leido en mensaje directo"
    on public.mensajes_directos for update
    to authenticated
    using (
        exists (
            select 1 from public.conversaciones c
            where c.id = mensajes_directos.conversacion_id
              and (c.usuario_a_id = auth.uid() or c.usuario_b_id = auth.uid())
              and mensajes_directos.autor_id <> auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS RLS: CONSULTAS Y ASESORÍAS
-- ------------------------------------------------------------------------------
drop policy if exists "Consultas visibles para autenticados" on public.consultas;
create policy "Consultas visibles para autenticados"
    on public.consultas for select
    to authenticated
    using (true);

drop policy if exists "Alumnos crean sus propias consultas" on public.consultas;
create policy "Alumnos crean sus propias consultas"
    on public.consultas for insert
    to authenticated
    with check (auth.uid() = autor_id);

drop policy if exists "Grupos de consulta son visibles para autenticados" on public.grupos_consulta;
create policy "Grupos de consulta son visibles para autenticados"
    on public.grupos_consulta for select
    to authenticated
    using (true);

drop policy if exists "Asesorias visibles para participantes" on public.asesorias;
create policy "Asesorias visibles para participantes"
    on public.asesorias for select
    to authenticated
    using (true);

drop policy if exists "Asesor inserta su orientacion" on public.asesorias;
create policy "Asesor inserta su orientacion"
    on public.asesorias for insert
    to authenticated
    with check (auth.uid() = asesor_id);

drop policy if exists "Valoraciones visibles para autenticados" on public.valoraciones_asesoria;
create policy "Valoraciones visibles para autenticados"
    on public.valoraciones_asesoria for select
    to authenticated
    using (true);

drop policy if exists "Autores de la consulta valoran la asesoria" on public.valoraciones_asesoria;
create policy "Autores de la consulta valoran la asesoria"
    on public.valoraciones_asesoria for insert
    to authenticated
    with check (auth.uid() = usuario_id);

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS: ENCUESTAS Y PROTECCIÓN DE DATOS
-- ------------------------------------------------------------------------------
drop policy if exists "Encuestas visibles para creador y destinatarios asignados" on public.encuestas;
create policy "Encuestas visibles para creador y destinatarios asignados"
    on public.encuestas for select
    to authenticated
    using (
        autor_id = auth.uid()
        or exists (
            select 1 from public.envios_encuesta e
            where e.encuesta_id = encuestas.id and e.destinatario_id = auth.uid()
        )
    );

drop policy if exists "Autores crean encuestas" on public.encuestas;
create policy "Autores crean encuestas"
    on public.encuestas for insert
    to authenticated
    with check (auth.uid() = autor_id);

drop policy if exists "Preguntas visibles para autor y destinatarios" on public.preguntas;
create policy "Preguntas visibles para autor y destinatarios"
    on public.preguntas for select
    to authenticated
    using (
        exists (
            select 1 from public.encuestas enc
            where enc.id = preguntas.encuesta_id
              and (
                  enc.autor_id = auth.uid()
                  or exists (
                      select 1 from public.envios_encuesta e
                      where e.encuesta_id = enc.id and e.destinatario_id = auth.uid()
                  )
              )
        )
    );

drop policy if exists "Autores insertan preguntas en sus encuestas" on public.preguntas;
create policy "Autores insertan preguntas en sus encuestas"
    on public.preguntas for insert
    to authenticated
    with check (
        exists (
            select 1 from public.encuestas enc
            where enc.id = preguntas.encuesta_id and enc.autor_id = auth.uid()
        )
    );

drop policy if exists "Destinatarios ven sus envios asignados" on public.envios_encuesta;
create policy "Destinatarios ven sus envios asignados"
    on public.envios_encuesta for select
    to authenticated
    using (destinatario_id = auth.uid() or exists (
        select 1 from public.encuestas enc where enc.id = envios_encuesta.encuesta_id and enc.autor_id = auth.uid()
    ));

drop policy if exists "Destinatario actualiza su estado de envio" on public.envios_encuesta;
create policy "Destinatario actualiza su estado de envio"
    on public.envios_encuesta for update
    to authenticated
    using (destinatario_id = auth.uid());

drop policy if exists "Destinatario inserta sus respuestas" on public.respuestas;
create policy "Destinatario inserta sus respuestas"
    on public.respuestas for insert
    to authenticated
    with check (
        exists (
            select 1 from public.envios_encuesta e
            where e.id = respuestas.envio_id and e.destinatario_id = auth.uid()
        )
    );

drop policy if exists "Nadie lee respuestas individuales ajenas directamente" on public.respuestas;
create policy "Nadie lee respuestas individuales ajenas directamente"
    on public.respuestas for select
    to authenticated
    using (
        exists (
            select 1 from public.envios_encuesta e
            where e.id = respuestas.envio_id and e.destinatario_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS RLS: CERTIFICADOS, REPORTES Y BLOQUEOS
-- ------------------------------------------------------------------------------
drop policy if exists "Certificados visibles para todos los autenticados" on public.certificados;
create policy "Certificados visibles para todos los autenticados"
    on public.certificados for select
    to authenticated
    using (true);

drop policy if exists "Usuarios gestionan sus propios certificados" on public.certificados;
create policy "Usuarios gestionan sus propios certificados"
    on public.certificados for all
    to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios pueden enviar reportes" on public.reportes;
create policy "Usuarios pueden enviar reportes"
    on public.reportes for insert
    to authenticated
    with check (auth.uid() = autor_id);

drop policy if exists "Reportes solo visibles por moderador o creador" on public.reportes;
create policy "Reportes solo visibles por moderador o creador"
    on public.reportes for select
    to authenticated
    using (
        auth.uid() = autor_id or exists (
            select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('moderador', 'admin_universidad')
        )
    );

drop policy if exists "Usuarios gestionan sus propios bloqueos" on public.bloqueos;
create policy "Usuarios gestionan sus propios bloqueos"
    on public.bloqueos for all
    to authenticated
    using (auth.uid() = bloqueador_id)
    with check (auth.uid() = bloqueador_id);

-- ------------------------------------------------------------------------------
-- 9. CONFIGURACIÓN DE SUPABASE REALTIME
-- ------------------------------------------------------------------------------
do $$
begin
    begin
        alter publication supabase_realtime add table public.mensajes;
    exception when others then null;
    end;
    begin
        alter publication supabase_realtime add table public.mensajes_directos;
    exception when others then null;
    end;
end $$;

-- ------------------------------------------------------------------------------
-- 10. BUCKET DE STORAGE: AVATARES
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatares son publicos para lectura" on storage.objects;
create policy "Avatares son publicos para lectura"
    on storage.objects for select
    to public
    using (bucket_id = 'avatares');

drop policy if exists "Usuarios suben avatar en su propia carpeta" on storage.objects;
create policy "Usuarios suben avatar en su propia carpeta"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'avatares' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Usuarios actualizan avatar en su propia carpeta" on storage.objects;
create policy "Usuarios actualizan avatar en su propia carpeta"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'avatares' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Usuarios eliminan avatar en su propia carpeta" on storage.objects;
create policy "Usuarios eliminan avatar en su propia carpeta"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'avatares' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );
