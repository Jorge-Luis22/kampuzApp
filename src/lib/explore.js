import { supabase, isSupabaseConfigured } from './supabase';
import { getOrCreateConversacion } from './chat';

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

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('perfiles')
        .select('id, nombre, apellido, foto_url, bio, sede, carrera, ciclo, intereses, rol, creado_en');

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      if (carrera) {
        query = query.eq('carrera', carrera);
      }

      if (ciclo) {
        query = query.eq('ciclo', Number(ciclo));
      }

      const { data, error } = await query;
      if (!error && data) {
        realProfiles = data;
      }
    } catch (err) {
      console.warn('[Kampus Explore] Error consultando perfiles:', err.message);
    }
  }

  // Filtrar bloqueados
  realProfiles = realProfiles.filter(p => !blockedIds.includes(p.id));

  // Combinar perfiles de campus complementarios para el piloto asegurando que no se dupliquen
  const idsReales = new Set(realProfiles.map(p => p.id));
  const complementarios = PERFILES_CAMPUS_PILOTO.filter(
    p => p.id !== currentUserId && !idsReales.has(p.id) && !blockedIds.includes(p.id)
  );

  const todos = [...realProfiles, ...complementarios];

  // Aplicar filtros en memoria
  return todos.filter(p => {
    const nombreCompleto = `${p.nombre || ''} ${p.apellido || ''}`.toLowerCase();
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
  if (!isSupabaseConfigured || !userId) {
    return { recibidas: [], enviadas: [] };
  }

  try {
    // 1. Solicitudes recibidas
    const { data: recibidasData, error: errRecibidas } = await supabase
      .from('solicitudes_mensaje')
      .select('id, de_id, a_id, motivo, estado, creado_en, respondido_en')
      .eq('a_id', userId)
      .order('creado_en', { ascending: false });

    // 2. Solicitudes enviadas
    const { data: enviadasData, error: errEnviadas } = await supabase
      .from('solicitudes_mensaje')
      .select('id, de_id, a_id, motivo, estado, creado_en, respondido_en')
      .eq('de_id', userId)
      .order('creado_en', { ascending: false });

    if (errRecibidas || errEnviadas) {
      console.warn('[Kampus Explore] Error cargando solicitudes');
    }

    // Enriquecer con perfiles
    const enriquecer = async (lista, campoOtroId) => {
      if (!lista || lista.length === 0) return [];
      return Promise.all(
        lista.map(async (sol) => {
          const otherId = sol[campoOtroId];
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('id, nombre, apellido, foto_url, carrera, ciclo, sede, intereses')
            .eq('id', otherId)
            .maybeSingle();

          return {
            ...sol,
            otroUsuario: perfil || {
              id: otherId,
              nombre: 'Estudiante UTP',
              apellido: '',
              carrera: 'Campus',
              ciclo: 1,
              sede: 'Lima'
            }
          };
        })
      );
    };

    const [recibidas, enviadas] = await Promise.all([
      enriquecer(recibidasData || [], 'de_id'),
      enriquecer(enviadasData || [], 'a_id')
    ]);

    return { recibidas, enviadas };
  } catch (err) {
    console.error('[Kampus Explore] Excepción en fetchSolicitudes:', err);
    return { recibidas: [], enviadas: [] };
  }
}

/**
 * Envía una solicitud de mensaje formal con motivo académico (Spec 6.4)
 */
export async function enviarSolicitudMensaje({ deId, aId, motivo }) {
  if (!isSupabaseConfigured || !deId || !aId) {
    return { success: false, error: 'Identidad de usuario requerida.' };
  }

  if (deId === aId) {
    return { success: false, error: 'No puedes enviarte una solicitud a ti mismo.' };
  }

  if (!motivo || !motivo.trim()) {
    return { success: false, error: 'Debes indicar un motivo para la solicitud de contacto.' };
  }

  try {
    // Si el destinatario es un id simulado de campus
    if (String(aId).startsWith('usr_')) {
      return {
        success: true,
        solicitud: {
          id: 'sol_sim_' + Date.now(),
          de_id: deId,
          a_id: aId,
          motivo: motivo.trim(),
          estado: 'pendiente',
          creado_en: new Date().toISOString()
        }
      };
    }

    // Comprobar si ya existe una solicitud entre ambos
    const { data: existente } = await supabase
      .from('solicitudes_mensaje')
      .select('id, estado')
      .eq('de_id', deId)
      .eq('a_id', aId)
      .maybeSingle();

    if (existente) {
      if (existente.estado === 'pendiente') {
        return { success: false, error: 'Ya tienes una solicitud pendiente enviada a este estudiante.' };
      }
      if (existente.estado === 'aceptada') {
        return { success: false, error: 'Ya tienes conexión aceptada con este estudiante. Puedes abrir el chat directo.' };
      }
    }

    const { data, error } = await supabase
      .from('solicitudes_mensaje')
      .insert({
        de_id: deId,
        a_id: aId,
        motivo: motivo.trim(),
        estado: 'pendiente'
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, solicitud: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Responde a una solicitud de conexión (aceptar o rechazar)
 */
export async function responderSolicitud({ solicitudId, accion, deId, aId }) {
  if (!isSupabaseConfigured || !solicitudId) {
    return { success: false, error: 'ID de solicitud requerido.' };
  }

  try {
    const estado = accion === 'aceptada' ? 'aceptada' : 'rechazada';

    // Actualizar solicitud
    const { error: updErr } = await supabase
      .from('solicitudes_mensaje')
      .update({
        estado,
        respondido_en: new Date().toISOString()
      })
      .eq('id', solicitudId);

    if (updErr) {
      console.warn('[Kampus Explore] Error actualizando solicitud:', updErr.message);
    }

    // Si fue aceptada, abrir/crear conversación
    let conversacion = null;
    if (estado === 'aceptada' && deId && aId) {
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
