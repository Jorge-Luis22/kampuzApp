import { supabase, isSupabaseConfigured } from './supabase.js';
import { getOrCreateConversacion } from './chat.js';
import {
  getRegisteredUsers,
  getSolicitudesStorage,
  saveSolicitudStorage,
  responderSolicitudStorage,
  findRegisteredUser
} from './campusStorage.js';

const withTimeout = (promise, ms = 2000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);
};

// Perfiles de campus para complementar el feed durante el piloto inicial
const PERFILES_CAMPUS_PILOTO = [
  {
    id: 'usr_camila_rios',
    nombre: 'Camila',
    apellido: 'Ríos',
    carrera: 'Administración de Empresas',
    ciclo: 2,
    sede: 'Lima Sur',
    foto_url: '/fotos/camila.jpg',
    intereses: ['Startups y Emprendimiento', 'Investigación y Tesis'],
    rol: 'Cachimba',
    bio: 'Apasionada por modelos de negocio y emprendimiento estudiantil.'
  },
  {
    id: 'usr_marcos_v',
    nombre: 'Marcos',
    apellido: 'Villanueva',
    carrera: 'Ingeniería Industrial',
    ciclo: 7,
    sede: 'Lima Sur',
    foto_url: '/fotos/marcos.jpg',
    intereses: ['Investigación y Tesis', 'Startups y Emprendimiento'],
    rol: 'Ciclos superiores',
    bio: 'Experiencia en formulación de proyectos, Excel avanzado y tesis.'
  },
  {
    id: 'usr_valeria_p',
    nombre: 'Valeria',
    apellido: 'Palacios',
    carrera: 'Psicología',
    ciclo: 8,
    sede: 'Lima Sur',
    foto_url: '/fotos/valeria.jpg',
    intereses: ['Salud Comunitaria', 'Investigación y Tesis'],
    rol: 'Ciclos superiores',
    bio: 'Enfocada en investigación clínica y apoyo psicopedagógico.'
  },
  {
    id: 'usr_diego_a',
    nombre: 'Diego',
    apellido: 'Alarcón',
    carrera: 'Ingeniería de Sistemas',
    ciclo: 5,
    sede: 'Lima Sur',
    foto_url: '/fotos/diego.jpg',
    intereses: ['Inteligencia Artificial', 'Fútbol y Futsal'],
    rol: 'Ciclo medio',
    bio: 'Desarrollador web, torneos esports y proyectos de software en campus.'
  },
  {
    id: 'usr_andrea_m',
    nombre: 'Andrea',
    apellido: 'Morales',
    carrera: 'Enfermería',
    ciclo: 5,
    sede: 'Lima Sur',
    foto_url: '/fotos/andrea.jpg',
    intereses: ['Primeros Auxilios', 'Salud Comunitaria'],
    rol: 'Tu salón',
    bio: 'Delegada de farmacología y voluntaria en campañas de vacunación.'
  }
];

/**
 * Consulta la lista de usuarios bloqueados para filtrarlos de la exploración
 */
export async function fetchBlockedUserIds(userId) {
  if (!isSupabaseConfigured || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('bloqueos')
      .select('bloqueado_id, bloqueador_id')
      .or(`bloqueador_id.eq.${userId},bloqueado_id.eq.${userId}`);

    if (error) {
      console.warn('[Kampus Explore] Error cargando bloqueos:', error.message);
      return [];
    }

    const blocked = new Set();
    data.forEach(b => {
      if (b.bloqueador_id === userId) blocked.add(b.bloqueado_id);
      if (b.bloqueado_id === userId) blocked.add(b.bloqueador_id);
    });

    return Array.from(blocked);
  } catch (err) {
    return [];
  }
}

/**
 * Consulta perfiles reales de public.perfiles excluyendo al usuario logueado
 * y a los usuarios con bloqueo mutuo.
 */
export async function fetchPerfilesExplorar({ currentUserId, searchTerm, carrera, ciclo, interes }) {
  const blockedIds = await fetchBlockedUserIds(currentUserId);

  let realProfiles = [];

  // 1. Perfiles de Supabase si está disponible
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('perfiles')
        .select('id, nombre, apellido, usuario, foto_url, bio, sede, carrera, ciclo, intereses, rol, creado_en');

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      if (carrera) {
        query = query.eq('carrera', carrera);
      }

      if (ciclo) {
        query = query.eq('ciclo', Number(ciclo));
      }

      const { data, error } = await withTimeout(query, 2000);
      if (!error && data) {
        realProfiles = data;
      }
    } catch (err) {
      // Timeout o red offline
    }
  }

  // 2. Perfiles registrados localmente (nuevos usuarios creados en la app)
  const localRegistered = getRegisteredUsers().filter(
    p => p.id !== currentUserId && !blockedIds.includes(p.id)
  );

  // Filtrar bloqueados de Supabase
  realProfiles = realProfiles.filter(p => !blockedIds.includes(p.id));

  // Combinar perfiles de campus asegurando unicidad por id y usuario
  const idsVistos = new Set();
  const todos = [];

  // Prioridad 1: Usuarios registrados recientemente en el campus (aparecen arriba para conectar)
  for (const reg of localRegistered) {
    if (!idsVistos.has(reg.id)) {
      idsVistos.add(reg.id);
      todos.push(reg);
    }
  }

  // Prioridad 2: Perfiles reales traídos de Supabase
  for (const p of realProfiles) {
    if (!idsVistos.has(p.id)) {
      idsVistos.add(p.id);
      todos.push(p);
    }
  }

  // Prioridad 3: Perfiles de muestra de campus para el piloto
  for (const p of PERFILES_CAMPUS_PILOTO) {
    if (p.id !== currentUserId && !idsVistos.has(p.id) && !blockedIds.includes(p.id)) {
      idsVistos.add(p.id);
      todos.push(p);
    }
  }

  // Aplicar filtros en memoria
  return todos.filter(p => {
    const nombreCompleto = `${p.nombre || ''} ${p.apellido || ''} ${p.usuario ? '@' + p.usuario : ''}`.toLowerCase();
    const carreraStr = (p.carrera || '').toLowerCase();

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!nombreCompleto.includes(term) && !carreraStr.includes(term)) {
        return false;
      }
    }

    if (carrera && p.carrera !== carrera) {
      return false;
    }

    if (ciclo && Number(p.ciclo) !== Number(ciclo)) {
      return false;
    }

    if (interes) {
      const ints = p.intereses || [];
      if (!ints.includes(interes)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Consulta las solicitudes de conexión recibidas y enviadas
 */
export async function fetchSolicitudes(userId) {
  if (!userId) {
    return { recibidas: [], enviadas: [] };
  }

  // 1. Obtener del almacén local
  const locales = getSolicitudesStorage();
  let localRecibidas = locales.filter(s => s.a_id === userId);
  let localEnviadas = locales.filter(s => s.de_id === userId);

  // 2. Si Supabase está disponible, consultar y fusionar
  if (isSupabaseConfigured) {
    try {
      const [resRec, resEnv] = await Promise.all([
        withTimeout(
          supabase
            .from('solicitudes_mensaje')
            .select('id, de_id, a_id, motivo, estado, creado_en, respondido_en')
            .eq('a_id', userId)
            .order('creado_en', { ascending: false }),
          2000
        ).catch(() => ({ data: [] })),
        withTimeout(
          supabase
            .from('solicitudes_mensaje')
            .select('id, de_id, a_id, motivo, estado, creado_en, respondido_en')
            .eq('de_id', userId)
            .order('creado_en', { ascending: false }),
          2000
        ).catch(() => ({ data: [] }))
      ]);

      if (resRec?.data?.length) {
        const ids = new Set(localRecibidas.map(s => s.id));
        for (const s of resRec.data) {
          if (!ids.has(s.id)) localRecibidas.push(s);
        }
      }

      if (resEnv?.data?.length) {
        const ids = new Set(localEnviadas.map(s => s.id));
        for (const s of resEnv.data) {
          if (!ids.has(s.id)) localEnviadas.push(s);
        }
      }
    } catch (err) {}
  }

  // Enriquecer con perfiles
  const enriquecer = (lista, campoOtroId) => {
    if (!lista || lista.length === 0) return [];
    return lista.map((sol) => {
      const otherId = sol[campoOtroId];
      // Buscar en registrados locales o catálogo de piloto
      const localP = findRegisteredUser(otherId) || PERFILES_CAMPUS_PILOTO.find(p => p.id === otherId);

      return {
        ...sol,
        otroUsuario: localP || {
          id: otherId,
          nombre: 'Compañero UTP',
          apellido: '',
          usuario: 'estudiante',
          carrera: 'Campus',
          ciclo: 1,
          sede: 'Lima Sur'
        }
      };
    });
  };

  return {
    recibidas: enriquecer(localRecibidas, 'de_id'),
    enviadas: enriquecer(localEnviadas, 'a_id')
  };
}

/**
 * Envía una solicitud de mensaje formal con motivo académico (Spec 6.4)
 */
export async function enviarSolicitudMensaje({ deId, aId, motivo }) {
  if (!deId || !aId) {
    return { success: false, error: 'Identidad de usuario requerida.' };
  }

  if (deId === aId) {
    return { success: false, error: 'No puedes enviarte una solicitud a ti mismo.' };
  }

  if (!motivo || !motivo.trim()) {
    return { success: false, error: 'Debes indicar un motivo para la solicitud de contacto.' };
  }

  try {
    // 1. Guardar siempre en almacenamiento local sincronizado
    let solicitudLocal;
    try {
      solicitudLocal = saveSolicitudStorage({ deId, aId, motivo: motivo.trim() });
    } catch (errLocal) {
      return { success: false, error: errLocal.message };
    }

    // 2. Intentar guardar en Supabase en paralelo si está disponible
    if (isSupabaseConfigured && !String(aId).startsWith('usr_')) {
      withTimeout(
        supabase.from('solicitudes_mensaje').insert({
          de_id: deId,
          a_id: aId,
          motivo: motivo.trim(),
          estado: 'pendiente'
        }),
        2000
      ).catch(() => {});
    }

    return { success: true, solicitud: solicitudLocal };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Responde a una solicitud de conexión (aceptar o rechazar)
 */
export async function responderSolicitud({ solicitudId, accion, deId, aId }) {
  if (!solicitudId) {
    return { success: false, error: 'ID de solicitud requerido.' };
  }

  try {
    const estado = accion === 'aceptada' ? 'aceptada' : 'rechazada';

    // 1. Actualizar en almacenamiento local
    const resultadoLocal = responderSolicitudStorage(solicitudId, accion);

    // 2. Intentar actualizar en Supabase en paralelo
    if (isSupabaseConfigured) {
      withTimeout(
        supabase
          .from('solicitudes_mensaje')
          .update({ estado, respondido_en: new Date().toISOString() })
          .eq('id', solicitudId),
        2000
      ).catch(() => {});
    }

    let conversacion = resultadoLocal?.conversacion || null;
    if (estado === 'aceptada' && deId && aId && !conversacion) {
      const resConv = await getOrCreateConversacion(deId, aId);
      if (resConv.success) {
        conversacion = resConv.conversacion;
      }
    }

    return { success: true, estado, conversacion };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reporta un perfil, mensaje o espacio a moderación
 */
export async function reportarContenido({ autorId, tipo, objetoId, motivo }) {
  if (!isSupabaseConfigured || !autorId || !tipo || !objetoId || !motivo?.trim()) {
    return { success: false, error: 'Datos incompletos para el reporte.' };
  }

  try {
    const { data, error } = await supabase
      .from('reportes')
      .insert({
        autor_id: autorId,
        tipo,
        objeto_id: String(objetoId),
        motivo: motivo.trim(),
        estado: 'abierto'
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, reporte: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Bloquea a un usuario para impedir contacto e interacciones
 */
export async function bloquearUsuario({ bloqueadorId, bloqueadoId }) {
  if (!isSupabaseConfigured || !bloqueadorId || !bloqueadoId || bloqueadorId === bloqueadoId) {
    return { success: false, error: 'No se puede bloquear este usuario.' };
  }

  try {
    const { data, error } = await supabase
      .from('bloqueos')
      .insert({
        bloqueador_id: bloqueadorId,
        bloqueado_id: bloqueadoId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: true, alreadyBlocked: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true, bloqueo: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
