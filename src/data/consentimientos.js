// Los cuatro consentimientos separados por finalidad (spec 6.8, Ley 29733).
// Nunca una casilla única. El 1 es necesario y va bloqueado; el 4 va apagado por defecto.
// Si cambias un texto, sube VERSION_POLITICA en src/lib/profile.js.

export const CONSENTIMIENTOS = [
  {
    finalidad: 'cuenta',
    numero: 1,
    titulo: 'Crear y mantener mi cuenta',
    texto:
      'Kampuz usa tu correo institucional, nombre, carrera, ciclo, sede, fecha de nacimiento, intereses y foto para crear tu cuenta, mostrar tu perfil a otros alumnos de tu universidad y que funcionen los grupos, chats y consultas.',
    necesario: true,
    porDefecto: true
  },
  {
    finalidad: 'encuestas',
    numero: 2,
    titulo: 'Recibir encuestas de otros alumnos',
    texto:
      'Tu carrera, ciclo, edad e intereses se usan para que te lleguen encuestas de investigación de otros alumnos (máximo 3 por semana). Quien envía la encuesta nunca ve quién respondió qué: solo resultados agregados de grupos de 30 o más.',
    necesario: false,
    porDefecto: true
  },
  {
    finalidad: 'metricas',
    numero: 3,
    titulo: 'Métricas agregadas para mi universidad',
    texto:
      'Tu actividad se suma, sin tu nombre, a estadísticas de participación (por carrera, ciclo o taller) que puede ver tu universidad. Ningún grupo de menos de 30 alumnos se muestra.',
    necesario: false,
    porDefecto: true
  },
  {
    finalidad: 'perfil_universidad',
    numero: 4,
    // Texto aprobado (spec 6.8)
    titulo: 'Que tu universidad vea lo que haces aquí',
    texto:
      'La UTP tiene programas como Impulsa y Generación Top, y hoy solo puede encontrarte por tu promedio. Si activas esto, cuando tu universidad se sume a Kampus también va a ver lo que construiste aquí: a cuántos compañeros asesoraste, qué grupos creaste, en qué te has venido formando.',
    comparte: 'tu nombre, tu carrera, tu ciclo y tu perfil de habilidades con su evidencia.',
    noComparte: 'tus mensajes, tus chats, ni qué respondiste en las encuestas.',
    consecuencia: 'Puedes apagarlo cuando quieras. Si está apagado, tu perfil no aparece en las convocatorias.',
    necesario: false,
    porDefecto: false
  }
];

export const valoresPorDefecto = () =>
  Object.fromEntries(CONSENTIMIENTOS.map((c) => [c.finalidad, c.porDefecto]));
