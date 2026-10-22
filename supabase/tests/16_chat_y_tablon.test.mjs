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
