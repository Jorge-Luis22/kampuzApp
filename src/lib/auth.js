import {
  supabase,
  ejecutar,
  rpc,
  conTiempo,
  uidActual,
  mensajeError,
  KampuzError,
  isSupabaseConfigured
} from './supabase.js';

// =============================================================================
// Autenticación real con Supabase Auth.
// - Registro: correo + contraseña + @usuario (supabase.auth.signUp).
// - Verificación: código de 6 dígitos que llega al correo (verifyOtp type 'signup').
//   La plantilla "Confirm signup" de Supabase debe usar {{ .Token }}.
// - Login: @usuario o correo + contraseña.
// - Recuperación: resetPasswordForEmail + código (verifyOtp type 'recovery').
// - El dominio @utp.edu.pe / correos_invitados se valida SOLO en el servidor
//   (trigger trg_validar_auth_user, migración 009).
// No existe ningún código local, ni código fijo, ni acceso sin verificar.
// =============================================================================

export const FORMATO_USUARIO = /^[a-z0-9._]{3,30}$/;

export function limpiarUsuario(usuario = '') {
  return usuario.trim().toLowerCase().replace(/^@/, '');
}

/**
 * Traduce errores de Supabase Auth al español.
 */
function mensajeErrorAuth(error) {
  const texto = `${error?.code || ''} ${error?.message || ''}`;

  if (/Database error saving new user|KAMPUZ_CORREO_NO_PERMITIDO/i.test(texto)) {
    return 'Este correo no está habilitado en Kampuz. Usa tu correo @utp.edu.pe.';
  }
  if (/user_already_exists|already registered/i.test(texto)) {
    return 'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.';
  }
  if (/weak_password|Password should/i.test(texto)) {
    return 'La contraseña es muy débil. Usa al menos 8 caracteres, con letras y números.';
  }
  if (/email_address_invalid|invalid format|Unable to validate email/i.test(texto)) {
    return 'Ese correo no tiene un formato válido.';
  }
  if (/invalid_credentials|Invalid login credentials/i.test(texto)) {
    return 'Usuario/correo o contraseña incorrectos.';
  }
  if (/email_not_confirmed|Email not confirmed/i.test(texto)) {
    return 'Aún no verificas tu correo. Te enviamos un código nuevo.';
  }
  if (/otp_expired|Token has expired|invalid.*token|otp/i.test(texto)) {
    return 'El código es incorrecto o ya venció. Pide uno nuevo.';
  }
  if (/over_email_send_rate_limit|rate limit|only request this after/i.test(texto)) {
    const segundos = (error?.message || '').match(/(\d+)\s*seconds?/);
    return segundos
      ? `Espera ${segundos[1]} segundos antes de pedir otro código.`
      : 'Pediste demasiados códigos. Espera unos minutos e inténtalo otra vez.';
  }
  if (/signup_disabled|Signups not allowed/i.test(texto)) {
    return 'El registro está desactivado en este momento.';
  }
  if (/same_password|should be different/i.test(texto)) {
    return 'La nueva contraseña debe ser distinta de la anterior.';
  }
  return mensajeError(error);
}

/**
 * Ejecuta una llamada de supabase.auth con timeout y errores en español.
 */
async function auth(llamada) {
  if (!isSupabaseConfigured) {
    throw new KampuzError('La app no está configurada para conectarse al servidor.');
  }
  let res;
  try {
    res = await conTiempo(llamada);
  } catch (err) {
    if (err instanceof KampuzError) throw err;
    throw new KampuzError(mensajeErrorAuth(err), { causa: err });
  }
  if (res?.error) {
    throw new KampuzError(mensajeErrorAuth(res.error), { codigo: res.error.code, causa: res.error });
  }
  return res?.data;
}

/**
 * ¿El @usuario está libre? Lo decide el servidor (RPC usuario_disponible).
 */
export async function usuarioDisponible(usuario) {
  const limpio = limpiarUsuario(usuario);
  if (!FORMATO_USUARIO.test(limpio)) return false;
  return Boolean(await rpc('usuario_disponible', { p_usuario: limpio }));
}

/**
 * Convierte "@usuario" o "correo" en correo. Lanza si el @usuario no existe.
 */
async function resolverCorreo(identificador) {
  const limpio = identificador.trim().toLowerCase().replace(/^@/, '');
  if (limpio.includes('@')) return limpio;
  const correo = await rpc('obtener_correo_por_identificador', { p_identificador: limpio });
  if (!correo) {
    throw new KampuzError('Usuario/correo o contraseña incorrectos.');
  }
  return correo;
}

/**
 * Crea la cuenta. Supabase envía el código de 6 dígitos al correo.
 */
export async function registrar({ nombre, apellido, usuario, email, password }) {
  const correo = email.trim().toLowerCase();
  const user = limpiarUsuario(usuario);

  if (!FORMATO_USUARIO.test(user)) {
    throw new KampuzError('El @usuario debe tener de 3 a 30 caracteres: letras, números, punto o guion bajo.');
  }
  if (!(await usuarioDisponible(user))) {
    throw new KampuzError(`@${user} ya está en uso. Elige otro.`);
  }

  const data = await auth(
    supabase.auth.signUp({
      email: correo,
      password,
      options: {
        data: { nombre: nombre.trim(), apellido: apellido.trim(), usuario: user }
      }
    })
  );

  // Con "Confirm email" activo, Supabase no revela si el correo ya existía:
  // devuelve un usuario sin identidades. Lo tratamos como cuenta existente.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new KampuzError('Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.');
  }

  return { correo, sesion: data?.session || null };
}

/**
 * Verifica el código de 6 dígitos del registro y abre la sesión.
 */
export async function verificarCodigoRegistro(email, codigo) {
  const data = await auth(
    supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: 'signup' })
  );
  if (!data?.session) {
    throw new KampuzError('El código es incorrecto o ya venció. Pide uno nuevo.');
  }
  return data.session;
}

export async function reenviarCodigoRegistro(email) {
  await auth(supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() }));
}

/**
 * Inicia sesión con @usuario o correo + contraseña.
 * Si el correo no está verificado, reenvía el código y lanza codigo EMAIL_NO_CONFIRMADO.
 */
export async function iniciarSesion(identificador, password) {
  const correo = await resolverCorreo(identificador);
  try {
    const data = await auth(supabase.auth.signInWithPassword({ email: correo, password }));
    return data.session;
  } catch (err) {
    const causa = err?.causa;
    if (causa && /email_not_confirmed|Email not confirmed/i.test(`${causa.code} ${causa.message}`)) {
      try {
        await reenviarCodigoRegistro(correo);
      } catch (e) {
        // Si el reenvío falla (p. ej. límite de envíos), igual llevamos al alumno a la pantalla del código.
      }
      throw new KampuzError(err.message, { codigo: 'EMAIL_NO_CONFIRMADO', causa: { correo } });
    }
    throw err;
  }
}

/**
 * Envía el código de recuperación de contraseña. Devuelve el correo de destino.
 */
export async function solicitarRecuperacion(identificador) {
  const correo = await resolverCorreo(identificador);
  await auth(supabase.auth.resetPasswordForEmail(correo));
  return correo;
}

/**
 * Verifica el código de recuperación, cambia la contraseña y cierra la sesión
 * temporal para que el alumno entre con su nueva clave.
 */
export async function confirmarRecuperacion(email, codigo, nuevaPassword) {
  await auth(
    supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: 'recovery' })
  );
  await auth(supabase.auth.updateUser({ password: nuevaPassword }));
  await cerrarSesion();
}

/**
 * Cierra la sesión. Si no hay red, igual se borra la sesión local.
 */
export async function cerrarSesion() {
  if (!isSupabaseConfigured) return;
  try {
    await conTiempo(supabase.auth.signOut());
  } catch (err) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
}

// =============================================================================
// Perfil propio (lectura y alta inicial en el onboarding)
// =============================================================================

export function perfilDesdeFila(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    usuario: fila.usuario || '',
    correoInstitucional: fila.correo_institucional,
    correoAlterno: fila.correo_alterno || '',
    fotoUrl: fila.foto_url || null,
    bio: fila.bio || '',
    sede: fila.sede,
    carrera: fila.carrera,
    ciclo: fila.ciclo,
    fechaNacimiento: fila.fecha_nacimiento,
    intereses: fila.intereses || [],
    rol: fila.rol,
    origenCampos: fila.origen_campos || {},
    enlaces: fila.enlaces || {},
    estadoEnVivo: fila.estado_en_vivo || null,
    creadoEn: fila.creado_en
  };
}

/**
 * Lee el perfil del usuario con sesión. Devuelve null si aún no completa el onboarding.
 */
export async function obtenerPerfil(userId) {
  const fila = await ejecutar(
    supabase.from('perfiles').select('*').eq('id', userId).maybeSingle()
  );
  return perfilDesdeFila(fila);
}

/**
 * Crea (o completa) el perfil del alumno con sesión real.
 * El servidor fija el correo, el rol y el origen de los campos.
 */
export async function guardarPerfilInicial(datos) {
  const uid = await uidActual();
  const fila = await ejecutar(
    supabase
      .from('perfiles')
      .upsert(
        {
          id: uid,
          correo_institucional: datos.correoInstitucional, // el servidor lo reemplaza por el de la sesión
          nombre: datos.nombre.trim(),
          apellido: datos.apellido.trim(),
          usuario: limpiarUsuario(datos.usuario),
          foto_url: datos.fotoUrl || null,
          sede: datos.sede,
          carrera: datos.carrera,
          ciclo: Number(datos.ciclo),
          fecha_nacimiento: datos.fechaNacimiento,
          intereses: datos.intereses || []
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single()
  ).catch((err) => {
    if (err?.causa?.code === '23505' && /usuario/i.test(`${err.causa.message} ${err.causa.details}`)) {
      throw new KampuzError(`@${limpiarUsuario(datos.usuario)} ya está en uso. Elige otro.`);
    }
    throw err;
  });
  return perfilDesdeFila(fila);
}
