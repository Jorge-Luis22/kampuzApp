import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Verifica si un correo está autorizado para acceder a Kampus:
 * - Debe terminar en @utp.edu.pe, O
 * - Debe figurar en la tabla correos_invitados (profesores, jurado, testers)
 */
export async function isEmailAllowed(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Dominio institucional oficial
  if (cleanEmail.endsWith('@utp.edu.pe')) {
    return true;
  }

  // Si Supabase no está configurado, solo aceptar dominio utp
  if (!isSupabaseConfigured) {
    return false;
  }

  // 2. Verificar lista de invitados autorizados en la base de datos
  try {
    const { data, error } = await supabase
      .from('correos_invitados')
      .select('id')
      .ilike('correo', cleanEmail)
      .limit(1);

    if (error) {
      console.warn('[Kampus Auth] Error consultando correos_invitados:', error.message);
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch (err) {
    console.error('[Kampus Auth] Excepción al validar correo:', err);
    return false;
  }
}

/**
 * Solicita el envío de código OTP de 6 dígitos al correo
 */
export async function signInWithOtp(email) {
  const cleanEmail = email.trim().toLowerCase();

  // Validación previa en cliente
  const allowed = await isEmailAllowed(cleanEmail);
  if (!allowed) {
    return {
      success: false,
      error: 'Correo no autorizado. Kampus es una red cerrada exclusiva para @utp.edu.pe o invitados registrados.'
    };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase no está configurado. Revisa las variables en .env.local.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || 'Error inesperado al solicitar código.' };
  }
}

/**
 * Verifica el código de 6 dígitos ingresado por el alumno
 */
export async function verifyOtp(email, token) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email'
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err.message || 'Error al verificar el código.' };
  }
}

/**
 * Obtiene el perfil del usuario autenticado desde public.perfiles
 */
export async function getProfile(userId) {
  if (!isSupabaseConfigured || !userId) return null;

  try {
    const { data: perfil, error: perfilErr } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (perfilErr) {
      console.warn('[Kampus Auth] Error al cargar perfil:', perfilErr.message);
      return null;
    }

    if (!perfil) return null;

    // Cargar consentimientos otorgados
    const { data: consentimientos } = await supabase
      .from('consentimientos')
      .select('finalidad, otorgado')
      .eq('usuario_id', userId);

    const consentMap = {
      cuenta: true,
      encuestas: true,
      metricas: true,
      perfil_universidad: false
    };

    if (consentimientos) {
      consentimientos.forEach(c => {
        consentMap[c.finalidad] = c.otorgado;
      });
    }

    return {
      ...perfil,
      consentimientos: consentMap
    };
  } catch (err) {
    console.error('[Kampus Auth] Excepción al obtener perfil:', err);
    return null;
  }
}

/**
 * Guarda o actualiza el perfil completo y los 4 consentimientos en la base de datos
 */
export async function saveProfile(userId, profileData, consentimientos) {
  if (!isSupabaseConfigured || !userId) {
    return { success: false, error: 'Sesión no válida o Supabase no configurado.' };
  }

  try {
    // 1. Guardar en public.perfiles
    const perfilPayload = {
      id: userId,
      correo_institucional: profileData.correoInstitucional,
      correo_alterno: profileData.correoAlterno || null,
      nombre: profileData.nombre,
      apellido: profileData.apellido,
      foto_url: profileData.fotoUrl || null,
      bio: profileData.bio || null,
      sede: profileData.sede,
      carrera: profileData.carrera,
      ciclo: Number(profileData.ciclo),
      fecha_nacimiento: profileData.fechaNacimiento,
      intereses: profileData.intereses || [],
      origen_campos: {
        nombre: 'declarado',
        apellido: 'declarado',
        correo_institucional: 'verificado',
        carrera: 'declarado',
        ciclo: 'declarado',
        sede: 'declarado',
        fecha_nacimiento: 'declarado'
      },
      rol: profileData.rol || 'alumno',
      actualizado_en: new Date().toISOString()
    };

    const { error: perfilError } = await supabase
      .from('perfiles')
      .upsert(perfilPayload, { onConflict: 'id' });

    if (perfilError) {
      return { success: false, error: perfilError.message };
    }

    // 2. Guardar los 4 consentimientos (Ley 29733)
    const finalidades = ['cuenta', 'encuestas', 'metricas', 'perfil_universidad'];
    const consentRows = finalidades.map(finalidad => ({
      usuario_id: userId,
      finalidad,
      otorgado: finalidad === 'cuenta' ? true : Boolean(consentimientos?.[finalidad]),
      version_politica: '1.0',
      otorgado_en: new Date().toISOString(),
      revocado_en: !consentimientos?.[finalidad] && finalidad !== 'cuenta' ? new Date().toISOString() : null
    }));

    const { error: consentError } = await supabase
      .from('consentimientos')
      .upsert(consentRows, { onConflict: 'usuario_id,finalidad' });

    if (consentError) {
      console.warn('[Kampus Auth] Advertencia al guardar consentimientos:', consentError.message);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Error al persistir el perfil.' };
  }
}

/**
 * Cierra la sesión activa en Supabase
 */
export async function signOut() {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('[Kampus Auth] Error en signOut:', err);
  }
}
