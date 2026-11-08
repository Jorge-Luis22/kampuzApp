import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearBase, como } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

// Migración 018: encuestas con preguntas de opción única, varias opciones y abiertas
// (validación en el servidor) y habilidades de otros alumnos solo con permiso.
const db = await crearBase();
console.log('migraciones + seed OK');

const A = await alumno(db, { ciclo: 5 });
const R = [];
for (let i = 0; i < 7; i++) R.push(await alumno(db, { ciclo: 5 }));
await db.query(`update public.config set valor = '5' where clave = 'umbral_minimo_segmento'`);
const filtro = { carrera: 'Psicología', cicloMin: 1, cicloMax: 10 };

// A necesita responder una encuesta ajena para desbloquear su alcance semanal.
const encSemilla = (await db.query(`insert into public.encuestas (autor_id, titulo, estado) values ($1, 'Semilla', 'enviada') returning id`, [R[0]])).rows[0].id;
const prSemilla = (await db.query(`insert into public.preguntas (encuesta_id, orden, texto, tipo, opciones) values ($1, 1, '¿Ok?', 'unica', '["Sí","No"]') returning id`, [encSemilla])).rows[0].id;
const envSemilla = (await db.query(`insert into public.envios_encuesta (encuesta_id, destinatario_id, estado) values ($1, $2, 'pendiente') returning id`, [encSemilla, A])).rows[0].id;
await como(db, A, `select public.responder_encuesta($1, $2)`, [envSemilla, { [prSemilla]: 'Sí' }]);

// ------------------------------------------------------------------------------
console.log('-- crear encuesta: preguntas y opciones válidas');
const base = [{ orden: 1, texto: '¿Cómo estudias?', tipo: 'multiple', opciones: ['Solo', 'En grupo'] }];
const enviar = (preguntas, titulo = 'Hábitos de estudio') =>
  como(db, A, `select public.enviar_encuesta_segura($1, '', $2, $3) r`, [titulo, filtro, preguntas]);
const encuestasDeA = async () => (await db.query(`select count(*)::int n from public.encuestas where autor_id = $1`, [A])).rows[0].n;

await falla(enviar([{ ...base[0], opciones: ['Solo', ' Solo '] }]), /no pueden repetirse/, 'opciones repetidas se rechazan');
await falla(enviar([{ ...base[0], opciones: ['Solo', '   '] }]), /Cada opción necesita texto/, 'una opción vacía (solo espacios) se rechaza');
await falla(enviar([{ ...base[0], opciones: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }]), /hasta 6 opciones/, 'máximo 6 opciones');
await falla(enviar([{ ...base[0], opciones: ['Solo', 'x'.repeat(101)] }]), /hasta 100 caracteres/, 'cada opción hasta 100 caracteres');
await falla(enviar([{ ...base[0], opciones: ['Solo', 7] }]), /deben ser texto/, 'las opciones deben ser texto');
await falla(enviar([{ ...base[0], texto: 'x'.repeat(301) }]), /hasta 300 caracteres/, 'la pregunta admite hasta 300 caracteres');
await falla(enviar([{ ...base[0], opciones: ['Solo'] }]), /al menos 2 opciones/, 'una pregunta de opción necesita 2 opciones');
await falla(enviar([{ ...base[0], tipo: 'ranking' }]), /tipo válido/, 'tipo de pregunta desconocido');
ok((await encuestasDeA()) === 0, 'las encuestas rechazadas no dejan nada guardado');

const preguntas = [
  { orden: 1, texto: '¿Cómo estudias?', tipo: 'multiple', opciones: ['  Solo ', 'En grupo', 'Con videos'] },
  { orden: 2, texto: '¿Estudias de noche?', tipo: 'unica', opciones: ['Sí', 'No'] },
  { orden: 3, texto: '¿Algo que quieras contarnos?', tipo: 'abierta', opciones: ['basura', 'que no debe guardarse'] }
];
const creada = (await enviar(preguntas)).rows[0].r;
ok(creada.enviados + creada.encolados === 7, 'se envía a todo el segmento');
const guardadas = (await db.query(`select tipo, opciones from public.preguntas where encuesta_id = $1 order by orden`, [creada.encuesta_id])).rows;
ok(JSON.stringify(guardadas[0].opciones) === JSON.stringify(['Solo', 'En grupo', 'Con videos']), 'las opciones se guardan sin espacios sobrantes');
ok(guardadas.map((g) => g.tipo).join() === 'multiple,unica,abierta', 'se conservan los 3 tipos de pregunta');
ok(JSON.stringify(guardadas[2].opciones) === '[]', 'una pregunta abierta no guarda opciones');

// ------------------------------------------------------------------------------
console.log('-- responder: solo opciones reales y texto acotado');
const [q1, q2, q3] = (await db.query(`select id from public.preguntas where encuesta_id = $1 order by orden`, [creada.encuesta_id])).rows.map((r) => r.id);
const envioDe = async (uid) => (await db.query(`select id from public.envios_encuesta where encuesta_id = $1 and destinatario_id = $2`, [creada.encuesta_id, uid])).rows[0].id;
const responder = (uid, envio, r) => como(db, uid, `select public.responder_encuesta($1, $2)`, [envio, r]);
const valido = { [q1]: ['Solo', 'En grupo'], [q2]: 'Sí', [q3]: 'Repaso con mis compañeros' };

const envio2 = await envioDe(R[2]);
await falla(responder(R[2], envio2, { ...valido, [q2]: 'Tal vez' }), /Respuesta no válida/, 'única: una opción inventada se rechaza');
await falla(responder(R[2], envio2, { ...valido, [q2]: ['Sí'] }), /Respuesta no válida/, 'única: una lista no se acepta');
await falla(responder(R[2], envio2, { ...valido, [q1]: ['Solo', 'Inventada'] }), /Respuesta no válida/, 'varias: una opción inventada se rechaza');
await falla(responder(R[2], envio2, { ...valido, [q1]: ['Solo', 'Solo'] }), /Respuesta no válida/, 'varias: no se repite una opción');
await falla(responder(R[2], envio2, { ...valido, [q1]: 'Inventada' }), /Respuesta no válida/, 'varias: un texto suelto que no es opción se rechaza');
await falla(responder(R[2], envio2, { ...valido, [q1]: [1, 2] }), /Respuesta no válida/, 'varias: solo texto');
await falla(responder(R[2], envio2, { ...valido, [q3]: ['a'] }), /Respuesta no válida/, 'abierta: debe ser texto');
await falla(responder(R[2], envio2, { ...valido, [q3]: 'x'.repeat(501) }), /hasta 500 caracteres/, 'abierta: máximo 500 caracteres');
await falla(responder(R[2], envio2, { ...valido, [q3]: '    ' }), /todas las preguntas/, 'abierta: no se acepta solo espacios');
await falla(responder(R[2], envio2, { [q1]: ['Solo'], [q2]: 'Sí' }), /todas las preguntas/, 'faltar una pregunta se rechaza');
await falla(responder(R[2], envio2, []), /todas las preguntas/, 'las respuestas deben ser un objeto');
const tras = (await db.query(`select estado from public.envios_encuesta where id = $1`, [envio2])).rows[0].estado;
const guardadasR2 = (await db.query(`select count(*)::int n from public.respuestas where envio_id = $1`, [envio2])).rows[0].n;
ok(tras === 'pendiente' && guardadasR2 === 0, 'tras un rechazo no queda nada a medias y se puede reintentar');

await responder(R[0], await envioDe(R[0]), { [q1]: ['Solo', 'En grupo'], [q2]: 'Sí', [q3]: '   Repaso con mis compañeros   ' });
await responder(R[1], await envioDe(R[1]), { [q1]: 'Solo', [q2]: 'No', [q3]: 'Nada por ahora' });
await responder(R[2], envio2, { [q1]: ['Con videos'], [q2]: 'No', [q3]: 'x'.repeat(500) });
const out = (await como(db, A, `select public.obtener_resultados_encuesta($1) r`, [creada.encuesta_id])).rows[0].r;
const [r1, r2, r3] = out.preguntas;
ok(out.total_respuestas === 3, 'resultados: 3 respuestas');
ok(r1.conteo.Solo === 2 && r1.conteo['En grupo'] === 1 && r1.conteo['Con videos'] === 1, 'varias opciones: cada opción se cuenta aparte');
ok(r2.conteo.Sí === 1 && r2.conteo.No === 2, 'opción única: conteo por opción');
ok(r3.conteo === null && r3.textos.length === 3 && r3.textos.includes('Repaso con mis compañeros') && r3.textos.some((t) => t.length === 500), 'abierta: textos sin espacios sobrantes y de hasta 500 caracteres');
ok(JSON.stringify(Object.keys(r1.conteo).sort()) === JSON.stringify(['Con videos', 'En grupo', 'Solo']), 'los resultados no muestran opciones que el autor no escribió');

// ------------------------------------------------------------------------------
console.log('-- habilidades de otros alumnos');
const hab = async (quien, de) => (await como(db, quien, `select public.calcular_habilidades_usuario($1) h`, [de])).rows[0].h;

const propia = await hab(R[0], R[0]);
ok(propia.apoyo_investigacion.nivel === 1 && propia.apoyo_investigacion.alcance_semanal === 30 && propia.apoyo_investigacion.progreso === 1, 'la propia persona ve todo el detalle');
ok(Object.keys(propia).includes('constancia') && propia.constancia.nivel === 0, 'y también las habilidades en nivel 0');

const ajena = await hab(A, R[0]);
ok(JSON.stringify(Object.keys(ajena)) === JSON.stringify(['apoyo_investigacion']), 'otro alumno solo ve las habilidades que ya alcanzó');
ok(JSON.stringify(Object.keys(ajena.apoyo_investigacion).sort()) === JSON.stringify(['estrellas', 'nivel', 'nombre', 'taller']), 'sin alcance semanal, progreso ni metas');
ok(ajena.apoyo_investigacion.nivel === 1 && ajena.apoyo_investigacion.nombre === 'Apoyo a la investigación' && ajena.apoyo_investigacion.taller === false, 'con nombre, nivel y estrellas');
ok(JSON.stringify(await hab(A, R[6])) === '{}', 'quien no alcanzó ninguna se ve vacío (sin niveles en 0)');

const noEncontrado = /No encontramos a ese alumno/;
await falla(hab(A, '00000000-0000-0000-0000-000000000000'), noEncontrado, 'un UUID que no existe');
await falla(como(db, A, `select public.calcular_habilidades_usuario(null)`), noEncontrado, 'sin UUID');
await falla(como(db, null, `select public.calcular_habilidades_usuario($1)`, [R[0]]), /permission denied/, 'sin sesión no se pueden leer');
await falla(como(db, A, `select public.calcular_habilidades_base($1)`, [R[0]]), /permission denied/, 'la función interna no se puede llamar directo');

await db.query(`update public.perfiles set universidad = 'OTRA' where id = $1`, [R[5]]);
await falla(hab(A, R[5]), noEncontrado, 'un alumno de otra universidad no se puede consultar');
await falla(hab(R[5], A), noEncontrado, 'ni desde la otra universidad hacia la tuya');

await db.query(`insert into public.bloqueos (bloqueador_id, bloqueado_id) values ($1, $2)`, [R[0], A]);
await falla(hab(A, R[0]), noEncontrado, 'quien me bloqueó deja de ser consultable');
await falla(hab(R[0], A), noEncontrado, 'y yo tampoco puedo consultar a quien bloqueé');
ok((await hab(R[0], R[0])).apoyo_investigacion.nivel === 1, 'el bloqueo no afecta mi propio perfil');

// ------------------------------------------------------------------------------
console.log('-- la migración se puede repetir (full_schema.sql promete ser idempotente)');
const migraciones = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
const sql = (n) => fs.readFileSync(path.join(migraciones, fs.readdirSync(migraciones).find((f) => f.startsWith(n))), 'utf8');
const comprobarPuerta = async (cuando) => {
  const propia = await hab(R[0], R[0]);
  ok(propia.apoyo_investigacion.alcance_semanal === 30 && propia.constancia.nivel === 0, `${cuando}: la persona sigue viendo todo su detalle`);
  const ajena = await hab(R[3], R[0]);
  ok(JSON.stringify(Object.keys(ajena.apoyo_investigacion).sort()) === JSON.stringify(['estrellas', 'nivel', 'nombre', 'taller']), `${cuando}: otro alumno sigue viendo solo lo público`);
  await falla(como(db, R[3], `select public.calcular_habilidades_base($1)`, [R[0]]), /permission denied/, `${cuando}: la función interna sigue cerrada`);
};
await db.query(`delete from public.bloqueos`);
await db.exec(sql('018'));
await comprobarPuerta('018 repetida sola');
await db.exec(sql('017'));
await db.exec(sql('018'));
await comprobarPuerta('017 y 018 repetidas');

console.log(process.exitCode ? '\nHubo fallos.' : '\nTodo en orden.');
