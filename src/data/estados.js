// Estado opcional del alumno (perfiles.estado_en_vivo). Ver docs/DECISIONES.md, 4.1.
export const ESTADOS_EN_VIVO = [
  { id: 'campus', label: 'En campus', emoji: '🟢', color: '#10B981', desc: 'En instalaciones de la sede' },
  { id: 'clase', label: 'En clase', emoji: '🟡', color: '#F59E0B', desc: 'En clase o laboratorio' },
  { id: 'biblioteca', label: 'En biblioteca', emoji: '🔵', color: '#3B82F6', desc: 'Estudiando' },
  { id: 'buscando_equipo', label: 'Buscando equipo', emoji: '🟣', color: '#8B5CF6', desc: 'Disponible para proyectos' },
  { id: 'examen', label: 'En exámenes', emoji: '🔴', color: '#EF4444', desc: 'Semana de parciales' }
];
