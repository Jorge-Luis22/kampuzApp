import { supabase, isSupabaseConfigured, ejecutar, uidActual, KampuzError } from './supabase.js';
import { HABILIDADES_BASE_NUEVO_ALUMNO } from '../data/mockData.js';
import {
  isValidUUID,
  saveRegisteredUser,
  findRegisteredUser
} from './campusStorage.js';

const withTimeout = (promise, ms = 2200) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);
};

/**
 * Convierte un Blob a Data URL (Base64) de forma segura
 */
function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Comprime y recorta una imagen cuadrada en el navegador
 */
export async function procesarImagenCuadrada(file, maxDimension = 600, maxSizeBytes = 300 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // 1. Recorte cuadrado centrado
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        const targetDim = Math.min(minDim, maxDimension);

        const canvas = document.createElement('canvas');
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');

        // Suavizado de imagen
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetDim, targetDim);

        // 2. Compresión iterativa hasta asegurar < 300 KB
        let quality = 0.85;
        const intentarComprimir = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Error al procesar canvas de imagen.'));
                return;
              }
              if (blob.size <= maxSizeBytes || quality <= 0.4) {
                resolve(blob);
              } else {
                quality -= 0.1;
                intentarComprimir();
              }
            },
            'image/jpeg',
            quality
          );
        };

        intentarComprimir();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sube la foto de perfil del usuario con sesión a Supabase Storage (bucket avatares,
 * carpeta propia) y devuelve su URL pública. Si falla, lanza un error en español
 * para que la interfaz ofrezca reintentar. Nunca guarda la imagen en base64.
 */
export async function subirAvatar(file) {
  if (!file) throw new KampuzError('Elige una imagen.');
  const uid = await uidActual();
  let blob;
  try {
    blob = await procesarImagenCuadrada(file, 600, 300 * 1024);
  } catch (err) {
    throw new KampuzError('No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).');
  }
  const filePath = `${uid}/avatar_${Date.now()}.jpg`;
  await ejecutar(
    supabase.storage.from('avatares').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true }),
    { ms: 30000 }
  ).catch((err) => {
    throw new KampuzError(`No se pudo subir la foto. ${err.message}`);
  });
  const { data } = supabase.storage.from('avatares').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Sube la foto de perfil:
 * Intenta subir a Supabase Storage; si está offline o el ID es local,
 * guarda la imagen optimizada localmente en Base64 garantizando 0 errores.
 */
export async function uploadAvatar(userId, file) {
  if (!userId || !file) {
    throw new Error('Archivo o sesión no válidos.');
  }

  // 1. Comprimir y recortar
  const blob = await procesarImagenCuadrada(file, 600, 300 * 1024);
  const dataUrlFallback = await blobToDataUrl(blob);

  // 2. Si Supabase está disponible y el ID es un UUID de base de datos
  if (isSupabaseConfigured && isValidUUID(userId)) {
    try {
      const fileName = `avatar_${Date.now()}.jpg`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await withTimeout(
        supabase.storage.from('avatares').upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true
        }),
        2500
      );

      if (!uploadError) {
        const { data } = supabase.storage.from('avatares').getPublicUrl(filePath);
        const publicUrl = data?.publicUrl;
        if (publicUrl) {
          withTimeout(
            supabase.from('perfiles').update({
              foto_url: publicUrl,
              actualizado_en: new Date().toISOString()
            }).eq('id', userId),
            2000
          ).catch(() => {});

          saveRegisteredUser({ id: userId, foto_url: publicUrl });
          return publicUrl;
        }
      }
    } catch (err) {
      console.warn('[UploadAvatar] Fallo de red hacia Storage, usando foto local optimizada...');
    }
  }

  // 3. Respaldo local garantizado: guardar Data URL optimizada
  saveRegisteredUser({ id: userId, foto_url: dataUrlFallback });
  return dataUrlFallback;
}

/**
 * Actualiza los datos del perfil del usuario (nombre, apellido, bio, sede, carrera, ciclo, intereses, enlaces, estado)
 * Blindado contra errores de sintaxis UUID y con persistencia local instantánea.
 */
export async function updateProfile(userId, updates) {
  if (!userId) {
    return { success: false, error: 'Sesión no válida.' };
  }

  try {
    // 1. Guardar de forma inmediata en el repositorio local sincronizado de campus
    const localUser = findRegisteredUser(userId);
    const updatedLocal = saveRegisteredUser({
      ...(localUser || {}),
      id: userId,
      nombre: updates.nombre !== undefined ? updates.nombre.trim() : localUser?.nombre,
      apellido: updates.apellido !== undefined ? updates.apellido.trim() : localUser?.apellido,
      bio: updates.bio !== undefined ? updates.bio.trim() : localUser?.bio,
      sede: updates.sede !== undefined ? updates.sede : localUser?.sede,
      carrera: updates.carrera !== undefined ? updates.carrera : localUser?.carrera,
      ciclo: updates.ciclo !== undefined ? Number(updates.ciclo) : localUser?.ciclo,
      intereses: updates.intereses !== undefined ? updates.intereses : localUser?.intereses,
      foto_url: updates.fotoUrl !== undefined ? updates.fotoUrl : (localUser?.foto_url || localUser?.fotoUrl),
      enlaces: updates.enlaces !== undefined ? updates.enlaces : (localUser?.enlaces || {}),
      estado_en_vivo: updates.estadoEnVivo !== undefined ? updates.estadoEnVivo : (updates.estado_en_vivo !== undefined ? updates.estado_en_vivo : localUser?.estado_en_vivo)
    });

    // 2. Si el ID es un UUID válido de Postgres y Supabase está configurado, sincronizar
    if (isSupabaseConfigured && isValidUUID(userId)) {
      try {
        const payload = {
          actualizado_en: new Date().toISOString()
        };

        if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim();
        if (updates.apellido !== undefined) payload.apellido = updates.apellido.trim();
        if (updates.bio !== undefined) payload.bio = updates.bio.trim();
        if (updates.sede !== undefined) payload.sede = updates.sede;
        if (updates.carrera !== undefined) payload.carrera = updates.carrera;
        if (updates.ciclo !== undefined) payload.ciclo = Number(updates.ciclo);
        if (updates.intereses !== undefined) payload.intereses = updates.intereses;
        if (updates.fotoUrl !== undefined) payload.foto_url = updates.fotoUrl;

        await withTimeout(
          supabase.from('perfiles').update(payload).eq('id', userId),
          2200
        );
      } catch (errSupabase) {
        console.warn('[Profile] Sincronización remota Supabase omitida o con timeout:', errSupabase.message);
      }
    }

    return { success: true, perfil: updatedLocal };
  } catch (err) {
    return { success: false, error: 'No se pudo guardar la información en este momento. Inténtalo de nuevo.' };
  }
}

/**
 * Actualiza o revoca un consentimiento bajo Ley 29733 y registra la fecha exacta
 */
export async function updateConsentimiento(userId, finalidad, otorgado) {
  if (!isSupabaseConfigured || !userId) return { success: false };
  if (finalidad === 'cuenta') return { success: false, error: 'Consentimiento obligatorio.' };

  const now = new Date().toISOString();
  const payload = {
    usuario_id: userId,
    finalidad,
    otorgado,
    version_politica: '1.0',
    ...(otorgado ? { otorgado_en: now, revocado_en: null } : { revocado_en: now })
  };

  const { error } = await supabase
    .from('consentimientos')
    .upsert(payload, { onConflict: 'usuario_id,finalidad' });

  if (error) {
    console.error('[Consentimientos] Error al actualizar:', error);
    return { success: false, error: error.message };
  }

  return { success: true, timestamp: now };
}

/**
 * Calcula las habilidades derivadas de los hechos reales de la base de datos (Spec 5.1 & 5.3)
 */
export async function calcularHabilidadesReales(userId) {
  if (!isSupabaseConfigured || !userId) {
    return HABILIDADES_BASE_NUEVO_ALUMNO;
  }

  try {
    // 1. Apoyo a la investigación: contar encuestas respondidas
    const { count: encuestasRespondidas } = await supabase
      .from('envios_encuesta')
      .select('*', { count: 'exact', head: true })
      .eq('destinatario_id', userId)
      .eq('estado', 'respondida');

    const totalEncuestas = encuestasRespondidas || 0;
    const nivelInv = totalEncuestas >= 8 ? 3 : totalEncuestas >= 3 ? 2 : totalEncuestas >= 1 ? 1 : 0;
    const metaInv = nivelInv === 0 ? 1 : nivelInv === 1 ? 3 : 8;

    // 2. Predisposición a ayudar: contar asesorías valoradas útiles
    const { data: asesoriasData } = await supabase
      .from('asesorias')
      .select('id, estrellas_acreditadas, grupo_consulta_id, valoraciones_asesoria!inner(util)')
      .eq('asesor_id', userId)
      .eq('valoraciones_asesoria.util', true);

    const totalAsesorias = asesoriasData ? asesoriasData.length : 0;
    const estrellasAyuda = (asesoriasData || []).reduce((acc, curr) => acc + (curr.estrellas_acreditadas || 1), 0);
    const nivelAyu = totalAsesorias >= 5 ? 3 : totalAsesorias >= 2 ? 2 : totalAsesorias >= 1 ? 1 : 0;
    const metaAyu = nivelAyu === 0 ? 1 : nivelAyu === 1 ? 2 : 5;

    // 3. Constancia: participación en talleres y grupos
    const { count: gruposMiembro } = await supabase
      .from('membresias')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId);

    const totalGrupos = gruposMiembro || 0;
    const nivelCon = totalGrupos >= 5 ? 3 : totalGrupos >= 3 ? 2 : totalGrupos >= 1 ? 1 : 0;
    const metaCon = nivelCon === 0 ? 1 : nivelCon === 1 ? 3 : 5;

    // 4. Liderazgo: grupos de interés propuestos/creados
    const { count: gruposCreados } = await supabase
      .from('espacios')
      .select('*', { count: 'exact', head: true })
      .eq('creador_id', userId)
      .eq('tipo', 'interes');

    const totalLiderazgo = gruposCreados || 0;
    const nivelLid = totalLiderazgo >= 3 ? 3 : totalLiderazgo >= 2 ? 2 : totalLiderazgo >= 1 ? 1 : 0;
    const metaLid = nivelLid === 0 ? 1 : nivelLid === 1 ? 2 : 3;

    return {
      apoyo_investigacion: {
        id: 'apoyo_investigacion',
        nombre: 'Apoyo a la investigación',
        tipo: 'blanda',
        nivel: nivelInv,
        estrellas: totalEncuestas,
        origen: 'verificada',
        hechos: totalEncuestas > 0 ? [`Respondió ${totalEncuestas} encuesta(s) académica(s) de investigación`] : [],
        siguienteNivelMeta: metaInv,
        progresoActual: totalEncuestas
      },
      predisposicion_ayudar: {
        id: 'predisposicion_ayudar',
        nombre: 'Predisposición a ayudar',
        tipo: 'blanda',
        nivel: nivelAyu,
        estrellas: estrellasAyuda,
        origen: 'verificada',
        hechos: totalAsesorias > 0 ? [`Orientó a ${totalAsesorias} compañero(s) en dudas académicas`] : [],
        siguienteNivelMeta: metaAyu,
        progresoActual: totalAsesorias
      },
      constancia: {
        id: 'constancia',
        nombre: 'Constancia',
        tipo: 'blanda',
        nivel: nivelCon,
        estrellas: totalGrupos,
        origen: 'verificada',
        hechos: totalGrupos > 0 ? [`Membresía activa en ${totalGrupos} espacio(s) y taller(es) de la sede`] : [],
        siguienteNivelMeta: metaCon,
        progresoActual: totalGrupos
      },
      liderazgo: {
        id: 'liderazgo',
        nombre: 'Liderazgo',
        tipo: 'blanda',
        nivel: nivelLid,
        estrellas: totalLiderazgo * 3,
        origen: 'verificada',
        hechos: totalLiderazgo > 0 ? [`Propuso y administra ${totalLiderazgo} comunidad(es) estudiantil(es)`] : [],
        siguienteNivelMeta: metaLid,
        progresoActual: totalLiderazgo
      }
    };
  } catch (err) {
    console.error('[Habilidades] Error calculando habilidades:', err);
    return HABILIDADES_BASE_NUEVO_ALUMNO;
  }
}

/**
 * Elimina definitivamente la cuenta del usuario en Supabase (Google Play Store compliance)
 * Llama a la RPC eliminar_mi_cuenta o a la Edge Function eliminar-cuenta,
 * y luego cierra la sesión y limpia el almacenamiento local.
 */
export async function eliminarCuentaUsuario() {
  if (!isSupabaseConfigured) {
    localStorage.clear();
    return { success: true };
  }

  try {
    // 1. Intentar vía RPC atómica
    const { data: rpcData, error: rpcError } = await supabase.rpc('eliminar_mi_cuenta');

    if (rpcError) {
      console.warn('[EliminarCuenta] Falló RPC, intentando vía Edge Function:', rpcError.message);
      // 2. Fallback a Edge Function
      const { data: fnData, error: fnError } = await supabase.functions.invoke('eliminar-cuenta');
      if (fnError) {
        throw new Error(fnError.message || 'Error al eliminar cuenta en el servidor');
      }
    }

    // 3. Cerrar sesión y purgar almacenamiento local
    await supabase.auth.signOut().catch(() => {});
    localStorage.clear();
    sessionStorage.clear();

    return { success: true };
  } catch (err) {
    console.error('[EliminarCuenta] Error:', err);
    return { success: false, error: err.message || 'Error al procesar la eliminación' };
  }
}

