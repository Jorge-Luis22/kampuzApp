import { supabase, ejecutar, rpc, uidActual, KampuzError } from './supabase.js';
import { perfilDesdeFila } from './auth.js';

// =============================================================================
// Perfil propio (M29–M32): edición, foto, habilidades derivadas, certificados,
// consentimientos y eliminación de cuenta. Solo Supabase.
// =============================================================================

/**
 * Comprime y recorta una imagen cuadrada en el navegador (< 300 KB).
 */
export async function procesarImagenCuadrada(file, maxDimension = 600, maxSizeBytes = 300 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        const targetDim = Math.min(minDim, maxDimension);

        const canvas = document.createElement('canvas');
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetDim, targetDim);

        let quality = 0.85;
        const intentarComprimir = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('No se pudo procesar la imagen.'));
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
 * Sube la foto al bucket "avatares" (carpeta propia) y devuelve su URL pública.
 * Si falla, lanza el error para que la interfaz ofrezca reintentar.
 * Nunca guarda la imagen en base64 en la base de datos.
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
 * Borra de Storage mis fotos anteriores, dejando solo la actual.
 */
async function limpiarAvataresAnteriores(urlActual) {
  const uid = await uidActual();
  const archivos = (await ejecutar(supabase.storage.from('avatares').list(uid, { limit: 100 }))) || [];
  const sobrantes = archivos
    .map((f) => `${uid}/${f.name}`)
    .filter((ruta) => !urlActual || !urlActual.endsWith(ruta));
  if (sobrantes.length) {
    await ejecutar(supabase.storage.from('avatares').remove(sobrantes));
  }
}

const CAMPOS_EDITABLES = {
  nombre: 'nombre',
  apellido: 'apellido',
  bio: 'bio',
  sede: 'sede',
  carrera: 'carrera',
  ciclo: 'ciclo',
  intereses: 'intereses',
  fotoUrl: 'foto_url',
  enlaces: 'enlaces',
  estadoEnVivo: 'estado_en_vivo'
};

/**
 * Actualiza campos del perfil propio y devuelve el perfil guardado en el servidor.
 */
export async function actualizarPerfil(cambios) {
  const uid = await uidActual();
  const payload = {};
  for (const [clave, columna] of Object.entries(CAMPOS_EDITABLES)) {
    if (cambios[clave] === undefined) continue;
    let valor = cambios[clave];
    if (typeof valor === 'string' && clave !== 'estadoEnVivo') valor = valor.trim();
    if (clave === 'ciclo') valor = Number(valor);
    payload[columna] = valor;
  }
  const fila = await ejecutar(
    supabase.from('perfiles').update(payload).eq('id', uid).select('*').single()
  );
  return perfilDesdeFila(fila);
}

/**
 * Sube la nueva foto, la guarda en el perfil y borra las anteriores.
 */
export async function cambiarFotoPerfil(file) {
  const url = await subirAvatar(file);
  const perfil = await actualizarPerfil({ fotoUrl: url });
  limpiarAvataresAnteriores(url).catch((err) => console.warn('[Kampuz] No se limpiaron fotos anteriores:', err.message));
  return perfil;
}

// -----------------------------------------------------------------------------
// Habilidades derivadas de los hechos (spec 5.3). Las calcula el servidor.
// -----------------------------------------------------------------------------
const NOMBRES_HABILIDAD = {
  apoyo_investigacion: 'Apoyo a la investigación',
  predisposicion_ayudar: 'Predisposición a ayudar',
  constancia: 'Constancia',
  liderazgo: 'Liderazgo'
};

const hechoDe = (id, n, estrellas) => {
  if (!n) return [];
  switch (id) {
    case 'apoyo_investigacion':
      return [`Respondió ${n} encuesta${n === 1 ? '' : 's'} de otros alumnos`];
    case 'predisposicion_ayudar':
      return [`Resolvió ${n} consulta${n === 1 ? '' : 's'} agrupada${n === 1 ? '' : 's'} de ciclos menores · ${estrellas} estrellas`];
    case 'constancia':
      return [`Participa activamente en ${n} grupo${n === 1 ? '' : 's'} o taller${n === 1 ? '' : 'es'}`];
    case 'liderazgo':
      return [`Creó ${n} grupo${n === 1 ? '' : 's'} de interés que ${n === 1 ? 'alcanzó' : 'alcanzaron'} el umbral de apoyos`];
    default:
      return [];
  }
};

export async function calcularHabilidadesReales(userId) {
  const datos = await rpc('calcular_habilidades_usuario', { p_usuario_id: userId });
  const resultado = {};
  for (const [id, h] of Object.entries(datos || {})) {
    const metas = h.metas || [1, 2, 3];
    resultado[id] = {
      id,
      nombre: NOMBRES_HABILIDAD[id] || id,
      tipo: 'blanda',
      nivel: h.nivel,
      estrellas: h.estrellas,
      origen: 'verificada',
      hechos: hechoDe(id, h.progreso, h.estrellas),
      progresoActual: h.progreso,
      siguienteNivelMeta: metas[Math.min(h.nivel, metas.length - 1)],
      alcanceSemanal: h.alcance_semanal
    };
  }
  return resultado;
}

// -----------------------------------------------------------------------------
// Certificados (M31, spec 5.5). Solo cuenta el más alto por habilidad.
// -----------------------------------------------------------------------------
export function clasificarCertificado(horas, tieneEvaluacion) {
  const h = Number(horas) || 0;
  if (h > 60) return 'Avanzado';
  if (h >= 20 || tieneEvaluacion) return 'Intermedio';
  return 'Básico';
}

function certificadoDesdeFila(c) {
  return {
    id: c.id,
    habilidad: c.habilidad,
    emisor: c.emisor,
    horas: c.horas,
    nivel: c.nivel,
    tieneEvaluacion: c.tiene_evaluacion,
    url: c.url || '',
    origen: c.origen,
    propuestoPorAgente: c.propuesto_por_agente,
    fecha: c.creado_en ? new Date(c.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  };
}

export async function fetchCertificados(userId) {
  const filas = (await ejecutar(
    supabase.from('certificados').select('*').eq('usuario_id', userId).order('creado_en', { ascending: false })
  )) || [];
  return filas.map(certificadoDesdeFila);
}

export async function agregarCertificado({ habilidad, emisor, horas, url, tieneEvaluacion }) {
  const uid = await uidActual();
  const fila = await ejecutar(
    supabase
      .from('certificados')
      .insert({
        usuario_id: uid,
        habilidad: habilidad.trim(),
        emisor: emisor.trim(),
        horas: Number(horas) || 0,
        tiene_evaluacion: Boolean(tieneEvaluacion),
        nivel: clasificarCertificado(horas, tieneEvaluacion), // el servidor lo recalcula
        url: url?.trim() || null,
        origen: 'con_evidencia',
        propuesto_por_agente: false
      })
      .select('*')
      .single()
  );
  return certificadoDesdeFila(fila);
}

// -----------------------------------------------------------------------------
// Consentimientos (spec 6.8): cuatro finalidades separadas, con versión y fechas.
// -----------------------------------------------------------------------------
export const VERSION_POLITICA = '1.1';
export const FINALIDADES = ['cuenta', 'encuestas', 'metricas', 'perfil_universidad'];

export async function fetchConsentimientos() {
  const uid = await uidActual();
  const filas = (await ejecutar(
    supabase
      .from('consentimientos')
      .select('finalidad, otorgado, version_politica, otorgado_en, revocado_en')
      .eq('usuario_id', uid)
  )) || [];
  const porFinalidad = Object.fromEntries(filas.map((f) => [f.finalidad, f]));
  return {
    completos: FINALIDADES.every((f) => porFinalidad[f]),
    valores: Object.fromEntries(FINALIDADES.map((f) => [f, Boolean(porFinalidad[f]?.otorgado)])),
    detalle: porFinalidad
  };
}

/**
 * Guarda las cuatro decisiones del onboarding (M05). La 1 es obligatoria.
 */
export async function guardarConsentimientosIniciales(valores) {
  const uid = await uidActual();
  const ahora = new Date().toISOString();
  const filas = FINALIDADES.map((finalidad) => {
    const otorgado = finalidad === 'cuenta' ? true : Boolean(valores[finalidad]);
    return {
      usuario_id: uid,
      finalidad,
      otorgado,
      version_politica: VERSION_POLITICA,
      otorgado_en: otorgado ? ahora : null,
      revocado_en: null
    };
  });
  await ejecutar(supabase.from('consentimientos').upsert(filas, { onConflict: 'usuario_id,finalidad' }));
  return fetchConsentimientos();
}

/**
 * Otorga o revoca una finalidad desde Privacidad (M32). La de "cuenta" no se revoca:
 * para eso está "Eliminar mi cuenta".
 */
export async function actualizarConsentimiento(finalidad, otorgado) {
  if (finalidad === 'cuenta') {
    throw new KampuzError('Este consentimiento es necesario para tener una cuenta. Si no lo quieres, elimina tu cuenta.');
  }
  const uid = await uidActual();
  const ahora = new Date().toISOString();
  await ejecutar(
    supabase.from('consentimientos').upsert(
      {
        usuario_id: uid,
        finalidad,
        otorgado,
        version_politica: VERSION_POLITICA,
        ...(otorgado ? { otorgado_en: ahora, revocado_en: null } : { revocado_en: ahora })
      },
      { onConflict: 'usuario_id,finalidad' }
    )
  );
  return fetchConsentimientos();
}

// -----------------------------------------------------------------------------
// Eliminar cuenta (Play Store): borra fotos, datos y el usuario de auth.
// -----------------------------------------------------------------------------
export async function eliminarCuentaUsuario() {
  const uid = await uidActual();

  const archivos = (await ejecutar(supabase.storage.from('avatares').list(uid, { limit: 100 }))) || [];
  if (archivos.length) {
    await ejecutar(supabase.storage.from('avatares').remove(archivos.map((f) => `${uid}/${f.name}`)));
  }

  const res = await rpc('eliminar_mi_cuenta');
  if (!res?.success) {
    throw new KampuzError('No se pudo eliminar la cuenta. Inténtalo de nuevo o escríbenos.');
  }

  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {
    // sin almacenamiento local
  }
}
