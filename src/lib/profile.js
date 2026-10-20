import { supabase, isSupabaseConfigured } from './supabase';
import { HABILIDADES_BASE_NUEVO_ALUMNO } from '../data/mockData';

/**
 * Comprime y recorta una imagen cuadrada en el navegador a menos de 300 KB
 * @param {File} file 
 * @param {number} maxDimension
 * @param {number} maxSizeBytes (300 KB por defecto)
 * @returns {Promise<Blob>}
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
 * Sube la foto de perfil al bucket 'avatares' en la carpeta propia del usuario
 * Cumple con RLS: (storage.foldername(name))[1] = auth.uid()
 */
export async function uploadAvatar(userId, file) {
  if (!isSupabaseConfigured || !userId) {
    throw new Error('Supabase no está configurado o no hay sesión activa.');
  }

  // 1. Comprimir y recortar
  const blob = await procesarImagenCuadrada(file, 600, 300 * 1024);
  const fileName = `avatar_${Date.now()}.jpg`;
  const filePath = `${userId}/${fileName}`;

  // 2. Subir a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatares')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (uploadError) {
    console.error('[UploadAvatar] Error subiendo imagen:', uploadError);
    throw new Error(uploadError.message || 'Error al subir la imagen al bucket.');
  }

  // 3. Obtener URL pública
  const { data } = supabase.storage.from('avatares').getPublicUrl(filePath);
  const publicUrl = data?.publicUrl;

  // 4. Actualizar en public.perfiles
  const { error: profileError } = await supabase
    .from('perfiles')
    .update({ foto_url: publicUrl, actualizado_en: new Date().toISOString() })
    .eq('id', userId);

  if (profileError) {
    console.warn('[UploadAvatar] Foto subida pero error al vincular en perfil:', profileError);
  }

  return publicUrl;
}

/**
 * Actualiza los datos del perfil del usuario (nombre, apellido, bio, sede, carrera, ciclo, intereses)
 */
export async function updateProfile(userId, updates) {
  if (!isSupabaseConfigured || !userId) {
    return { success: false, error: 'Sesión no válida.' };
  }

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

    const { data, error } = await supabase
      .from('perfiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, perfil: data };
  } catch (err) {
    return { success: false, error: err.message || 'Error al actualizar perfil.' };
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
