-- ==============================================================================
-- KAMPUZ - ESQUEMA COMPLETO (generado): migraciones 001 a 016 + seed, en orden.
-- Úsalo solo para crear una base NUEVA desde cero. Es idempotente (se puede
-- ejecutar dos veces). Para actualizar la base existente, ejecuta las que falten
-- (ver docs/GUIA_PILOTO.md, sección 0).
-- Se genera con: node scripts/generar_full_schema.mjs
-- ==============================================================================

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

-- ==============================================================================
-- KAMPUS MVP - MIGRACIÓN 006: CONSULTAS AGRUPADAS (reemplazada)
--
-- La versión original de este archivo usaba columnas que no existen en el esquema
-- de 001 (consultas.autores_ids, consultas.texto_resumen, asesorias.consulta_id,
-- valoraciones_asesoria.evaluador_id, estados 'activa'/'respondida') y fallaba al
-- aplicarse en una base nueva ("column evaluador_id does not exist"). Nunca llegó
-- a la base de producción.
--
-- El flujo de consultas se reimplementa sobre el esquema de 001
-- (grupos_consulta + consultas + asesorias + valoraciones_asesoria) en
-- 012_reglas_servidor.sql. Este archivo queda vacío para que la secuencia
-- 001 → 012 sea reproducible desde cero.
-- ==============================================================================

drop function if exists public.crear_o_agrupar_consulta(text, text, text, text, uuid, text);

-- Migration 007: Procedimiento seguro para eliminación irreversible de cuenta (Google Play Store compliance)
-- Permite al estudiante solicitar el borrado total de sus datos y de su cuenta de autenticación.

CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- 1. Eliminar fotos de perfil y archivos de storage del usuario
  DELETE FROM storage.objects 
  WHERE bucket_id = 'avatares' 
    AND (name LIKE v_user_id || '/%' OR name LIKE v_user_id || '.%' OR owner = v_user_id::text);

  -- 2. Eliminar explícitamente registros relacionados si no tuviesen cascade
  DELETE FROM public.respuestas WHERE usuario_id = v_user_id;
  DELETE FROM public.consentimientos WHERE usuario_id = v_user_id;
  DELETE FROM public.perfiles WHERE id = v_user_id;

  -- 3. Eliminar usuario de auth.users (el trigger ON DELETE CASCADE de la FK perfiles se encarga del resto)
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'message', 'Cuenta y datos personales eliminados con éxito.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;

-- Política de actualización de reportes para moderadores (M33)
DROP POLICY IF EXISTS "Moderadores pueden actualizar estado de reportes" ON public.reportes;
CREATE POLICY "Moderadores pueden actualizar estado de reportes"
    ON public.reportes FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('moderador', 'admin_universidad')
        )
    );

-- Migration 008: Soporte para Nombre de Usuario y Autenticación con Contraseña
-- Agrega columna usuario única en perfiles y función para login con usuario o correo.

ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS usuario text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_perfiles_usuario ON public.perfiles(usuario);

-- Función segura para obtener el correo a partir del nombre de usuario o email
CREATE OR REPLACE FUNCTION public.obtener_correo_por_identificador(p_identificador text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correo text;
  v_clean text := lower(trim(p_identificador));
BEGIN
  -- Si ya contiene @, verificar directamente en perfiles o retornar tal cual
  IF position('@' IN v_clean) > 0 THEN
    RETURN v_clean;
  END IF;

  -- Buscar por nombre de usuario
  SELECT correo_institucional INTO v_correo
  FROM public.perfiles
  WHERE lower(usuario) = v_clean
  LIMIT 1;

  RETURN v_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_correo_por_identificador(text) TO anon, authenticated;

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

-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 010: Datos compartidos solo en Supabase
-- Auditoría (docs/PROMPT_CLAUDE_CODE_AUDITORIA.md, paso 3).
--
-- El cliente deja de usar localStorage como base de datos. Esta migración agrega
-- las funciones del servidor que el cliente necesita para leer y escribir con la
-- sesión real (auth.uid()), con las reglas aplicadas aquí y no en React:
--   - Perfiles: enlaces y estado opcional; los bloqueos ocultan perfiles en ambos sentidos.
--   - Grupo de carrera y ciclo: al cambiar de carrera/ciclo se sale del grupo anterior.
--   - Solicitudes y conversaciones: no hay chat sin solicitud aceptada (spec 6.4).
--   - Espacios: listado con conteos en una sola llamada; unirse solo a talleres y
--     grupos de interés visibles; propuestas creadas por el servidor (spec 7.2).
--   - Consultas agrupadas sobre el esquema de 001 (spec 7.1).
--   - Encuestas: bandeja con cola, respuesta atómica y resultados solo para el autor.
--   - Habilidades derivadas de los hechos (spec 5.3).
--
-- Los errores de negocio se lanzan como 'KAMPUZ_<AREA>: mensaje en español'.
-- Idempotente.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERFILES: enlaces profesionales y estado opcional
-- ------------------------------------------------------------------------------
alter table public.perfiles add column if not exists enlaces jsonb not null default '{}'::jsonb;

-- Estado en vivo: opcional y vacío por defecto ("Sin estado"). Ver docs/DECISIONES.md.
alter table public.perfiles add column if not exists estado_en_vivo text;
do $$
begin
    alter table public.perfiles
        add constraint perfiles_estado_en_vivo_valido
        check (estado_en_vivo is null or estado_en_vivo in ('campus', 'clase', 'biblioteca', 'buscando_equipo', 'examen'));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------------------
-- 2. BLOQUEOS: ocultan el perfil en ambos sentidos
-- ------------------------------------------------------------------------------
create or replace function public.hay_bloqueo(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.bloqueos
        where (bloqueador_id = p_a and bloqueado_id = p_b)
           or (bloqueador_id = p_b and bloqueado_id = p_a)
    );
$$;

revoke all on function public.hay_bloqueo(uuid, uuid) from public, anon;
grant execute on function public.hay_bloqueo(uuid, uuid) to authenticated;

-- ¿Este alumno me bloqueó? (su perfil deja de ser visible para mí)
create or replace function public.me_bloqueo(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.bloqueos where bloqueador_id = p_otro and bloqueado_id = auth.uid()
    );
$$;

revoke all on function public.me_bloqueo(uuid) from public, anon;
grant execute on function public.me_bloqueo(uuid) to authenticated;

-- Quien bloquea sigue viendo a quién bloqueó (para poder desbloquear); el bloqueado
-- deja de ver al que lo bloqueó. Explorar excluye además a los que yo bloqueé.
drop policy if exists "Perfiles visibles para alumnos autenticados" on public.perfiles;
drop policy if exists "Perfiles visibles salvo bloqueo" on public.perfiles;
create policy "Perfiles visibles salvo bloqueo"
    on public.perfiles for select
    to authenticated
    using (id = auth.uid() or not public.me_bloqueo(id));

-- Al bloquear, las solicitudes pendientes entre ambos se cierran.
create or replace function public.cerrar_solicitudes_al_bloquear()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.solicitudes_mensaje
    set estado = 'rechazada', respondido_en = now()
    where estado = 'pendiente'
      and ((de_id = new.bloqueador_id and a_id = new.bloqueado_id)
        or (de_id = new.bloqueado_id and a_id = new.bloqueador_id));
    return new;
end;
$$;

drop trigger if exists trg_cerrar_solicitudes_al_bloquear on public.bloqueos;
create trigger trg_cerrar_solicitudes_al_bloquear
    after insert on public.bloqueos
    for each row
    execute function public.cerrar_solicitudes_al_bloquear();

-- ------------------------------------------------------------------------------
-- 3. GRUPO DE CARRERA Y CICLO: membresía automática y exclusiva
-- ------------------------------------------------------------------------------
create or replace function public.auto_asignar_espacios_alumno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_espacio_carrera_id uuid;
    v_espacio_ciclo_id uuid;
begin
    select id into v_espacio_carrera_id
    from public.espacios
    where tipo = 'carrera' and carrera = new.carrera and sede = new.sede
    order by creado_en
    limit 1;

    if v_espacio_carrera_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
        values (
            'carrera',
            'Comunidad de ' || new.carrera || ' UTP',
            'Espacio de todos los ciclos de ' || new.carrera || ' (' || new.sede || '). Consultas, orientación y proyectos.',
            '/grupos/carrera_default.jpg',
            new.carrera, new.sede, false, 'visible'
        )
        returning id into v_espacio_carrera_id;
    end if;

    select id into v_espacio_ciclo_id
    from public.espacios
    where tipo = 'carrera_ciclo' and carrera = new.carrera and ciclo = new.ciclo and sede = new.sede
    order by creado_en
    limit 1;

    if v_espacio_ciclo_id is null then
        insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, ciclo, sede, oficial, estado)
        values (
            'carrera_ciclo',
            new.carrera || ' — Ciclo ' || new.ciclo,
            'Grupo de tus compañeros de ' || new.carrera || ', ciclo ' || new.ciclo || ' (' || new.sede || ').',
            '/grupos/ciclo_default.jpg',
            new.carrera, new.ciclo, new.sede, false, 'visible'
        )
        returning id into v_espacio_ciclo_id;
    end if;

    -- Solo accedes a TU grupo de carrera y ciclo (spec 4): al cambiar, sales del anterior.
    delete from public.membresias m
    using public.espacios e
    where m.espacio_id = e.id
      and m.usuario_id = new.id
      and e.tipo in ('carrera', 'carrera_ciclo')
      and e.id not in (v_espacio_carrera_id, v_espacio_ciclo_id);

    insert into public.membresias (usuario_id, espacio_id, rol)
    values (new.id, v_espacio_carrera_id, 'miembro'), (new.id, v_espacio_ciclo_id, 'miembro')
    on conflict (usuario_id, espacio_id) do nothing;

    return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. SOLICITUDES Y CONVERSACIONES (spec 6.4)
-- ------------------------------------------------------------------------------
create or replace function public.asegurar_conversacion(p_a uuid, p_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    insert into public.conversaciones (usuario_a_id, usuario_b_id)
    values (least(p_a, p_b), greatest(p_a, p_b))
    on conflict (usuario_a_id, usuario_b_id) do nothing;

    select id into v_id from public.conversaciones
    where usuario_a_id = least(p_a, p_b) and usuario_b_id = greatest(p_a, p_b);
    return v_id;
end;
$$;

revoke all on function public.asegurar_conversacion(uuid, uuid) from public, anon, authenticated;

create or replace function public.enviar_solicitud(p_a_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_de uuid := auth.uid();
    v_motivo text := trim(coalesce(p_motivo, ''));
    v_previa record;
    v_id uuid;
begin
    if v_de is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    if p_a_id = v_de then
        raise exception 'KAMPUZ_SOLICITUD: No puedes enviarte una solicitud a ti mismo.';
    end if;
    if length(v_motivo) < 5 then
        raise exception 'KAMPUZ_SOLICITUD: Escribe el motivo de tu solicitud (mínimo 5 caracteres).';
    end if;
    if length(v_motivo) > 300 then
        raise exception 'KAMPUZ_SOLICITUD: El motivo es muy largo (máximo 300 caracteres).';
    end if;
    if not exists (select 1 from public.perfiles where id = v_de) then
        raise exception 'KAMPUZ_SOLICITUD: Completa tu perfil antes de enviar solicitudes.';
    end if;
    if not exists (select 1 from public.perfiles where id = p_a_id) or public.hay_bloqueo(v_de, p_a_id) then
        raise exception 'KAMPUZ_SOLICITUD: No puedes contactar a este estudiante.';
    end if;
    if exists (
        select 1 from public.conversaciones
        where usuario_a_id = least(v_de, p_a_id) and usuario_b_id = greatest(v_de, p_a_id)
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Ya están conectados. Abre el chat desde "Chats 1 a 1".';
    end if;
    if exists (
        select 1 from public.solicitudes_mensaje
        where de_id = p_a_id and a_id = v_de and estado = 'pendiente'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Esta persona ya te envió una solicitud. Revísala en Solicitudes → Recibidas.';
    end if;

    select * into v_previa from public.solicitudes_mensaje where de_id = v_de and a_id = p_a_id;
    if found then
        if v_previa.estado = 'pendiente' then
            raise exception 'KAMPUZ_SOLICITUD: Ya le enviaste una solicitud. Espera su respuesta.';
        elsif v_previa.estado = 'rechazada' then
            raise exception 'KAMPUZ_SOLICITUD: Esta persona no aceptó tu solicitud anterior.';
        else
            raise exception 'KAMPUZ_SOLICITUD: Ya están conectados. Abre el chat desde "Chats 1 a 1".';
        end if;
    end if;

    insert into public.solicitudes_mensaje (de_id, a_id, motivo, estado)
    values (v_de, p_a_id, v_motivo, 'pendiente')
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.enviar_solicitud(uuid, text) from public, anon;
grant execute on function public.enviar_solicitud(uuid, text) to authenticated;

-- Acepta o ignora una solicitud recibida. Si se acepta, crea la conversación en la
-- misma transacción y devuelve su id.
create or replace function public.responder_solicitud(p_solicitud_id uuid, p_aceptar boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sol record;
begin
    select * into v_sol from public.solicitudes_mensaje where id = p_solicitud_id for update;
    if not found or v_sol.a_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_SOLICITUD: No encontramos esta solicitud.';
    end if;

    if v_sol.estado = 'pendiente' then
        update public.solicitudes_mensaje
        set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
            respondido_en = now()
        where id = p_solicitud_id;
    elsif v_sol.estado = 'rechazada' and p_aceptar then
        raise exception 'KAMPUZ_SOLICITUD: Ya ignoraste esta solicitud.';
    end if;

    if p_aceptar then
        if public.hay_bloqueo(v_sol.de_id, v_sol.a_id) then
            raise exception 'KAMPUZ_SOLICITUD: No puedes conectar con este estudiante.';
        end if;
        return public.asegurar_conversacion(v_sol.de_id, v_sol.a_id);
    end if;
    return null;
end;
$$;

revoke all on function public.responder_solicitud(uuid, boolean) from public, anon;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;

-- Las solicitudes y conversaciones solo se crean/actualizan por las funciones de arriba.
drop policy if exists "Emisor crea solicitud de mensaje" on public.solicitudes_mensaje;
drop policy if exists "Receptor actualiza solicitud de mensaje" on public.solicitudes_mensaje;
drop policy if exists "Creacion de conversacion por participantes" on public.conversaciones;

-- Mensajes directos: solo dentro de una conversación propia y sin bloqueo.
drop policy if exists "Interlocutores envian mensajes directos" on public.mensajes_directos;
create policy "Interlocutores envian mensajes directos"
    on public.mensajes_directos for insert
    to authenticated
    with check (
        auth.uid() = autor_id
        and length(trim(texto)) between 1 and 2000
        and exists (
            select 1 from public.conversaciones c
            where c.id = mensajes_directos.conversacion_id
              and auth.uid() in (c.usuario_a_id, c.usuario_b_id)
              and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
        )
    );

-- El receptor solo puede marcar "leído"; nadie edita el texto de otro.
revoke update on public.mensajes_directos from anon, authenticated;
grant update (leido) on public.mensajes_directos to authenticated;

create or replace function public.tocar_conversacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.conversaciones set ultimo_mensaje_en = new.creado_en where id = new.conversacion_id;
    return new;
end;
$$;

drop trigger if exists trg_tocar_conversacion on public.mensajes_directos;
create trigger trg_tocar_conversacion
    after insert on public.mensajes_directos
    for each row
    execute function public.tocar_conversacion();

-- Bandeja de chats: interlocutor, último mensaje y no leídos en una sola llamada.
-- drop: la 015 agrega columnas al resultado; sin esto, volver a correr 010 fallaría
drop function if exists public.mis_conversaciones();
create function public.mis_conversaciones()
returns table (
    id uuid,
    otro_id uuid,
    otro_nombre text,
    otro_apellido text,
    otro_usuario text,
    otro_foto_url text,
    otro_carrera text,
    otro_ciclo integer,
    otro_sede text,
    ultimo_texto text,
    ultimo_autor_id uuid,
    ultimo_en timestamptz,
    no_leidos integer
)
language sql
stable
security definer
set search_path = public
as $$
    select
        c.id,
        p.id, p.nombre, p.apellido, p.usuario, p.foto_url, p.carrera, p.ciclo, p.sede,
        um.texto, um.autor_id,
        coalesce(um.creado_en, c.abierta_en),
        (
            select count(*)::integer from public.mensajes_directos m
            where m.conversacion_id = c.id and m.autor_id <> auth.uid() and not m.leido
        )
    from public.conversaciones c
    join public.perfiles p
      on p.id = case when c.usuario_a_id = auth.uid() then c.usuario_b_id else c.usuario_a_id end
    left join lateral (
        select m.texto, m.autor_id, m.creado_en
        from public.mensajes_directos m
        where m.conversacion_id = c.id
        order by m.creado_en desc
        limit 1
    ) um on true
    where auth.uid() in (c.usuario_a_id, c.usuario_b_id)
      and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
    order by coalesce(um.creado_en, c.abierta_en) desc;
$$;

revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mis_conversaciones() to authenticated;

-- ------------------------------------------------------------------------------
-- 5. ESPACIOS, MEMBRESÍAS Y PROPUESTAS (spec 4 y 7.2)
-- ------------------------------------------------------------------------------
create or replace function public.es_miembro(p_espacio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.membresias
        where espacio_id = p_espacio_id and usuario_id = auth.uid()
    );
$$;

revoke all on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_miembro(uuid) to authenticated;

create or replace function public.umbral_visibilidad()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select greatest(15, round((select count(*) from public.perfiles) * 0.03))::integer;
$$;

-- Antes cualquiera veía todas las membresías (quién está en qué grupo).
drop policy if exists "Membresias visibles para autenticados" on public.membresias;
drop policy if exists "Membresias visibles para miembros del espacio" on public.membresias;
create policy "Membresias visibles para miembros del espacio"
    on public.membresias for select
    to authenticated
    using (usuario_id = auth.uid() or public.es_miembro(espacio_id));

-- Unirse solo a talleres y grupos de interés visibles. Los de carrera los asigna el trigger.
drop policy if exists "Usuarios pueden unirse a espacios" on public.membresias;
create policy "Usuarios pueden unirse a espacios"
    on public.membresias for insert
    to authenticated
    with check (
        auth.uid() = usuario_id
        and rol = 'miembro'
        and exists (
            select 1 from public.espacios e
            where e.id = membresias.espacio_id
              and e.tipo in ('taller', 'interes')
              and e.estado = 'visible'
        )
    );

drop policy if exists "Usuarios pueden salirse de espacios" on public.membresias;
create policy "Usuarios pueden salirse de espacios"
    on public.membresias for delete
    to authenticated
    using (
        auth.uid() = usuario_id
        and exists (
            select 1 from public.espacios e
            where e.id = membresias.espacio_id and e.tipo in ('taller', 'interes')
        )
    );

-- Listado de espacios con conteos (antes: 2 consultas por espacio desde el cliente).
-- Incluye las propuestas ocultas para que otros puedan apoyarlas: el umbral controla
-- si aparecen en Explorar, no si existen (spec 7.2).
create or replace function public.listar_espacios()
returns table (
    id uuid,
    tipo text,
    nombre text,
    descripcion text,
    portada_url text,
    carrera text,
    ciclo integer,
    sede text,
    horario text,
    oficial boolean,
    estado text,
    umbral integer,
    link_inscripcion text,
    creador_id uuid,
    creado_en timestamptz,
    miembros integer,
    apoyos integer,
    es_miembro boolean,
    ya_apoye boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        e.id, e.tipo, e.nombre, e.descripcion, e.portada_url, e.carrera, e.ciclo, e.sede,
        e.horario, coalesce(e.oficial, false), e.estado, public.umbral_visibilidad(),
        e.link_inscripcion, e.creador_id, e.creado_en,
        (select count(*)::integer from public.membresias m where m.espacio_id = e.id),
        (select count(*)::integer from public.apoyos_propuesta a where a.espacio_id = e.id),
        exists (select 1 from public.membresias m where m.espacio_id = e.id and m.usuario_id = auth.uid()),
        exists (select 1 from public.apoyos_propuesta a where a.espacio_id = e.id and a.usuario_id = auth.uid())
    from public.espacios e
    where auth.uid() is not null
      and (
          (e.tipo in ('carrera', 'carrera_ciclo')
              and exists (select 1 from public.membresias m where m.espacio_id = e.id and m.usuario_id = auth.uid()))
          or e.tipo in ('taller', 'interes')
      )
    order by
        case e.tipo when 'carrera_ciclo' then 0 when 'carrera' then 1 when 'taller' then 2 else 3 end,
        e.creado_en;
$$;

revoke all on function public.listar_espacios() from public, anon;
grant execute on function public.listar_espacios() to authenticated;

-- Proponer un grupo de interés: nace oculto, con su creador como admin y primer apoyo.
create or replace function public.proponer_grupo(p_nombre text, p_descripcion text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_nombre text := trim(coalesce(p_nombre, ''));
    v_id uuid;
begin
    if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_GRUPO: Completa tu perfil antes de proponer un grupo.';
    end if;
    if length(v_nombre) < 3 or length(v_nombre) > 60 then
        raise exception 'KAMPUZ_GRUPO: El nombre debe tener entre 3 y 60 caracteres.';
    end if;
    if exists (select 1 from public.espacios where lower(nombre) = lower(v_nombre)) then
        raise exception 'KAMPUZ_GRUPO: Ya existe un grupo con ese nombre.';
    end if;
    -- Anti-spam: como máximo 2 propuestas ocultas a la vez por alumno.
    if (select count(*) from public.espacios
        where creador_id = v_uid and tipo = 'interes' and estado = 'oculto') >= 2 then
        raise exception 'KAMPUZ_GRUPO: Ya tienes 2 propuestas esperando apoyos. Consigue apoyos antes de proponer otra.';
    end if;

    insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, oficial, creador_id, estado, umbral_apoyos)
    select 'interes', v_nombre,
           coalesce(nullif(trim(p_descripcion), ''), 'Comunidad estudiantil en formación.'),
           null, p.sede, false, v_uid, 'oculto', public.umbral_visibilidad()
    from public.perfiles p where p.id = v_uid
    returning id into v_id;

    insert into public.membresias (usuario_id, espacio_id, rol) values (v_uid, v_id, 'admin');
    insert into public.apoyos_propuesta (espacio_id, usuario_id) values (v_id, v_uid);
    return v_id;
end;
$$;

revoke all on function public.proponer_grupo(text, text) from public, anon;
grant execute on function public.proponer_grupo(text, text) to authenticated;

-- Apoyar una propuesta: uno por alumno (restricción única) y el trigger la hace visible.
create or replace function public.apoyar_propuesta(p_espacio_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_estado text;
begin
    if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
        raise exception 'KAMPUZ_GRUPO: Completa tu perfil antes de apoyar propuestas.';
    end if;
    if not exists (select 1 from public.espacios where id = p_espacio_id and tipo = 'interes') then
        raise exception 'KAMPUZ_GRUPO: Esta propuesta ya no existe.';
    end if;
    begin
        insert into public.apoyos_propuesta (espacio_id, usuario_id) values (p_espacio_id, v_uid);
    exception when unique_violation then
        raise exception 'KAMPUZ_GRUPO: Ya apoyaste esta propuesta.';
    end;
    select estado into v_estado from public.espacios where id = p_espacio_id;
    return v_estado;
end;
$$;

revoke all on function public.apoyar_propuesta(uuid) from public, anon;
grant execute on function public.apoyar_propuesta(uuid) to authenticated;

-- Las propuestas solo se crean por proponer_grupo y su estado solo lo cambia el umbral.
drop policy if exists "Alumnos pueden proponer espacios" on public.espacios;
drop policy if exists "Creador puede actualizar su espacio propuesto" on public.espacios;
drop policy if exists "Usuarios pueden apoyar propuestas" on public.apoyos_propuesta;

-- El umbral usa la base activa del momento (max(15, 3%)).
create or replace function public.verificar_umbral_propuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select count(*) from public.apoyos_propuesta where espacio_id = new.espacio_id)
        >= public.umbral_visibilidad() then
        update public.espacios set estado = 'visible' where id = new.espacio_id and estado = 'oculto';
    end if;
    return new;
end;
$$;

-- Mensajes de grupo: texto acotado.
drop policy if exists "Miembros escriben mensajes en el espacio" on public.mensajes;
create policy "Miembros escriben mensajes en el espacio"
    on public.mensajes for insert
    to authenticated
    with check (
        auth.uid() = autor_id
        and length(trim(texto)) between 1 and 2000
        and public.es_miembro(espacio_id)
    );

-- ------------------------------------------------------------------------------
-- 6. CONSULTAS AGRUPADAS (spec 7.1) sobre grupos_consulta + consultas + asesorías
-- ------------------------------------------------------------------------------
-- Moderación (spec 7.1). Corrige 003: el nombre propio solo se detectaba con
-- "profesor" en minúscula; "Profesor García" al inicio de una frase pasaba.
-- "el profesor dijo..." sigue permitido (no hay mayúscula después).
create or replace function public.moderar_consulta_servidor()
returns trigger
language plpgsql
as $$
begin
    if new.texto ~* '\m(profe|profesor|profesora|docente|maestro|maestra)\M'
       and new.texto ~* '\m(mejor|peor|cuál|cual|recomienda|evita|jala|regala|bueno|malo|filtro|fácil|facil|difícil|dificil)\M' then
        raise exception 'KAMPUZ_MODERACION: Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones o qué material conviene.';
    end if;

    if new.texto ~ '\m([Pp]rofesora?|[Pp]rofe|[Dd]ocente|[Mm]aestra?)\s+[A-ZÁÉÍÓÚÑ]' then
        raise exception 'KAMPUZ_MODERACION: Mencionaste a un docente por su nombre. Se habla del curso, no de la persona.';
    end if;

    return new;
end;
$$;

-- La misma moderación se aplica a las respuestas.
drop trigger if exists trg_moderar_asesoria on public.asesorias;
create trigger trg_moderar_asesoria
    before insert on public.asesorias
    for each row
    execute function public.moderar_consulta_servidor();

create or replace function public.firma_alumno(p_nombre text, p_apellido text, p_ciclo integer)
returns text
language sql
immutable
as $$
    select p_nombre || ' ' || left(coalesce(p_apellido, ''), 1) || '. (Ciclo ' || p_ciclo || ')';
$$;

-- Crea la consulta o la agrupa con otras de la misma carrera + curso + tema.
-- nAlumnos = autores DISTINTOS: preguntar dos veces no suma.
create or replace function public.crear_consulta(p_curso text, p_tema text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_perfil record;
    v_grupo_id uuid;
    v_n integer;
begin
    select * into v_perfil from public.perfiles where id = v_uid;
    if not found then
        raise exception 'KAMPUZ_CONSULTA: Completa tu perfil antes de consultar.';
    end if;
    if length(trim(coalesce(p_curso, ''))) < 2 or length(trim(coalesce(p_tema, ''))) < 2 then
        raise exception 'KAMPUZ_CONSULTA: Indica el curso y el tema.';
    end if;
    if length(trim(coalesce(p_texto, ''))) < 10 then
        raise exception 'KAMPUZ_CONSULTA: Cuéntanos tu duda con un poco más de detalle (mínimo 10 caracteres).';
    end if;

    select id into v_grupo_id
    from public.grupos_consulta
    where carrera = v_perfil.carrera
      and lower(trim(curso)) = lower(trim(p_curso))
      and lower(trim(tema)) = lower(trim(p_tema))
      and estado = 'abierto'
    order by creado_en
    limit 1
    for update;

    if v_grupo_id is not null and exists (
        select 1 from public.consultas where grupo_consulta_id = v_grupo_id and autor_id = v_uid
    ) then
        return jsonb_build_object('grupo_id', v_grupo_id, 'agrupada', true, 'ya_estabas', true);
    end if;

    if v_grupo_id is null then
        insert into public.grupos_consulta (carrera, curso, tema, n_alumnos, estado)
        values (v_perfil.carrera, trim(p_curso), trim(p_tema), 0, 'abierto')
        returning id into v_grupo_id;
    end if;

    -- trg_moderar_consulta bloquea aquí si se habla del docente y no del curso
    insert into public.consultas (autor_id, carrera, ciclo_autor, curso, tema, texto, estado, grupo_consulta_id)
    values (v_uid, v_perfil.carrera, v_perfil.ciclo, trim(p_curso), trim(p_tema), trim(p_texto), 'abierta', v_grupo_id);

    select count(distinct autor_id) into v_n from public.consultas where grupo_consulta_id = v_grupo_id;
    update public.grupos_consulta set n_alumnos = v_n where id = v_grupo_id;
    if v_n >= 2 then
        update public.consultas set estado = 'agrupada' where grupo_consulta_id = v_grupo_id and estado = 'abierta';
    end if;

    return jsonb_build_object('grupo_id', v_grupo_id, 'agrupada', v_n >= 2, 'ya_estabas', false);
end;
$$;

revoke all on function public.crear_consulta(text, text, text) from public, anon;
grant execute on function public.crear_consulta(text, text, text) to authenticated;

-- Consultas de MI carrera (espacio de carrera) con sus respuestas, en una sola llamada.
create or replace function public.listar_consultas_carrera()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    with yo as (select id, carrera from public.perfiles where id = auth.uid())
    select coalesce(jsonb_agg(g.obj order by g.orden_estado, g.creado_en desc), '[]'::jsonb)
    from (
        select
            gc.creado_en,
            case gc.estado when 'abierto' then 0 else 1 end as orden_estado,
            jsonb_build_object(
                'id', gc.id,
                'carrera', gc.carrera,
                'curso', gc.curso,
                'tema', gc.tema,
                'estado', gc.estado,
                'n_alumnos', gc.n_alumnos,
                'creado_en', gc.creado_en,
                'soy_autor', exists (select 1 from public.consultas c where c.grupo_consulta_id = gc.id and c.autor_id = yo.id),
                'ciclo_max_autores', (select coalesce(max(c.ciclo_autor), 0) from public.consultas c where c.grupo_consulta_id = gc.id),
                'textos', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'texto', c.texto,
                        'firma', public.firma_alumno(p.nombre, p.apellido, c.ciclo_autor)
                    ) order by c.creado_en), '[]'::jsonb)
                    from public.consultas c
                    join public.perfiles p on p.id = c.autor_id
                    where c.grupo_consulta_id = gc.id
                ),
                'respuestas', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'id', a.id,
                        'asesor_id', a.asesor_id,
                        'asesor_nombre', p.nombre || ' ' || coalesce(p.apellido, ''),
                        'asesor_ciclo', p.ciclo,
                        'asesor_carrera', p.carrera,
                        'asesor_foto', p.foto_url,
                        'texto', a.texto,
                        'modo', a.modo,
                        'estrellas_pendientes', a.estrellas_pendientes,
                        'estrellas_acreditadas', a.estrellas_acreditadas,
                        'valorada', exists (select 1 from public.valoraciones_asesoria v where v.asesoria_id = a.id),
                        'mi_valoracion', (select v.util from public.valoraciones_asesoria v where v.asesoria_id = a.id and v.usuario_id = yo.id),
                        'creado_en', a.creado_en
                    ) order by a.creado_en), '[]'::jsonb)
                    from public.asesorias a
                    join public.perfiles p on p.id = a.asesor_id
                    where a.grupo_consulta_id = gc.id
                )
            ) as obj
        from public.grupos_consulta gc, yo
        where gc.carrera = yo.carrera
    ) g;
$$;

revoke all on function public.listar_consultas_carrera() from public, anon;
grant execute on function public.listar_consultas_carrera() to authenticated;

-- Orientar: ciclo >= 5, ciclo MAYOR que el de todos los autores, misma carrera y no ser autor.
-- Solo por mensaje: la opción "llamada" (×3) se quitó porque la llamada no existe en la app
-- (spec 11.3) y el modo lo declaraba quien respondía. Estrellas = nAlumnos si son 2 o más,
-- pendientes hasta que un autor valore "me sirvió". p_modo se mantiene por compatibilidad.
create or replace function public.responder_consulta(p_grupo_id uuid, p_texto text, p_modo text default 'mensaje')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_perfil record;
    v_grupo record;
    v_ciclo_max integer;
    v_id uuid;
begin
    if coalesce(p_modo, 'mensaje') <> 'mensaje' then
        raise exception 'KAMPUZ_CONSULTA: Por ahora solo se puede orientar por mensaje.';
    end if;
    select * into v_perfil from public.perfiles where id = v_uid;
    select * into v_grupo from public.grupos_consulta where id = p_grupo_id;
    if v_perfil.id is null or v_grupo.id is null then
        raise exception 'KAMPUZ_CONSULTA: No encontramos esta consulta.';
    end if;
    if v_grupo.carrera <> v_perfil.carrera then
        raise exception 'KAMPUZ_CONSULTA: Solo puedes orientar consultas de tu carrera.';
    end if;
    if v_perfil.ciclo < 5 then
        raise exception 'KAMPUZ_CONSULTA: Solo alumnos de ciclo 5 o superior pueden orientar.';
    end if;
    if exists (select 1 from public.consultas where grupo_consulta_id = p_grupo_id and autor_id = v_uid) then
        raise exception 'KAMPUZ_CONSULTA: No puedes orientar una consulta en la que tú preguntaste.';
    end if;
    select coalesce(max(ciclo_autor), 0) into v_ciclo_max from public.consultas where grupo_consulta_id = p_grupo_id;
    if v_perfil.ciclo <= v_ciclo_max then
        raise exception 'KAMPUZ_CONSULTA: Para orientar aquí debes estar en un ciclo mayor que %.', v_ciclo_max;
    end if;
    if length(trim(coalesce(p_texto, ''))) < 10 then
        raise exception 'KAMPUZ_CONSULTA: Escribe una orientación un poco más completa (mínimo 10 caracteres).';
    end if;

    insert into public.asesorias (grupo_consulta_id, asesor_id, modo, texto, estrellas_pendientes, estrellas_acreditadas)
    values (
        p_grupo_id, v_uid, 'mensaje', trim(p_texto),
        case when v_grupo.n_alumnos >= 2 then v_grupo.n_alumnos else 0 end,
        0
    )
    returning id into v_id;
    return v_id;
end;
$$;

revoke all on function public.responder_consulta(uuid, text, text) from public, anon;
grant execute on function public.responder_consulta(uuid, text, text) to authenticated;

-- Valorar una respuesta: SOLO un autor de la consulta. Recién aquí se acreditan las
-- estrellas, una sola vez por respuesta, y solo si:
--   - la consulta está agrupada (nAlumnos >= 2), y
--   - quien valora no tiene una conexión aceptada con el asesor (anti-gaming 3).
create or replace function public.valorar_asesoria(p_asesoria_id uuid, p_util boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_as record;
    v_grupo record;
    v_conectados boolean;
    v_estrellas integer := 0;
begin
    select * into v_as from public.asesorias where id = p_asesoria_id for update;
    if not found then
        raise exception 'KAMPUZ_CONSULTA: No encontramos esta respuesta.';
    end if;
    if not exists (
        select 1 from public.consultas where grupo_consulta_id = v_as.grupo_consulta_id and autor_id = v_uid
    ) then
        raise exception 'KAMPUZ_CONSULTA: Solo quienes hicieron la consulta pueden valorar la respuesta.';
    end if;
    if exists (select 1 from public.valoraciones_asesoria where asesoria_id = p_asesoria_id and usuario_id = v_uid) then
        raise exception 'KAMPUZ_CONSULTA: Ya valoraste esta respuesta.';
    end if;

    insert into public.valoraciones_asesoria (asesoria_id, usuario_id, util)
    values (p_asesoria_id, v_uid, p_util);

    if p_util and v_as.estrellas_acreditadas = 0 then
        select * into v_grupo from public.grupos_consulta where id = v_as.grupo_consulta_id;
        v_conectados := exists (
            select 1 from public.conversaciones
            where usuario_a_id = least(v_uid, v_as.asesor_id) and usuario_b_id = greatest(v_uid, v_as.asesor_id)
        );
        if v_grupo.n_alumnos >= 2 and not v_conectados then
            v_estrellas := v_grupo.n_alumnos;
        end if;
        update public.asesorias
        set estrellas_acreditadas = v_estrellas, estrellas_pendientes = 0
        where id = p_asesoria_id;
        update public.grupos_consulta set estado = 'resuelto', resuelto_en = now()
        where id = v_as.grupo_consulta_id and estado = 'abierto';
        update public.consultas set estado = 'resuelta' where grupo_consulta_id = v_as.grupo_consulta_id;
    end if;

    return jsonb_build_object('estrellas_acreditadas', v_estrellas);
end;
$$;

revoke all on function public.valorar_asesoria(uuid, boolean) from public, anon;
grant execute on function public.valorar_asesoria(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. ENCUESTAS: destinatarios, envío, bandeja con cola, respuesta y resultados
-- ------------------------------------------------------------------------------
-- Las políticas de 002 de encuestas y envios_encuesta se referenciaban entre sí
-- ("infinite recursion detected in policy"): cualquier lectura desde el cliente fallaba.
-- Además el autor podía leer los envíos y saber QUIÉN respondió. Ahora:
--   - encuestas/preguntas: visibles para el autor o un destinatario (helper sin RLS);
--   - envios_encuesta: solo el destinatario ve su fila; el autor ve conteos por RPC.
create or replace function public.soy_destinatario(p_encuesta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.envios_encuesta
        where encuesta_id = p_encuesta_id and destinatario_id = auth.uid()
    );
$$;

create or replace function public.soy_autor_encuesta(p_encuesta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.encuestas where id = p_encuesta_id and autor_id = auth.uid());
$$;

revoke all on function public.soy_destinatario(uuid) from public, anon;
revoke all on function public.soy_autor_encuesta(uuid) from public, anon;
grant execute on function public.soy_destinatario(uuid) to authenticated;
grant execute on function public.soy_autor_encuesta(uuid) to authenticated;

drop policy if exists "Encuestas visibles para creador y destinatarios asignados" on public.encuestas;
create policy "Encuestas visibles para creador y destinatarios asignados"
    on public.encuestas for select
    to authenticated
    using (autor_id = auth.uid() or public.soy_destinatario(id));

drop policy if exists "Preguntas visibles para autor y destinatarios" on public.preguntas;
create policy "Preguntas visibles para autor y destinatarios"
    on public.preguntas for select
    to authenticated
    using (public.soy_autor_encuesta(encuesta_id) or public.soy_destinatario(encuesta_id));

drop policy if exists "Destinatarios ven sus envios asignados" on public.envios_encuesta;
create policy "Destinatarios ven sus envios asignados"
    on public.envios_encuesta for select
    to authenticated
    using (destinatario_id = auth.uid());

-- Un único filtro para contar y para enviar (antes el envío ignoraba edad e intereses).
-- En 011 se agrega el consentimiento 2 ("Recibir encuestas").
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
    -- "carreras": lista (vacía = todas). Se acepta también "carrera" suelta.
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
    where p.id is distinct from p_emisor
      and (cardinality(v_carreras) = 0 or p.carrera = any(v_carreras))
      and p.ciclo between v_ciclo_min and v_ciclo_max
      and extract(year from age(p.fecha_nacimiento)) between v_edad_min and v_edad_max
      and (cardinality(v_intereses) = 0 or p.intereses && v_intereses);
end;
$$;

revoke all on function public.destinatarios_filtro(jsonb, uuid) from public, anon, authenticated;

-- Conteo en vivo: devuelve SOLO un número.
create or replace function public.calcular_alcance_encuesta(p_filtro jsonb)
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select case when auth.uid() is null then 0
                else (select count(*)::integer from public.destinatarios_filtro(p_filtro, auth.uid()))
           end;
$$;

revoke all on function public.calcular_alcance_encuesta(jsonb) from public, anon;
grant execute on function public.calcular_alcance_encuesta(jsonb) to authenticated;

-- Nivel de "Apoyo a la investigación" y su alcance semanal (spec 5.2).
create or replace function public.alcance_semanal(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select case
        when n >= 8 then 200
        when n >= 3 then 80
        when n >= 1 then 30
        else 0
    end
    from (
        select count(*) as n from public.envios_encuesta
        where destinatario_id = p_usuario and estado = 'respondida'
    ) t;
$$;

revoke all on function public.alcance_semanal(uuid) from public, anon;
grant execute on function public.alcance_semanal(uuid) to authenticated;

-- Envío seguro: umbral mínimo, alcance semanal del emisor (acumulado en 7 días),
-- muestra aleatoria y tope de 3 encuestas por alumno por semana con cola.
create or replace function public.enviar_encuesta_segura(
    p_titulo text,
    p_descripcion text,
    p_filtro jsonb,
    p_preguntas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_emisor uuid := auth.uid();
    v_umbral integer;
    v_alcance_total integer;
    v_semanal integer;
    v_usado integer;
    v_cupo integer;
    v_encuesta_id uuid;
    v_p record;
    v_dest uuid;
    v_enviados integer := 0;
    v_encolados integer := 0;
begin
    if v_emisor is null or not exists (select 1 from public.perfiles where id = v_emisor) then
        raise exception 'KAMPUZ_ENCUESTA: Completa tu perfil antes de enviar encuestas.';
    end if;
    if length(trim(coalesce(p_titulo, ''))) < 5 then
        raise exception 'KAMPUZ_ENCUESTA: Escribe un título (mínimo 5 caracteres).';
    end if;
    if jsonb_typeof(p_preguntas) <> 'array' or jsonb_array_length(p_preguntas) = 0 then
        raise exception 'KAMPUZ_ENCUESTA: Agrega al menos una pregunta.';
    end if;
    if jsonb_array_length(p_preguntas) > 15 then
        raise exception 'KAMPUZ_ENCUESTA: Máximo 15 preguntas por encuesta.';
    end if;

    select coalesce((select valor::integer from public.config where clave = 'umbral_minimo_segmento'), 30)
    into v_umbral;

    select count(*) into v_alcance_total from public.destinatarios_filtro(p_filtro, v_emisor);
    if v_alcance_total < v_umbral then
        raise exception 'KAMPUZ_ENCUESTA: Muy pocos (% alumnos). Con menos de % alguien podría quedar identificado. Amplía el ciclo o quita un filtro.', v_alcance_total, v_umbral;
    end if;

    v_semanal := public.alcance_semanal(v_emisor);
    if v_semanal = 0 then
        raise exception 'KAMPUZ_ENCUESTA: Responde una encuesta de otro alumno para desbloquear 30 destinatarios.';
    end if;

    select coalesce(sum(alcance_enviado), 0) into v_usado
    from public.encuestas
    where autor_id = v_emisor and creado_en >= now() - interval '7 days';

    v_cupo := least(v_alcance_total, v_semanal - v_usado);
    if v_cupo <= 0 then
        raise exception 'KAMPUZ_ENCUESTA: Ya usaste tu alcance de esta semana (% destinatarios). Podrás enviar de nuevo en unos días.', v_semanal;
    end if;

    insert into public.encuestas (autor_id, titulo, descripcion, filtro, alcance_calculado, alcance_enviado, estado)
    values (v_emisor, trim(p_titulo), nullif(trim(coalesce(p_descripcion, '')), ''), p_filtro, v_alcance_total, v_cupo, 'enviada')
    returning id into v_encuesta_id;

    for v_p in
        select * from jsonb_to_recordset(p_preguntas) as x(orden int, texto text, tipo text, opciones jsonb)
    loop
        if length(trim(coalesce(v_p.texto, ''))) = 0 or v_p.tipo not in ('unica', 'multiple', 'abierta') then
            raise exception 'KAMPUZ_ENCUESTA: Revisa las preguntas: cada una necesita texto y un tipo válido.';
        end if;
        if v_p.tipo <> 'abierta' and (jsonb_typeof(v_p.opciones) <> 'array' or jsonb_array_length(v_p.opciones) < 2) then
            raise exception 'KAMPUZ_ENCUESTA: Las preguntas de opción necesitan al menos 2 opciones.';
        end if;
        insert into public.preguntas (encuesta_id, orden, texto, tipo, opciones)
        values (v_encuesta_id, v_p.orden, trim(v_p.texto), v_p.tipo, coalesce(v_p.opciones, '[]'::jsonb));
    end loop;

    for v_dest in
        select d from public.destinatarios_filtro(p_filtro, v_emisor) d order by random() limit v_cupo
    loop
        if (select count(*) from public.envios_encuesta
            where destinatario_id = v_dest
              and estado in ('pendiente', 'respondida')
              and enviado_en >= now() - interval '7 days') >= 3 then
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado) values (v_encuesta_id, v_dest, 'encolada');
            v_encolados := v_encolados + 1;
        else
            insert into public.envios_encuesta (encuesta_id, destinatario_id, estado) values (v_encuesta_id, v_dest, 'pendiente');
            v_enviados := v_enviados + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'encuesta_id', v_encuesta_id,
        'alcance_calculado', v_alcance_total,
        'enviados', v_enviados,
        'encolados', v_encolados
    );
end;
$$;

revoke all on function public.enviar_encuesta_segura(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.enviar_encuesta_segura(text, text, jsonb, jsonb) to authenticated;

-- Bandeja: primero libera de la cola lo que quepa en el tope semanal (3), luego lista.
create or replace function public.mi_bandeja_encuestas()
returns table (
    envio_id uuid,
    encuesta_id uuid,
    titulo text,
    descripcion text,
    estado text,
    enviado_en timestamptz,
    respondido_en timestamptz,
    n_preguntas integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_uid uuid := auth.uid();
    v_libres integer;
begin
    if v_uid is null then
        return;
    end if;

    select 3 - count(*) into v_libres
    from public.envios_encuesta
    where destinatario_id = v_uid
      and estado in ('pendiente', 'respondida')
      and enviado_en >= now() - interval '7 days';

    if v_libres > 0 then
        update public.envios_encuesta
        set estado = 'pendiente', enviado_en = now()
        where id in (
            select id from public.envios_encuesta
            where destinatario_id = v_uid and estado = 'encolada'
            order by enviado_en
            limit v_libres
        );
    end if;

    return query
    select e.id, e.encuesta_id, enc.titulo, enc.descripcion, e.estado, e.enviado_en, e.respondido_en,
           (select count(*)::integer from public.preguntas pr where pr.encuesta_id = e.encuesta_id)
    from public.envios_encuesta e
    join public.encuestas enc on enc.id = e.encuesta_id
    where e.destinatario_id = v_uid and e.estado in ('pendiente', 'respondida')
    order by (e.estado = 'pendiente') desc, e.enviado_en desc;
end;
$$;

revoke all on function public.mi_bandeja_encuestas() from public, anon;
grant execute on function public.mi_bandeja_encuestas() to authenticated;

-- Responder: valida que el envío sea mío y esté pendiente, que cada respuesta sea de una
-- pregunta de esa encuesta y que todas estén respondidas. Todo en una transacción.
-- p_respuestas: { "<pregunta_id>": "opción" | ["opción", ...] | "texto libre" }
create or replace function public.responder_encuesta(p_envio_id uuid, p_respuestas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_envio record;
    v_pr record;
    v_valor jsonb;
begin
    select * into v_envio from public.envios_encuesta where id = p_envio_id for update;
    if not found or v_envio.destinatario_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_ENCUESTA: No encontramos esta encuesta en tu bandeja.';
    end if;
    if v_envio.estado = 'respondida' then
        raise exception 'KAMPUZ_ENCUESTA: Ya respondiste esta encuesta.';
    end if;
    if v_envio.estado <> 'pendiente' then
        raise exception 'KAMPUZ_ENCUESTA: Esta encuesta todavía no está disponible.';
    end if;

    for v_pr in select * from public.preguntas where encuesta_id = v_envio.encuesta_id loop
        v_valor := p_respuestas -> v_pr.id::text;
        if v_valor is null
           or (jsonb_typeof(v_valor) = 'string' and length(trim(v_valor #>> '{}')) = 0)
           or (jsonb_typeof(v_valor) = 'array' and jsonb_array_length(v_valor) = 0) then
            raise exception 'KAMPUZ_ENCUESTA: Responde todas las preguntas antes de enviar.';
        end if;
        if v_pr.tipo = 'multiple' and jsonb_typeof(v_valor) <> 'array' then
            v_valor := jsonb_build_array(v_valor);
        end if;
        if v_pr.tipo <> 'multiple' and jsonb_typeof(v_valor) <> 'string' then
            raise exception 'KAMPUZ_ENCUESTA: Respuesta no válida.';
        end if;
        insert into public.respuestas (envio_id, encuesta_id, pregunta_id, valor)
        values (p_envio_id, v_envio.encuesta_id, v_pr.id, v_valor);
    end loop;

    update public.envios_encuesta set estado = 'respondida', respondido_en = now() where id = p_envio_id;
end;
$$;

revoke all on function public.responder_encuesta(uuid, jsonb) from public, anon;
grant execute on function public.responder_encuesta(uuid, jsonb) to authenticated;

-- Resultados agregados: SOLO para el autor. Nunca devuelve quién respondió qué.
-- (La versión de 003 anidaba agregados y no verificaba al autor.)
create or replace function public.obtener_resultados_encuesta(p_encuesta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_enc record;
begin
    select * into v_enc from public.encuestas where id = p_encuesta_id;
    if not found or v_enc.autor_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_ENCUESTA: Solo quien creó la encuesta puede ver sus resultados.';
    end if;

    return jsonb_build_object(
        'encuesta_id', v_enc.id,
        'titulo', v_enc.titulo,
        'alcance_enviado', v_enc.alcance_enviado,
        'total_respuestas', (
            select count(*) from public.envios_encuesta where encuesta_id = v_enc.id and estado = 'respondida'
        ),
        'preguntas', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'pregunta_id', pr.id,
                'texto', pr.texto,
                'tipo', pr.tipo,
                'opciones', pr.opciones,
                'conteo', case when pr.tipo = 'abierta' then null else (
                    select coalesce(jsonb_object_agg(t.opcion, t.n), '{}'::jsonb)
                    from (
                        select x.opcion, count(*) as n
                        from public.respuestas r
                        cross join lateral (
                            select jsonb_array_elements_text(
                                case when jsonb_typeof(r.valor) = 'array' then r.valor else jsonb_build_array(r.valor) end
                            ) as opcion
                        ) x
                        where r.pregunta_id = pr.id
                        group by x.opcion
                    ) t
                ) end,
                -- Textos libres sin ningún vínculo con quién los escribió, en orden aleatorio
                'textos', case when pr.tipo = 'abierta' then (
                    select coalesce(jsonb_agg(r.valor #>> '{}' order by random()), '[]'::jsonb)
                    from public.respuestas r where r.pregunta_id = pr.id
                ) else null end
            ) order by pr.orden), '[]'::jsonb)
            from public.preguntas pr where pr.encuesta_id = v_enc.id
        )
    );
end;
$$;

revoke all on function public.obtener_resultados_encuesta(uuid) from public, anon;
grant execute on function public.obtener_resultados_encuesta(uuid) to authenticated;

-- Mis encuestas creadas, con conteos agregados (el autor no lee los envíos individuales).
create or replace function public.mis_encuestas_creadas()
returns table (
    id uuid,
    titulo text,
    descripcion text,
    alcance_calculado integer,
    alcance_enviado integer,
    respuestas integer,
    encoladas integer,
    estado text,
    creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select enc.id, enc.titulo, enc.descripcion, enc.alcance_calculado, enc.alcance_enviado,
           (select count(*)::integer from public.envios_encuesta e where e.encuesta_id = enc.id and e.estado = 'respondida'),
           (select count(*)::integer from public.envios_encuesta e where e.encuesta_id = enc.id and e.estado = 'encolada'),
           enc.estado, enc.creado_en
    from public.encuestas enc
    where enc.autor_id = auth.uid()
    order by enc.creado_en desc;
$$;

revoke all on function public.mis_encuestas_creadas() from public, anon;
grant execute on function public.mis_encuestas_creadas() to authenticated;

-- ------------------------------------------------------------------------------
-- 8. HABILIDADES DERIVADAS DE LOS HECHOS (spec 5.1, 5.3 y 5.6)
-- ------------------------------------------------------------------------------
create or replace function public.calcular_habilidades_usuario(p_usuario_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_encuestas integer;
    v_asesorias integer;
    v_estrellas_ayuda integer;
    v_grupos_activos integer;
    v_grupos_creados integer;
    v_semanal integer;
begin
    if auth.uid() is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;

    select count(*) into v_encuestas
    from public.envios_encuesta where destinatario_id = p_usuario_id and estado = 'respondida';

    -- Solo cuentan las asesorías que acreditaron estrellas (agrupadas y valoradas)
    select count(*), coalesce(sum(estrellas_acreditadas), 0) into v_asesorias, v_estrellas_ayuda
    from public.asesorias where asesor_id = p_usuario_id and estrellas_acreditadas > 0;

    -- "Grupo con actividad": taller o grupo de interés donde es miembro Y escribió.
    -- Estar inscrito no basta (spec 5.6: asistir no es evidencia).
    select count(distinct m.espacio_id) into v_grupos_activos
    from public.membresias m
    join public.espacios e on e.id = m.espacio_id and e.tipo in ('taller', 'interes')
    where m.usuario_id = p_usuario_id
      and exists (select 1 from public.mensajes ms where ms.espacio_id = m.espacio_id and ms.autor_id = p_usuario_id);

    -- Liderazgo: grupos creados que alcanzaron el umbral (una propuesta oculta no es un grupo)
    select count(*) into v_grupos_creados
    from public.espacios where creador_id = p_usuario_id and tipo = 'interes' and estado = 'visible';

    v_semanal := public.alcance_semanal(p_usuario_id);

    return jsonb_build_object(
        'apoyo_investigacion', jsonb_build_object(
            'progreso', v_encuestas,
            'nivel', case when v_encuestas >= 8 then 3 when v_encuestas >= 3 then 2 when v_encuestas >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 3, 8),
            'estrellas', v_encuestas,
            'alcance_semanal', v_semanal
        ),
        'predisposicion_ayudar', jsonb_build_object(
            'progreso', v_asesorias,
            'nivel', case when v_asesorias >= 5 then 3 when v_asesorias >= 2 then 2 when v_asesorias >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 2, 5),
            'estrellas', v_estrellas_ayuda
        ),
        'constancia', jsonb_build_object(
            'progreso', v_grupos_activos,
            'nivel', case when v_grupos_activos >= 5 then 3 when v_grupos_activos >= 3 then 2 when v_grupos_activos >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 3, 5),
            'estrellas', v_grupos_activos
        ),
        'liderazgo', jsonb_build_object(
            'progreso', v_grupos_creados,
            'nivel', case when v_grupos_creados >= 3 then 3 when v_grupos_creados >= 2 then 2 when v_grupos_creados >= 1 then 1 else 0 end,
            'metas', jsonb_build_array(1, 2, 3),
            'estrellas', v_grupos_creados * 3
        )
    );
end;
$$;

revoke all on function public.calcular_habilidades_usuario(uuid) from public, anon;
grant execute on function public.calcular_habilidades_usuario(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 9. ELIMINAR CUENTA (corrige 007: respuestas no tiene usuario_id y los errores se
--    devolvían como "success: false" que el cliente trataba como éxito)
--    Las fotos se borran antes desde el cliente con la API de Storage: Supabase no
--    permite borrar filas de storage.objects con SQL directo.
-- ------------------------------------------------------------------------------
create or replace function public.eliminar_mi_cuenta()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;

    -- perfiles tiene ON DELETE CASCADE hacia mensajes, membresías, solicitudes,
    -- conversaciones, consultas, envíos (y sus respuestas), consentimientos, etc.
    delete from public.perfiles where id = v_user_id;
    delete from auth.users where id = v_user_id;

    return json_build_object('success', true);
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- ------------------------------------------------------------------------------
-- 10. REALTIME: avisos en vivo de solicitudes (mensajes y mensajes_directos ya estaban)
-- ------------------------------------------------------------------------------
do $$
begin
    begin
        alter publication supabase_realtime add table public.solicitudes_mensaje;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.mensajes;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.mensajes_directos;
    exception when duplicate_object then null;
    end;
end $$;

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

-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 012: Reglas que deben vivir en el servidor
-- Auditoría (docs/PROMPT_CLAUDE_CODE_AUDITORIA.md, pasos 5 y 7).
-- Ver la tabla completa "Dónde se aplica cada regla" en docs/DECISIONES.md.
-- Idempotente.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FOTOS DE PERFIL: solo URLs de Storage, nunca imágenes en base64 (paso 5, punto 11)
--    El cliente guardaba la foto como Data URL en foto_url cuando Storage fallaba.
-- ------------------------------------------------------------------------------
update public.perfiles set foto_url = null where foto_url like 'data:%';

do $$
begin
    alter table public.perfiles
        add constraint perfiles_foto_url_no_base64
        check (foto_url is null or (foto_url not like 'data:%' and length(foto_url) <= 500));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------------------
-- 2. SIN ATAJOS ALREDEDOR DE LAS FUNCIONES DEL SERVIDOR (paso 7)
--    Estas políticas de 002/006 dejaban escribir directo en las tablas y saltarse
--    las reglas que aplican las RPC de 010:
--    - envios_encuesta UPDATE: marcar "respondida" sin responder → subir de nivel de
--      Apoyo a la investigación y desbloquear alcance (spec 5.2) sin ayudar a nadie.
--    - asesorias INSERT: orientar sin ciclo >= 5 / mayor que los autores y fijarse
--      estrellas_acreditadas a mano (spec 7.1).
--    - valoraciones_asesoria INSERT: valorar sin ser autor de la consulta.
--    - consultas INSERT: crear consultas sin agrupar (nAlumnos falso).
--    - encuestas / preguntas / respuestas INSERT: encuestas sin umbral ni alcance,
--      respuestas sin envío pendiente.
--    Ahora solo se escribe en ellas a través de las funciones del servidor.
-- ------------------------------------------------------------------------------
drop policy if exists "Destinatario actualiza su estado de envio" on public.envios_encuesta;
drop policy if exists "Asesor inserta su orientacion" on public.asesorias;
drop policy if exists "Alumnos ciclo 5 o superior orientan" on public.asesorias;
drop policy if exists "Autores de la consulta valoran la asesoria" on public.valoraciones_asesoria;
drop policy if exists "Solo autor valora orientacion" on public.valoraciones_asesoria;
drop policy if exists "Alumnos crean sus propias consultas" on public.consultas;
drop policy if exists "Insercion de consultas para autenticados" on public.consultas;
drop policy if exists "Autores crean encuestas" on public.encuestas;
drop policy if exists "Autores insertan preguntas en sus encuestas" on public.preguntas;
drop policy if exists "Destinatario inserta sus respuestas" on public.respuestas;

-- ------------------------------------------------------------------------------
-- 3. CERTIFICADOS (spec 5.5): el nivel y el origen los decide el servidor
--    El alumno podía guardar nivel "Avanzado" u origen "verificada" a mano.
-- ------------------------------------------------------------------------------
create or replace function public.clasificar_certificado()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        new.habilidad := trim(new.habilidad);
        new.emisor := trim(new.emisor);
        if length(new.habilidad) < 2 or length(new.emisor) < 2 then
            raise exception 'KAMPUZ_CERTIFICADO: Indica la habilidad y quién emitió el certificado.';
        end if;
        new.horas := greatest(coalesce(new.horas, 0), 0);
        new.tiene_evaluacion := coalesce(new.tiene_evaluacion, false);
        -- clasificar(horas, tieneEvaluacion): > 60 Avanzado; >= 20 o evaluación Intermedio; si no Básico
        new.nivel := case
            when new.horas > 60 then 'Avanzado'
            when new.horas >= 20 or new.tiene_evaluacion then 'Intermedio'
            else 'Básico'
        end;
        -- Con enlace verificable es "con evidencia"; sin enlace queda un escalón abajo (declarada).
        -- "respaldada" y "verificada" no las puede poner el alumno.
        new.url := nullif(trim(coalesce(new.url, '')), '');
        if new.url is not null and new.url !~* '^https?://' then
            raise exception 'KAMPUZ_CERTIFICADO: El enlace de verificación debe empezar con https://';
        end if;
        new.origen := case when new.url is not null or new.archivo_url is not null then 'con_evidencia' else 'declarada' end;
        new.propuesto_por_agente := false;
        new.aprobado := true;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_clasificar_certificado on public.certificados;
create trigger trg_clasificar_certificado
    before insert or update on public.certificados
    for each row
    execute function public.clasificar_certificado();

-- ------------------------------------------------------------------------------
-- 4. STORAGE: el bucket de avatares solo acepta imágenes pequeñas
-- ------------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 1048576, -- 1 MB (el cliente comprime a < 300 KB)
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatares';

-- ------------------------------------------------------------------------------
-- 5. FUNCIONES: nada de negocio ejecutable sin sesión
-- ------------------------------------------------------------------------------
revoke all on function public.umbral_visibilidad() from public, anon;
grant execute on function public.umbral_visibilidad() to authenticated;

-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 013: Login con @usuario sin exponer correos y textos de "Contacto"
-- Sprint de 2 días (docs/PROMPT_SPRINT_2_DIAS.md, punto 1).
-- Idempotente: se puede ejecutar más de una vez.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LOGIN CON @USUARIO
--    obtener_correo_por_identificador (008/009) le devolvía a cualquiera, sin sesión,
--    el correo de un @usuario. Ahora el login con @usuario pasa por la Edge Function
--    `login` (supabase/functions/login), que resuelve el correo con la service role
--    y devuelve solo la sesión. La función pública se elimina.
-- ------------------------------------------------------------------------------
drop function if exists public.obtener_correo_por_identificador(text);

-- ------------------------------------------------------------------------------
-- 2. "CONTACTO" EN LOS MENSAJES DEL SERVIDOR
--    La relación entre dos alumnos que aceptaron una solicitud se llama "Contacto".
--    Mismas reglas que en 010; solo cambian los textos que ve el alumno.
-- ------------------------------------------------------------------------------
create or replace function public.enviar_solicitud(p_a_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_de uuid := auth.uid();
    v_motivo text := trim(coalesce(p_motivo, ''));
    v_previa record;
    v_id uuid;
begin
    if v_de is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    if p_a_id = v_de then
        raise exception 'KAMPUZ_SOLICITUD: No puedes enviarte una solicitud a ti mismo.';
    end if;
    if length(v_motivo) < 5 then
        raise exception 'KAMPUZ_SOLICITUD: Escribe el motivo de tu solicitud (mínimo 5 caracteres).';
    end if;
    if length(v_motivo) > 300 then
        raise exception 'KAMPUZ_SOLICITUD: El motivo es muy largo (máximo 300 caracteres).';
    end if;
    if not exists (select 1 from public.perfiles where id = v_de) then
        raise exception 'KAMPUZ_SOLICITUD: Completa tu perfil antes de enviar solicitudes.';
    end if;
    if not exists (select 1 from public.perfiles where id = p_a_id) or public.hay_bloqueo(v_de, p_a_id) then
        raise exception 'KAMPUZ_SOLICITUD: No puedes contactar a este estudiante.';
    end if;
    if exists (
        select 1 from public.conversaciones
        where usuario_a_id = least(v_de, p_a_id) and usuario_b_id = greatest(v_de, p_a_id)
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Ya son contactos. Abre el chat desde "Chats".';
    end if;
    if exists (
        select 1 from public.solicitudes_mensaje
        where de_id = p_a_id and a_id = v_de and estado = 'pendiente'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Esta persona ya te envió una solicitud. Revísala en Solicitudes.';
    end if;

    select * into v_previa from public.solicitudes_mensaje where de_id = v_de and a_id = p_a_id;
    if found then
        if v_previa.estado = 'pendiente' then
            raise exception 'KAMPUZ_SOLICITUD: Ya le enviaste una solicitud. Espera su respuesta.';
        elsif v_previa.estado = 'rechazada' then
            raise exception 'KAMPUZ_SOLICITUD: Esta persona no aceptó tu solicitud anterior.';
        else
            raise exception 'KAMPUZ_SOLICITUD: Ya son contactos. Abre el chat desde "Chats".';
        end if;
    end if;

    insert into public.solicitudes_mensaje (de_id, a_id, motivo, estado)
    values (v_de, p_a_id, v_motivo, 'pendiente')
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.enviar_solicitud(uuid, text) from public, anon;
grant execute on function public.enviar_solicitud(uuid, text) to authenticated;

create or replace function public.responder_solicitud(p_solicitud_id uuid, p_aceptar boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sol record;
begin
    select * into v_sol from public.solicitudes_mensaje where id = p_solicitud_id for update;
    if not found or v_sol.a_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_SOLICITUD: No encontramos esta solicitud.';
    end if;

    if v_sol.estado = 'pendiente' then
        update public.solicitudes_mensaje
        set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
            respondido_en = now()
        where id = p_solicitud_id;
    elsif v_sol.estado = 'rechazada' and p_aceptar then
        raise exception 'KAMPUZ_SOLICITUD: Ya ignoraste esta solicitud.';
    end if;

    if p_aceptar then
        if public.hay_bloqueo(v_sol.de_id, v_sol.a_id) then
            raise exception 'KAMPUZ_SOLICITUD: No puedes agregar a este estudiante como contacto.';
        end if;
        return public.asegurar_conversacion(v_sol.de_id, v_sol.a_id);
    end if;
    return null;
end;
$$;

revoke all on function public.responder_solicitud(uuid, boolean) from public, anon;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;

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

-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 015: Tablón "Pasando hoy"
-- Sprint de 2 días (docs/PROMPT_SPRINT_2_DIAS.md, punto 2).
-- Un solo tablón con 4 tipos: plan, ayuda, evento y mercadito.
-- Idempotente: se puede ejecutar más de una vez.
--
-- Permisos: Supabase da EXECUTE a anon y authenticated en cada función nueva.
-- Aquí cada función empieza quitándoselo a public y anon; solo las que llama la
-- app se le dan a authenticated. Las de trigger no se le dan a nadie.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. UNIVERSIDAD EN EL PERFIL
--    El tablón se lee por universidad. Hoy todos son de la UTP; la columna deja
--    lista la base para otra universidad (punto 4 del sprint). El alumno no puede
--    cambiársela.
-- ------------------------------------------------------------------------------
alter table public.perfiles add column if not exists universidad text not null default 'UTP';

create or replace function public.proteger_universidad_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'INSERT' then
            new.universidad := 'UTP';
        else
            new.universidad := old.universidad;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_proteger_universidad_perfil on public.perfiles;
create trigger trg_proteger_universidad_perfil
    before insert or update on public.perfiles
    for each row
    execute function public.proteger_universidad_perfil();

revoke all on function public.proteger_universidad_perfil() from public, anon, authenticated;

create or replace function public.mi_universidad()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select universidad from public.perfiles where id = auth.uid();
$$;

revoke all on function public.mi_universidad() from public, anon;
grant execute on function public.mi_universidad() to authenticated;

-- ------------------------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------------------------
create table if not exists public.publicaciones (
    id uuid primary key default gen_random_uuid(),
    autor_id uuid not null references public.perfiles(id) on delete cascade,
    universidad text not null,
    sede text,
    tipo text not null check (tipo in ('plan', 'ayuda', 'evento', 'mercadito')),
    titulo text not null check (char_length(titulo) between 3 and 80),
    descripcion text check (descripcion is null or char_length(descripcion) <= 500),
    lugar text check (lugar is null or char_length(lugar) <= 80),
    empieza_en timestamptz,
    vence_en timestamptz not null,
    cupo integer check (cupo is null or cupo between 1 and 200),
    precio numeric(8, 2) check (precio is null or precio between 0 and 10000),
    foto_url text check (foto_url is null or (foto_url not like 'data:%' and char_length(foto_url) <= 500)),
    estado text not null default 'activa' check (estado in ('activa', 'cerrada', 'eliminada')),
    creado_en timestamptz not null default now(),
    constraint publicaciones_precio_solo_mercadito check (precio is null or tipo = 'mercadito')
);

create index if not exists idx_publicaciones_tablon
    on public.publicaciones (universidad, sede, vence_en)
    where estado = 'activa';
create index if not exists idx_publicaciones_autor on public.publicaciones (autor_id, estado);

create table if not exists public.publicacion_respuestas (
    publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
    usuario_id uuid not null references public.perfiles(id) on delete cascade,
    tipo text not null check (tipo in ('voy', 'ayudo', 'asistire', 'interesa')),
    creado_en timestamptz not null default now(),
    primary key (publicacion_id, usuario_id)
);

create index if not exists idx_publicacion_respuestas_usuario on public.publicacion_respuestas (usuario_id);

-- ------------------------------------------------------------------------------
-- 2. MODERACIÓN ANTI-TRAMPA (mercadito y ayuda)
--    Mismo enfoque que la moderación de consultas: expresiones regulares en el
--    servidor. Se detecta ofrecer resolver evaluaciones, hacer trabajos o vender
--    respuestas. "Tutorías de Cálculo" o "vendo mis apuntes" sí se permiten.
-- ------------------------------------------------------------------------------
create or replace function public.texto_ofrece_trampa(p_texto text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
    t text := translate(lower(coalesce(p_texto, '')), 'áéíóúü', 'aeiouu');
    v_eval text := '(examen|examenes|parcial|parciales|final|finales|practica|practicas|pc|pcs|quiz|quices|evaluacion|evaluaciones|trabajo|trabajos|tarea|tareas|tesis|laboratorio|laboratorios|monografia|monografias)';
begin
    return
        -- "resuelvo tu examen", "hago tu trabajo", "hacemos tareas"
        t ~ ('\m(resuelvo|resolvemos|resuelve|resolver|hago|hacemos|te hago|les hago|realizo|realizamos|desarrollo|desarrollamos)\s+((tu|tus|el|los|la|las|su|sus|cualquier)\s+)?' || v_eval || '\M')
        -- "te paso las respuestas", "vendo solucionario", "tengo las claves"
        or t ~ '\m(te paso|les paso|paso|vendo|venta de|ofrezco|tengo)\s+((las|los|el|la)\s+)?(respuestas|solucionario|solucionarios|claves)\M'
        -- "solucionario del examen", "respuestas del parcial"
        or t ~ '\m(solucionarios?|respuestas|claves)\s+(del|de la|de los|de las|de|para el|para la|para)\s+(examen|examenes|parcial|parciales|final|pc|practica|evaluacion|quiz)\M'
        -- "exámenes resueltos", "tareas resueltas"
        or t ~ ('\m' || v_eval || '\s+(resuelto|resueltos|resuelta|resueltas)\M')
        -- "rindo tu examen", "doy tu parcial"
        or t ~ '\m(rindo|doy|rendimos)\s+(tu|tus|el|los|su)\s+(examen|examenes|parcial|parciales|final|evaluacion)\M';
end;
$$;

-- La llama el trigger preparar_publicacion con los permisos del alumno. Es una
-- función pura (no lee datos), así que authenticated puede ejecutarla; anon no.
revoke all on function public.texto_ofrece_trampa(text) from public, anon;
grant execute on function public.texto_ofrece_trampa(text) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. REGLAS DE UNA PUBLICACIÓN (trigger): autor, sede, vencimiento, límites,
--    antispam y moderación. Lo que mande el cliente en esos campos se ignora.
-- ------------------------------------------------------------------------------
create or replace function public.preparar_publicacion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_univ text;
    v_sede text;
    v_activas integer;
    v_mercadito integer;
    v_fin_dia timestamptz := (date_trunc('day', now() at time zone 'America/Lima') + interval '1 day') at time zone 'America/Lima';
    v_desde_app boolean := current_user in ('anon', 'authenticated');
begin
    new.titulo := trim(coalesce(new.titulo, ''));
    new.descripcion := nullif(trim(coalesce(new.descripcion, '')), '');
    new.lugar := nullif(trim(coalesce(new.lugar, '')), '');

    if char_length(new.titulo) < 3 then
        raise exception 'KAMPUZ_TABLON: Escribe un título de al menos 3 caracteres.';
    end if;
    if char_length(new.titulo) > 80 then
        raise exception 'KAMPUZ_TABLON: El título es muy largo (máximo 80 caracteres).';
    end if;
    if char_length(coalesce(new.descripcion, '')) > 500 then
        raise exception 'KAMPUZ_TABLON: La descripción es muy larga (máximo 500 caracteres).';
    end if;
    if char_length(coalesce(new.lugar, '')) > 80 then
        raise exception 'KAMPUZ_TABLON: El lugar es muy largo (máximo 80 caracteres).';
    end if;

    if tg_op = 'INSERT' then
        if v_desde_app then
            new.autor_id := auth.uid();
        end if;
        select universidad, sede into v_univ, v_sede from public.perfiles where id = new.autor_id;
        if not found then
            raise exception 'KAMPUZ_TABLON: Completa tu perfil antes de publicar.';
        end if;
        new.universidad := v_univ;
        new.sede := v_sede;
        new.estado := 'activa';
        new.creado_en := now();

        -- Campos que solo tienen sentido en algunos tipos
        if new.tipo <> 'mercadito' then
            new.precio := null;
        end if;
        if new.tipo in ('ayuda', 'mercadito') then
            new.cupo := null;
        end if;

        -- Vencimiento según el tipo
        if new.tipo = 'plan' then
            new.empieza_en := coalesce(new.empieza_en, now());
            new.vence_en := least(coalesce(new.vence_en, now() + interval '3 hours'), v_fin_dia);
        elsif new.tipo = 'ayuda' then
            new.empieza_en := now();
            new.vence_en := least(coalesce(new.vence_en, now() + interval '2 hours'), now() + interval '24 hours');
        elsif new.tipo = 'evento' then
            if new.empieza_en is null then
                raise exception 'KAMPUZ_TABLON: Indica la fecha y hora del evento.';
            end if;
            if new.empieza_en < now() - interval '1 hour' then
                raise exception 'KAMPUZ_TABLON: La fecha del evento ya pasó.';
            end if;
            if new.empieza_en > now() + interval '90 days' then
                raise exception 'KAMPUZ_TABLON: El evento debe ser dentro de los próximos 90 días.';
            end if;
            new.vence_en := coalesce(new.vence_en, new.empieza_en + interval '3 hours');
            if new.vence_en <= new.empieza_en then
                new.vence_en := new.empieza_en + interval '3 hours';
            end if;
        else -- mercadito
            new.empieza_en := now();
            new.vence_en := now() + interval '7 days';
        end if;

        if new.vence_en <= now() then
            raise exception 'KAMPUZ_TABLON: Esa hora ya pasó. Elige una más tarde.';
        end if;

        -- Antispam: 5 publicaciones activas por alumno y 3 en el mercadito
        select count(*), count(*) filter (where tipo = 'mercadito')
        into v_activas, v_mercadito
        from public.publicaciones
        where autor_id = new.autor_id and estado = 'activa' and vence_en > now();

        if v_activas >= 5 then
            raise exception 'KAMPUZ_TABLON: Ya tienes 5 publicaciones activas. Cierra alguna para publicar otra.';
        end if;
        if new.tipo = 'mercadito' and v_mercadito >= 3 then
            raise exception 'KAMPUZ_TABLON: Ya tienes 3 publicaciones en el mercadito. Cierra alguna para publicar otra.';
        end if;
    else
        -- El autor puede editar textos, precio, cupo y cerrar; nada más
        new.id := old.id;
        new.autor_id := old.autor_id;
        new.universidad := old.universidad;
        new.sede := old.sede;
        new.tipo := old.tipo;
        new.empieza_en := old.empieza_en;
        new.vence_en := old.vence_en;
        new.creado_en := old.creado_en;
        if old.estado <> 'activa' and new.estado = 'activa' then
            raise exception 'KAMPUZ_TABLON: Una publicación cerrada no se puede volver a abrir. Crea una nueva.';
        end if;
        if old.estado = 'eliminada' then
            new.estado := 'eliminada';
        end if;
        if new.tipo <> 'mercadito' then
            new.precio := null;
        end if;
    end if;

    if new.tipo in ('ayuda', 'mercadito')
       and public.texto_ofrece_trampa(new.titulo || ' ' || coalesce(new.descripcion, '')) then
        raise exception 'KAMPUZ_TRAMPA: Kampuz no permite ofrecer ayuda para hacer trampa en evaluaciones. Puedes ofrecer tutorías o apuntes propios.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_preparar_publicacion on public.publicaciones;
create trigger trg_preparar_publicacion
    before insert or update on public.publicaciones
    for each row
    execute function public.preparar_publicacion();

revoke all on function public.preparar_publicacion() from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. REGLAS DE UNA RESPUESTA (trigger): solo publicaciones activas y vigentes,
--    nunca la propia, la acción que corresponde al tipo y sin pasarse del cupo.
--    Bloquea la fila de la publicación para que dos "¡Voy!" a la vez no superen
--    el cupo.
-- ------------------------------------------------------------------------------
create or replace function public.validar_respuesta_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pub record;
    v_esperado text;
    v_total integer;
begin
    select * into v_pub from public.publicaciones where id = new.publicacion_id for update;
    if not found or v_pub.estado <> 'activa' or v_pub.vence_en <= now() then
        raise exception 'KAMPUZ_TABLON: Esta publicación ya terminó.';
    end if;
    if v_pub.autor_id = new.usuario_id then
        raise exception 'KAMPUZ_TABLON: No puedes responder tu propia publicación.';
    end if;
    if public.hay_bloqueo(v_pub.autor_id, new.usuario_id)
       or v_pub.universidad is distinct from (select universidad from public.perfiles where id = new.usuario_id) then
        raise exception 'KAMPUZ_TABLON: No puedes responder esta publicación.';
    end if;

    v_esperado := case v_pub.tipo
        when 'plan' then 'voy'
        when 'ayuda' then 'ayudo'
        when 'evento' then 'asistire'
        else 'interesa'
    end;
    new.tipo := v_esperado;
    new.creado_en := now();

    if v_pub.cupo is not null then
        select count(*) into v_total from public.publicacion_respuestas where publicacion_id = new.publicacion_id;
        if v_total >= v_pub.cupo then
            raise exception 'KAMPUZ_TABLON: Ya no quedan cupos.';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_validar_respuesta_publicacion on public.publicacion_respuestas;
create trigger trg_validar_respuesta_publicacion
    before insert on public.publicacion_respuestas
    for each row
    execute function public.validar_respuesta_publicacion();

revoke all on function public.validar_respuesta_publicacion() from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------------------------
alter table public.publicaciones enable row level security;
alter table public.publicacion_respuestas enable row level security;

revoke all on public.publicaciones from anon;
revoke all on public.publicacion_respuestas from anon;
grant select, insert, update on public.publicaciones to authenticated;
revoke delete on public.publicaciones from authenticated; -- no se borran datos: se cierran
grant select, insert, delete on public.publicacion_respuestas to authenticated;
revoke update on public.publicacion_respuestas from authenticated;

-- Leen los alumnos de la misma universidad (sin bloqueos). Las vencidas se filtran
-- en las consultas (vence_en > now()) para que el autor siga viendo su historial.
drop policy if exists "Alumnos de la universidad leen publicaciones" on public.publicaciones;
create policy "Alumnos de la universidad leen publicaciones"
    on public.publicaciones for select
    to authenticated
    using (
        autor_id = auth.uid()
        or (
            estado <> 'eliminada'
            and universidad = public.mi_universidad()
            and not public.hay_bloqueo(autor_id, auth.uid())
        )
    );

drop policy if exists "Alumnos publican a su nombre" on public.publicaciones;
create policy "Alumnos publican a su nombre"
    on public.publicaciones for insert
    to authenticated
    with check (autor_id = auth.uid());

drop policy if exists "Solo el autor edita o cierra" on public.publicaciones;
create policy "Solo el autor edita o cierra"
    on public.publicaciones for update
    to authenticated
    using (autor_id = auth.uid())
    with check (autor_id = auth.uid());

-- Quién va a un plan o evento lo ven todos; quién ofreció ayuda o se interesó en
-- el mercadito solo lo ven el autor de la publicación y quien respondió.
drop policy if exists "Ver respuestas de publicaciones" on public.publicacion_respuestas;
create policy "Ver respuestas de publicaciones"
    on public.publicacion_respuestas for select
    to authenticated
    using (
        usuario_id = auth.uid()
        or exists (
            select 1 from public.publicaciones p
            where p.id = publicacion_respuestas.publicacion_id
              and (
                  p.autor_id = auth.uid()
                  or (
                      p.tipo in ('plan', 'evento')
                      and p.estado <> 'eliminada'
                      and p.universidad = public.mi_universidad()
                      and not public.hay_bloqueo(p.autor_id, auth.uid())
                  )
              )
        )
    );

drop policy if exists "Cada alumno agrega su respuesta" on public.publicacion_respuestas;
create policy "Cada alumno agrega su respuesta"
    on public.publicacion_respuestas for insert
    to authenticated
    with check (usuario_id = auth.uid());

drop policy if exists "Cada alumno quita su respuesta" on public.publicacion_respuestas;
create policy "Cada alumno quita su respuesta"
    on public.publicacion_respuestas for delete
    to authenticated
    using (usuario_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 6. "YO TE AYUDO": chat directo sin solicitud, solo para esa publicación
--    La conversación queda marcada con origen 'ayuda' y la publicación. No cuenta
--    como contacto y se puede escribir hasta 2 días después de que vence la
--    publicación. Si después se aceptan como contactos, pasa a origen 'solicitud'.
-- ------------------------------------------------------------------------------
alter table public.conversaciones add column if not exists origen text not null default 'solicitud';
alter table public.conversaciones add column if not exists publicacion_id uuid references public.publicaciones(id) on delete set null;

do $$
begin
    alter table public.conversaciones
        add constraint conversaciones_origen_valido check (origen in ('solicitud', 'ayuda'));
exception when duplicate_object then null;
end $$;

create or replace function public.puede_escribir_conversacion(p_conversacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.conversaciones c
        left join public.publicaciones p on p.id = c.publicacion_id
        where c.id = p_conversacion_id
          and auth.uid() in (c.usuario_a_id, c.usuario_b_id)
          and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
          and (
              c.origen = 'solicitud'
              or (p.id is not null and p.estado <> 'eliminada' and now() < p.vence_en + interval '2 days')
          )
    );
$$;

revoke all on function public.puede_escribir_conversacion(uuid) from public, anon;
grant execute on function public.puede_escribir_conversacion(uuid) to authenticated;

drop policy if exists "Interlocutores envian mensajes directos" on public.mensajes_directos;
create policy "Interlocutores envian mensajes directos"
    on public.mensajes_directos for insert
    to authenticated
    with check (
        auth.uid() = autor_id
        and length(trim(texto)) between 1 and 2000
        and public.puede_escribir_conversacion(conversacion_id)
    );

create or replace function public.ofrecer_ayuda(p_publicacion_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
    v_pub record;
    v_conv uuid;
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    select * into v_pub from public.publicaciones where id = p_publicacion_id;
    if not found or v_pub.tipo <> 'ayuda' then
        raise exception 'KAMPUZ_TABLON: No encontramos esta publicación.';
    end if;

    -- El trigger valida que siga activa, que no sea propia y que no haya bloqueo
    insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo)
    values (p_publicacion_id, v_yo, 'ayudo')
    on conflict (publicacion_id, usuario_id) do nothing;

    select id into v_conv from public.conversaciones
    where usuario_a_id = least(v_yo, v_pub.autor_id) and usuario_b_id = greatest(v_yo, v_pub.autor_id);

    if v_conv is null then
        insert into public.conversaciones (usuario_a_id, usuario_b_id, origen, publicacion_id)
        values (least(v_yo, v_pub.autor_id), greatest(v_yo, v_pub.autor_id), 'ayuda', p_publicacion_id)
        returning id into v_conv;
    else
        -- Ya tenían un chat de ayuda por otra publicación: se vincula a esta
        update public.conversaciones
        set publicacion_id = p_publicacion_id
        where id = v_conv and origen = 'ayuda';
    end if;

    return v_conv;
end;
$$;

revoke all on function public.ofrecer_ayuda(uuid) from public, anon;
grant execute on function public.ofrecer_ayuda(uuid) to authenticated;

-- Solicitudes: un chat de ayuda no impide agregarse como contactos (013 + origen)
create or replace function public.enviar_solicitud(p_a_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_de uuid := auth.uid();
    v_motivo text := trim(coalesce(p_motivo, ''));
    v_previa record;
    v_id uuid;
begin
    if v_de is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    if p_a_id = v_de then
        raise exception 'KAMPUZ_SOLICITUD: No puedes enviarte una solicitud a ti mismo.';
    end if;
    if length(v_motivo) < 5 then
        raise exception 'KAMPUZ_SOLICITUD: Escribe el motivo de tu solicitud (mínimo 5 caracteres).';
    end if;
    if length(v_motivo) > 300 then
        raise exception 'KAMPUZ_SOLICITUD: El motivo es muy largo (máximo 300 caracteres).';
    end if;
    if not exists (select 1 from public.perfiles where id = v_de) then
        raise exception 'KAMPUZ_SOLICITUD: Completa tu perfil antes de enviar solicitudes.';
    end if;
    if not exists (select 1 from public.perfiles where id = p_a_id) or public.hay_bloqueo(v_de, p_a_id) then
        raise exception 'KAMPUZ_SOLICITUD: No puedes contactar a este estudiante.';
    end if;
    if exists (
        select 1 from public.conversaciones
        where usuario_a_id = least(v_de, p_a_id) and usuario_b_id = greatest(v_de, p_a_id)
          and origen = 'solicitud'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Ya son contactos. Abre el chat desde "Chats".';
    end if;
    if exists (
        select 1 from public.solicitudes_mensaje
        where de_id = p_a_id and a_id = v_de and estado = 'pendiente'
    ) then
        raise exception 'KAMPUZ_SOLICITUD: Esta persona ya te envió una solicitud. Revísala en Solicitudes.';
    end if;

    select * into v_previa from public.solicitudes_mensaje where de_id = v_de and a_id = p_a_id;
    if found then
        if v_previa.estado = 'pendiente' then
            raise exception 'KAMPUZ_SOLICITUD: Ya le enviaste una solicitud. Espera su respuesta.';
        elsif v_previa.estado = 'rechazada' then
            raise exception 'KAMPUZ_SOLICITUD: Esta persona no aceptó tu solicitud anterior.';
        else
            raise exception 'KAMPUZ_SOLICITUD: Ya son contactos. Abre el chat desde "Chats".';
        end if;
    end if;

    insert into public.solicitudes_mensaje (de_id, a_id, motivo, estado)
    values (v_de, p_a_id, v_motivo, 'pendiente')
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.enviar_solicitud(uuid, text) from public, anon;
grant execute on function public.enviar_solicitud(uuid, text) to authenticated;

create or replace function public.responder_solicitud(p_solicitud_id uuid, p_aceptar boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sol record;
    v_conv uuid;
begin
    select * into v_sol from public.solicitudes_mensaje where id = p_solicitud_id for update;
    if not found or v_sol.a_id is distinct from auth.uid() then
        raise exception 'KAMPUZ_SOLICITUD: No encontramos esta solicitud.';
    end if;

    if v_sol.estado = 'pendiente' then
        update public.solicitudes_mensaje
        set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
            respondido_en = now()
        where id = p_solicitud_id;
    elsif v_sol.estado = 'rechazada' and p_aceptar then
        raise exception 'KAMPUZ_SOLICITUD: Ya ignoraste esta solicitud.';
    end if;

    if p_aceptar then
        if public.hay_bloqueo(v_sol.de_id, v_sol.a_id) then
            raise exception 'KAMPUZ_SOLICITUD: No puedes agregar a este estudiante como contacto.';
        end if;
        v_conv := public.asegurar_conversacion(v_sol.de_id, v_sol.a_id);
        -- Si venían de un chat de ayuda, ahora son contactos
        update public.conversaciones set origen = 'solicitud', publicacion_id = null
        where id = v_conv and origen <> 'solicitud';
        return v_conv;
    end if;
    return null;
end;
$$;

revoke all on function public.responder_solicitud(uuid, boolean) from public, anon;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;

-- Bandeja de chats: ahora dice si el chat es de un contacto o de una ayuda
drop function if exists public.mis_conversaciones();
create function public.mis_conversaciones()
returns table (
    id uuid,
    otro_id uuid,
    otro_nombre text,
    otro_apellido text,
    otro_usuario text,
    otro_foto_url text,
    otro_carrera text,
    otro_ciclo integer,
    otro_sede text,
    ultimo_texto text,
    ultimo_autor_id uuid,
    ultimo_en timestamptz,
    no_leidos integer,
    origen text,
    publicacion_id uuid,
    publicacion_titulo text,
    puede_escribir boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        c.id,
        p.id, p.nombre, p.apellido, p.usuario, p.foto_url, p.carrera, p.ciclo, p.sede,
        um.texto, um.autor_id,
        coalesce(um.creado_en, c.abierta_en),
        (
            select count(*)::integer from public.mensajes_directos m
            where m.conversacion_id = c.id and m.autor_id <> auth.uid() and not m.leido
        ),
        c.origen,
        c.publicacion_id,
        pub.titulo,
        public.puede_escribir_conversacion(c.id)
    from public.conversaciones c
    join public.perfiles p
      on p.id = case when c.usuario_a_id = auth.uid() then c.usuario_b_id else c.usuario_a_id end
    left join public.publicaciones pub on pub.id = c.publicacion_id
    left join lateral (
        select m.texto, m.autor_id, m.creado_en
        from public.mensajes_directos m
        where m.conversacion_id = c.id
        order by m.creado_en desc
        limit 1
    ) um on true
    where auth.uid() in (c.usuario_a_id, c.usuario_b_id)
      and not public.hay_bloqueo(c.usuario_a_id, c.usuario_b_id)
    order by coalesce(um.creado_en, c.abierta_en) desc;
$$;

revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mis_conversaciones() to authenticated;

-- ------------------------------------------------------------------------------
-- 7. "ME INTERESA" (mercadito): registra el interés y manda una solicitud de
--    mensaje con el motivo ya escrito (si todavía no son contactos).
--    Devuelve: 'contacto' | 'solicitud_enviada' | 'solicitud_pendiente' | 'registrado'
-- ------------------------------------------------------------------------------
create or replace function public.me_interesa(p_publicacion_id uuid, p_motivo text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
    v_pub record;
    v_motivo text;
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    select * into v_pub from public.publicaciones where id = p_publicacion_id;
    if not found or v_pub.tipo <> 'mercadito' then
        raise exception 'KAMPUZ_TABLON: No encontramos esta publicación.';
    end if;

    insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo)
    values (p_publicacion_id, v_yo, 'interesa')
    on conflict (publicacion_id, usuario_id) do nothing;

    if exists (
        select 1 from public.conversaciones
        where usuario_a_id = least(v_yo, v_pub.autor_id) and usuario_b_id = greatest(v_yo, v_pub.autor_id)
          and origen = 'solicitud'
    ) then
        return 'contacto';
    end if;

    if exists (
        select 1 from public.solicitudes_mensaje
        where estado = 'pendiente'
          and ((de_id = v_yo and a_id = v_pub.autor_id) or (de_id = v_pub.autor_id and a_id = v_yo))
    ) then
        return 'solicitud_pendiente';
    end if;

    if exists (select 1 from public.solicitudes_mensaje where de_id = v_yo and a_id = v_pub.autor_id) then
        return 'registrado'; -- ya hubo una solicitud que no se aceptó: no se insiste
    end if;

    v_motivo := left(coalesce(nullif(trim(p_motivo), ''),
        'Hola, me interesa tu publicación "' || v_pub.titulo || '" del mercadito.'), 300);
    perform public.enviar_solicitud(v_pub.autor_id, v_motivo);
    return 'solicitud_enviada';
end;
$$;

revoke all on function public.me_interesa(uuid, text) from public, anon;
grant execute on function public.me_interesa(uuid, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 8. LECTURA DEL TABLÓN (una sola llamada)
--    Publicaciones activas y vigentes de mi sede, con el autor, si es mía, mi
--    respuesta, el total de respuestas y hasta 5 participantes (solo en planes y
--    eventos, o si la publicación es mía).
-- ------------------------------------------------------------------------------
create or replace function public.tablon(p_tipo text default null)
returns table (
    id uuid,
    tipo text,
    titulo text,
    descripcion text,
    lugar text,
    empieza_en timestamptz,
    vence_en timestamptz,
    cupo integer,
    precio numeric,
    foto_url text,
    creado_en timestamptz,
    autor_id uuid,
    autor_nombre text,
    autor_apellido text,
    autor_usuario text,
    autor_foto_url text,
    autor_carrera text,
    autor_ciclo integer,
    es_mia boolean,
    mi_respuesta text,
    total_respuestas integer,
    participantes jsonb
)
language sql
stable
security definer
set search_path = public
as $$
    with yo as (
        select id, universidad, sede from public.perfiles where id = auth.uid()
    )
    select
        pu.id, pu.tipo, pu.titulo, pu.descripcion, pu.lugar, pu.empieza_en, pu.vence_en,
        pu.cupo, pu.precio, pu.foto_url, pu.creado_en,
        a.id, a.nombre, a.apellido, a.usuario, a.foto_url, a.carrera, a.ciclo,
        pu.autor_id = yo.id,
        (select r.tipo from public.publicacion_respuestas r where r.publicacion_id = pu.id and r.usuario_id = yo.id),
        (select count(*)::integer from public.publicacion_respuestas r where r.publicacion_id = pu.id),
        case when pu.tipo in ('plan', 'evento') or pu.autor_id = yo.id then
            coalesce((
                select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'foto_url', x.foto_url) order by x.creado_en)
                from (
                    select pe.id, pe.nombre, pe.foto_url, r.creado_en
                    from public.publicacion_respuestas r
                    join public.perfiles pe on pe.id = r.usuario_id
                    where r.publicacion_id = pu.id and not public.hay_bloqueo(pe.id, yo.id)
                    order by r.creado_en
                    limit 5
                ) x
            ), '[]'::jsonb)
        else '[]'::jsonb end
    from public.publicaciones pu
    cross join yo
    join public.perfiles a on a.id = pu.autor_id
    where pu.estado = 'activa'
      and pu.vence_en > now()
      and pu.universidad = yo.universidad
      and pu.sede is not distinct from yo.sede
      and (p_tipo is null or pu.tipo = p_tipo)
      and not public.hay_bloqueo(pu.autor_id, yo.id)
    order by
        case when pu.tipo = 'evento' then pu.empieza_en end asc nulls last,
        pu.creado_en desc
    limit 100;
$$;

revoke all on function public.tablon(text) from public, anon;
grant execute on function public.tablon(text) to authenticated;

-- Quiénes respondieron una publicación mía (para "Ver quiénes respondieron")
-- drop: la 016 agrega columnas al resultado; sin esto, volver a correr 015 fallaría
drop function if exists public.respuestas_publicacion(uuid);
create function public.respuestas_publicacion(p_publicacion_id uuid)
returns table (
    usuario_id uuid,
    nombre text,
    apellido text,
    usuario text,
    foto_url text,
    carrera text,
    ciclo integer,
    tipo text,
    creado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.publicaciones where id = p_publicacion_id and autor_id = auth.uid()) then
        raise exception 'KAMPUZ_TABLON: Solo el autor ve quiénes respondieron.';
    end if;
    return query
        select pe.id, pe.nombre, pe.apellido, pe.usuario, pe.foto_url, pe.carrera, pe.ciclo, r.tipo, r.creado_en
        from public.publicacion_respuestas r
        join public.perfiles pe on pe.id = r.usuario_id
        where r.publicacion_id = p_publicacion_id
          and not public.hay_bloqueo(pe.id, auth.uid())
        order by r.creado_en;
end;
$$;

revoke all on function public.respuestas_publicacion(uuid) from public, anon;
grant execute on function public.respuestas_publicacion(uuid) to authenticated;

-- "Recién llegados" del Inicio (punto 3): alumnos nuevos de OTRAS carreras de mi
-- sede con los que todavía no tengo relación (ni contacto ni solicitud) ni bloqueo.
-- Empuja la métrica del producto: interacciones entre carreras.
create or replace function public.recien_llegados(p_limite integer default 5)
returns table (
    id uuid,
    nombre text,
    apellido text,
    usuario text,
    foto_url text,
    carrera text,
    ciclo integer,
    creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    with yo as (
        select id, universidad, sede, carrera from public.perfiles where id = auth.uid()
    )
    select p.id, p.nombre, p.apellido, p.usuario, p.foto_url, p.carrera, p.ciclo, p.creado_en
    from public.perfiles p
    cross join yo
    where p.id <> yo.id
      and p.universidad = yo.universidad
      and p.sede is not distinct from yo.sede
      and p.carrera is distinct from yo.carrera
      and not public.hay_bloqueo(p.id, yo.id)
      and not exists (
          select 1 from public.conversaciones c
          where c.usuario_a_id = least(p.id, yo.id) and c.usuario_b_id = greatest(p.id, yo.id)
            and c.origen = 'solicitud'
      )
      and not exists (
          select 1 from public.solicitudes_mensaje s
          where (s.de_id = yo.id and s.a_id = p.id) or (s.de_id = p.id and s.a_id = yo.id)
      )
    order by p.creado_en desc
    limit least(greatest(coalesce(p_limite, 5), 1), 10);
$$;

revoke all on function public.recien_llegados(integer) from public, anon;
grant execute on function public.recien_llegados(integer) to authenticated;

-- ------------------------------------------------------------------------------
-- 9. REPORTES DE PUBLICACIONES (tabla reportes existente)
-- ------------------------------------------------------------------------------
alter table public.reportes drop constraint if exists reportes_tipo_check;
alter table public.reportes
    add constraint reportes_tipo_check
    check (tipo in ('mensaje', 'perfil', 'espacio', 'consulta', 'mensaje_directo', 'publicacion'));

-- ------------------------------------------------------------------------------
-- 10. FOTO OPCIONAL (eventos y mercadito) en Storage
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('publicaciones', 'publicaciones', true)
on conflict (id) do update set public = true;

update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'publicaciones';

drop policy if exists "Fotos de publicaciones son publicas" on storage.objects;
create policy "Fotos de publicaciones son publicas"
    on storage.objects for select
    to public
    using (bucket_id = 'publicaciones');

drop policy if exists "Alumnos suben fotos de publicaciones en su carpeta" on storage.objects;
create policy "Alumnos suben fotos de publicaciones en su carpeta"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Alumnos borran fotos de publicaciones de su carpeta" on storage.objects;
create policy "Alumnos borran fotos de publicaciones de su carpeta"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------------------------
-- 11. REALTIME: los "¡Voy!" y las publicaciones nuevas se ven en vivo
-- ------------------------------------------------------------------------------
do $$
begin
    begin
        alter publication supabase_realtime add table public.publicaciones;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.publicacion_respuestas;
    exception when duplicate_object then null;
    end;
end $$;

-- ==============================================================================
-- KAMPUZ - MIGRACIÓN 016: Arreglos del tablón y del chat
-- Idempotente: se puede ejecutar más de una vez.
-- Funciones nuevas: sin EXECUTE para public ni anon; authenticated solo en las
-- que llama la app.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. "ME INTERESA" ENTRE CONTACTOS
--    Si ya son contactos, en vez de una solicitud se envía un mensaje en su chat:
--    'Hola, me interesa tu publicación «TÍTULO» del mercadito.' (solo la primera
--    vez que se toca). Si no son contactos, la solicitud lleva ese mismo motivo.
-- ------------------------------------------------------------------------------
create or replace function public.me_interesa(p_publicacion_id uuid, p_motivo text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
    v_pub record;
    v_nueva integer;
    v_conv uuid;
    v_texto text;
begin
    if v_yo is null then
        raise exception 'KAMPUZ_SESION: Tu sesión expiró. Vuelve a iniciar sesión.';
    end if;
    select * into v_pub from public.publicaciones where id = p_publicacion_id;
    if not found or v_pub.tipo <> 'mercadito' then
        raise exception 'KAMPUZ_TABLON: No encontramos esta publicación.';
    end if;

    -- El trigger valida que siga activa, que no sea propia y que no haya bloqueo
    insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo)
    values (p_publicacion_id, v_yo, 'interesa')
    on conflict (publicacion_id, usuario_id) do nothing;
    get diagnostics v_nueva = row_count;

    v_texto := left('Hola, me interesa tu publicación «' || v_pub.titulo || '» del mercadito.', 300);

    select id into v_conv from public.conversaciones
    where usuario_a_id = least(v_yo, v_pub.autor_id) and usuario_b_id = greatest(v_yo, v_pub.autor_id)
      and origen = 'solicitud';

    if v_conv is not null then
        if v_nueva > 0 and not public.hay_bloqueo(v_yo, v_pub.autor_id) then
            insert into public.mensajes_directos (conversacion_id, autor_id, texto)
            values (v_conv, v_yo, v_texto);
        end if;
        return 'contacto';
    end if;

    if exists (
        select 1 from public.solicitudes_mensaje
        where estado = 'pendiente'
          and ((de_id = v_yo and a_id = v_pub.autor_id) or (de_id = v_pub.autor_id and a_id = v_yo))
    ) then
        return 'solicitud_pendiente';
    end if;

    if exists (select 1 from public.solicitudes_mensaje where de_id = v_yo and a_id = v_pub.autor_id) then
        return 'registrado'; -- ya hubo una solicitud que no se aceptó: no se insiste
    end if;

    perform public.enviar_solicitud(v_pub.autor_id, left(coalesce(nullif(trim(p_motivo), ''), v_texto), 300));
    return 'solicitud_enviada';
end;
$$;

revoke all on function public.me_interesa(uuid, text) from public, anon;
grant execute on function public.me_interesa(uuid, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. "QUIÉNES RESPONDIERON": con qué chat se abre cada persona
--    Para cada persona: su chat conmigo (de contacto o de ayuda) o, si no hay,
--    el estado de una solicitud pendiente entre los dos ('enviada' o 'recibida').
-- ------------------------------------------------------------------------------
drop function if exists public.respuestas_publicacion(uuid);
create function public.respuestas_publicacion(p_publicacion_id uuid)
returns table (
    usuario_id uuid,
    nombre text,
    apellido text,
    usuario text,
    foto_url text,
    carrera text,
    ciclo integer,
    tipo text,
    creado_en timestamptz,
    conversacion_id uuid,
    conversacion_origen text,
    puede_escribir boolean,
    solicitud_pendiente text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_yo uuid := auth.uid();
begin
    if not exists (select 1 from public.publicaciones where id = p_publicacion_id and autor_id = v_yo) then
        raise exception 'KAMPUZ_TABLON: Solo el autor ve quiénes respondieron.';
    end if;
    return query
        select pe.id, pe.nombre, pe.apellido, pe.usuario, pe.foto_url, pe.carrera, pe.ciclo, r.tipo, r.creado_en,
               c.id,
               c.origen,
               case when c.id is null then false else public.puede_escribir_conversacion(c.id) end,
               case
                   when exists (select 1 from public.solicitudes_mensaje s where s.de_id = v_yo and s.a_id = pe.id and s.estado = 'pendiente') then 'enviada'
                   when exists (select 1 from public.solicitudes_mensaje s where s.de_id = pe.id and s.a_id = v_yo and s.estado = 'pendiente') then 'recibida'
               end
        from public.publicacion_respuestas r
        join public.perfiles pe on pe.id = r.usuario_id
        left join public.conversaciones c
          on c.usuario_a_id = least(pe.id, v_yo) and c.usuario_b_id = greatest(pe.id, v_yo)
        where r.publicacion_id = p_publicacion_id
          and not public.hay_bloqueo(pe.id, v_yo)
        order by r.creado_en;
end;
$$;

revoke all on function public.respuestas_publicacion(uuid) from public, anon;
grant execute on function public.respuestas_publicacion(uuid) to authenticated;

-- ==============================================================================
-- KAMPUS MVP - SEED DATA INICIAL
-- Semilla con catálogos UTP, talleres oficiales con horario real y configuración
-- ==============================================================================

-- 1. CONFIGURACIÓN DEL SISTEMA
insert into public.config (clave, valor, descripcion)
values 
    -- PILOTO: 5 en vez de 30 (spec 6.5) porque el piloto tiene ~10 alumnos. Volver a 30
    -- antes de abrir Kampuz a más alumnos. Ver docs/DECISIONES.md 2.1.
    ('umbral_minimo_segmento', '5', 'Mínimo de alumnos en un segmento para enviar encuestas. PILOTO: 5 (la spec pide 30); volver a 30 al abrir a más alumnos.'),
    ('edad_minima_registro', '14', 'Edad mínima para crear un perfil en Kampuz (años cumplidos). No bajar de 14 sin un flujo de consentimiento de los padres.')
on conflict (clave) do update set valor = excluded.valor;

-- 2. CORREOS INVITADOS (únicos correos sin @utp.edu.pe que pueden registrarse)
-- La validación ocurre SOLO en el servidor (trigger trg_validar_auth_user, 009).
-- Para agregar a alguien más (profesor, tester), inserta una fila desde el SQL Editor.
-- kampuz.app.pe+revision@gmail.com llega al mismo buzón del equipo (alias "+" de Gmail):
-- así el equipo verifica la cuenta de revisión de Google sin ningún atajo.
insert into public.correos_invitados (correo, nombre_contacto, rol, motivo, activo)
values
    ('kampuz.app.pe@gmail.com', 'Equipo Kampuz', 'alumno', 'Cuenta del equipo', true),
    ('kampuz.app.pe+revision@gmail.com', 'Revisor Google Play', 'alumno', 'Cuenta de prueba para la revisión de Play Console', true)
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
select id, 'Procesos Industriales', 4 from public.carreras where codigo = 'ind'
on conflict (carrera_id, nombre) do nothing;

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
insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, horario, oficial, estado, link_inscripcion)
select 'taller', 'Taller de Lettering y Caligrafía', 'Taller formativo de expresión gráfica y caligrafía. Registro oficial UTP para actividades de bienestar estudiantil.', '/grupos/lettering.jpg', 'Lima Sur', 'Sábados 10:00 - 12:00 (Aula 302)', true, 'visible', 'https://portal.utp.edu.pe/talleres/lettering-2026'
where not exists (select 1 from public.espacios where nombre = 'Taller de Lettering y Caligrafía');

insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, horario, oficial, estado, link_inscripcion)
select 'taller', 'Taller de Futsal UTP Lima Sur', 'Entrenamientos semanales y preparación para los torneos interfacultades de la universidad.', '/grupos/futsal.jpg', 'Lima Sur', 'Martes y Jueves 17:00 - 19:00 (Cancha Central)', true, 'visible', 'https://portal.utp.edu.pe/talleres/futsal-2026'
where not exists (select 1 from public.espacios where nombre = 'Taller de Futsal UTP Lima Sur');

insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, horario, oficial, estado, link_inscripcion)
select 'taller', 'Taller de Karate Básico', 'Defensa personal y disciplina tradicional. Actividad deportiva extracurricular oficial.', '/grupos/karate.jpg', 'Lima Sur', 'Lunes y Miércoles 18:00 - 19:30 (Sala Multiusos)', true, 'visible', 'https://portal.utp.edu.pe/talleres/karate-2026'
where not exists (select 1 from public.espacios where nombre = 'Taller de Karate Básico');

insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, horario, oficial, estado, link_inscripcion)
select 'taller', 'Taller de IA Aplicada a la Universidad', 'Uso ético y práctico de modelos generativos, automatización de resúmenes y asistencia en investigación.', '/grupos/ia.jpg', 'Lima Sur', 'Viernes 19:00 - 21:00 (Lab 401)', true, 'visible', 'https://portal.utp.edu.pe/talleres/ia-2026'
where not exists (select 1 from public.espacios where nombre = 'Taller de IA Aplicada a la Universidad');

-- 8. ESPACIOS DE CARRERA INICIALES
insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
select 'carrera', 'Comunidad de Enfermería UTP', 'Espacio general para todos los ciclos (1.° al 10.°) de Enfermería Lima Sur. Consultas de cursos, bancos de preguntas, orientación para prácticas e internado.', '/grupos/enfermeria.jpg', 'Enfermería', 'Lima Sur', false, 'visible'
where not exists (select 1 from public.espacios where nombre = 'Comunidad de Enfermería UTP');

insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
select 'carrera', 'Comunidad de Psicología UTP', 'Consultas de cursos teóricos y clínicos, orientación de casos formativos y eventos de salud mental.', '/grupos/carrera_default.jpg', 'Psicología', 'Lima Sur', false, 'visible'
where not exists (select 1 from public.espacios where nombre = 'Comunidad de Psicología UTP');

insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
select 'carrera', 'Comunidad de Ingeniería de Sistemas UTP', 'Dudas de programación, algoritmos, arquitectura de software, bases de datos y hackathons.', '/grupos/carrera_default.jpg', 'Ingeniería de Sistemas e Informática', 'Lima Sur', false, 'visible'
where not exists (select 1 from public.espacios where nombre = 'Comunidad de Ingeniería de Sistemas UTP');

insert into public.espacios (tipo, nombre, descripcion, portada_url, carrera, sede, oficial, estado)
select 'carrera', 'Comunidad de Ingeniería Industrial UTP', 'Consultas sobre optimización de procesos, investigación operativa, calidad y seguridad industrial.', '/grupos/carrera_default.jpg', 'Ingeniería Industrial', 'Lima Sur', false, 'visible'
where not exists (select 1 from public.espacios where nombre = 'Comunidad de Ingeniería Industrial UTP');

-- 9. GRUPOS DE INTERÉS Y COMUNIDADES INICIALES
insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, oficial, estado, umbral_apoyos)
select 'interes', 'Startups & Emprendimiento UTP', 'Espacio para founders estudiantiles, validación de ideas de negocio, búsqueda de co-founders y preparación para incubadoras.', '/grupos/startup.png', 'Lima Sur', false, 'visible', 15
where not exists (select 1 from public.espacios where nombre = 'Startups & Emprendimiento UTP');

insert into public.espacios (tipo, nombre, descripcion, portada_url, sede, oficial, estado, umbral_apoyos)
select 'interes', 'Cinéfilos y Debate UTP', 'Charlas semanales, ciclos de cine clásico y contemporáneo, y análisis crítico audiovisual.', '/grupos/cinefilos.jpg', 'Lima Sur', false, 'visible', 15
where not exists (select 1 from public.espacios where nombre = 'Cinéfilos y Debate UTP');
