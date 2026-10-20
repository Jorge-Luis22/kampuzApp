import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Verifica si un correo está autorizado para acceder a Kampuz:
 * - Dominio @utp.edu.pe, O
 * - Figura en la tabla correos_invitados
 */
export async function isEmailAllowed(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail.endsWith('@utp.edu.pe')) {
    return true;
  }

  if (!isSupabaseConfigured) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('correos_invitados')
      .select('id')
      .ilike('correo', cleanEmail)
      .limit(1);

    if (error) {
      console.warn('[Kampuz Auth] Error consultando correos_invitados:', error.message);
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch (err) {
    console.error('[Kampuz Auth] Excepción al validar correo:', err);
    return false;
  }
}

/**
 * Obtiene el correo a partir de un usuario o correo
 */
export async function resolveEmailFromIdentifier(identifier) {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }

  if (!isSupabaseConfigured) {
    return `${clean}@utp.edu.pe`;
  }

  try {
    // 1. Intentar RPC
    const { data: rpcEmail, error: rpcErr } = await supabase.rpc('obtener_correo_por_identificador', {
      p_identificador: clean
    });

    if (!rpcErr && rpcEmail) {
      return rpcEmail;
    }

    // 2. Fallback consulta directa
    const { data, error } = await supabase
      .from('perfiles')
      .select('correo_institucional')
      .ilike('usuario', clean)
      .maybeSingle();

    if (!error && data?.correo_institucional) {
      return data.correo_institucional;
    }

    // 3. Fallback inteligente: si parece código de alumno (ej. u2320732)
    return `${clean}@utp.edu.pe`;
  } catch (e) {
    console.warn('[Kampuz Auth] Error resolviendo usuario:', e);
    return `${clean}@utp.edu.pe`;
  }
}

/**
 * Iniciar sesión con Usuario o Correo y Contraseña
 */
export async function signInWithPassword(identifier, password) {
  if (!identifier || !password) {
    return { success: false, error: 'Ingresa tu usuario o correo y tu contraseña.' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    const email = await resolveEmailFromIdentifier(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Usuario/correo o contraseña incorrectos.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Tu correo aún no ha sido confirmado con el código de verificación.', emailNeedsConfirm: email };
      }
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err.message || 'Error al iniciar sesión.' };
  }
}

/**
 * Registro de cuenta con Nombre, Usuario, Correo y Contraseña
 */
export async function signUpWithPassword({ nombre, apellido, usuario, email, password }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUser = usuario.trim().toLowerCase();

  const allowed = await isEmailAllowed(cleanEmail);
  if (!allowed) {
    return {
      success: false,
      error: 'Correo no autorizado. Kampuz es una red universitaria exclusiva para @utp.edu.pe o invitados registrados.'
    };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    // Verificar si el nombre de usuario ya existe en perfiles
    const { data: existingUser } = await supabase
      .from('perfiles')
      .select('id')
      .ilike('usuario', cleanUser)
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: 'El nombre de usuario ya está registrado por otro estudiante.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          usuario: cleanUser
        }
      }
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        return { success: false, error: 'Este correo ya tiene una cuenta registrada. Puedes iniciar sesión o recuperar tu contraseña.' };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      // Si Supabase requiere confirmar email vía código
      needsVerification: !data.session
    };
  } catch (err) {
    return { success: false, error: err.message || 'Error al crear la cuenta.' };
  }
}

/**
 * Solicita el envío de código OTP para verificar correo o iniciar sesión
 */
export async function signInWithOtp(email) {
  const cleanEmail = email.trim().toLowerCase();

  const allowed = await isEmailAllowed(cleanEmail);
  if (!allowed) {
    return {
      success: false,
      error: 'Correo no autorizado. Kampuz es exclusivo para @utp.edu.pe o invitados registrados.'
    };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true }
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || 'Error al enviar código.' };
  }
}

/**
 * Verifica código OTP de 6 dígitos
 */
export async function verifyOtp(email, token, type = 'email') {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    // Intentar con el tipo indicado (signup, recovery, o email)
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type
    });

    if (error) {
      // Reintento con type fallback si fuese necesario
      if (type !== 'email') {
        const fallback = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'email'
        });
        if (!fallback.error) {
          return { success: true, user: fallback.data.user, session: fallback.data.session };
        }
      }
      return { success: false, error: 'Código incorrecto o vencido. Verifica tu correo.' };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err.message || 'Error al verificar código.' };
  }
}

/**
 * Solicitar restablecimiento de contraseña vía correo
 */
export async function requestPasswordReset(identifier) {
  if (!identifier) {
    return { success: false, error: 'Ingresa tu usuario o correo institucional.' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    const email = await resolveEmailFromIdentifier(identifier);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, email };
  } catch (err) {
    return { success: false, error: err.message || 'Error al solicitar recuperación.' };
  }
}

/**
 * Confirmar nueva contraseña tras verificar el código de recuperación
 */
export async function confirmPasswordReset(email, token, newPassword) {
  if (!token || !newPassword) {
    return { success: false, error: 'Ingresa el código y tu nueva contraseña.' };
  }

  try {
    // 1. Verificar el código de recuperación
    const verifyRes = await verifyOtp(email, token, 'recovery');
    if (!verifyRes.success) {
      return verifyRes;
    }

    // 2. Actualizar la contraseña del usuario autenticado
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err.message || 'Error al actualizar la contraseña.' };
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

    if (perfilErr || !perfil) {
      return null;
    }

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
      usuario: perfil.usuario || perfil.correo_institucional?.split('@')[0],
      consentimientos: consentMap
    };
  } catch (err) {
    console.error('[Kampuz Auth] Excepción al obtener perfil:', err);
    return null;
  }
}

/**
 * Guarda o actualiza el perfil completo en public.perfiles
 * Los consentimientos se registran automáticamente de forma implícita.
 */
export async function saveProfile(userId, profileData, consentimientos = {}) {
  if (!isSupabaseConfigured || !userId) {
    return { success: false, error: 'Sesión no válida o Supabase no configurado.' };
  }

  try {
    const perfilPayload = {
      id: userId,
      correo_institucional: profileData.correoInstitucional,
      correo_alterno: profileData.correoAlterno || null,
      nombre: profileData.nombre,
      apellido: profileData.apellido,
      usuario: profileData.usuario || profileData.correoInstitucional?.split('@')[0],
      foto_url: profileData.fotoUrl || null,
      bio: profileData.bio || null,
      sede: profileData.sede,
      carrera: profileData.carrera,
      ciclo: Number(profileData.ciclo),
      fecha_nacimiento: profileData.fechaNacimiento || '2005-01-01',
      intereses: profileData.intereses || [],
      origen_campos: {
        nombre: 'declarado',
        apellido: 'declarado',
        usuario: 'declarado',
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

    // Registrar consentimientos automáticamente (implícito al aceptar términos)
    const finalidades = ['cuenta', 'encuestas', 'metricas', 'perfil_universidad'];
    const consentRows = finalidades.map(finalidad => ({
      usuario_id: userId,
      finalidad,
      otorgado: finalidad === 'perfil_universidad' ? Boolean(consentimientos?.perfil_universidad) : true,
      version_politica: '1.0',
      otorgado_en: new Date().toISOString()
    }));

    await supabase
      .from('consentimientos')
      .upsert(consentRows, { onConflict: 'usuario_id,finalidad' })
      .catch(() => {});

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
    console.warn('[Kampuz Auth] Error en signOut:', err);
  }
}
