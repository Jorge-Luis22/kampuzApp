import { crearBase, como } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

// Migración 016: arreglos del tablón y del chat.
const db = await crearBase();
console.log('migraciones + seed OK');

const A = await alumno(db, { carrera: 'Psicología', ciclo: 3 });
const B = await alumno(db, { carrera: 'Derecho', ciclo: 5 });
const C = await alumno(db, { carrera: 'Enfermería', ciclo: 2 });

const publicar = (uid, datos) => {
  const cols = Object.keys(datos);
  const sql = `insert into public.publicaciones (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`;
  return como(db, uid, sql, Object.values(datos)).then((r) => r.rows[0]);
};
const hacerContactos = async (x, y) => {
  const sol = (await como(db, x, `select public.enviar_solicitud($1, 'Hola, coordinemos') id`, [y])).rows[0].id;
  return (await como(db, y, `select public.responder_solicitud($1, true) c`, [sol])).rows[0].c;
};

console.log('-- "Me interesa" entre contactos');
const convAB = await hacerContactos(A, B);
const merc = await publicar(B, { tipo: 'mercadito', titulo: 'Vendo mandil talla M', precio: 25 });
ok((await como(db, A, `select public.me_interesa($1, null) r`, [merc.id])).rows[0].r === 'contacto', 'si son contactos responde "contacto"');
const msj = (await db.query(`select autor_id, texto from public.mensajes_directos where conversacion_id = $1 order by creado_en desc limit 1`, [convAB])).rows[0];
ok(msj?.autor_id === A && msj.texto === 'Hola, me interesa tu publicación «Vendo mandil talla M» del mercadito.', 'se envía el mensaje en su chat existente');
await como(db, A, `select public.me_interesa($1, null)`, [merc.id]);
ok((await db.query(`select count(*)::int n from public.mensajes_directos where conversacion_id = $1 and texto like 'Hola, me interesa%'`, [convAB])).rows[0].n === 1, 'tocar de nuevo no repite el mensaje');
ok((await db.query(`select count(*)::int n from public.solicitudes_mensaje where de_id = $1 and a_id = $2 and estado = 'pendiente'`, [A, B])).rows[0].n === 0, 'entre contactos no se crea una solicitud');

console.log('-- "Me interesa" sin ser contactos');
ok((await como(db, C, `select public.me_interesa($1, null) r`, [merc.id])).rows[0].r === 'solicitud_enviada', 'si no son contactos se envía una solicitud');
const motivo = (await db.query(`select motivo from public.solicitudes_mensaje where de_id = $1 and a_id = $2`, [C, B])).rows[0]?.motivo;
ok(motivo === 'Hola, me interesa tu publicación «Vendo mandil talla M» del mercadito.', 'la solicitud lleva el mismo motivo');
await falla(como(db, null, `select public.me_interesa($1, null)`, [merc.id]), /permission denied/, 'sin sesión no se llama');

console.log('-- "Quiénes respondieron" con su chat');
const D = await alumno(db, { carrera: 'Medicina', ciclo: 4 });
const ayuda = await publicar(A, { tipo: 'ayuda', titulo: 'Necesito un cargador tipo C' });
const convAyuda = (await como(db, D, `select public.ofrecer_ayuda($1) c`, [ayuda.id])).rows[0].c;
const filasAyuda = (await como(db, A, `select * from public.respuestas_publicacion($1)`, [ayuda.id])).rows;
ok(filasAyuda[0]?.conversacion_id === convAyuda && filasAyuda[0].conversacion_origen === 'ayuda' && filasAyuda[0].puede_escribir, 'quien ofreció ayuda trae su chat de ayuda');
const filasMerc = (await como(db, B, `select * from public.respuestas_publicacion($1)`, [merc.id])).rows;
const deA = filasMerc.find((f) => f.usuario_id === A);
const deC = filasMerc.find((f) => f.usuario_id === C);
ok(deA?.conversacion_id === convAB && deA.conversacion_origen === 'solicitud', 'un contacto trae su chat de contacto');
ok(deC && deC.conversacion_id === null && deC.solicitud_pendiente === 'recibida', 'sin chat: se indica la solicitud pendiente');
await falla(como(db, C, `select * from public.respuestas_publicacion($1)`, [merc.id]), /Solo el autor/, 'solo el autor ve la lista');

console.log('-- "Eliminar chat para mí"');
const E = await alumno(db, { carrera: 'Economía', ciclo: 2 });
const F = await alumno(db, { carrera: 'Contabilidad', ciclo: 3 });
const convEF = await hacerContactos(E, F);
const enviar = (uid, conv, texto) => como(db, uid, `insert into public.mensajes_directos (conversacion_id, autor_id, texto) values ($1, $2, $3) returning id`, [conv, uid, texto]).then((r) => r.rows[0].id);
await enviar(E, convEF, 'Mensaje viejo 1');
await enviar(F, convEF, 'Mensaje viejo 2');
await como(db, E, `select public.ocultar_conversacion($1)`, [convEF]);
ok(!(await como(db, E, `select id from public.mis_conversaciones()`)).rows.some((r) => r.id === convEF), 'el chat sale de mi lista');
ok((await como(db, E, `select count(*)::int n from public.mensajes_directos where conversacion_id = $1`, [convEF])).rows[0].n === 0, 'ya no veo los mensajes anteriores');
ok((await como(db, F, `select count(*)::int n from public.mensajes_directos where conversacion_id = $1`, [convEF])).rows[0].n === 2, 'la otra persona no ve cambios');
ok((await como(db, F, `select id from public.mis_conversaciones()`)).rows.some((r) => r.id === convEF), 'la otra persona sigue teniendo el chat');
ok((await db.query(`select count(*)::int n from public.mensajes_directos where conversacion_id = $1`, [convEF])).rows[0].n === 2, 'no se borra nada de la base');
await new Promise((r) => setTimeout(r, 20));
await enviar(F, convEF, 'Mensaje nuevo');
const bandejaE = (await como(db, E, `select * from public.mis_conversaciones()`)).rows.find((r) => r.id === convEF);
ok(bandejaE && bandejaE.ultimo_texto === 'Mensaje nuevo' && bandejaE.no_leidos === 1, 'si llega un mensaje nuevo, el chat reaparece');
const vistosE = (await como(db, E, `select texto from public.mensajes_directos where conversacion_id = $1`, [convEF])).rows.map((r) => r.texto);
ok(vistosE.length === 1 && vistosE[0] === 'Mensaje nuevo', 'y muestra solo lo posterior');
await falla(como(db, A, `select public.ocultar_conversacion($1)`, [convEF]), /No encontramos este chat/, 'nadie oculta un chat ajeno');
await falla(como(db, E, `insert into public.conversaciones_ocultas (conversacion_id, usuario_id, oculta_hasta) values ($1, $2, now() + interval '1 year')`, [convEF, E]), /permission denied/, 'solo por la función del servidor');

console.log('-- "Eliminar para todos"');
const mio = await enviar(E, convEF, 'Me equivoqué de chat');
await falla(como(db, F, `select public.eliminar_mensaje_para_todos($1)`, [mio]), /tus propios mensajes/, 'solo el autor puede eliminarlo');
await como(db, E, `select public.eliminar_mensaje_para_todos($1)`, [mio]);
const visto = (await como(db, F, `select texto, eliminado_en from public.mensajes_directos where id = $1`, [mio])).rows[0];
ok(visto && visto.texto === '' && visto.eliminado_en, 'ambos lo ven eliminado y la app no recibe el texto');
ok((await como(db, F, `select ultimo_texto from public.mis_conversaciones() where id = $1`, [convEF])).rows[0]?.ultimo_texto === 'Este mensaje fue eliminado', 'la bandeja muestra "Este mensaje fue eliminado"');
ok((await db.query(`select texto from public.mensajes_directos_eliminados where mensaje_id = $1`, [mio])).rows[0]?.texto === 'Me equivoqué de chat', 'el texto original queda guardado');
ok((await como(db, E, `select count(*)::int n from public.mensajes_directos_eliminados`)).rows[0].n === 0, 'ni el autor puede leer el texto guardado');
await db.query(`update public.perfiles set rol = 'moderador' where id = $1`, [F]);
ok((await como(db, F, `select count(*)::int n from public.mensajes_directos_eliminados`)).rows[0].n === 1, 'moderación sí puede leerlo (para revisar reportes)');
await db.query(`update public.perfiles set rol = 'alumno' where id = $1`, [F]);
const viejo = await enviar(E, convEF, 'Mensaje de ayer');
await db.query(`update public.mensajes_directos set creado_en = now() - interval '25 hours' where id = $1`, [viejo]);
await falla(como(db, E, `select public.eliminar_mensaje_para_todos($1)`, [viejo]), /últimas 24 horas/, 'pasadas 24 h ya no se puede');
await falla(como(db, E, `insert into public.mensajes_directos (conversacion_id, autor_id, texto, creado_en) values ($1, $2, 'antedatado', now() - interval '1 day')`, [convEF, E]), /permission denied/, 'la app no puede elegir la fecha de un mensaje');
await falla(como(db, E, `insert into public.mensajes_directos (conversacion_id, autor_id, texto, eliminado_en) values ($1, $2, 'trampa', now())`, [convEF, E]), /permission denied/, 'ni crearlo ya eliminado');
await falla(como(db, E, `update public.mensajes_directos set eliminado_en = now() where id = $1`, [viejo]), /permission denied/, 'ni marcarlo eliminado sin la función');
await falla(como(db, null, `select public.eliminar_mensaje_para_todos($1)`, [viejo]), /permission denied/, 'sin sesión no se llama');
