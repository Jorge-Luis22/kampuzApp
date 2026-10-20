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
