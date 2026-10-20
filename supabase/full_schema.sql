-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 001: Esquema Inicial
-- Basado en KAMPUS-spec-antigravity.md (Sección 8) y PROMPT_ANTIGRAVITY_MVP.md
-- ==============================================================================

-- Extensión para generación de UUIDs si no está habilitada
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. CONFIGURACIÓN Y CONTROL
-- ------------------------------------------------------------------------------
create table if not exists public.config (
    clave text primary key,
    valor text not null,
    descripcion text,
    actualizado_en timestamp with time zone default now()
);

-- Correos externos autorizados (profesor, jurados, testers sin correo @utp.edu.pe)
create table if not exists public.correos_invitados (
    id uuid primary key default uuid_generate_v4(),
    correo text unique not null,
    nombre_contacto text,
    rol text default 'alumno' check (rol in ('alumno', 'egresado', 'moderador', 'admin_universidad')),
    creado_en timestamp with time zone default now()
);

-- ------------------------------------------------------------------------------
-- 2. CATÁLOGOS INSTITUCIONALES (UTP)
-- ------------------------------------------------------------------------------
create table if not exists public.sedes (
    id uuid primary key default uuid_generate_v4(),
    nombre text unique not null,
    ciudad text,
    activo boolean default true
);

create table if not exists public.carreras (
    id uuid primary key default uuid_generate_v4(),
    codigo text unique not null, -- ej: 'enf', 'psi', 'ind', 'sis'
    nombre text not null,
    facultad text not null,
    activo boolean default true
);

create table if not exists public.cursos (
    id uuid primary key default uuid_generate_v4(),
    carrera_id uuid references public.carreras(id) on delete cascade,
    nombre text not null,
    ciclo_sugerido integer check (ciclo_sugerido between 1 and 10),
    activo boolean default true
);

create table if not exists public.intereses_catalogo (
    id uuid primary key default uuid_generate_v4(),
    nombre text unique not null,
    categoria text default 'general'
);

-- ------------------------------------------------------------------------------
-- 3. PERFILES Y PRIVACIDAD (1 a 1 con auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    correo_institucional text unique not null,
    correo_alterno text,
    nombre text not null,
    apellido text not null,
    foto_url text,
    bio text,
    sede text not null, -- Sede UTP declarada (ej: 'Lima Sur')
    carrera text not null, -- Carrera UTP declarada (ej: 'Enfermería')
    carrera_id uuid references public.carreras(id) on delete set null,
    ciclo integer not null check (ciclo between 1 and 10),
    fecha_nacimiento date not null,
    intereses text[] default '{}',
    origen_campos jsonb default '{
        "nombre": "declarado",
        "apellido": "declarado",
        "correo_institucional": "verificado",
        "carrera": "declarado",
        "ciclo": "declarado",
        "sede": "declarado",
        "fecha_nacimiento": "declarado"
    }'::jsonb,
    rol text default 'alumno' check (rol in ('alumno', 'egresado', 'moderador', 'admin_universidad')),
    creado_en timestamp with time zone default now(),
    actualizado_en timestamp with time zone default now()
);

-- Cuatro consentimientos explícitos bajo Ley 29733 (Sección 6.8 de la spec)
create table if not exists public.consentimientos (
    id uuid primary key default uuid_generate_v4(),
    usuario_id uuid references public.perfiles(id) on delete cascade,
    finalidad text not null check (finalidad in ('cuenta', 'encuestas', 'metricas', 'perfil_universidad')),
    otorgado boolean not null,
    version_politica text not null default '1.0',
    otorgado_en timestamp with time zone default now(),
    revocado_en timestamp with time zone,
    constraint consentimientos_usuario_finalidad_key unique (usuario_id, finalidad)
);

-- ------------------------------------------------------------------------------
-- 4. ESPACIOS, MEMBRESÍAS Y APOYOS (Sección 4 de la spec)
-- ------------------------------------------------------------------------------
-- Tipos de espacio:
--   - carrera_ciclo: Cohorte salón (ej: Enfermería Ciclo 5)
--   - carrera: Toda la carrera ciclos 1 al 10 (donde viven las consultas agrupadas)
--   - taller: Talleres oficiales espejados con horario real
--   - interes: Comunidades propuestas por alumnos
create table if not exists public.espacios (
    id uuid primary key default uuid_generate_v4(),
    tipo text not null check (tipo in ('carrera_ciclo', 'carrera', 'taller', 'interes')),
    nombre text not null,
    descripcion text,
    portada_url text,
    carrera text,
    ciclo integer check (ciclo between 1 and 10),
    sede text not null default 'Lima Sur',
    horario text, -- Horario real visible para talleres (ej: 'Sábados 10:00 - 12:00')
    oficial boolean default false,
    creador_id uuid references public.perfiles(id) on delete set null,
    estado text default 'visible' check (estado in ('visible', 'oculto')),
    umbral_apoyos integer default 15,
    link_inscripcion text,
    creado_en timestamp with time zone default now()
);

create table if not exists public.membresias (
    id uuid primary key default uuid_generate_v4(),
    usuario_id uuid references public.perfiles(id) on delete cascade,
    espacio_id uuid references public.espacios(id) on delete cascade,
    rol text default 'miembro' check (rol in ('miembro', 'admin', 'moderador')),
    desde timestamp with time zone default now(),
    constraint membresias_usuario_espacio_key unique (usuario_id, espacio_id)
);

create table if not exists public.apoyos_propuesta (
    id uuid primary key default uuid_generate_v4(),
    espacio_id uuid references public.espacios(id) on delete cascade,
    usuario_id uuid references public.perfiles(id) on delete cascade,
    creado_en timestamp with time zone default now(),
    constraint apoyos_propuesta_espacio_usuario_key unique (espacio_id, usuario_id)
);

-- ------------------------------------------------------------------------------
-- 5. MENSAJERÍA Y CHAT (GRUPAL Y DIRECTO 1 A 1)
-- ------------------------------------------------------------------------------
create table if not exists public.mensajes (
    id uuid primary key default uuid_generate_v4(),
    espacio_id uuid references public.espacios(id) on delete cascade,
    autor_id uuid references public.perfiles(id) on delete cascade,
    texto text not null,
    creado_en timestamp with time zone default now(),
    editado_en timestamp with time zone
);

-- Solicitudes de contacto 1 a 1 (No hay chat directo libre - Sección 6.4)
create table if not exists public.solicitudes_mensaje (
    id uuid primary key default uuid_generate_v4(),
    de_id uuid references public.perfiles(id) on delete cascade,
    a_id uuid references public.perfiles(id) on delete cascade,
    motivo text,
    estado text default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
    creado_en timestamp with time zone default now(),
    respondido_en timestamp with time zone,
    constraint solicitudes_no_autoenvio check (de_id <> a_id),
    constraint solicitudes_par_unico unique (de_id, a_id)
);

create table if not exists public.conversaciones (
    id uuid primary key default uuid_generate_v4(),
    usuario_a_id uuid references public.perfiles(id) on delete cascade,
    usuario_b_id uuid references public.perfiles(id) on delete cascade,
    abierta_en timestamp with time zone default now(),
    ultimo_mensaje_en timestamp with time zone default now(),
    constraint conversaciones_no_automensaje check (usuario_a_id <> usuario_b_id),
    constraint conversaciones_par_unico unique (usuario_a_id, usuario_b_id)
);

create table if not exists public.mensajes_directos (
    id uuid primary key default uuid_generate_v4(),
    conversacion_id uuid references public.conversaciones(id) on delete cascade,
    autor_id uuid references public.perfiles(id) on delete cascade,
    texto text not null,
    leido boolean default false,
    creado_en timestamp with time zone default now()
);

-- ------------------------------------------------------------------------------
-- 6. CONSULTAS AGRUPADAS Y ASESORÍAS (Flujo 1 - Sección 7.1)
-- ------------------------------------------------------------------------------
create table if not exists public.grupos_consulta (
    id uuid primary key default uuid_generate_v4(),
    carrera text not null,
    curso text not null,
    tema text not null,
    n_alumnos integer default 1,
    estado text default 'abierto' check (estado in ('abierto', 'resuelto')),
    creado_en timestamp with time zone default now(),
    resuelto_en timestamp with time zone
);

create table if not exists public.consultas (
    id uuid primary key default uuid_generate_v4(),
    autor_id uuid references public.perfiles(id) on delete cascade,
    carrera text not null,
    ciclo_autor integer not null,
    curso text not null,
    tema text not null,
    texto text not null,
    estado text default 'abierta' check (estado in ('abierta', 'agrupada', 'resuelta', 'bloqueada')),
    grupo_consulta_id uuid references public.grupos_consulta(id) on delete set null,
    motivo_bloqueo text,
    creado_en timestamp with time zone default now()
);

create table if not exists public.asesorias (
    id uuid primary key default uuid_generate_v4(),
    grupo_consulta_id uuid references public.grupos_consulta(id) on delete cascade,
    asesor_id uuid references public.perfiles(id) on delete cascade,
    modo text not null check (modo in ('mensaje', 'llamada')),
    texto text,
    duracion_segundos integer default 0,
    estrellas_pendientes integer default 0,
    estrellas_acreditadas integer default 0,
    creado_en timestamp with time zone default now()
);

create table if not exists public.valoraciones_asesoria (
    id uuid primary key default uuid_generate_v4(),
    asesoria_id uuid references public.asesorias(id) on delete cascade,
    usuario_id uuid references public.perfiles(id) on delete cascade,
    util boolean not null,
    comentario text,
    creado_en timestamp with time zone default now(),
    constraint valoraciones_asesoria_usuario_key unique (asesoria_id, usuario_id)
);

-- ------------------------------------------------------------------------------
-- 7. ENCUESTAS CON FILTRO Y TOPE SEMANAL (Flujo 3 y Núcleo - Sección 6.5 y 7.4)
-- ------------------------------------------------------------------------------
create table if not exists public.encuestas (
    id uuid primary key default uuid_generate_v4(),
    autor_id uuid references public.perfiles(id) on delete cascade,
    titulo text not null,
    descripcion text,
    filtro jsonb not null default '{}'::jsonb, -- {carrera, cicloMin, cicloMax, edadMin, edadMax, intereses: []}
    alcance_calculado integer default 0,
    alcance_enviado integer default 0,
    estado text default 'borrador' check (estado in ('borrador', 'enviada', 'cerrada')),
    creado_en timestamp with time zone default now()
);

create table if not exists public.preguntas (
    id uuid primary key default uuid_generate_v4(),
    encuesta_id uuid references public.encuestas(id) on delete cascade,
    orden integer not null,
    texto text not null,
    tipo text not null check (tipo in ('unica', 'multiple', 'abierta')),
    opciones jsonb default '[]'::jsonb -- ['Opción 1', 'Opción 2', ...]
);

create table if not exists public.envios_encuesta (
    id uuid primary key default uuid_generate_v4(),
    encuesta_id uuid references public.encuestas(id) on delete cascade,
    destinatario_id uuid references public.perfiles(id) on delete cascade,
    estado text default 'pendiente' check (estado in ('pendiente', 'respondida', 'encolada', 'descartada')),
    enviado_en timestamp with time zone default now(),
    respondido_en timestamp with time zone,
    constraint envios_encuesta_destinatario_key unique (encuesta_id, destinatario_id)
);

create table if not exists public.respuestas (
    id uuid primary key default uuid_generate_v4(),
    envio_id uuid references public.envios_encuesta(id) on delete cascade,
    encuesta_id uuid references public.encuestas(id) on delete cascade,
    pregunta_id uuid references public.preguntas(id) on delete cascade,
    valor jsonb not null, -- texto o arreglo de respuestas seleccionadas
    creado_en timestamp with time zone default now()
);

-- ------------------------------------------------------------------------------
-- 8. CERTIFICADOS, HABILIDADES Y REPORTES (Sección 5 y 10)
-- ------------------------------------------------------------------------------
create table if not exists public.certificados (
    id uuid primary key default uuid_generate_v4(),
    usuario_id uuid references public.perfiles(id) on delete cascade,
    habilidad text not null,
    emisor text not null,
    horas integer default 0,
    nivel text check (nivel in ('Básico', 'Intermedio', 'Avanzado')),
    tiene_evaluacion boolean default false,
    url text,
    archivo_url text,
    origen text default 'con_evidencia' check (origen in ('declarada', 'con_evidencia', 'respaldada', 'verificada')),
    propuesto_por_agente boolean default false,
    aprobado boolean default true,
    creado_en timestamp with time zone default now()
);

create table if not exists public.reportes (
    id uuid primary key default uuid_generate_v4(),
    autor_id uuid references public.perfiles(id) on delete cascade,
    tipo text not null check (tipo in ('mensaje', 'perfil', 'espacio', 'consulta', 'mensaje_directo')),
    objeto_id text not null,
    motivo text not null,
    estado text default 'abierto' check (estado in ('abierto', 'revisado', 'accionado')),
    creado_en timestamp with time zone default now()
);

create table if not exists public.bloqueos (
    id uuid primary key default uuid_generate_v4(),
    bloqueador_id uuid references public.perfiles(id) on delete cascade,
    bloqueado_id uuid references public.perfiles(id) on delete cascade,
    creado_en timestamp with time zone default now(),
    constraint bloqueos_par_unico unique (bloqueador_id, bloqueado_id)
);

-- ------------------------------------------------------------------------------
-- 9. ÍNDICES DE RENDIMIENTO CLAVE
-- ------------------------------------------------------------------------------
create index if not exists idx_perfiles_filtro on public.perfiles(carrera, ciclo, sede);
create index if not exists idx_perfiles_intereses on public.perfiles using gin(intereses);
create index if not exists idx_mensajes_espacio on public.mensajes(espacio_id, creado_en desc);
create index if not exists idx_mensajes_directos_conv on public.mensajes_directos(conversacion_id, creado_en asc);
create index if not exists idx_envios_destinatario_fecha on public.envios_encuesta(destinatario_id, enviado_en desc);
create index if not exists idx_consultas_agrupacion on public.consultas(carrera, curso, tema, estado);
create index if not exists idx_grupos_consulta_clave on public.grupos_consulta(carrera, curso, tema, estado);
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
-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 003: Funciones RPC, Triggers y Reglas en Base de Datos
-- Basado en PROMPT_ANTIGRAVITY_MVP.md (Reglas 3, 4, 5 y Fases 5, 6, 7)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VALIDACIÓN DE CORREO INSTITUCIONAL O INVITADO
-- ------------------------------------------------------------------------------
create or replace function public.validar_correo_institucional()
returns trigger as $$
begin
    if not (
        new.correo_institucional ilike '%@utp.edu.pe'
        or exists (
            select 1 from public.correos_invitados
            where lower(correo) = lower(new.correo_institucional)
        )
    ) then
        raise exception 'Acceso restringido: El correo % no pertenece al dominio @utp.edu.pe ni está en la lista de invitados autorizados.', new.correo_institucional;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_validar_correo_perfil on public.perfiles;
create trigger trg_validar_correo_perfil
    before insert or update of correo_institucional
    on public.perfiles
    for each row
    execute function public.validar_correo_institucional();

-- ------------------------------------------------------------------------------
-- 2. AUTO-ASIGNACIÓN A GRUPO DE CARRERA Y CICLO Y ESPACIO DE CARRERA
-- ------------------------------------------------------------------------------
create or replace function public.auto_asignar_espacios_alumno()
returns trigger as $$
declare
    v_espacio_carrera_id uuid;
    v_espacio_ciclo_id uuid;
    v_nombre_carrera text;
    v_nombre_ciclo text;
begin
    v_nombre_carrera := 'Comunidad de ' || new.carrera || ' UTP';
    v_nombre_ciclo := new.carrera || ' — Ciclo ' || new.ciclo;

    -- 1. Espacio de carrera (Cruza ciclos 1 al 10)
    select id into v_espacio_carrera_id
    from public.espacios
    where tipo = 'carrera' and carrera = new.carrera and sede = new.sede
    limit 1;

    if v_espacio_carrera_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
        values (
            'carrera',
            v_nombre_carrera,
            'Espacio académico general para todos los ciclos de ' || new.carrera || ' ' || new.sede || '. Consultas, orientación y proyectos.',
            '/grupos/carrera_default.jpg',
            new.carrera,
            new.sede,
            false,
            'visible'
        )
        returning id into v_espacio_carrera_id;
    end if;

    -- 2. Espacio de carrera y ciclo (Cohorte de salón)
    select id into v_espacio_ciclo_id
    from public.espacios
    where tipo = 'carrera_ciclo' and carrera = new.carrera and ciclo = new.ciclo and sede = new.sede
    limit 1;

    if v_espacio_ciclo_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, ciclo, sede, oficial, estado)
        values (
            'carrera_ciclo',
            v_nombre_ciclo,
            'Grupo exclusivo de compañeros de salón de ' || new.carrera || ' — Ciclo ' || new.ciclo || ' ' || new.sede || '.',
            '/grupos/ciclo_default.jpg',
            new.carrera,
            new.ciclo,
            new.sede,
            false,
            'visible'
        )
        returning id into v_espacio_ciclo_id;
    end if;

    -- Asegurar membresía en espacio de carrera
    insert into public.membresias (usuario_id, espacio_id, rol)
    values (new.id, v_espacio_carrera_id, 'miembro')
    on conflict (usuario_id, espacio_id) do nothing;

    -- Asegurar membresía en espacio de ciclo
    insert into public.membresias (usuario_id, espacio_id, rol)
    values (new.id, v_espacio_ciclo_id, 'miembro')
    on conflict (usuario_id, espacio_id) do nothing;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_asignar_espacios on public.perfiles;
create trigger trg_auto_asignar_espacios
    after insert or update of carrera, ciclo, sede
    on public.perfiles
    for each row
    execute function public.auto_asignar_espacios_alumno();

-- ------------------------------------------------------------------------------
-- 3. MODERACIÓN DE DOCENTES EN CONSULTAS (Sección 7.1)
-- ------------------------------------------------------------------------------
-- Regla: "Se habla del curso, no de la persona".
-- Regex sin flag /i para nombres propios (Profesor [A-Z]...).
create or replace function public.moderar_consulta_servidor()
returns trigger as $$
declare
    v_menciona_docente boolean;
    v_emite_juicio boolean;
    v_nombre_propio boolean;
begin
    -- 1. Mención a docente con juicio de valor (insensible a mayúsculas)
    v_menciona_docente := new.texto ~* '\m(profe|profesor|profesora|docente|maestro|maestra)\M';
    v_emite_juicio := new.texto ~* '\m(mejor|peor|cuál|recomienda|evita|jala|regala|bueno|malo|filtro|fácil|difícil)\M';

    if v_menciona_docente and v_emite_juicio then
        raise exception 'Moderación activa: Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones o qué material conviene.';
    end if;

    -- 2. Nombre propio de docente: sensible a mayúsculas
    v_nombre_propio := new.texto ~ '\m(profesor|profesora|docente|profe)\s+[A-ZÁÉÍÓÚ]';
    if v_nombre_propio then
        raise exception 'Moderación activa: Mencionaste a un docente por su nombre. En Kampus se habla del curso, no de la persona.';
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_moderar_consulta on public.consultas;
create trigger trg_moderar_consulta
    before insert on public.consultas
    for each row
    execute function public.moderar_consulta_servidor();

-- ------------------------------------------------------------------------------
-- 4. UMBRAL DINÁMICO DE PROPUESTA DE GRUPOS (Sección 7.2)
-- ------------------------------------------------------------------------------
create or replace function public.verificar_umbral_propuesta()
returns trigger as $$
declare
    v_total_apoyos integer;
    v_base_activa integer;
    v_umbral integer;
begin
    -- Contar apoyos acumulados para este espacio
    select count(*) into v_total_apoyos
    from public.apoyos_propuesta
    where espacio_id = new.espacio_id;

    -- Base activa aproximada (usuarios registrados)
    select count(*) into v_base_activa from public.perfiles;
    v_umbral := greatest(15, round(v_base_activa * 0.03));

    if v_total_apoyos >= v_umbral then
        update public.espacios
        set estado = 'visible'
        where id = new.espacio_id and estado = 'oculto';
    end if;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_verificar_umbral_propuesta on public.apoyos_propuesta;
create trigger trg_verificar_umbral_propuesta
    after insert on public.apoyos_propuesta
    for each row
    execute function public.verificar_umbral_propuesta();

-- ------------------------------------------------------------------------------
-- 5. RPC: CALCULAR ALCANCE EN VIVO (Flujo Encuestas - Sección 6.5)
-- Devuelve SOLO un número entero. El emisor NUNCA recibe la lista de personas.
-- ------------------------------------------------------------------------------
create or replace function public.calcular_alcance_encuesta(p_filtro jsonb)
returns integer as $$
declare
    v_carrera text;
    v_ciclo_min integer;
    v_ciclo_max integer;
    v_edad_min integer;
    v_edad_max integer;
    v_intereses text[];
    v_alcance integer;
begin
    v_carrera := nullif(p_filtro->>'carrera', '');
    v_ciclo_min := coalesce((p_filtro->>'cicloMin')::integer, 1);
    v_ciclo_max := coalesce((p_filtro->>'cicloMax')::integer, 10);
    v_edad_min := coalesce((p_filtro->>'edadMin')::integer, 16);
    v_edad_max := coalesce((p_filtro->>'edadMax')::integer, 99);

    if p_filtro ? 'intereses' and jsonb_array_length(p_filtro->'intereses') > 0 then
        select array_agg(elem::text) into v_intereses
        from jsonb_array_elements_text(p_filtro->'intereses') as elem;
    else
        v_intereses := '{}';
    end if;

    select count(*) into v_alcance
    from public.perfiles p
    where p.id <> auth.uid()
      and (v_carrera is null or p.carrera = v_carrera)
      and p.ciclo between v_ciclo_min and v_ciclo_max
      and extract(year from age(p.fecha_nacimiento)) between v_edad_min and v_edad_max
      and (
          array_length(v_intereses, 1) is null 
          or p.intereses && v_intereses
      );

    return v_alcance;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- 6. RPC: ENVÍO SEGURO DE ENCUESTAS (Flujo Encuestas - Sección 5.2, 6.5 y 7.4)
-- Valida umbral mínimo de 30, alcance semanal por nivel, y tope de 3 por semana
-- ------------------------------------------------------------------------------
create or replace function public.enviar_encuesta_segura(
    p_titulo text,
    p_descripcion text,
    p_filtro jsonb,
    p_preguntas jsonb
)
returns jsonb as $$
declare
    v_emisor_id uuid := auth.uid();
    v_umbral_minimo integer := 30;
    v_alcance_total integer;
    v_nivel_investigacion integer := 0;
    v_alcance_semanal integer := 0;
    v_cupo_maximo integer;
    v_encuesta_id uuid;
    v_pregunta record;
    v_dest record;
    v_enviados_count integer := 0;
    v_encolados_count integer := 0;
    v_recibidas_semana integer;
begin
    if v_emisor_id is null then
        raise exception 'Debes estar autenticado para enviar encuestas.';
    end if;

    -- 1. Leer umbral de configuración
    select coalesce(valor::integer, 30) into v_umbral_minimo
    from public.config
    where clave = 'umbral_minimo_segmento';

    -- 2. Calcular alcance del filtro
    v_alcance_total := public.calcular_alcance_encuesta(p_filtro);

    -- Regla dura de umbral mínimo
    if v_alcance_total < v_umbral_minimo then
        raise exception 'Segmento insuficiente (% personas). El mínimo requerido para garantizar el anonimato es % personas. Amplía el rango de ciclos o flexibiliza el filtro.', v_alcance_total, v_umbral_minimo;
    end if;

    -- 3. Calcular nivel de "Apoyo a la investigación" del emisor
    -- Nivel 0 = 0, Nivel 1 = 1 encuesta respondida, Nivel 2 = 3, Nivel 3 = 8
    select count(*) into v_nivel_investigacion
    from public.envios_encuesta
    where destinatario_id = v_emisor_id and estado = 'respondida';

    if v_nivel_investigacion >= 8 then
        v_alcance_semanal := 200;
    elsif v_nivel_investigacion >= 3 then
        v_alcance_semanal := 80;
    elsif v_nivel_investigacion >= 1 then
        v_alcance_semanal := 30;
    else
        v_alcance_semanal := 0;
    end if;

    if v_alcance_semanal = 0 then
        raise exception 'Alcance semanal agotado (0 destinatarios). En Kampus el primer gesto es ayudar: responde una encuesta en tu bandeja para desbloquear 30 envíos.';
    end if;

    v_cupo_maximo := least(v_alcance_total, v_alcance_semanal);

    -- 4. Crear registro de encuesta
    insert into public.encuestas (autor_id, titulo, descripcion, filtro, alcance_calculado, alcance_enviado, estado)
    values (v_emisor_id, p_titulo, p_descripcion, p_filtro, v_alcance_total, v_cupo_maximo, 'enviada')
    returning id into v_encuesta_id;

    -- 5. Insertar preguntas
    for v_pregunta in select * from jsonb_to_recordset(p_preguntas) as x(orden int, texto text, tipo text, opciones jsonb) loop
        insert into public.preguntas (encuesta_id, orden, texto, tipo, opciones)
        values (v_encuesta_id, v_pregunta.orden, v_pregunta.texto, v_pregunta.tipo, coalesce(v_pregunta.opciones, '[]'::jsonb));
    end loop;

    -- 6. Seleccionar muestra aleatoria de destinatarios
    for v_dest in (
        select p.id
        from public.perfiles p
        where p.id <> v_emisor_id
          and (nullif(p_filtro->>'carrera', '') is null or p.carrera = p_filtro->>'carrera')
          and p.ciclo between coalesce((p_filtro->>'cicloMin')::integer, 1) and coalesce((p_filtro->>'cicloMax')::integer, 10)
        order by random()
        limit v_cupo_maximo
    ) loop
        -- Verificar si el alumno ya recibió 3 encuestas esta semana (Tope de 3 / semana)
        select count(*) into v_recibidas_semana
        from public.envios_encuesta
        where destinatario_id = v_dest.id
          and enviado_en >= now() - interval '7 days'
          and estado in ('pendiente', 'respondida');

        if v_recibidas_semana >= 3 then
            -- Excedente a la cola (no se descarta - Sección 6.5)
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado)
            values (v_encuesta_id, v_dest.id, 'encolada');
            v_encolados_count := v_encolados_count + 1;
        else
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado)
            values (v_encuesta_id, v_dest.id, 'pendiente');
            v_enviados_count := v_enviados_count + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'encuesta_id', v_encuesta_id,
        'alcance_calculado', v_alcance_total,
        'enviados', v_enviados_count,
        'encolados', v_encolados_count
    );
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- 7. RPC: OBTENER RESULTADOS AGREGADOS (Ley 29733 - Respuestas Agregadas)
-- ------------------------------------------------------------------------------
create or replace function public.obtener_resultados_encuesta(p_encuesta_id uuid)
returns jsonb as $$
declare
    v_autor_id uuid;
    v_total_respuestas integer;
    v_resultado jsonb;
begin
    select autor_id into v_autor_id from public.encuestas where id = p_encuesta_id;
    if v_autor_id is null then
        raise exception 'Encuesta no encontrada.';
    end if;

    select count(distinct envio_id) into v_total_respuestas
    from public.respuestas
    where encuesta_id = p_encuesta_id;

    select jsonb_build_object(
        'encuesta_id', p_encuesta_id,
        'total_respuestas', v_total_respuestas,
        'preguntas', coalesce(jsonb_agg(
            jsonb_build_object(
                'pregunta_id', pr.id,
                'texto', pr.texto,
                'tipo', pr.tipo,
                'opciones', pr.opciones,
                'conteo_respuestas', (
                    select jsonb_object_agg(coalesce(r.valor #>> '{}', 'Sin respuesta'), count(*))
                    from public.respuestas r
                    where r.pregunta_id = pr.id
                    group by r.pregunta_id
                )
            ) order by pr.orden
        ), '[]'::jsonb)
    ) into v_resultado
    from public.preguntas pr
    where pr.encuesta_id = p_encuesta_id;

    return v_resultado;
end;
$$ language plpgsql security definer;
-- ==============================================================================
-- KAMPUS MVP - SEED DATA INICIAL
-- Semilla con catálogos UTP, talleres oficiales con horario real y configuración
-- ==============================================================================

-- 1. CONFIGURACIÓN DEL SISTEMA
insert into public.config (clave, valor, descripcion)
values 
    ('umbral_minimo_segmento', '30', 'Mínimo de alumnos en un segmento para habilitar el envío de encuestas (Ley 29733)')
on conflict (clave) do update set valor = excluded.valor;

-- 2. CORREOS INVITADOS (Jurado, Profesores, Testers externos sin @utp.edu.pe)
insert into public.correos_invitados (correo, nombre_contacto, rol)
values
    ('profesor.utp.demo@gmail.com', 'Profesor Evaluador UTP', 'moderador'),
    ('jurado.evaluador@gmail.com', 'Jurado Calificador', 'admin_universidad'),
    ('demo.tester1@gmail.com', 'Alumno Tester Invitado 1', 'alumno'),
    ('demo.tester2@gmail.com', 'Alumno Tester Invitado 2', 'alumno')
on conflict (correo) do nothing;

-- 3. SEDES UTP
insert into public.sedes (nombre, ciudad)
values
    ('Lima Sur', 'Lima'),
    ('Lima Centro', 'Lima'),
    ('Lima Norte', 'Lima'),
    ('San Juan de Lurigancho', 'Lima'),
    ('Ate', 'Lima'),
    ('Chimbote', 'Chimbote'),
    ('Arequipa', 'Arequipa'),
    ('Huancayo', 'Huancayo'),
    ('Ica', 'Ica'),
    ('Piura', 'Piura'),
    ('Trujillo', 'Trujillo')
on conflict (nombre) do nothing;

-- 4. CARRERAS UTP
insert into public.carreras (codigo, nombre, facultad)
values
    ('enf', 'Enfermería', 'Ciencias de la Salud'),
    ('psi', 'Psicología', 'Humanidades y Ciencias Sociales'),
    ('ind', 'Ingeniería Industrial', 'Ingeniería'),
    ('sis', 'Ingeniería de Sistemas e Informática', 'Ingeniería'),
    ('der', 'Derecho', 'Derecho'),
    ('adm', 'Administración de Empresas', 'Negocios'),
    ('con', 'Contabilidad', 'Negocios'),
    ('arq', 'Arquitectura', 'Arquitectura'),
    ('com', 'Ciencias de la Comunicación', 'Comunicaciones'),
    ('civ', 'Ingeniería Civil', 'Ingeniería')
on conflict (codigo) do nothing;

-- 5. CURSOS REPRESENTATIVOS POR CARRERA
insert into public.cursos (carrera_id, nombre, ciclo_sugerido)
select id, 'Farmacología Clínica', 5 from public.carreras where codigo = 'enf'
union all
select id, 'Enfermería en Salud del Adulto I', 5 from public.carreras where codigo = 'enf'
union all
select id, 'Bioética y Deontología', 4 from public.carreras where codigo = 'enf'
union all
select id, 'Epidemiología en Salud Pública', 6 from public.carreras where codigo = 'enf'
union all
select id, 'Microbiología y Parasitología Médica', 4 from public.carreras where codigo = 'enf'
union all
select id, 'Anatomía y Fisiología Humana II', 3 from public.carreras where codigo = 'enf'
union all
select id, 'Cuidados Fundamentales de Enfermería', 2 from public.carreras where codigo = 'enf'
union all
select id, 'Psicopatología I', 5 from public.carreras where codigo = 'psi'
union all
select id, 'Pruebas Psicológicas I', 4 from public.carreras where codigo = 'psi'
union all
select id, 'Algoritmos y Estructuras de Datos', 3 from public.carreras where codigo = 'sis'
union all
select id, 'Base de Datos Avanzada', 5 from public.carreras where codigo = 'sis'
union all
select id, 'Investigación de Operaciones I', 5 from public.carreras where codigo = 'ind'
union all
select id, 'Procesos Industriales', 4 from public.carreras where codigo = 'ind';

-- 6. CATÁLOGO DE INTERESES
insert into public.intereses_catalogo (nombre, categoria)
values
    ('Investigación y Tesis', 'academico'),
    ('Salud Comunitaria', 'salud'),
    ('Primeros Auxilios', 'salud'),
    ('Inteligencia Artificial', 'tecnologia'),
    ('Startups y Emprendimiento', 'negocios'),
    ('Fútbol y Futsal', 'deportes'),
    ('Vóley', 'deportes'),
    ('Artes Marciales', 'deportes'),
    ('Fotografía', 'arte'),
    ('Idiomas (Inglés/Portugués)', 'idiomas'),
    ('Lettering y Caligrafía', 'arte'),
    ('Música y Guitarra', 'arte'),
    ('Debate y Oratoria', 'habilidades'),
    ('Voluntariado', 'social')
on conflict (nombre) do nothing;

-- 7. TALLERES OFICIALES ESPEJADOS CON HORARIO REAL (Sección 4 & 7.2)
insert into public.espacios (
    tipo, nombre, descripcion, portada_url, sede, horario, oficial, estado, link_inscripcion
)
values
    (
        'taller',
        'Taller de Lettering y Caligrafía',
        'Taller formativo de expresión gráfica y caligrafía. Registro oficial UTP para actividades de bienestar estudiantil.',
        '/grupos/lettering.jpg',
        'Lima Sur',
        'Sábados 10:00 - 12:00 (Aula 302)',
        true,
        'visible',
        'https://portal.utp.edu.pe/talleres/lettering-2026'
    ),
    (
        'taller',
        'Taller de Futsal UTP Lima Sur',
        'Entrenamientos semanales y preparación para los torneos interfacultades de la universidad.',
        '/grupos/futsal.jpg',
        'Lima Sur',
        'Martes y Jueves 17:00 - 19:00 (Cancha Central)',
        true,
        'visible',
        'https://portal.utp.edu.pe/talleres/futsal-2026'
    ),
    (
        'taller',
        'Taller de Karate Básico',
        'Defensa personal y disciplina tradicional. Actividad deportiva extracurricular oficial.',
        '/grupos/karate.jpg',
        'Lima Sur',
        'Lunes y Miércoles 18:00 - 19:30 (Sala Multiusos)',
        true,
        'visible',
        'https://portal.utp.edu.pe/talleres/karate-2026'
    ),
    (
        'taller',
        'Taller de IA Aplicada a la Universidad',
        'Uso ético y práctico de modelos generativos, automatización de resúmenes y asistencia en investigación.',
        '/grupos/ia.jpg',
        'Lima Sur',
        'Viernes 19:00 - 21:00 (Lab 401)',
        true,
        'visible',
        'https://portal.utp.edu.pe/talleres/ia-2026'
    );

-- 8. ESPACIOS DE CARRERA INICIALES (Cruzan ciclos 1 al 10 - Dónde viven las consultas agrupadas)
insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
values
    (
        'carrera',
        'Comunidad de Enfermería UTP',
        'Espacio general para todos los ciclos (1.° al 10.°) de Enfermería Lima Sur. Consultas de cursos, bancos de preguntas, orientación para prácticas e internado.',
        '/grupos/enfermeria.jpg',
        'Enfermería',
        'Lima Sur',
        false,
        'visible'
    ),
    (
        'carrera',
        'Comunidad de Psicología UTP',
        'Consultas de cursos teóricos y clínicos, orientación de casos formativos y eventos de salud mental.',
        '/grupos/carrera_default.jpg',
        'Psicología',
        'Lima Sur',
        false,
        'visible'
    ),
    (
        'carrera',
        'Comunidad de Ingeniería de Sistemas UTP',
        'Dudas de programación, algoritmos, arquitectura de software, bases de datos y hackathons.',
        '/grupos/carrera_default.jpg',
        'Ingeniería de Sistemas e Informática',
        'Lima Sur',
        false,
        'visible'
    ),
    (
        'carrera',
        'Comunidad de Ingeniería Industrial UTP',
        'Consultas sobre optimización de procesos, investigación operativa, calidad y seguridad industrial.',
        '/grupos/carrera_default.jpg',
        'Ingeniería Industrial',
        'Lima Sur',
        false,
        'visible'
    );

-- 9. GRUPOS DE INTERÉS Y COMUNIDADES INICIALES (Cruzan carreras)
insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, oficial, estado, umbral_apoyos)
values
    (
        'interes',
        'Startups & Emprendimiento UTP',
        'Espacio para founders estudiantiles, validación de ideas de negocio, búsqueda de co-founders y preparación para incubadoras.',
        '/grupos/startup.png',
        'Lima Sur',
        false,
        'visible',
        15
    ),
    (
        'interes',
        'Cinéfilos y Debate UTP',
        'Charlas semanales, ciclos de cine clásico y contemporáneo, y análisis crítico audiovisual.',
        '/grupos/cinefilos.jpg',
        'Lima Sur',
        false,
        'visible',
        15
    );
