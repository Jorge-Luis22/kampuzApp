// Kampus Mock Data — Basado en KAMPUS-spec-antigravity.md

export const UNIVERSIDAD_DEFAULT = {
  id: "utp",
  nombre: "Universidad Tecnológica del Perú",
  sigla: "UTP",
  dominioCorreo: "@utp.edu.pe",
  colorPrimario: "#2F2A6B",
  colorAcento: "#00A896",
  sedeActual: "Lima Sur",
  alumnosEstimadosSede: 19300
};

export const SEDES_UTP = [
  "Lima Sur",
  "Lima Centro",
  "Lima Norte",
  "San Juan de Lurigancho",
  "Ate",
  "Chimbote",
  "Arequipa",
  "Huancayo",
  "Ica",
  "Piura",
  "Trujillo"
];

export const CARRERAS_UTP = [
  { id: "enf", nombre: "Enfermería", facultad: "Ciencias de la Salud" },
  { id: "psi", nombre: "Psicología", facultad: "Humanidades y Ciencias Sociales" },
  { id: "ind", nombre: "Ingeniería Industrial", facultad: "Ingeniería" },
  { id: "sis", nombre: "Ingeniería de Sistemas e Informática", facultad: "Ingeniería" },
  { id: "der", nombre: "Derecho", facultad: "Derecho" },
  { id: "adm", nombre: "Administración de Empresas", facultad: "Negocios" },
  { id: "con", nombre: "Contabilidad", facultad: "Negocios" },
  { id: "arq", nombre: "Arquitectura", facultad: "Arquitectura" },
  { id: "com", nombre: "Ciencias de la Comunicación", facultad: "Comunicaciones" },
  { id: "civ", nombre: "Ingeniería Civil", facultad: "Ingeniería" }
];

export const CURSOS_ENFERMERIA = [
  "Farmacología Clínica",
  "Enfermería en Salud del Adulto I",
  "Bioética y Deontología",
  "Epidemiología en Salud Pública",
  "Microbiología y Parasitología Médica",
  "Anatomía y Fisiología Humana II",
  "Cuidados Fundamentales de Enfermería"
];

export const INTERESES_DISPONIBLES = [
  "Investigación y Tesis",
  "Salud Comunitaria",
  "Primeros Auxilios",
  "Inteligencia Artificial",
  "Startups y Emprendimiento",
  "Fútbol y Futsal",
  "Vóley",
  "Artes Marciales",
  "Fotografía",
  "Idiomas (Inglés/Portugués)",
  "Lettering y Caligrafía",
  "Música y Guitarra",
  "Debate y Oratoria",
  "Voluntariado"
];

// Persona principal de demostración
export const USUARIO_DEMO = {
  id: "usr_luz",
  nombre: "Luz",
  apellido: "Martínez",
  correoInstitucional: "luz.martinez@utp.edu.pe",
  correoAlterno: "luz.martinez.personal@gmail.com",
  fotoUrl: "/fotos/luz.jpg",
  portadaUrl: "/fotos/portada_luz.jpg",
  sede: "Lima Sur",
  carrera: "Enfermería",
  facultad: "Ciencias de la Salud",
  ciclo: 5,
  edad: 21,
  fechaNacimiento: "2005-03-14",
  rol: "alumno",
  intereses: [
    "Salud Comunitaria",
    "Primeros Auxilios",
    "Investigación y Tesis",
    "Idiomas (Inglés/Portugués)",
    "Lettering y Caligrafía"
  ],
  origenCampos: {
    nombre: "declarado",
    apellido: "declarado",
    correoInstitucional: "verificado",
    carrera: "declarado",
    ciclo: "declarado",
    sede: "declarado",
    fechaNacimiento: "declarado"
  },
  consentimientos: {
    cuenta: true,        // 1. Necesario, bloqueado
    encuestas: true,     // 2. Recibir encuestas
    metricas: true,      // 3. Métricas agregadas
    perfil_universidad: false // 4. Compartir perfil con UTP (Apagado por defecto según Ley 29733)
  },
  // Habilidades con escala 0 a 3 (NO hay monedas)
  habilidades: {
    apoyo_investigacion: {
      id: "apoyo_investigacion",
      nombre: "Apoyo a la investigación",
      tipo: "blanda",
      nivel: 1, // Nivel 1 = 1 encuesta. Luz tiene 2 encuestas respondidas. Falta 1 para Nivel 2 (umbral 3)
      estrellas: 2,
      origen: "verificada",
      hechos: [
        "Respondió encuesta sobre estrés académico en universitarios (Tesis Psicología)",
        "Respondió encuesta sobre hábitos alimenticios en estudiantes de salud"
      ],
      siguienteNivelMeta: 3,
      progresoActual: 2
    },
    predisposicion_ayudar: {
      id: "predisposicion_ayudar",
      nombre: "Predisposición a ayudar",
      tipo: "blanda",
      nivel: 1, // Nivel 1 = 1 consulta. Tiene 1 consulta resuelta. Falta 1 para Nivel 2 (umbral 2)
      estrellas: 3,
      origen: "verificada",
      hechos: [
        "Resolvió duda grupal sobre dosificación en Farmacología Básica a alumnos de 3er ciclo (3 alumnos valoraron positivamente)"
      ],
      siguienteNivelMeta: 2,
      progresoActual: 1
    },
    constancia: {
      id: "constancia",
      nombre: "Constancia",
      tipo: "blanda",
      nivel: 1, // Activa en 2 grupos. Falta 1 para Nivel 2 (umbral 3)
      estrellas: 2,
      origen: "verificada",
      hechos: [
        "Participación sostenida durante el ciclo en Taller Oficial de Lettering",
        "Participación activa en el Espacio de Enfermería"
      ],
      siguienteNivelMeta: 3,
      progresoActual: 2
    },
    liderazgo: {
      id: "liderazgo",
      nombre: "Liderazgo",
      tipo: "blanda",
      nivel: 0, // Umbral Nivel 1 = 1 grupo creado
      estrellas: 0,
      origen: "verificada",
      hechos: [],
      siguienteNivelMeta: 1,
      progresoActual: 0
    }
  },
  certificados: [
    {
      id: "cert_1",
      habilidad: "Primeros Auxilios y RCP Avanzado",
      emisor: "Cruz Roja Peruana / IFRC",
      horas: 40,
      nivel: "Intermedio", // horas >= 20
      tieneEvaluacion: true,
      url: "https://cruzroja.org.pe/cert/CR-2025-88412",
      origen: "con_evidencia",
      propuestoPorAgente: true,
      aprobado: true,
      fecha: "15 Feb 2026"
    },
    {
      id: "cert_2",
      habilidad: "Bioseguridad Hospitalaria",
      emisor: "Ministerio de Salud (MINSA - Enlace Virtual)",
      horas: 16,
      nivel: "Básico",
      tieneEvaluacion: false,
      url: "",
      archivoNombre: "certificado_minsa_bioseguridad.pdf",
      origen: "con_evidencia",
      propuestoPorAgente: false,
      aprobado: true,
      fecha: "10 Ene 2026"
    }
  ],
  // Medallas y Reconocimientos Universitarios Reales (Estudiante Estrella)
  medallas: [
    {
      id: "med_auxilios",
      nombre: "Primeros Auxilios Destacado",
      categoria: "Salud y Emergencias",
      emisor: "Cruz Roja Peruana & MINSA",
      año: "2026",
      imagenUrl: "/medallas/primeros_auxilios.jpg",
      descripcion: "Distinción de honor por rendimiento sobresaliente en soporte vital básico, control de hemorragias y triage hospitalario en emergencias.",
      nivel: "Distinción de Honor",
      fecha: "18 Ene 2026",
      verificado: true
    },
    {
      id: "med_voley",
      nombre: "Subcampeona Vóley 2026",
      categoria: "Deportes UTP",
      emisor: "Dirección de Deportes UTP Lima Sur",
      año: "2026",
      imagenUrl: "/medallas/voley_2026.jpg",
      descripcion: "Medalla de plata en el Torneo Apertura Interfacultades de Voleibol Femenino UTP Lima Sur, capitana del equipo de Ciencias de la Salud.",
      nivel: "Medalla de Plata",
      fecha: "12 Feb 2026",
      verificado: true
    },
    {
      id: "med_excel",
      nombre: "Excel Intermedio Certificado",
      categoria: "Competencias Digitales",
      emisor: "Centro de Certificación UTP & Microsoft",
      año: "2026",
      imagenUrl: "/medallas/excel_intermedio.jpg",
      descripcion: "Acreditación práctica en tablas dinámicas, dashboards analíticos, modelado de bases de datos clínicas y formulación avanzada para bioestadística.",
      nivel: "Certificación Oro",
      fecha: "28 Feb 2026",
      verificado: true
    },
    {
      id: "med_investigacion",
      nombre: "Investigación Académica & Tesis",
      categoria: "Mérito Científico",
      emisor: "Vicerrectorado de Investigación UTP",
      año: "2026",
      imagenUrl: "/medallas/investigacion_academica.jpg",
      descripcion: "Reconocimiento por contribución activa en semilleros de investigación formativa y publicación de estudio de campo en salud comunitaria.",
      nivel: "Sello Académico",
      fecha: "05 Mar 2026",
      verificado: true
    }
  ]
};

// Habilidades iniciales vacías para nuevos alumnos registrados (Spec 5.1 & 6.7: arranca en cero)
export const HABILIDADES_BASE_NUEVO_ALUMNO = {
  apoyo_investigacion: {
    id: "apoyo_investigacion",
    nombre: "Apoyo a la investigación",
    tipo: "blanda",
    nivel: 0,
    estrellas: 0,
    origen: "verificada",
    hechos: [],
    siguienteNivelMeta: 1,
    progresoActual: 0
  },
  predisposicion_ayudar: {
    id: "predisposicion_ayudar",
    nombre: "Predisposición a ayudar",
    tipo: "blanda",
    nivel: 0,
    estrellas: 0,
    origen: "verificada",
    hechos: [],
    siguienteNivelMeta: 1,
    progresoActual: 0
  },
  constancia: {
    id: "constancia",
    nombre: "Constancia",
    tipo: "blanda",
    nivel: 0,
    estrellas: 0,
    origen: "verificada",
    hechos: [],
    siguienteNivelMeta: 1,
    progresoActual: 0
  },
  liderazgo: {
    id: "liderazgo",
    nombre: "Liderazgo",
    tipo: "blanda",
    nivel: 0,
    estrellas: 0,
    origen: "verificada",
    hechos: [],
    siguienteNivelMeta: 1,
    progresoActual: 0
  }
};

// Generador de base simulada de alumnos para cálculos exactos de filtro en UTP Lima Sur
export const BASE_ALUMNOS_SIMULADA = [
  // Enfermería
  { id: "a01", carrera: "Enfermería", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Salud Comunitaria", "Investigación y Tesis"] },
  { id: "a02", carrera: "Enfermería", ciclo: 5, edad: 22, sede: "Lima Sur", intereses: ["Primeros Auxilios", "Idiomas (Inglés/Portugués)"] },
  { id: "a03", carrera: "Enfermería", ciclo: 5, edad: 20, sede: "Lima Sur", intereses: ["Salud Comunitaria", "Voluntariado"] },
  { id: "a04", carrera: "Enfermería", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Primeros Auxilios", "Vóley"] },
  { id: "a05", carrera: "Enfermería", ciclo: 3, edad: 19, sede: "Lima Sur", intereses: ["Salud Comunitaria", "Música y Guitarra"] },
  { id: "a06", carrera: "Enfermería", ciclo: 6, edad: 22, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Salud Comunitaria"] },
  { id: "a07", carrera: "Enfermería", ciclo: 7, edad: 23, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Primeros Auxilios"] },
  { id: "a08", carrera: "Enfermería", ciclo: 8, edad: 24, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Salud Comunitaria"] },
  { id: "a09", carrera: "Enfermería", ciclo: 2, edad: 19, sede: "Lima Sur", intereses: ["Lettering y Caligrafía", "Primeros Auxilios"] },
  { id: "a10", carrera: "Enfermería", ciclo: 1, edad: 18, sede: "Lima Sur", intereses: ["Salud Comunitaria", "Vóley"] },
  { id: "a11", carrera: "Enfermería", ciclo: 1, edad: 18, sede: "Lima Sur", intereses: ["Primeros Auxilios", "Idiomas (Inglés/Portugués)"] },
  { id: "a12", carrera: "Enfermería", ciclo: 2, edad: 19, sede: "Lima Sur", intereses: ["Voluntariado", "Salud Comunitaria"] },
  { id: "a13", carrera: "Enfermería", ciclo: 3, edad: 20, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Artes Marciales"] },
  { id: "a14", carrera: "Enfermería", ciclo: 4, edad: 21, sede: "Lima Sur", intereses: ["Primeros Auxilios", "Salud Comunitaria"] },
  { id: "a15", carrera: "Enfermería", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Idiomas (Inglés/Portugués)"] },

  // Psicología
  { id: "b01", carrera: "Psicología", ciclo: 7, edad: 22, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Salud Comunitaria"] },
  { id: "b02", carrera: "Psicología", ciclo: 7, edad: 23, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Debate y Oratoria"] },
  { id: "b03", carrera: "Psicología", ciclo: 6, edad: 21, sede: "Lima Sur", intereses: ["Fotografía", "Voluntariado"] },
  { id: "b04", carrera: "Psicología", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Idiomas (Inglés/Portugués)"] },
  { id: "b05", carrera: "Psicología", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Lettering y Caligrafía", "Salud Comunitaria"] },
  { id: "b06", carrera: "Psicología", ciclo: 3, edad: 19, sede: "Lima Sur", intereses: ["Música y Guitarra", "Voluntariado"] },
  { id: "b07", carrera: "Psicología", ciclo: 2, edad: 18, sede: "Lima Sur", intereses: ["Debate y Oratoria", "Investigación y Tesis"] },
  { id: "b08", carrera: "Psicología", ciclo: 1, edad: 18, sede: "Lima Sur", intereses: ["Voluntariado", "Idiomas (Inglés/Portugués)"] },
  { id: "b09", carrera: "Psicología", ciclo: 8, edad: 24, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Salud Comunitaria"] },
  { id: "b10", carrera: "Psicología", ciclo: 9, edad: 25, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Debate y Oratoria"] },

  // Ingeniería Industrial
  { id: "c01", carrera: "Ingeniería Industrial", ciclo: 7, edad: 21, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Startups y Emprendimiento"] },
  { id: "c02", carrera: "Ingeniería Industrial", ciclo: 7, edad: 22, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Inteligencia Artificial"] },
  { id: "c03", carrera: "Ingeniería Industrial", ciclo: 6, edad: 21, sede: "Lima Sur", intereses: ["Fútbol y Futsal", "Startups y Emprendimiento"] },
  { id: "c04", carrera: "Ingeniería Industrial", ciclo: 5, edad: 20, sede: "Lima Sur", intereses: ["Inteligencia Artificial", "Investigación y Tesis"] },
  { id: "c05", carrera: "Ingeniería Industrial", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Fútbol y Futsal", "Idiomas (Inglés/Portugués)"] },
  { id: "c06", carrera: "Ingeniería Industrial", ciclo: 3, edad: 19, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Vóley"] },
  { id: "c07", carrera: "Ingeniería Industrial", ciclo: 2, edad: 19, sede: "Lima Sur", intereses: ["Artes Marciales", "Inteligencia Artificial"] },
  { id: "c08", carrera: "Ingeniería Industrial", ciclo: 1, edad: 18, sede: "Lima Sur", intereses: ["Fútbol y Futsal", "Startups y Emprendimiento"] },
  { id: "c09", carrera: "Ingeniería Industrial", ciclo: 8, edad: 23, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Startups y Emprendimiento"] },
  { id: "c10", carrera: "Ingeniería Industrial", ciclo: 9, edad: 24, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Inteligencia Artificial"] },
  { id: "c11", carrera: "Ingeniería Industrial", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Idiomas (Inglés/Portugués)"] },
  { id: "c12", carrera: "Ingeniería Industrial", ciclo: 6, edad: 22, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Fútbol y Futsal"] },

  // Ingeniería de Sistemas
  { id: "d01", carrera: "Ingeniería de Sistemas e Informática", ciclo: 6, edad: 21, sede: "Lima Sur", intereses: ["Inteligencia Artificial", "Startups y Emprendimiento"] },
  { id: "d02", carrera: "Ingeniería de Sistemas e Informática", ciclo: 5, edad: 20, sede: "Lima Sur", intereses: ["Inteligencia Artificial", "Fotografía"] },
  { id: "d03", carrera: "Ingeniería de Sistemas e Informática", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Inteligencia Artificial", "Idiomas (Inglés/Portugués)"] },
  { id: "d04", carrera: "Ingeniería de Sistemas e Informática", ciclo: 3, edad: 19, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Fútbol y Futsal"] },
  { id: "d05", carrera: "Ingeniería de Sistemas e Informática", ciclo: 7, edad: 22, sede: "Lima Sur", intereses: ["Inteligencia Artificial", "Investigación y Tesis"] },
  { id: "d06", carrera: "Ingeniería de Sistemas e Informática", ciclo: 8, edad: 23, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Startups y Emprendimiento"] },
  { id: "d07", carrera: "Ingeniería de Sistemas e Informática", ciclo: 1, edad: 18, sede: "Lima Sur", intereses: ["Inteligencia Artificial", "Artes Marciales"] },
  { id: "d08", carrera: "Ingeniería de Sistemas e Informática", ciclo: 2, edad: 19, sede: "Lima Sur", intereses: ["Fútbol y Futsal", "Inteligencia Artificial"] },

  // Administración y Negocios
  { id: "e01", carrera: "Administración de Empresas", ciclo: 1, edad: 18, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Voluntariado"] },
  { id: "e02", carrera: "Administración de Empresas", ciclo: 2, edad: 19, sede: "Lima Sur", intereses: ["Debate y Oratoria", "Idiomas (Inglés/Portugués)"] },
  { id: "e03", carrera: "Administración de Empresas", ciclo: 3, edad: 19, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Fotografía"] },
  { id: "e04", carrera: "Administración de Empresas", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Startups y Emprendimiento"] },
  { id: "e05", carrera: "Administración de Empresas", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Vóley"] },
  { id: "e06", carrera: "Administración de Empresas", ciclo: 6, edad: 22, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Debate y Oratoria"] },
  { id: "e07", carrera: "Administración de Empresas", ciclo: 7, edad: 23, sede: "Lima Sur", intereses: ["Startups y Emprendimiento", "Idiomas (Inglés/Portugués)"] },

  // Derecho
  { id: "f01", carrera: "Derecho", ciclo: 3, edad: 20, sede: "Lima Sur", intereses: ["Debate y Oratoria", "Voluntariado"] },
  { id: "f02", carrera: "Derecho", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Debate y Oratoria", "Investigación y Tesis"] },
  { id: "f03", carrera: "Derecho", ciclo: 7, edad: 22, sede: "Lima Sur", intereses: ["Investigación y Tesis", "Debate y Oratoria"] },
  { id: "f04", carrera: "Derecho", ciclo: 2, edad: 19, sede: "Lima Sur", intereses: ["Idiomas (Inglés/Portugués)", "Debate y Oratoria"] },
  { id: "f05", carrera: "Derecho", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Lettering y Caligrafía", "Debate y Oratoria"] },

  // Arquitectura y Civil
  { id: "g01", carrera: "Arquitectura", ciclo: 4, edad: 20, sede: "Lima Sur", intereses: ["Fotografía", "Lettering y Caligrafía"] },
  { id: "g02", carrera: "Arquitectura", ciclo: 6, edad: 22, sede: "Lima Sur", intereses: ["Fotografía", "Investigación y Tesis"] },
  { id: "g03", carrera: "Ingeniería Civil", ciclo: 5, edad: 21, sede: "Lima Sur", intereses: ["Fútbol y Futsal", "Investigación y Tesis"] },
  { id: "g04", carrera: "Ingeniería Civil", ciclo: 7, edad: 23, sede: "Lima Sur", intereses: ["Artes Marciales", "Investigación y Tesis"] },

  // Generar otros 45 alumnos adicionales uniformemente distribuidos en la sede Lima Sur
  ...Array.from({ length: 45 }).map((_, i) => ({
    id: `extra_${i}`,
    carrera: CARRERAS_UTP[i % CARRERAS_UTP.length].nombre,
    ciclo: (i % 10) + 1,
    edad: 18 + (i % 8),
    sede: "Lima Sur",
    intereses: [
      INTERESES_DISPONIBLES[i % INTERESES_DISPONIBLES.length],
      INTERESES_DISPONIBLES[(i + 3) % INTERESES_DISPONIBLES.length]
    ]
  }))
];

// Espacios pre-creados según la arquitectura de la Sección 4
export const ESPACIOS_INICIALES = [
  // 1. Grupo de carrera y ciclo (Automático, cerrado)
  {
    id: "esp_enf_c5",
    tipo: "carrera_ciclo",
    nombre: "Enfermería — 5.° Ciclo",
    descripcion: "Espacio cerrado para alumnos de Enfermería ciclo 2026-1 de la sede Lima Sur. Coordinación de cursos, turnos de prácticas y horarios.",
    portadaUrl: "/grupos/enfermeria.jpg",
    carrera: "Enfermería",
    ciclo: 5,
    sede: "Lima Sur",
    miembrosCount: 38,
    esMiembro: true,
    oficial: false,
    ultimoMensaje: "Chicos, acuérdense que mañana toca entrega del caso clínico de Salud del Adulto.",
    horaUltimoMensaje: "10:42 AM",
    mensajes: [
      { id: "m1", autor: "Carlos Mendoza", texto: "Alguien tiene el formato APA 7 para la carátula de Farmacología?", hora: "08:30 AM", esMio: false },
      { id: "m2", autor: "Luz Martínez", texto: "Sí Carlos, está en el drive de delegados, te lo reenvío al toque.", hora: "08:35 AM", esMio: true },
      { id: "m3", autor: "Valeria Ríos", texto: "¿La práctica de laboratorio del jueves será con uniforme completo o bata blanca?", hora: "09:15 AM", esMio: false },
      { id: "m4", autor: "Carlos Mendoza", texto: "Bata blanca y calzado clínico cerrado, lo confirmó el delegado.", hora: "09:20 AM", esMio: false },
      { id: "m5", autor: "Andrea Morales", texto: "Chicos, acuérdense que mañana toca entrega del caso clínico de Salud del Adulto.", hora: "10:42 AM", esMio: false }
    ]
  },

  // 2. Espacio de carrera (Cruza ciclos 1 al 10 - donde viven las consultas agrupadas)
  {
    id: "esp_carrera_enf",
    tipo: "carrera",
    nombre: "Comunidad de Enfermería UTP",
    descripcion: "Espacio general para todos los ciclos (1.° al 10.°) de Enfermería Lima Sur. Consultas de cursos, bancos de preguntas, orientación para prácticas e internado.",
    portadaUrl: "/grupos/enfermeria.jpg",
    carrera: "Enfermería",
    ciclo: null,
    sede: "Lima Sur",
    miembrosCount: 420,
    esMiembro: true,
    oficial: false,
    ultimoMensaje: "Consulta agrupada: Farmacología Clínica (3 alumnos con la misma duda)",
    horaUltimoMensaje: "11:15 AM",
    mensajes: [
      { id: "mc1", autor: "Marcos (Ciclo 7)", texto: "A los de ciclos 4 y 5: ya subí la guía de fármacos analgésicos en la sección de consultas agrupadas.", hora: "Ayer", esMio: false }
    ]
  },

  // 3. Talleres Oficiales espejados con horario real (Sección 4 & 7.2)
  {
    id: "esp_taller_lettering",
    tipo: "taller",
    nombre: "Taller de Lettering y Caligrafía",
    descripcion: "Taller formativo de expresión gráfica y caligrafía. Registro oficial UTP para actividades de bienestar estudiantil.",
    portadaUrl: "/grupos/lettering.jpg",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    horario: "Sábados 10:00 - 12:00 (Aula 302)",
    oficial: true,
    miembrosCount: 64,
    esMiembro: true,
    ultimoMensaje: "Materiales listos para este sábado: plumones punta pincel.",
    horaUltimoMensaje: "09:00 AM",
    linkInscripcion: "https://portal.utp.edu.pe/talleres/lettering-2026",
    mensajes: [
      { id: "mt1", autor: "Prof. Guía Arte", texto: "Bienvenidos al ciclo. Recuerden traer papel bond de 90gr para no traspasar la tinta.", hora: "08:10 AM", esMio: false },
      { id: "mt2", autor: "Luz Martínez", texto: "Buenas, ¿sirven los plumones punta cónica o necesariamente punta pincel flexible?", hora: "08:25 AM", esMio: true },
      { id: "mt3", autor: "Prof. Guía Arte", texto: "Punta pincel preferentemente Luz, para hacer trazos gruesos y delgados.", hora: "08:45 AM", esMio: false }
    ]
  },
  {
    id: "esp_taller_futsal",
    tipo: "taller",
    nombre: "Taller de Futsal UTP Lima Sur",
    descripcion: "Entrenamientos semanales y preparación para los torneos interfacultades de la universidad.",
    portadaUrl: "/grupos/futsal.jpg",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    horario: "Martes y Jueves 17:00 - 19:00 (Cancha Central)",
    oficial: true,
    miembrosCount: 112,
    esMiembro: false,
    ultimoMensaje: "Convocatoria para el partido amistoso contra Sede Central.",
    horaUltimoMensaje: "07:30 AM",
    linkInscripcion: "https://portal.utp.edu.pe/talleres/futsal-2026",
    mensajes: []
  },
  {
    id: "esp_taller_karate",
    tipo: "taller",
    nombre: "Taller de Karate Básico",
    descripcion: "Defensa personal y disciplina tradicional. Actividad deportiva extracurricular oficial.",
    portadaUrl: "/grupos/karate.jpg",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    horario: "Lunes y Miércoles 18:00 - 19:30 (Sala Multiusos)",
    oficial: true,
    miembrosCount: 45,
    esMiembro: false,
    ultimoMensaje: "Llevar ropa deportiva cómoda quienes aún no tengan karategi.",
    horaUltimoMensaje: "Ayer",
    linkInscripcion: "https://portal.utp.edu.pe/talleres/karate-2026",
    mensajes: []
  },
  {
    id: "esp_taller_ia",
    tipo: "taller",
    nombre: "Taller de IA Aplicada a la Universidad",
    descripcion: "Uso ético y práctico de modelos generativos, automatización de resúmenes y asistencia en investigación.",
    portadaUrl: "/grupos/ia.jpg",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    horario: "Viernes 19:00 - 21:00 (Lab 401)",
    oficial: true,
    miembrosCount: 198,
    esMiembro: false,
    ultimoMensaje: "Esta semana: creación de prompts estructurados para revisión bibliográfica.",
    horaUltimoMensaje: "Hace 2 días",
    linkInscripcion: "https://portal.utp.edu.pe/talleres/ia-2026",
    mensajes: []
  },

  // 4. Grupos de interés propuestos por alumnos (Sección 7.2)
  {
    id: "esp_int_startups",
    tipo: "interes",
    nombre: "Startups UTP Lima Sur",
    descripcion: "Comunidad de emprendedores, desarrolladores y diseñadores de la sede. Validamos ideas de negocio y conectamos co-fundadores.",
    portadaUrl: "/grupos/startup.png",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    creador: "Marcos (Ing. Industrial)",
    miembrosCount: 142,
    estado: "visible", // Ya superó el umbral de 15 apoyos (tiene 48)
    apoyosCount: 48,
    esMiembro: false,
    oficial: false,
    ultimoMensaje: "Tenemos mentoría abierta sobre Canvas este sábado a las 4pm.",
    horaUltimoMensaje: "09:30 AM",
    mensajes: []
  },
  {
    id: "esp_int_cinefilos",
    tipo: "interes",
    nombre: "Cinéfilos y Debate UTP",
    descripcion: "Club de apreciación de cine independiente, análisis de guión y proyección quincenal en auditorio.",
    portadaUrl: "/grupos/cinefilos.jpg",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    creador: "Camila (Administración)",
    miembrosCount: 11,
    estado: "oculto", // Aún no llega al umbral de 15 (tiene 11 apoyos)
    apoyosCount: 11,
    umbralRequerido: 15,
    esMiembro: false,
    oficial: false,
    ultimoMensaje: "Faltan 4 apoyos para que el grupo sea visible en Explorar.",
    horaUltimoMensaje: "Hace 1 hora",
    mensajes: []
  },
  {
    id: "esp_int_freefire",
    tipo: "interes",
    nombre: "Comunidad Gaming & Free Fire UTP",
    descripcion: "Torneos de escuadras, salas personalizadas y comunidad de deportes electrónicos de UTP Lima Sur.",
    portadaUrl: "/grupos/free_fire.jpg",
    carrera: null,
    ciclo: null,
    sede: "Lima Sur",
    creador: "Kevin (Ing. Sistemas)",
    miembrosCount: 12,
    estado: "oculto", // 12 de 15 apoyos
    apoyosCount: 12,
    umbralRequerido: 15,
    esMiembro: false,
    oficial: false,
    ultimoMensaje: "¡Faltan 3 apoyos de estudiantes para desbloquear el espacio oficial!",
    horaUltimoMensaje: "Hace 15 min",
    mensajes: []
  }
];

// Consultas agrupadas existentes (Flujo 1, Sección 7.1)
export const CONSULTAS_AGRUPADAS_INICIALES = [
  {
    id: "grp_con_1",
    carrera: "Enfermería",
    curso: "Farmacología Clínica",
    tema: "Vademécum y guías prácticas hospitalarias",
    textoResumen: "¿Dónde conseguir el vademécum o guía de dosificación recomendado para las prácticas hospitalarias y cómo prepararse?",
    estado: "abierto",
    nAlumnos: 3, // Regla anti-gaming: >= 2 alumnos para generar estrellas
    autores: ["Camila R. (Ciclo 4)", "José P. (Ciclo 4)", "Ana V. (Ciclo 3)"],
    fecha: "Hoy 10:15 AM",
    respuestas: [
      {
        id: "resp_1",
        asesorNombre: "Luz Martínez",
        asesorCiclo: 5,
        asesorCarrera: "Enfermería",
        esMio: true,
        modo: "mensaje", // 1 estrella * nAlumnos (3) = 3 estrellas potenciales
        texto: "Para las prácticas en el hospital María Auxiliadora, la guía oficial la comparte la Lic. en el aula virtual en la semana 3, pero les recomiendo comprar el compendio de fármacos de bolsillo en la fotocopiadora del pabellón B. Enfoquen su estudio en antibióticos betalactámicos y cálculo de goteo.",
        fecha: "Hoy 10:45 AM",
        estrellasCalculadas: 3,
        valoraciones: [
          { alumno: "Camila R.", util: true },
          { alumno: "José P.", util: true }
        ],
        calificadoPorSolicitante: true
      }
    ]
  },
  {
    id: "grp_con_2",
    carrera: "Enfermería",
    curso: "Bioética y Deontología",
    tema: "Estructura del caso clínico de evaluación continua 2",
    textoResumen: "¿Qué metodología de análisis moral (Beauchamp y Childress) se debe seguir para el informe de la semana 8?",
    estado: "abierto",
    nAlumnos: 2,
    autores: ["David T. (Ciclo 3)", "Sara L. (Ciclo 4)"],
    fecha: "Ayer 16:30",
    respuestas: []
  },
  {
    // Consulta donde Luz es autora: permite mostrar M22 (valorar una respuesta recibida).
    // La respuesta está pendiente de valoración, así que sus estrellas aún no se acreditan.
    id: "grp_con_3",
    carrera: "Enfermería",
    curso: "Enfermería en Salud del Adulto",
    tema: "Preparación para el internado de sexto ciclo",
    textoResumen: "¿Qué temas conviene repasar antes de empezar las rotaciones del internado y qué material sirve más?",
    estado: "abierto",
    nAlumnos: 2,
    autorIds: ["usr_luz"],
    autores: ["Luz M. (Ciclo 5)", "Rosa C. (Ciclo 5)"],
    fecha: "Hoy 08:10 AM",
    respuestas: [
      {
        id: "resp_3",
        asesorId: "usr_daniela",
        asesorNombre: "Daniela Quispe",
        asesorCiclo: 8,
        asesorCarrera: "Enfermería",
        esMio: false,
        modo: "mensaje", // 1 x 2 alumnos = 2 estrellas, pendientes hasta que una autora valore
        texto: "Repasen valoración por sistemas y cálculo de dosis, que es lo que más preguntan en la primera semana. Lleven una libreta de bolsillo con los valores normales de laboratorio: les va a salvar en las rondas.",
        fecha: "Hoy 09:05 AM",
        estrellasCalculadas: 2,
        valoraciones: [],
        calificadoPorSolicitante: false
      }
    ]
  }
];

// Encuestas en bandeja para Luz Martínez (Flujo 3, Sección 6.5 & 7.4)
export const ENCUESTAS_BANDEJA_INICIALES = [
  {
    id: "enc_tesis_psico",
    titulo: "Nivel de estrés académico y hábitos de sueño en estudiantes universitarios",
    autorNombre: "Claudia Méndez",
    autorCarrera: "Psicología (Ciclo 8)",
    objetivo: "Investigación para trabajo de tesis de bachiller",
    tiempoEstimado: "2 minutos",
    fechaEnvio: "Hoy",
    estado: "pendiente",
    preguntas: [
      {
        id: "p1",
        texto: "¿Cuántas horas en promedio duermes en semanas de exámenes continuos?",
        tipo: "unica",
        opciones: ["Menos de 4 horas", "Entre 4 y 6 horas", "Entre 6 y 8 horas", "Más de 8 horas"]
      },
      {
        id: "p2",
        texto: "¿Has experimentado síntomas de ansiedad antes de una práctica calificada?",
        tipo: "unica",
        opciones: ["Frecuentemente", "A veces", "Casi nunca", "Nunca"]
      },
      {
        id: "p3",
        texto: "¿Qué técnica de descanso utilizas con mayor frecuencia?",
        tipo: "multiple",
        opciones: ["Música / Podcasting", "Deporte o caminata", "Redes sociales", "Ninguna"]
      }
    ]
  },
  {
    id: "enc_ind_comedor",
    titulo: "Propuesta de optimización del tiempo de atención en cafetines UTP Lima Sur",
    autorNombre: "Marcos Villanueva",
    autorCarrera: "Ingeniería Industrial (Ciclo 7)",
    objetivo: "Proyecto del curso de Gestión por Procesos",
    tiempoEstimado: "1 minuto",
    fechaEnvio: "Ayer",
    estado: "respondida",
    preguntas: [
      {
        id: "p1",
        texto: "¿Cuánto tiempo promedio demoras en adquirir tu almuerzo en horas punta?",
        tipo: "unica",
        opciones: ["Menos de 10 min", "10 a 20 min", "Más de 20 min"]
      }
    ]
  }
];

// Encuesta propia creada por Luz Martínez
export const ENCUESTA_PROPIA_DEMO = {
  id: "enc_luz_salud",
  titulo: "Percepción del rol de enfermería en la prevención comunitaria",
  creadoEn: "Hace 4 días",
  estado: "enviada",
  alcanceEnviado: 30, // Según su alcance semanal de Nivel 1
  respuestasRecibidas: 19,
  filtro: {
    sede: "Lima Sur",
    carreras: ["Enfermería", "Psicología"],
    cicloMin: 3,
    cicloMax: 8,
    edadMin: 18,
    edadMax: 26,
    intereses: ["Salud Comunitaria", "Investigación y Tesis"]
  },
  preguntas: [
    {
      id: "q1",
      texto: "¿Consideras prioritario el abordaje preventivo frente al asistencial?",
      tipo: "unica",
      resultados: [
        { label: "Sí, prioritario", votos: 15, porcentaje: 79 },
        { label: "No, el asistencial es más crítico", votos: 4, porcentaje: 21 }
      ]
    },
    {
      id: "q2",
      texto: "¿Con qué frecuencia participas en ferias de salud o voluntariado comunitario?",
      tipo: "unica",
      resultados: [
        { label: "Al menos una vez al mes", votos: 6, porcentaje: 32 },
        { label: "Una o dos veces al año", votos: 9, porcentaje: 47 },
        { label: "Nunca he participado", votos: 4, porcentaje: 21 }
      ]
    }
  ]
};

// Datos para el panel de la universidad (W01 - W06)
export const METRICAS_PANEL_UTP = {
  totalRegistradosSede: 2895, // 15% de la sede
  activosSemanales: 1420,
  gruposActivos: 34,
  talleresOficialesActivos: 8,
  tasaRetencion4Semanas: 31.4, // Supera la meta de >25%
  interaccionesCruzanCarreras: 44.8, // Supera el objetivo
  participacionCiclos1a3: 56.2, // Clave para la universidad (Sección 13.2)
  distribucionFacultad: [
    { facultad: "Ingeniería", alumnos: 1240, porcentaje: 42.8 },
    { facultad: "Ciencias de la Salud", alumnos: 410, porcentaje: 14.1 },
    { facultad: "Negocios y Administración", alumnos: 530, porcentaje: 18.3 },
    { facultad: "Humanidades y Derecho", alumnos: 460, porcentaje: 15.9 },
    { facultad: "Comunicaciones y Arquitectura", alumnos: 255, porcentaje: 8.9 }
  ],
  // Alumnos destacados: SOLO aquellos con consentimiento 4 activo (Sección 9 - W03 & 6.8)
  alumnosDestacadosConsentimiento4: [
    {
      id: "dest_1",
      nombre: "Marcos Villanueva",
      carrera: "Ingeniería Industrial",
      ciclo: 7,
      hechosClave: "Creó 'Startups UTP Lima Sur' (142 miembros) · Resolvió 8 consultas de procesos",
      habilidadesPrincipales: ["Liderazgo (Nivel 2)", "Predisposición a ayudar (Nivel 3)"],
      consentimiento4Activo: true
    },
    {
      id: "dest_2",
      nombre: "Rodrigo Quispe",
      carrera: "Ingeniería de Sistemas",
      ciclo: 8,
      hechosClave: "Asesoró a 24 compañeros en Inteligencia Artificial y Python",
      habilidadesPrincipales: ["La ha enseñado - Python (Nivel 3)", "Predisposición a ayudar (Nivel 3)"],
      consentimiento4Activo: true
    },
    {
      id: "dest_3",
      nombre: "Valeria Palacios",
      carrera: "Psicología",
      ciclo: 9,
      hechosClave: "Respondió 14 encuestas de tesis · Organizó charlas de salud mental comunitaria",
      habilidadesPrincipales: ["Apoyo a la investigación (Nivel 3)", "Constancia (Nivel 2)"],
      consentimiento4Activo: true
    }
  ]
};
