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
-- Configuración: Lectura para usuarios autenticados
create policy "Configuracion visible para autenticados"
    on public.config for select
    to authenticated
    using (true);

-- Correos invitados: Solo lectura para verificación durante registro/auth
create policy "Correos invitados visible durante auth"
    on public.correos_invitados for select
    to anon, authenticated
    using (true);

-- Catálogos institucionales: Lectura libre
create policy "Sedes son públicas"
    on public.sedes for select
    to anon, authenticated
    using (activo = true);

create policy "Carreras son públicas"
    on public.carreras for select
    to anon, authenticated
    using (activo = true);

create policy "Cursos son públicos"
    on public.cursos for select
    to anon, authenticated
    using (activo = true);

create policy "Intereses catálogo son públicos"
    on public.intereses_catalogo for select
    to anon, authenticated
    using (true);

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS: PERFILES Y CONSENTIMIENTOS
-- ------------------------------------------------------------------------------
-- Perfiles: Lectura para cualquier alumno autenticado (Explorar, nombres en chat)
create policy "Perfiles visibles para alumnos autenticados"
    on public.perfiles for select
    to authenticated
    using (true);

-- Perfiles: Inserción y actualización solo de su propio perfil
create policy "Usuarios pueden insertar su propio perfil"
    on public.perfiles for insert
    to authenticated
    with check (auth.uid() = id);

create policy "Usuarios pueden actualizar su propio perfil"
    on public.perfiles for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Consentimientos: Estrictamente privados por usuario
create policy "Usuarios gestionan sus propios consentimientos"
    on public.consentimientos for select
    to authenticated
    using (auth.uid() = usuario_id);

create policy "Usuarios insertan sus propios consentimientos"
    on public.consentimientos for insert
    to authenticated
    with check (auth.uid() = usuario_id);

create policy "Usuarios actualizan sus propios consentimientos"
    on public.consentimientos for update
    to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS: ESPACIOS, MEMBRESÍAS Y APOYOS
-- ------------------------------------------------------------------------------
-- Espacios: Visibles si estado es 'visible' o si el usuario es el creador o miembro
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

create policy "Alumnos pueden proponer espacios"
    on public.espacios for insert
    to authenticated
    with check (auth.uid() = creador_id);

create policy "Creador puede actualizar su espacio propuesto"
    on public.espacios for update
    to authenticated
    using (auth.uid() = creador_id);

-- Membresías: Lectura de miembros del espacio
create policy "Membresias visibles para autenticados"
    on public.membresias for select
    to authenticated
    using (true);

create policy "Usuarios pueden unirse a espacios"
    on public.membresias for insert
    to authenticated
    with check (auth.uid() = usuario_id);

create policy "Usuarios pueden salirse de espacios"
    on public.membresias for delete
    to authenticated
    using (auth.uid() = usuario_id);

-- Apoyos a propuestas: Ver apoyos y dar un solo apoyo
create policy "Apoyos visibles para autenticados"
    on public.apoyos_propuesta for select
    to authenticated
    using (true);

create policy "Usuarios pueden apoyar propuestas"
    on public.apoyos_propuesta for insert
    to authenticated
    with check (auth.uid() = usuario_id);

-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS RLS: MENSAJES Y CHAT
-- ------------------------------------------------------------------------------
-- Mensajes de espacios: Solo miembros del espacio leen y escriben
create policy "Miembros leen mensajes del espacio"
    on public.mensajes for select
    to authenticated
    using (
        exists (
            select 1 from public.membresias m
            where m.espacio_id = mensajes.espacio_id and m.usuario_id = auth.uid()
        )
    );

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

-- Solicitudes de mensaje 1 a 1: Solo emisor y receptor
create policy "Participantes ven sus solicitudes de mensaje"
    on public.solicitudes_mensaje for select
    to authenticated
    using (auth.uid() = de_id or auth.uid() = a_id);

create policy "Emisor crea solicitud de mensaje"
    on public.solicitudes_mensaje for insert
    to authenticated
    with check (auth.uid() = de_id);

create policy "Receptor actualiza solicitud de mensaje"
    on public.solicitudes_mensaje for update
    to authenticated
    using (auth.uid() = a_id);

-- Conversaciones 1 a 1: Solo los dos interlocutores
create policy "Interlocutores ven su conversacion"
    on public.conversaciones for select
    to authenticated
    using (auth.uid() = usuario_a_id or auth.uid() = usuario_b_id);

create policy "Creacion de conversacion por participantes"
    on public.conversaciones for insert
    to authenticated
    with check (auth.uid() = usuario_a_id or auth.uid() = usuario_b_id);

-- Mensajes directos: Solo participantes de la conversación
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
create policy "Consultas visibles para autenticados"
    on public.consultas for select
    to authenticated
    using (true);

create policy "Alumnos crean sus propias consultas"
    on public.consultas for insert
    to authenticated
    with check (auth.uid() = autor_id);

create policy "Grupos de consulta son visibles para autenticados"
    on public.grupos_consulta for select
    to authenticated
    using (true);

create policy "Asesorias visibles para participantes"
    on public.asesorias for select
    to authenticated
    using (true);

create policy "Asesor inserta su orientacion"
    on public.asesorias for insert
    to authenticated
    with check (auth.uid() = asesor_id);

create policy "Valoraciones visibles para autenticados"
    on public.valoraciones_asesoria for select
    to authenticated
    using (true);

create policy "Autores de la consulta valoran la asesoria"
    on public.valoraciones_asesoria for insert
    to authenticated
    with check (auth.uid() = usuario_id);

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS: ENCUESTAS Y PROTECCIÓN DE DATOS (Anonimato)
-- ------------------------------------------------------------------------------
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

create policy "Autores crean encuestas"
    on public.encuestas for insert
    to authenticated
    with check (auth.uid() = autor_id);

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

create policy "Autores insertan preguntas en sus encuestas"
    on public.preguntas for insert
    to authenticated
    with check (
        exists (
            select 1 from public.encuestas enc
            where enc.id = preguntas.encuesta_id and enc.autor_id = auth.uid()
        )
    );

-- Envíos de encuesta: El destinatario solo ve sus encuestas asignadas
create policy "Destinatarios ven sus envios asignados"
    on public.envios_encuesta for select
    to authenticated
    using (destinatario_id = auth.uid() or exists (
        select 1 from public.encuestas enc where enc.id = envios_encuesta.encuesta_id and enc.autor_id = auth.uid()
    ));

create policy "Destinatario actualiza su estado de envio"
    on public.envios_encuesta for update
    to authenticated
    using (destinatario_id = auth.uid());

-- Respuestas: PROTECCIÓN ESTRICTA. El emisor NUNCA puede consultar respuestas directas.
-- Solo el usuario que responde puede insertar sus respuestas a través de su envío asignado.
create policy "Destinatario inserta sus respuestas"
    on public.respuestas for insert
    to authenticated
    with check (
        exists (
            select 1 from public.envios_encuesta e
            where e.id = respuestas.envio_id and e.destinatario_id = auth.uid()
        )
    );

-- Nadie lee respuestas individuales de otros. Solo mediante RPC agregada.
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
create policy "Certificados visibles para todos los autenticados"
    on public.certificados for select
    to authenticated
    using (true);

create policy "Usuarios gestionan sus propios certificados"
    on public.certificados for all
    to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);

create policy "Usuarios pueden enviar reportes"
    on public.reportes for insert
    to authenticated
    with check (auth.uid() = autor_id);

create policy "Reportes solo visibles por moderador o creador"
    on public.reportes for select
    to authenticated
    using (
        auth.uid() = autor_id or exists (
            select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('moderador', 'admin_universidad')
        )
    );

create policy "Usuarios gestionan sus propios bloqueos"
    on public.bloqueos for all
    to authenticated
    using (auth.uid() = bloqueador_id)
    with check (auth.uid() = bloqueador_id);

-- ------------------------------------------------------------------------------
-- 9. CONFIGURACIÓN DE SUPABASE REALTIME
-- ------------------------------------------------------------------------------
-- Habilitar replicación Realtime en mensajes de grupos y mensajes directos
alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.mensajes_directos;

-- ------------------------------------------------------------------------------
-- 10. BUCKET DE STORAGE: AVATARES
-- ------------------------------------------------------------------------------
-- Crear bucket de avatares público para lectura y con RLS
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

-- Políticas de Storage en storage.objects
create policy "Avatares son publicos para lectura"
    on storage.objects for select
    to public
    using (bucket_id = 'avatares');

create policy "Usuarios suben avatar en su propia carpeta"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'avatares' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "Usuarios actualizan avatar en su propia carpeta"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'avatares' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "Usuarios eliminan avatar en su propia carpeta"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'avatares' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );
