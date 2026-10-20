/**
 * Kampus Campus Storage & Realtime Local-First Bus
 * Provee persistencia local sincronizada para usuarios registrados,
 * perfiles de campus, solicitudes de conexión y chat 1 a 1 en tiempo real.
 * Funciona de manera transparente tanto offline como en conjunto con Supabase.
 */

const KEY_USUARIOS = 'kampus_usuarios_registrados_v1';
const KEY_SOLICITUDES = 'kampus_solicitudes_conexion_v1';
const KEY_CONVERSACIONES = 'kampus_conversaciones_v1';
const KEY_MENSAJES = 'kampus_mensajes_directos_v1';

// Canal de difusión en tiempo real entre pestañas y ventanas
let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    broadcastChannel = new BroadcastChannel('kampus_campus_bus');
  }
} catch (e) {
  console.warn('[CampusStorage] BroadcastChannel no disponible:', e);
}

/**
 * Emite un evento en tiempo real a todas las pestañas abiertas
 */
export function emitCampusEvent(tipo, payload) {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ tipo, payload, timestamp: Date.now() });
    }
    // Fallback: evento de storage para navegadores que no tengan BroadcastChannel
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kampus_last_event', JSON.stringify({ tipo, payload, timestamp: Date.now() }));
    }
  } catch (e) {
    console.warn('[CampusStorage] Error al emitir evento:', e);
  }
}

/**
 * Se suscribe a eventos del campus en tiempo real
 */
export function subscribeToCampusEvents(handler) {
  if (typeof window === 'undefined') return () => {};

  const onBroadcast = (event) => {
    if (event.data && typeof handler === 'function') {
      handler(event.data);
    }
  };

  const onStorage = (event) => {
    if (event.key === 'kampus_last_event' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (typeof handler === 'function') {
          handler(data);
        }
      } catch (e) {}
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', onBroadcast);
  }
  window.addEventListener('storage', onStorage);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', onBroadcast);
    }
    window.removeEventListener('storage', onStorage);
  };
}

// =============================================================================
// 1. GESTIÓN DE USUARIOS Y PERFILES REGISTRADOS
// =============================================================================

export function getRegisteredUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY_USUARIOS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveRegisteredUser(userData) {
  if (typeof window === 'undefined' || !userData) return null;
  try {
    const users = getRegisteredUsers();
    const index = users.findIndex(
      u => u.id === userData.id ||
      (userData.correo_institucional && u.correo_institucional?.toLowerCase() === userData.correo_institucional.toLowerCase()) ||
      (userData.usuario && u.usuario?.toLowerCase() === userData.usuario.toLowerCase())
    );

    const now = new Date().toISOString();
    const cleanUser = {
      id: userData.id || `usr_${Date.now()}`,
      nombre: userData.nombre || 'Estudiante',
      apellido: userData.apellido || '',
      usuario: (userData.usuario || userData.correo_institucional?.split('@')[0] || `user_${Date.now()}`).replace('@', '').toLowerCase(),
      correo_institucional: (userData.correo_institucional || userData.email || '').toLowerCase(),
      password: userData.password || '',
      carrera: userData.carrera || 'Ingeniería de Sistemas e Informática',
      ciclo: Number(userData.ciclo) || 1,
      sede: userData.sede || 'Lima Sur',
      intereses: Array.isArray(userData.intereses) ? userData.intereses : ['Programación', 'Inteligencia Artificial'],
      foto_url: userData.foto_url || userData.fotoUrl || null,
      bio: userData.bio || `Estudiante de ${userData.carrera || 'campus'} en UTP Lima Sur.`,
      rol: userData.rol || 'alumno',
      creado_en: userData.creado_en || now,
      actualizado_en: now
    };

    if (index >= 0) {
      users[index] = { ...users[index], ...cleanUser };
    } else {
      users.unshift(cleanUser);
    }

    window.localStorage.setItem(KEY_USUARIOS, JSON.stringify(users));
    emitCampusEvent('usuario_actualizado', cleanUser);
    return cleanUser;
  } catch (e) {
    console.error('[CampusStorage] Error guardando usuario:', e);
    return null;
  }
}

export function findRegisteredUser(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase().replace('@', '');
  const users = getRegisteredUsers();
  return users.find(
    u => u.id === identifier ||
         u.usuario?.toLowerCase() === clean ||
         u.correo_institucional?.toLowerCase() === clean ||
         u.correo_institucional?.toLowerCase() === `${clean}@utp.edu.pe`
  ) || null;
}

export function isUsernameAvailable(username, currentUserId = null) {
  if (!username) return false;
  const clean = username.trim().toLowerCase().replace('@', '');
  if (clean.length < 3) return false;
  const users = getRegisteredUsers();
  return !users.some(u => u.usuario?.toLowerCase() === clean && u.id !== currentUserId);
}

const KEY_ACTIVE_OTP = 'kampus_active_otp_v1';

export function setActiveOtpStorage(email, code) {
  if (typeof window === 'undefined' || !email) return;
  try {
    const raw = window.localStorage.getItem(KEY_ACTIVE_OTP);
    const otps = raw ? JSON.parse(raw) : {};
    otps[email.trim().toLowerCase()] = {
      code: String(code),
      createdAt: Date.now()
    };
    window.localStorage.setItem(KEY_ACTIVE_OTP, JSON.stringify(otps));
  } catch (e) {}
}

export function getActiveOtpStorage(email) {
  if (typeof window === 'undefined' || !email) return null;
  try {
    const raw = window.localStorage.getItem(KEY_ACTIVE_OTP);
    if (!raw) return null;
    const otps = JSON.parse(raw);
    const item = otps[email.trim().toLowerCase()];
    if (!item) return null;
    // Válido por 30 minutos
    if (Date.now() - item.createdAt > 30 * 60 * 1000) return null;
    return item.code;
  } catch (e) {
    return null;
  }
}

// =============================================================================
// 2. SOLICITUDES DE CONEXIÓN (M08, M09)
// =============================================================================

export function getSolicitudesStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY_SOLICITUDES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSolicitudStorage({ deId, aId, motivo }) {
  if (typeof window === 'undefined' || !deId || !aId) return null;
  try {
    const solicitudes = getSolicitudesStorage();

    // Comprobar si ya existe entre ambos
    const existente = solicitudes.find(s => s.de_id === deId && s.a_id === aId);
    if (existente) {
      if (existente.estado === 'pendiente') {
        throw new Error('Ya tienes una solicitud pendiente enviada a este estudiante.');
      }
      if (existente.estado === 'aceptada') {
        throw new Error('Ya tienes conexión aceptada con este estudiante. Puedes abrir el chat directo.');
      }
    }

    const nueva = {
      id: `sol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      de_id: deId,
      a_id: aId,
      motivo: motivo.trim(),
      estado: 'pendiente',
      creado_en: new Date().toISOString(),
      respondido_en: null
    };

    solicitudes.unshift(nueva);
    window.localStorage.setItem(KEY_SOLICITUDES, JSON.stringify(solicitudes));
    emitCampusEvent('solicitud_nueva', nueva);
    return nueva;
  } catch (e) {
    throw e;
  }
}

export function responderSolicitudStorage(solicitudId, accion) {
  if (typeof window === 'undefined' || !solicitudId) return null;
  try {
    const solicitudes = getSolicitudesStorage();
    const index = solicitudes.findIndex(s => s.id === solicitudId);
    if (index === -1) return null;

    const estado = accion === 'aceptada' ? 'aceptada' : 'rechazada';
    const ahora = new Date().toISOString();

    solicitudes[index] = {
      ...solicitudes[index],
      estado,
      respondido_en: ahora
    };

    window.localStorage.setItem(KEY_SOLICITUDES, JSON.stringify(solicitudes));

    let conversacion = null;
    if (estado === 'aceptada') {
      conversacion = getOrCreateConversacionStorage(solicitudes[index].de_id, solicitudes[index].a_id);
    }

    emitCampusEvent('solicitud_respondida', { solicitud: solicitudes[index], conversacion });
    return { solicitud: solicitudes[index], conversacion };
  } catch (e) {
    console.error('[CampusStorage] Error respondiendo solicitud:', e);
    return null;
  }
}

// =============================================================================
// 3. CONVERSACIONES 1 A 1 (M10)
// =============================================================================

export function getConversacionesStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY_CONVERSACIONES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getOrCreateConversacionStorage(userId1, userId2) {
  if (!userId1 || !userId2 || userId1 === userId2) return null;
  try {
    const userA = userId1 < userId2 ? userId1 : userId2;
    const userB = userId1 < userId2 ? userId2 : userId1;

    const convs = getConversacionesStorage();
    const existente = convs.find(c => c.usuario_a_id === userA && c.usuario_b_id === userB);
    if (existente) return existente;

    const nueva = {
      id: `conv_${userA}_${userB}`,
      usuario_a_id: userA,
      usuario_b_id: userB,
      abierta_en: new Date().toISOString(),
      ultimo_mensaje_en: new Date().toISOString()
    };

    convs.unshift(nueva);
    window.localStorage.setItem(KEY_CONVERSACIONES, JSON.stringify(convs));
    emitCampusEvent('conversacion_creada', nueva);
    return nueva;
  } catch (e) {
    console.error('[CampusStorage] Error en getOrCreateConversacion:', e);
    return null;
  }
}

// =============================================================================
// 4. MENSAJES DIRECTOS (M10)
// =============================================================================

export function getMensajesDirectosStorage(conversacionId) {
  if (typeof window === 'undefined' || !conversacionId) return [];
  try {
    const raw = window.localStorage.getItem(KEY_MENSAJES);
    const todos = raw ? JSON.parse(raw) : [];
    return todos.filter(m => m.conversacion_id === conversacionId);
  } catch (e) {
    return [];
  }
}

export function saveMensajeDirectoStorage({ conversacionId, autorId, texto }) {
  if (typeof window === 'undefined' || !conversacionId || !autorId || !texto?.trim()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_MENSAJES);
    const todos = raw ? JSON.parse(raw) : [];

    const nuevo = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversacion_id: conversacionId,
      autor_id: autorId,
      texto: texto.trim(),
      leido: false,
      creado_en: new Date().toISOString()
    };

    todos.push(nuevo);
    window.localStorage.setItem(KEY_MENSAJES, JSON.stringify(todos));

    // Actualizar ultimo_mensaje_en en conversación
    const convs = getConversacionesStorage();
    const idx = convs.findIndex(c => c.id === conversacionId);
    if (idx >= 0) {
      convs[idx].ultimo_mensaje_en = nuevo.creado_en;
      window.localStorage.setItem(KEY_CONVERSACIONES, JSON.stringify(convs));
    }

    emitCampusEvent('mensaje_directo', nuevo);
    return nuevo;
  } catch (e) {
    console.error('[CampusStorage] Error guardando mensaje directo:', e);
    return null;
  }
}

export function marcarMensajesComoLeidosStorage(conversacionId, userId) {
  if (typeof window === 'undefined' || !conversacionId || !userId) return;
  try {
    const raw = window.localStorage.getItem(KEY_MENSAJES);
    if (!raw) return;
    const todos = JSON.parse(raw);
    let modificado = false;

    todos.forEach(m => {
      if (m.conversacion_id === conversacionId && m.autor_id !== userId && !m.leido) {
        m.leido = true;
        modificado = true;
      }
    });

    if (modificado) {
      window.localStorage.setItem(KEY_MENSAJES, JSON.stringify(todos));
      emitCampusEvent('mensajes_leidos', { conversacionId, userId });
    }
  } catch (e) {}
}
