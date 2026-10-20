import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Consulta la lista completa de espacios (carrera, ciclo, talleres, propuestas)
 * con el estado de membresía y apoyos del usuario actual.
 */
export async function fetchEspacios(userId) {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    // 1. Consultar espacios visibles o creados por el usuario
    const { data: espaciosData, error: espErr } = await supabase
      .from('espacios')
      .select('*')
      .order('creado_en', { ascending: false });

    if (espErr) {
      console.warn('[Kampus Spaces] Error al obtener espacios:', espErr.message);
      return [];
    }

    if (!espaciosData || espaciosData.length === 0) return [];

    // 2. Si el usuario está identificado, consultar sus membresías y apoyos
    let misMembresias = new Set();
    let misApoyos = new Set();

    if (userId) {
      const [{ data: mems }, { data: apoyos }] = await Promise.all([
        supabase.from('membresias').select('espacio_id').eq('usuario_id', userId),
        supabase.from('apoyos_propuesta').select('espacio_id').eq('usuario_id', userId)
      ]);

      if (mems) mems.forEach(m => misMembresias.add(m.espacio_id));
      if (apoyos) apoyos.forEach(a => misApoyos.add(a.espacio_id));
    }

    // 3. Obtener conteo de miembros y apoyos para cada espacio
    const espaciosEnriquecidos = await Promise.all(
      espaciosData.map(async (esp) => {
        const [{ count: countMiembros }, { count: countApoyos }] = await Promise.all([
          supabase.from('membresias').select('*', { count: 'exact', head: true }).eq('espacio_id', esp.id),
          supabase.from('apoyos_propuesta').select('*', { count: 'exact', head: true }).eq('espacio_id', esp.id)
        ]);

        return {
          id: esp.id,
          tipo: esp.tipo, // 'carrera_ciclo' | 'carrera' | 'taller' | 'interes'
          nombre: esp.nombre,
          descripcion: esp.descripcion,
          portadaUrl: esp.portada_url,
          carrera: esp.carrera,
          ciclo: esp.ciclo,
          sede: esp.sede,
          horario: esp.horario,
          oficial: Boolean(esp.oficial),
          estado: esp.estado, // 'visible' | 'oculto'
          umbral: esp.umbral_apoyos || 15,
          apoyos: countApoyos || 0,
          miembrosCount: countMiembros || 0,
          linkInscripcion: esp.link_inscripcion,
          esMiembro: misMembresias.has(esp.id),
          yaApoye: misApoyos.has(esp.id),
          creadorId: esp.creador_id
        };
      })
    );

    return espaciosEnriquecidos;
  } catch (err) {
    console.error('[Kampus Spaces] Excepción fetchEspacios:', err);
    return [];
  }
}

/**
 * Une al usuario a un espacio (taller o interés)
 */
export async function unirseAEspacio(userId, espacioId) {
  if (!isSupabaseConfigured || !userId || !espacioId) {
    return { success: false, error: 'Parámetros requeridos para unirse.' };
  }

  try {
    const { data, error } = await supabase
      .from('membresias')
      .insert({
        usuario_id: userId,
        espacio_id: espacioId,
        rol: 'miembro'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: true, alreadyMember: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true, membresia: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Permite al usuario salirse de un espacio
 */
export async function salirDeEspacio(userId, espacioId) {
  if (!isSupabaseConfigured || !userId || !espacioId) return { success: false };

  try {
    const { error } = await supabase
      .from('membresias')
      .delete()
      .eq('usuario_id', userId)
      .eq('espacio_id', espacioId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Apoya una propuesta de grupo nuevo (Fase 5 - M16)
 * Aplica regla de 1 apoyo por alumno garantizado por constraint único.
 * Si alcanza el umbral dinámico, el trigger lo pasa automáticamente a visible.
 */
export async function apoyarPropuestaEspacio(userId, espacioId) {
  if (!isSupabaseConfigured || !userId || !espacioId) {
    return { success: false, error: 'Identidad de usuario requerida.' };
  }

  try {
    const { data, error } = await supabase
      .from('apoyos_propuesta')
      .insert({
        usuario_id: userId,
        espacio_id: espacioId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya has apoyado esta propuesta anteriormente.' };
      }
      return { success: false, error: error.message };
    }

    // Consultar el estado actualizado del espacio tras el trigger
    const { data: espActualizado } = await supabase
      .from('espacios')
      .select('estado, umbral_apoyos')
      .eq('id', espacioId)
      .single();

    return {
      success: true,
      apoyo: data,
      nuevoEstado: espActualizado?.estado || 'oculto'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Propone un nuevo grupo de interés estudiantil (M16)
 * Calcula en el servidor el umbral dinámico max(15, round(base_activa * 0.03)).
 */
export async function proponerNuevoEspacio({ userId, nombre, descripcion, sede = 'Lima Sur' }) {
  if (!isSupabaseConfigured || !userId || !nombre?.trim()) {
    return { success: false, error: 'Nombre de grupo requerido.' };
  }

  try {
    // 1. Calcular umbral dinámico en base a perfiles activos
    const { count: baseActiva } = await supabase
      .from('perfiles')
      .select('*', { count: 'exact', head: true });

    const activos = baseActiva || 1;
    const umbral = Math.max(15, Math.round(activos * 0.03));

    // 2. Crear espacio con estado 'oculto' hasta que alcance los apoyos requeridos
    const payload = {
      tipo: 'interes',
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || 'Comunidad estudiantil en formación.',
      portada_url: '/grupos/interes_default.jpg',
      sede,
      oficial: false,
      creador_id: userId,
      estado: 'oculto',
      umbral_apoyos: umbral
    };

    const { data: nuevoEspacio, error: insErr } = await supabase
      .from('espacios')
      .insert(payload)
      .select()
      .single();

    if (insErr) {
      return { success: false, error: insErr.message };
    }

    // 3. El creador se une automáticamente y emite su primer apoyo
    await Promise.all([
      supabase.from('membresias').insert({
        usuario_id: userId,
        espacio_id: nuevoEspacio.id,
        rol: 'creador'
      }),
      supabase.from('apoyos_propuesta').insert({
        usuario_id: userId,
        espacio_id: nuevoEspacio.id
      })
    ]);

    return {
      success: true,
      espacio: {
        ...nuevoEspacio,
        apoyos: 1,
        umbral,
        esMiembro: true,
        yaApoye: true
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Carga los mensajes del chat grupal de un espacio
 */
export async function fetchMensajesEspacio(espacioId) {
  if (!isSupabaseConfigured || !espacioId) return [];

  try {
    const { data: mensajesData, error } = await supabase
      .from('mensajes')
      .select(`
        id,
        espacio_id,
        autor_id,
        texto,
        creado_en,
        editado_en,
        autor:autor_id (
          id,
          nombre,
          apellido,
          foto_url,
          carrera,
          ciclo,
          rol
        )
      `)
      .eq('espacio_id', espacioId)
      .order('creado_en', { ascending: true });

    if (error) {
      console.warn('[Kampus Spaces] Error al cargar mensajes de espacio:', error.message);
      return [];
    }

    return (mensajesData || []).map(m => ({
      id: m.id,
      espacioId: m.espacio_id,
      autorId: m.autor_id,
      autorNombre: m.autor ? `${m.autor.nombre} ${m.autor.apellido || ''}`.trim() : 'Estudiante',
      autorFoto: m.autor?.foto_url || null,
      autorCarrera: m.autor?.carrera || '',
      autorCiclo: m.autor?.ciclo || '',
      autorRol: m.autor?.rol || 'alumno',
      texto: m.texto,
      creadoEn: m.creado_en
    }));
  } catch (err) {
    console.error('[Kampus Spaces] Excepción fetchMensajesEspacio:', err);
    return [];
  }
}

/**
 * Envía un mensaje en el chat del espacio
 */
export async function enviarMensajeEspacio({ espacioId, autorId, texto }) {
  if (!isSupabaseConfigured || !espacioId || !autorId || !texto?.trim()) {
    return { success: false, error: 'Texto y sesión requeridos.' };
  }

  try {
    const { data, error } = await supabase
      .from('mensajes')
      .insert({
        espacio_id: espacioId,
        autor_id: autorId,
        texto: texto.trim()
      })
      .select(`
        id,
        espacio_id,
        autor_id,
        texto,
        creado_en
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, mensaje: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Suscripción en tiempo real a los mensajes de un espacio grupal
 */
export function subscribeToMensajesEspacio(espacioId, onNewMessage) {
  if (!isSupabaseConfigured || !espacioId) {
    return () => {};
  }

  const channel = supabase
    .channel(`espacio_chat_${espacioId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `espacio_id=eq.${espacioId}`
      },
      async (payload) => {
        if (!payload?.new) return;
        const msg = payload.new;

        // Cargar información del autor para enriquecer el mensaje
        let autorData = null;
        try {
          const { data } = await supabase
            .from('perfiles')
            .select('nombre, apellido, foto_url, carrera, ciclo, rol')
            .eq('id', msg.autor_id)
            .maybeSingle();
          autorData = data;
        } catch (e) {}

        const enriquecido = {
          id: msg.id,
          espacioId: msg.espacio_id,
          autorId: msg.autor_id,
          autorNombre: autorData ? `${autorData.nombre} ${autorData.apellido || ''}`.trim() : 'Estudiante',
          autorFoto: autorData?.foto_url || null,
          autorCarrera: autorData?.carrera || '',
          autorCiclo: autorData?.ciclo || '',
          autorRol: autorData?.rol || 'alumno',
          texto: msg.texto,
          creadoEn: msg.creado_en
        };

        if (typeof onNewMessage === 'function') {
          onNewMessage(enriquecido);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
