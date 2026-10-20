-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 001: Esquema Inicial
-- Basado en KAMPUS-spec-antigravity.md (Sección 8) y PROMPT_ANTIGRAVITY_MVP.md
-- ==============================================================================

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
    codigo text unique not null,
    nombre text not null,
    facultad text not null,
    activo boolean default true
);

create table if not exists public.cursos (
    id uuid primary key default uuid_generate_v4(),
    carrera_id uuid references public.carreras(id) on delete cascade,
    nombre text not null,
    ciclo_sugerido integer check (ciclo_sugerido between 1 and 10),
    activo boolean default true,
    constraint cursos_carrera_nombre_key unique (carrera_id, nombre)
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
    sede text not null,
    carrera text not null,
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
-- 4. ESPACIOS, MEMBRESÍAS Y APOYOS
-- ------------------------------------------------------------------------------
create table if not exists public.espacios (
    id uuid primary key default uuid_generate_v4(),
    tipo text not null check (tipo in ('carrera_ciclo', 'carrera', 'taller', 'interes')),
    nombre text not null,
    descripcion text,
    portada_url text,
    carrera text,
    ciclo integer check (ciclo between 1 and 10),
    sede text not null default 'Lima Sur',
    horario text,
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
-- 5. MENSAJERÍA Y CHAT
-- ------------------------------------------------------------------------------
create table if not exists public.mensajes (
    id uuid primary key default uuid_generate_v4(),
    espacio_id uuid references public.espacios(id) on delete cascade,
    autor_id uuid references public.perfiles(id) on delete cascade,
    texto text not null,
    creado_en timestamp with time zone default now(),
    editado_en timestamp with time zone
);

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
-- 6. CONSULTAS Y ASESORÍAS
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
-- 7. ENCUESTAS CON FILTRO
-- ------------------------------------------------------------------------------
create table if not exists public.encuestas (
    id uuid primary key default uuid_generate_v4(),
    autor_id uuid references public.perfiles(id) on delete cascade,
    titulo text not null,
    descripcion text,
    filtro jsonb not null default '{}'::jsonb,
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
    opciones jsonb default '[]'::jsonb
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
    valor jsonb not null,
    creado_en timestamp with time zone default now()
);

-- ------------------------------------------------------------------------------
-- 8. CERTIFICADOS, REPORTES Y BLOQUEOS
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
-- 9. ÍNDICES DE RENDIMIENTO
-- ------------------------------------------------------------------------------
create index if not exists idx_perfiles_filtro on public.perfiles(carrera, ciclo, sede);
create index if not exists idx_perfiles_intereses on public.perfiles using gin(intereses);
create index if not exists idx_mensajes_espacio on public.mensajes(espacio_id, creado_en desc);
create index if not exists idx_mensajes_directos_conv on public.mensajes_directos(conversacion_id, creado_en asc);
create index if not exists idx_envios_destinatario_fecha on public.envios_encuesta(destinatario_id, enviado_en desc);
create index if not exists idx_consultas_agrupacion on public.consultas(carrera, curso, tema, estado);
create index if not exists idx_grupos_consulta_clave on public.grupos_consulta(carrera, curso, tema, estado);
