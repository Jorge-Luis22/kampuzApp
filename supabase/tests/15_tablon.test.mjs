import { crearBase, como } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

// Migración 015: tablón "Pasando hoy" (planes, ayudas, eventos y mercadito).
const db = await crearBase();
console.log('migraciones + seed OK');

const A = await alumno(db, { carrera: 'Psicología', ciclo: 3 });
const B = await alumno(db, { carrera: 'Derecho', ciclo: 5 });
const C = await alumno(db, { carrera: 'Enfermería', ciclo: 2 });
const D = await alumno(db, { carrera: 'Medicina', ciclo: 4 });
const E = await alumno(db, { carrera: 'Arquitectura', ciclo: 6 });

const publicar = (uid, datos) => {
  const cols = Object.keys(datos);
  const sql = `insert into public.publicaciones (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`;
  return como(db, uid, sql, Object.values(datos)).then((r) => r.rows[0]);
};
// Sin triggers (como el SQL Editor con replicación), para simular el paso del tiempo
const forzar = async (sql, params) => {
  await db.exec('set session_replication_role = replica');
  try {
    await db.query(sql, params);
  } finally {
    await db.exec('set session_replication_role = origin');
  }
};

console.log('-- crear y leer (RLS)');
const plan = await publicar(A, { tipo: 'plan', titulo: 'Fútbol a las 5 en la cancha', lugar: 'Cancha', cupo: 2, precio: 10, autor_id: B, sede: 'Otra', universidad: 'OTRA' });
ok(plan.autor_id === A && plan.universidad === 'UTP' && plan.sede === 'Lima Sur', 'el servidor fija autor, universidad y sede (ignora lo que manda el cliente)');
ok(plan.precio === null, 'el precio solo existe en el mercadito');
const finDia = (await db.query(`select (date_trunc('day', now() at time zone 'America/Lima') + interval '1 day') at time zone 'America/Lima' f`)).rows[0].f;
ok(new Date(plan.vence_en) <= new Date(finDia) && new Date(plan.vence_en) > new Date(), 'un plan vence el mismo día (3 h por defecto)');
ok((await como(db, B, `select count(*)::int n from public.publicaciones where id = $1`, [plan.id])).rows[0].n === 1, 'otro alumno de la universidad la ve');
await falla(como(db, null, `select * from public.publicaciones`), /permission denied/, 'sin sesión no se lee el tablón');
await db.query(`update public.perfiles set universidad = 'OTRA' where id = $1`, [E]);
ok((await como(db, E, `select count(*)::int n from public.publicaciones where id = $1`, [plan.id])).rows[0].n === 0, 'un alumno de otra universidad no la ve');
await como(db, A, `insert into public.bloqueos (bloqueador_id, bloqueado_id) values ($1, $2)`, [A, D]);
ok((await como(db, D, `select count(*)::int n from public.publicaciones where id = $1`, [plan.id])).rows[0].n === 0, 'un alumno bloqueado no la ve');

console.log('-- solo el autor edita o cierra');
await como(db, B, `update public.publicaciones set titulo = 'Cambiado por B' where id = $1`, [plan.id]);
ok((await db.query(`select titulo from public.publicaciones where id = $1`, [plan.id])).rows[0].titulo === 'Fútbol a las 5 en la cancha', 'otro alumno no puede editarla');
await falla(como(db, A, `delete from public.publicaciones where id = $1`, [plan.id]), /permission denied/, 'no se borran publicaciones (se cierran)');
const editado = (await como(db, A, `update public.publicaciones set titulo = 'Fútbol 5 a las 5', vence_en = now() + interval '30 days', tipo = 'evento' where id = $1 returning *`, [plan.id])).rows[0];
ok(editado.titulo === 'Fútbol 5 a las 5' && editado.tipo === 'plan' && editado.vence_en.getTime() === new Date(plan.vence_en).getTime(), 'el autor edita el texto, pero no el tipo ni el vencimiento');

console.log('-- respuestas y cupo');
await como(db, B, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'interesa')`, [plan.id, B]);
ok((await db.query(`select tipo from public.publicacion_respuestas where publicacion_id = $1 and usuario_id = $2`, [plan.id, B])).rows[0].tipo === 'voy', 'en un plan la respuesta siempre es "voy"');
await falla(como(db, B, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'voy')`, [plan.id, B]), /duplicate|unique/, 'una respuesta por alumno');
await falla(como(db, C, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'voy')`, [plan.id, B]), /row-level security/, 'nadie responde a nombre de otro');
await falla(como(db, A, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'voy')`, [plan.id, A]), /tu propia publicación/, 'el autor no responde su propia publicación');
await como(db, C, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'voy')`, [plan.id, C]);
const F = await alumno(db, { carrera: 'Contabilidad', ciclo: 1 });
await falla(como(db, F, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'voy')`, [plan.id, F]), /Ya no quedan cupos/, 'no se pasa del cupo (2 de 2)');
await como(db, F, `delete from public.publicacion_respuestas where publicacion_id = $1 and usuario_id = $2`, [plan.id, B]);
ok((await db.query(`select count(*)::int n from public.publicacion_respuestas where publicacion_id = $1`, [plan.id])).rows[0].n === 2, 'nadie borra la respuesta de otro');
await como(db, B, `delete from public.publicacion_respuestas where publicacion_id = $1 and usuario_id = $2`, [plan.id, B]);
await como(db, F, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'voy')`, [plan.id, F]);
ok(true, 'al quitar su "¡Voy!" se libera el cupo');

console.log('-- vencidas y cerradas');
const vieja = await publicar(A, { tipo: 'ayuda', titulo: '¿Alguien tiene un cargador tipo C?' });
await forzar(`update public.publicaciones set vence_en = now() - interval '1 minute' where id = $1`, [vieja.id]);
await falla(como(db, B, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'ayudo')`, [vieja.id, B]), /ya terminó/, 'no se responde una publicación vencida');
ok(!(await como(db, B, `select id from public.tablon()`)).rows.some((r) => r.id === vieja.id), 'las vencidas no salen en el tablón');
ok((await db.query(`select count(*)::int n from public.publicaciones where id = $1`, [vieja.id])).rows[0].n === 1, 'las vencidas no se borran');
const cerrar = await publicar(A, { tipo: 'evento', titulo: 'Charla de emprendimiento', empieza_en: new Date(Date.now() + 86400000).toISOString() });
await como(db, A, `update public.publicaciones set estado = 'cerrada' where id = $1`, [cerrar.id]);
await falla(como(db, B, `insert into public.publicacion_respuestas (publicacion_id, usuario_id, tipo) values ($1, $2, 'asistire')`, [cerrar.id, B]), /ya terminó/, 'no se responde una publicación cerrada');
await falla(como(db, A, `update public.publicaciones set estado = 'activa' where id = $1`, [cerrar.id]), /no se puede volver a abrir/, 'una cerrada no se reabre');

console.log('-- vencimiento por tipo');
await falla(publicar(B, { tipo: 'evento', titulo: 'Torneo de vóley' }), /fecha y hora del evento/, 'un evento necesita fecha');
const merc = await publicar(B, { tipo: 'mercadito', titulo: 'Vendo mandil talla M', precio: 25, cupo: 3 });
const dias = (new Date(merc.vence_en) - Date.now()) / 86400000;
ok(dias > 6.9 && dias <= 7.01 && merc.cupo === null && Number(merc.precio) === 25, 'el mercadito vence en 7 días, con precio y sin cupo');
const ayuda = await publicar(B, { tipo: 'ayuda', titulo: 'Perdí mi carné en el aula 302', vence_en: new Date(Date.now() + 3 * 86400000).toISOString() });
ok((new Date(ayuda.vence_en) - Date.now()) / 3600000 <= 24.01, 'una ayuda vence como máximo en 24 h');

console.log('-- antispam');
const G = await alumno(db);
for (let i = 1; i <= 3; i++) await publicar(G, { tipo: 'mercadito', titulo: `Vendo calculadora ${i}`, precio: 50 });
await falla(publicar(G, { tipo: 'mercadito', titulo: 'Vendo calculadora 4' }), /3 publicaciones en el mercadito/, 'máximo 3 en el mercadito');
await publicar(G, { tipo: 'plan', titulo: 'Almuerzo en la cafetería' });
await publicar(G, { tipo: 'plan', titulo: 'Estudio de Cálculo' });
await falla(publicar(G, { tipo: 'ayuda', titulo: 'Necesito un lapicero' }), /5 publicaciones activas/, 'máximo 5 publicaciones activas');

console.log('-- moderación anti-trampa (mercadito y ayuda)');
const H = await alumno(db);
const trampas = [
  ['mercadito', 'Resuelvo tu examen de Cálculo'],
  ['mercadito', 'Te paso las respuestas del parcial'],
  ['mercadito', 'Solucionario del examen final de Física'],
  ['ayuda', 'Hago tu trabajo de Estadística por S/ 20'],
  ['ayuda', 'Tareas resueltas de Química, escríbeme'],
  ['mercadito', 'RESUELVO EXÁMENES virtuales']
];
for (const [tipo, titulo] of trampas) {
  await falla(publicar(H, { tipo, titulo }), /no permite ofrecer ayuda para hacer trampa/, `rechaza: "${titulo}"`);
}
ok(!!(await publicar(H, { tipo: 'mercadito', titulo: 'Tutorías de Cálculo I', descripcion: 'Repasamos ejercicios juntos' })), 'permite tutorías');
ok(!!(await publicar(H, { tipo: 'mercadito', titulo: 'Vendo mis apuntes de Anatomía' })), 'permite vender apuntes propios');
const ok3 = await publicar(H, { tipo: 'ayuda', titulo: '¿Quién me explica integrales?' });
await falla(como(db, H, `update public.publicaciones set descripcion = 'o mejor hago tu tarea' where id = $1`, [ok3.id]), /trampa/, 'también se modera al editar');

console.log('-- lectura del tablón');
const vistaB = (await como(db, B, `select * from public.tablon()`)).rows;
const pB = vistaB.find((r) => r.id === plan.id);
ok(pB && pB.total_respuestas === 2 && pB.participantes.length === 2 && !pB.es_mia, 'B ve el plan con 2 participantes');
const mercVistaA = (await como(db, A, `select * from public.tablon('mercadito')`)).rows;
ok(mercVistaA.every((r) => r.tipo === 'mercadito'), 'filtra por tipo');
ok((await como(db, A, `select * from public.respuestas_publicacion($1)`, [plan.id])).rows.length === 2, 'el autor ve quiénes respondieron');
await falla(como(db, B, `select * from public.respuestas_publicacion($1)`, [plan.id]), /Solo el autor/, 'los demás no ven la lista completa');

console.log('-- "Yo te ayudo": chat sin solicitud, solo para esa publicación');
const conv = (await como(db, C, `select public.ofrecer_ayuda($1) c`, [ayuda.id])).rows[0].c;
const c1 = (await db.query(`select origen, publicacion_id from public.conversaciones where id = $1`, [conv])).rows[0];
ok(c1.origen === 'ayuda' && c1.publicacion_id === ayuda.id, 'se abre un chat de ayuda ligado a la publicación');
await como(db, C, `insert into public.mensajes_directos (conversacion_id, autor_id, texto) values ($1, $2, 'Lo vi en la biblioteca')`, [conv, C]);
const bandejaB = (await como(db, B, `select * from public.mis_conversaciones()`)).rows.find((r) => r.id === conv);
ok(bandejaB && bandejaB.origen === 'ayuda' && bandejaB.publicacion_titulo === ayuda.titulo && bandejaB.puede_escribir, 'B lo ve en Chats como chat de ayuda');
ok((await db.query(`select count(*)::int n from public.publicacion_respuestas where publicacion_id = $1 and usuario_id = $2 and tipo = 'ayudo'`, [ayuda.id, C])).rows[0].n === 1, 'queda registrado "Yo te ayudo"');
const sol = (await como(db, C, `select public.enviar_solicitud($1, 'Gracias, sigamos en contacto') id`, [B])).rows[0].id;
ok(!!sol, 'un chat de ayuda no impide agregarse como contactos');
await como(db, B, `select public.responder_solicitud($1, true)`, [sol]);
ok((await db.query(`select origen from public.conversaciones where id = $1`, [conv])).rows[0].origen === 'solicitud', 'al aceptarse pasan a ser contactos (mismo chat)');
// Un chat de ayuda se cierra 2 días después de que vence la publicación
const ayuda2 = await publicar(D, { tipo: 'ayuda', titulo: 'Necesito una calculadora para hoy' });
const conv2 = (await como(db, F, `select public.ofrecer_ayuda($1) c`, [ayuda2.id])).rows[0].c;
await forzar(`update public.publicaciones set vence_en = now() - interval '3 days' where id = $1`, [ayuda2.id]);
await falla(como(db, F, `insert into public.mensajes_directos (conversacion_id, autor_id, texto) values ($1, $2, 'hola?')`, [conv2, F]), /row-level security/, 'un chat de ayuda vencido ya no acepta mensajes');
await falla(como(db, B, `select public.ofrecer_ayuda($1)`, [plan.id]), /No encontramos/, '"Yo te ayudo" solo existe en publicaciones de ayuda');

console.log('-- "Me interesa": solicitud con el motivo ya escrito');
ok((await como(db, F, `select public.me_interesa($1, null) r`, [merc.id])).rows[0].r === 'solicitud_enviada', 'manda la solicitud al vendedor');
const motivo = (await db.query(`select motivo from public.solicitudes_mensaje where de_id = $1 and a_id = $2`, [F, B])).rows[0]?.motivo || '';
ok(motivo.includes('Vendo mandil talla M'), 'el motivo menciona la publicación');
ok((await como(db, F, `select public.me_interesa($1, null) r`, [merc.id])).rows[0].r === 'solicitud_pendiente', 'no duplica la solicitud');
ok((await como(db, C, `select public.me_interesa($1, null) r`, [merc.id])).rows[0].r === 'contacto', 'si ya son contactos, solo registra el interés');
const mercVistaF = (await como(db, F, `select * from public.tablon('mercadito')`)).rows.find((r) => r.id === merc.id);
ok(mercVistaF && mercVistaF.participantes.length === 0 && mercVistaF.mi_respuesta === 'interesa', 'en el mercadito no se muestra quién más se interesó');
ok((await como(db, C, `select count(*)::int n from public.publicacion_respuestas where publicacion_id = $1`, [merc.id])).rows[0].n === 1, 'cada uno solo ve su propio interés en el mercadito');

console.log('-- permisos y realtime');
const funcs = (await db.query(`
  select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth
  from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('tablon','ofrecer_ayuda','me_interesa','respuestas_publicacion','mi_universidad','puede_escribir_conversacion',
                      'preparar_publicacion','validar_respuesta_publicacion','texto_ofrece_trampa','proteger_universidad_perfil')`)).rows;
ok(funcs.length === 10 && funcs.every((f) => !f.anon), 'ninguna función del tablón es ejecutable sin sesión');
ok(funcs.filter((f) => ['preparar_publicacion', 'validar_respuesta_publicacion', 'proteger_universidad_perfil'].includes(f.proname)).every((f) => !f.auth), 'las de trigger tampoco para los alumnos');
await falla(como(db, null, `select * from public.tablon()`), /permission denied/, 'sin sesión no se llama al tablón');
const rt = (await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('publicaciones','publicacion_respuestas')`)).rows;
ok(rt.length === 2, 'publicaciones y respuestas tienen Realtime');
await como(db, B, `insert into public.reportes (autor_id, tipo, objeto_id, motivo) values ($1, 'publicacion', $2, 'Spam')`, [B, plan.id]);
ok(true, 'se puede reportar una publicación');
await como(db, A, `update public.perfiles set universidad = 'OTRA' where id = $1`, [A]);
ok((await db.query(`select universidad from public.perfiles where id = $1`, [A])).rows[0].universidad === 'UTP', 'el alumno no puede cambiarse de universidad');

console.log('-- recién llegados (Inicio)');
const yoRL = await alumno(db, { carrera: 'Psicología', ciclo: 1 });
const mismaCarrera = await alumno(db, { carrera: 'Psicología', ciclo: 2 });
const otraCarrera = await alumno(db, { carrera: 'Economía', ciclo: 1 });
const conSolicitud = await alumno(db, { carrera: 'Derecho', ciclo: 1 });
await como(db, yoRL, `select public.enviar_solicitud($1, 'Hola, soy nuevo también')`, [conSolicitud]);
const rl = (await como(db, yoRL, `select * from public.recien_llegados(10)`)).rows.map((r) => r.id);
ok(rl.includes(otraCarrera), 'muestra alumnos nuevos de otras carreras');
ok(!rl.includes(mismaCarrera), 'no muestra a los de mi carrera');
ok(!rl.includes(conSolicitud), 'no muestra a quien ya le envié una solicitud');
ok(!rl.includes(yoRL) && !rl.includes(E), 'ni a mí ni a alumnos de otra universidad');
await falla(como(db, null, `select * from public.recien_llegados(5)`), /permission denied/, 'sin sesión no se llama');
