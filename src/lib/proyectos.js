import { rpc } from './supabase.js';

// =============================================================================
// Proyectos reales buscando equipo (migración 017): hackatones, startups, tesis...
// Las tablas no se leen directo: todo pasa por funciones del servidor, que fijan
// al autor, su universidad y los límites (3 proyectos abiertos, 5 postulaciones).
// =============================================================================

export const TIPOS_PROYECTO = [
  { id: 'hackaton', label: 'Hackatón', emoji: '💻' },
  { id: 'startup', label: 'Startup', emoji: '🚀' },
  { id: 'tesis', label: 'Tesis', emoji: '🎓' },
  { id: 'concurso', label: 'Concurso', emoji: '🏆' },
  { id: 'investigacion', label: 'Investigación', emoji: '🔬' },
  { id: 'otro', label: 'Otro', emoji: '✨' }
];

export const tipoProyecto = (id) => TIPOS_PROYECTO.find((t) => t.id === id) || TIPOS_PROYECTO[TIPOS_PROYECTO.length - 1];

const fechaCorta = (iso) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '';

function proyectoDesdeFila(p) {
  return {
    id: p.id,
    tipo: p.tipo,
    titulo: p.titulo,
    descripcion: p.descripcion,
    roles: p.roles || [],
    cupos: p.cupos,
    integrantes: p.integrantes || 0,
    cuposLibres: Math.max(0, (p.cupos || 0) - (p.integrantes || 0)),
    fechaLimite: p.fecha_limite || null,
    fechaLimiteTexto: fechaCorta(p.fecha_limite),
    enlace: p.enlace || '',
    estado: p.estado,
    autorId: p.autor_id,
    autorNombre: p.autor_nombre || 'Compañero',
    autorFoto: p.autor_foto || null,
    autorCarrera: p.autor_carrera || '',
    autorCiclo: p.autor_ciclo || '',
    soyAutor: Boolean(p.soy_autor),
    miPostulacion: p.mi_postulacion || null, // 'pendiente' | 'aceptada' | 'rechazada' | null
    pendientes: p.pendientes || 0
  };
}

/** Proyectos abiertos de mi universidad, los míos y aquellos a los que me postulé. */
export async function fetchProyectos() {
  const filas = (await rpc('listar_proyectos')) || [];
  return filas.map(proyectoDesdeFila);
}

export async function publicarProyecto({ tipo, titulo, descripcion, roles, cupos, fechaLimite, enlace }) {
  return rpc('crear_proyecto', {
    p_tipo: tipo,
    p_titulo: titulo,
    p_descripcion: descripcion,
    p_roles: roles || [],
    p_cupos: Number(cupos) || 1,
    p_fecha_limite: fechaLimite || null,
    p_enlace: enlace || ''
  });
}

export async function postularAProyecto({ proyectoId, rol, mensaje }) {
  return rpc('postular_proyecto', { p_proyecto_id: proyectoId, p_rol: rol || '', p_mensaje: mensaje });
}

/** Solo el autor: quién se postuló, con su carrera, ciclo y mensaje. */
export async function fetchPostulaciones(proyectoId) {
  const filas = (await rpc('listar_postulaciones_proyecto', { p_proyecto_id: proyectoId })) || [];
  return filas.map((x) => ({
    id: x.id,
    usuarioId: x.usuario_id,
    nombre: x.nombre || 'Alumno',
    foto: x.foto || null,
    carrera: x.carrera,
    ciclo: x.ciclo,
    rol: x.rol_deseado || '',
    mensaje: x.mensaje,
    estado: x.estado
  }));
}

/** Acepta (abre un chat entre ambos) o ignora una postulación. */
export async function responderPostulacion(postulacionId, aceptar) {
  return rpc('responder_postulacion', { p_postulacion_id: postulacionId, p_aceptar: aceptar });
}

export async function cerrarProyecto(proyectoId) {
  return rpc('cerrar_proyecto', { p_proyecto_id: proyectoId });
}
