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
// - Login: correo + contraseña directo con Supabase Auth; con @usuario, por la Edge
//   Function `login`, que busca el correo en el servidor y devuelve solo la sesión
//   (el correo de un @usuario nunca llega al cliente).
// - Recuperación: con el correo institucional (resetPasswordForEmail + código,
//   verifyOtp type 'recovery').
// - El dominio @utp.edu.pe / correos_invitados se valida SOLO en el servidor
//   (trigger trg_validar_auth_user, migración 009).
// No existe ningún código local, ni código fijo, ni acceso sin verificar.
// =============================================================================

export const FORMATO_USUARIO = /^[a-z0-9._]{3,30}$/;

export function limpiarUsuario(usuario = '') {
  return usuario.trim().toLowerCase().replace(/^@/, '');
}

// El mismo mensaje para usuario inexistente y contraseña incorrecta
const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos.';

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
    return MSG_CREDENCIALES;
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
 * Inicia sesión con @usuario mediante la Edge Function `login`: el servidor resuelve
 * el correo con la service role y devuelve solo la sesión, que se guarda aquí.
 */
async function iniciarSesionConUsuario(usuario, password) {
  if (!isSupabaseConfigured) {
    throw new KampuzError('La app no está configurada para conectarse al servidor.');
  }
  let res;
  try {
    res = await conTiempo(supabase.functions.invoke('login', { body: { identificador: usuario, password } }));
  } catch (err) {
    if (err instanceof KampuzError) throw err;
    throw new KampuzError(mensajeError(err), { causa: err });
  }

  if (res?.error) {
    // FunctionsHttpError trae la respuesta del servidor en error.context
    let cuerpo = null;
    try {
      cuerpo = await res.error.context?.json?.();
    } catch (e) {
      cuerpo = null;
    }
    if (cuerpo?.codigo === 'EMAIL_NO_CONFIRMADO') {
      throw new KampuzError('Aún no verificas tu correo. Entra con tu correo institucional para recibir el código.');
    }
    if (cuerpo?.error) throw new KampuzError(cuerpo.error, { codigo: cuerpo.codigo || null });
    if (res.error.context?.status === 404) {
      // La Edge Function aún no se desplegó en este proyecto de Supabase
      throw new KampuzError('Por ahora entra con tu correo institucional.', { causa: res.error });
    }
    if (/FunctionsFetchError|FunctionsRelayError/.test(res.error.name || '')) {
      throw new KampuzError('No pudimos conectar con Kampuz. Revisa tu internet e inténtalo de nuevo.', { causa: res.error });
    }
    throw new KampuzError(MSG_CREDENCIALES, { causa: res.error });
  }

  const sesion = res?.data?.session;
  if (!sesion?.access_token || !sesion?.refresh_token) {
    throw new KampuzError(MSG_CREDENCIALES);
  }
  const data = await auth(supabase.auth.setSession(sesion));
  return data.session;
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
  const limpio = identificador.trim().toLowerCase().replace(/^@/, '');
  if (!limpio.includes('@')) {
    return iniciarSesionConUsuario(limpio, password);
  }
  const correo = limpio;
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
  // Solo con el correo: buscarlo a partir de un @usuario revelaría el correo de otra persona.
  const correo = identificador.trim().toLowerCase();
  if (!correo.includes('@')) {
    throw new KampuzError('Para recuperar tu contraseña, escribe tu correo institucional.');
  }
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

export const EDAD_MINIMA_POR_DEFECTO = 14;

/**
 * Edad mínima para registrarse (config edad_minima_registro). El servidor la vuelve
 * a validar al guardar el perfil; aquí solo sirve para avisar antes.
 */
export async function obtenerEdadMinima() {
  const fila = await ejecutar(
    supabase.from('config').select('valor').eq('clave', 'edad_minima_registro').maybeSingle()
  );
  return Math.max(EDAD_MINIMA_POR_DEFECTO, parseInt(fila?.valor, 10) || EDAD_MINIMA_POR_DEFECTO);
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
 * Guarda el @usuario de un perfil que aún no tiene (cuentas creadas antes del
 * @usuario). Solo funciona si el perfil no tenía uno: no sirve para cambiarlo.
 */
export async function guardarUsuarioFaltante(usuario) {
  const limpio = limpiarUsuario(usuario);
  if (!FORMATO_USUARIO.test(limpio)) {
    throw new KampuzError('El @usuario debe tener de 3 a 30 caracteres: letras minúsculas, números, punto o guion bajo.');
  }
  if (!(await usuarioDisponible(limpio))) {
    throw new KampuzError(`@${limpio} ya está en uso. Elige otro.`);
  }
  const uid = await uidActual();
  const fila = await ejecutar(
    supabase.from('perfiles').update({ usuario: limpio }).eq('id', uid).is('usuario', null).select('*').maybeSingle()
  ).catch((err) => {
    if (err?.causa?.code === '23505') throw new KampuzError(`@${limpio} ya está en uso. Elige otro.`);
    throw err;
  });
  if (fila) return perfilDesdeFila(fila);
  // Ya tenía @usuario (por ejemplo, lo eligió en otro celular): se usa el guardado
  const actual = await obtenerPerfil(uid);
  if (!actual?.usuario) throw new KampuzError('No pudimos guardar tu @usuario. Inténtalo de nuevo.');
  return actual;
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
