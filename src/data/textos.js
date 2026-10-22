// =============================================================================
// Textos de la relación entre dos alumnos que aceptaron una solicitud.
// Decisión de producto: se llama "Contacto" (neutral y semi-formal, como LinkedIn).
// Si el equipo elige otra palabra, se cambia solo aquí. Los mensajes de error del
// servidor están en supabase/migrations/013_login_y_contactos.sql.
// =============================================================================

export const CONTACTO = {
  singular: 'Contacto',
  plural: 'Contactos',
  agregar: 'Agregar contacto',
  solicitudEnviada: 'Solicitud enviada',
  responder: 'Responder',
  chatear: 'Chatear',
  marca: 'Contacto',
  misContactos: 'Mis contactos',
  yaSonContactos: 'Ya son contactos',
  aceptar: 'Aceptar',
  ignorar: 'Ignorar',
  aceptada: 'Ahora son contactos',
  sinContactos: 'Todavía no tienes contactos',
  sinContactosDetalle:
    'Cuando alguien acepte tu solicitud, o tú aceptes la suya, aparecerá aquí.',
  sinSolicitudesRecibidas: 'No tienes solicitudes pendientes.',
  motivoEtiqueta: '¿Por qué quieres agregar a esta persona?',
  motivoPlaceholder: 'Hola, me gustaría coordinar sobre un curso o un proyecto...',
  motivoAyuda: 'La otra persona verá tu motivo y decidirá si acepta. Al aceptar, podrán chatear.',
  enviarSolicitud: 'Enviar solicitud',
  enviadaA: (nombre) => `Solicitud enviada a ${nombre}`,
  enviadaDetalle: 'Podrán chatear cuando acepte tu solicitud.',
  avisoChat: 'Chat privado entre contactos de Kampuz',
  chatVacioTitulo: 'Ya son contactos',
  chatVacioDetalle: 'Escribe el primer mensaje para empezar la conversación.',
  saludo: 'Ahora son contactos. Saluda.'
};
