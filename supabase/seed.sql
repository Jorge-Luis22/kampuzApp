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
    ('edad_minima_registro', '14', 'Edad mínima para crear un perfil en Kampuz (años cumplidos). No bajar de 14 sin un flujo de consentimiento de los padres.'),
    -- PILOTO (migración 017): 5 apoyos en vez de 15 para abrir un grupo de interés, y "Me ayudó"
    -- acredita estrellas con 1 alumno en vez de 2. Volver a 15 y 2 al abrir a más alumnos.
    ('umbral_apoyos_grupo', '5', 'Mínimo de apoyos para que una propuesta de grupo sea visible. PILOTO: 5 (la spec pide 15); volver a 15 al abrir a más alumnos. El umbral real es el mayor entre este valor y el 3 % de la base.'),
    ('min_alumnos_estrellas', '1', 'Alumnos distintos con la misma duda para que "Me ayudó" acredite estrellas. PILOTO: 1 (la spec pedía 2); volver a 2 al abrir a más alumnos.')
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

-- Los talleres formativos otorgan puntos de una habilidad al terminarlos (migración 017).
-- Los deportivos y recreativos no suman puntos; los crea el personal de la UTP con habilidad y puntos.
update public.espacios
set habilidad_taller = 'Inteligencia artificial', puntos_taller = 20
where tipo = 'taller' and nombre = 'Taller de IA Aplicada a la Universidad' and habilidad_taller is null;

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
