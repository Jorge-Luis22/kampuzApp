import { supabase, ejecutar, rpc, uidActual, KampuzError } from './supabase.js';
import { procesarImagenCuadrada } from './profile.js';
import { enviarReporte } from './safety.js';

// =============================================================================
// Tablón "Pasando hoy" (migración 015). Solo Supabase: vencimiento, cupo,
// antispam y moderación los decide el servidor.
// =============================================================================

const filaAPublicacion = (f) => ({
  id: f.id,
  tipo: f.tipo,
  titulo: f.titulo,
  descripcion: f.descripcion || '',
  lugar: f.lugar || '',
  empiezaEn: f.empieza_en,
  venceEn: f.vence_en,
  cupo: f.cupo,
  precio: f.precio === null || f.precio === undefined ? null : Number(f.precio),
  fotoUrl: f.foto_url || null,
  creadoEn: f.creado_en,
  autor: {
    id: f.autor_id,
    nombre: f.autor_nombre,
    apellido: f.autor_apellido,
    usuario: f.autor_usuario,
    foto_url: f.autor_foto_url,
    carrera: f.autor_carrera,
    ciclo: f.autor_ciclo
  },
  esMia: Boolean(f.es_mia),
  miRespuesta: f.mi_respuesta || null,
  totalRespuestas: f.total_respuestas || 0,
  participantes: Array.isArray(f.participantes) ? f.participantes : []
});

/**
 * Publicaciones activas y vigentes de mi sede. tipo: null | plan | ayuda | evento | mercadito
 */
export async function fetchTablon(tipo = null) {
  const filas = (await rpc('tablon', { p_tipo: tipo })) || [];
  return filas.map(filaAPublicacion);
}

/**
 * Crea una publicación. El servidor fija autor, sede, vencimiento final y valida todo.
 */
export async function crearPublicacion({ tipo, titulo, descripcion, lugar, empiezaEn, venceEn, cupo, precio, fotoUrl }) {
  const uid = await uidActual();
  return ejecutar(
    supabase
      .from('publicaciones')
      .insert({
        autor_id: uid,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        lugar: lugar?.trim() || null,
        empieza_en: empiezaEn || null,
        vence_en: venceEn || null,
        cupo: cupo ? Number(cupo) : null,
        precio: precio === '' || precio === null || precio === undefined ? null : Number(precio),
        foto_url: fotoUrl || null
      })
      .select('id')
      .single()
  );
}

export async function cerrarPublicacion(id) {
  await ejecutar(supabase.from('publicaciones').update({ estado: 'cerrada' }).eq('id', id));
}

/**
 * "¡Voy!" o "Asistiré". El servidor pone el tipo que corresponde y valida el cupo.
 */
export async function sumarme(publicacionId) {
  const uid = await uidActual();
  await ejecutar(
    supabase.from('publicacion_respuestas').insert({ publicacion_id: publicacionId, usuario_id: uid, tipo: 'voy' })
  );
}

export async function quitarme(publicacionId) {
  const uid = await uidActual();
  await ejecutar(
    supabase.from('publicacion_respuestas').delete().eq('publicacion_id', publicacionId).eq('usuario_id', uid)
  );
}

/**
 * "Yo te ayudo": abre (o reabre) el chat con el autor. Devuelve el id de la conversación.
 */
export function ofrecerAyuda(publicacionId) {
  return rpc('ofrecer_ayuda', { p_publicacion_id: publicacionId });
}

/**
 * "Me interesa": 'contacto' | 'solicitud_enviada' | 'solicitud_pendiente' | 'registrado'
 */
export function meInteresa(publicacionId, motivo) {
  return rpc('me_interesa', { p_publicacion_id: publicacionId, p_motivo: motivo || null });
}

export async function fetchRespuestas(publicacionId) {
  return (await rpc('respuestas_publicacion', { p_publicacion_id: publicacionId })) || [];
}

export function reportarPublicacion(publicacionId, motivo) {
  return enviarReporte({ tipo: 'publicacion', objetoId: publicacionId, motivo });
}

/**
 * Foto opcional de un evento o del mercadito (bucket "publicaciones").
 */
export async function subirFotoPublicacion(file) {
  if (!file) throw new KampuzError('Elige una imagen.');
  const uid = await uidActual();
  let blob;
  try {
    blob = await procesarImagenCuadrada(file, 900, 350 * 1024);
  } catch (err) {
    throw new KampuzError('No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).');
  }
  const ruta = `${uid}/pub_${Date.now()}.jpg`;
  await ejecutar(
    supabase.storage.from('publicaciones').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false }),
    { ms: 30000 }
  ).catch((err) => {
    throw new KampuzError(`No se pudo subir la foto. ${err.message}`);
  });
  return supabase.storage.from('publicaciones').getPublicUrl(ruta).data.publicUrl;
}

/**
 * Avisos en vivo: publicaciones nuevas o cerradas y "¡Voy!" de otros.
 */
export function subscribeToTablon(onCambio) {
  const canal = supabase
    .channel(`tablon_${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'publicaciones' }, () => onCambio())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'publicacion_respuestas' }, () => onCambio())
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
