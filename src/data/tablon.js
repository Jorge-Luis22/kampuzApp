import { Users, HandHelping, CalendarDays, ShoppingBag } from 'lucide-react';

// =============================================================================
// Los 4 tipos del tablón "Pasando hoy" y sus textos. Tono neutral y semi-formal.
// =============================================================================

export const TIPOS_PUBLICACION = {
  plan: {
    id: 'plan',
    etiqueta: 'Plan',
    plural: 'Planes',
    icono: Users,
    descripcion: 'Sumar gente a algo de hoy',
    placeholder: 'Ej.: Buscamos 2 personas para fútbol a las 5',
    accion: '¡Voy!',
    hecho: 'Vas',
    verbo: ['va', 'van'],
    publicar: 'Publicar plan',
    vacio: 'Todavía no hay planes en tu sede. Sé el primero en proponer uno.',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-200 dark:bg-indigo-950/50 dark:border-indigo-900'
  },
  ayuda: {
    id: 'ayuda',
    etiqueta: 'Ayuda',
    plural: 'Ayuda',
    icono: HandHelping,
    descripcion: 'Pedir una mano a alguien cerca',
    placeholder: 'Ej.: ¿Alguien tiene un cargador tipo C en el pabellón B?',
    accion: 'Yo te ayudo',
    hecho: 'Abrir chat',
    publicar: 'Pedir ayuda',
    vacio: 'Nadie ha pedido ayuda por ahora. Si necesitas algo, pídelo aquí.',
    color: 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-950/50 dark:border-amber-900'
  },
  evento: {
    id: 'evento',
    etiqueta: 'Evento',
    plural: 'Eventos',
    icono: CalendarDays,
    descripcion: 'Invitar a una actividad con fecha',
    placeholder: 'Ej.: Torneo de vóley de Ingeniería',
    accion: 'Asistiré',
    hecho: 'Asistirás',
    verbo: ['asistirá', 'asistirán'],
    publicar: 'Publicar evento',
    vacio: 'No hay eventos próximos en tu sede. Comparte uno para que otros se sumen.',
    color: 'text-teal-800 bg-teal-50 border-teal-200 dark:text-teal-200 dark:bg-teal-950/50 dark:border-teal-900'
  },
  mercadito: {
    id: 'mercadito',
    etiqueta: 'Mercadito',
    plural: 'Mercadito',
    icono: ShoppingBag,
    descripcion: 'Vender o intercambiar algo',
    placeholder: 'Ej.: Vendo calculadora científica usada',
    accion: 'Me interesa',
    hecho: 'Te interesa',
    publicar: 'Publicar en el mercadito',
    vacio: 'El mercadito está vacío. Ofrece algo que ya no uses.',
    color: 'text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-950/50 dark:border-rose-900'
  }
};

export const ORDEN_TIPOS = ['plan', 'ayuda', 'evento', 'mercadito'];

export const FILTROS_TABLON = [
  { id: null, etiqueta: 'Todo' },
  { id: 'plan', etiqueta: 'Planes' },
  { id: 'ayuda', etiqueta: 'Ayuda' },
  { id: 'evento', etiqueta: 'Eventos' },
  { id: 'mercadito', etiqueta: 'Mercadito' }
];

export const VACIO_TODO = 'Todavía no hay publicaciones en tu sede. Sé el primero en compartir algo.';

// Lugares sugeridos al publicar (el alumno puede escribir cualquier otro)
export const LUGARES_SUGERIDOS = [
  'Biblioteca',
  'Cafetería',
  'Patio central',
  'Pabellón A',
  'Pabellón B',
  'Pabellón C',
  'Pabellón D',
  'Cancha deportiva',
  'Auditorio'
];

export const MSG_TRAMPA =
  'Kampuz no permite ofrecer ayuda para hacer trampa en evaluaciones. Puedes ofrecer tutorías o apuntes propios.';

const HORA = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit' });
const FECHA = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });

// "vence en 2 h", "vence en 25 min"
export function textoVence(venceEn, ahora = Date.now()) {
  const min = Math.max(0, Math.round((new Date(venceEn) - ahora) / 60000));
  if (min < 1) return 'vence en un momento';
  if (min < 60) return `vence en ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vence en ${h} h`;
  const d = Math.round(h / 24);
  return `vence en ${d} ${d === 1 ? 'día' : 'días'}`;
}

// "Hoy, 4:00 p. m.", "Mañana, 10:00 a. m.", "sáb, 25 oct · 4:00 p. m."
export function textoFecha(iso, ahora = new Date()) {
  const f = new Date(iso);
  const dia = (d) => d.toDateString();
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const hora = HORA.format(f);
  if (dia(f) === dia(ahora)) return `Hoy, ${hora}`;
  if (dia(f) === dia(manana)) return `Mañana, ${hora}`;
  const fecha = FECHA.format(f);
  return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)} · ${hora}`;
}

// "Ana va", "Ana y Luis van", "Ana, Luis y 3 más van"
export function textoParticipantes(tipo, participantes, total) {
  const verbo = TIPOS_PUBLICACION[tipo]?.verbo;
  if (!verbo || !total) return '';
  const nombres = participantes.map((p) => (p.nombre || '').split(' ')[0]).filter(Boolean);
  if (total === 1) return `${nombres[0] || '1 persona'} ${verbo[0]}`;
  if (total === 2 && nombres.length === 2) return `${nombres[0]} y ${nombres[1]} ${verbo[1]}`;
  const primeros = nombres.slice(0, 2).join(', ');
  const resto = total - Math.min(2, nombres.length);
  return primeros ? `${primeros} y ${resto} más ${verbo[1]}` : `${total} personas ${verbo[1]}`;
}

export const formatoPrecio = (precio) =>
  precio === null || precio === undefined ? '' : precio === 0 ? 'Gratis' : `S/ ${precio.toFixed(precio % 1 ? 2 : 0)}`;
