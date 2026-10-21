import { crearBase, como } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

const db = await crearBase();
console.log('migraciones + seed OK');
const A = await alumno(db, { ciclo: 2 });
const B = await alumno(db, { ciclo: 2 });
const D = await alumno(db, { ciclo: 7 });

console.log('-- atajos cerrados');
const enc = (await db.query(`insert into public.encuestas (autor_id,titulo,estado) values ($1,'X','enviada') returning id`, [B])).rows[0].id;
const env = (await db.query(`insert into public.envios_encuesta (encuesta_id,destinatario_id,estado) values ($1,$2,'pendiente') returning id`, [enc, A])).rows[0].id;
await como(db, A, `update public.envios_encuesta set estado='respondida' where id=$1`, [env]);
ok((await db.query(`select estado from public.envios_encuesta where id=$1`, [env])).rows[0].estado === 'pendiente', 'no se marca "respondida" sin responder (nivel no se regala)');
await falla(como(db, A, `insert into public.respuestas (envio_id, encuesta_id, pregunta_id, valor) values ($1,$2,null,'"x"')`, [env, enc]), /row-level security/, 'no inserta respuestas directo');
await falla(como(db, A, `insert into public.encuestas (autor_id,titulo,estado) values ($1,'Spam','enviada')`, [A]), /row-level security/, 'no crea encuestas sin la RPC (umbral y alcance)');
const g = (await como(db, A, `select public.crear_consulta('Curso X','Tema Y','Necesito ayuda con el tema Y') r`)).rows[0].r.grupo_id;
await falla(como(db, A, `insert into public.consultas (autor_id,carrera,ciclo_autor,curso,tema,texto) values ($1,'Psicología',2,'C','T','texto largo de prueba')`, [A]), /row-level security/, 'no crea consultas sin agrupar');
await falla(como(db, B, `insert into public.asesorias (grupo_consulta_id, asesor_id, modo, texto, estrellas_acreditadas) values ($1,$2,'mensaje','te ayudo con esto',99)`, [g, B]), /row-level security/, 'ciclo 2 no se salta la regla insertando asesorías ni se fija estrellas');
const as = (await como(db, D, `select public.responder_consulta($1,'Revisa los apuntes del tema Y y practica') id`, [g])).rows[0].id;
await falla(como(db, B, `insert into public.valoraciones_asesoria (asesoria_id, usuario_id, util) values ($1,$2,true)`, [as, B]), /row-level security/, 'quien no preguntó no valora insertando directo');
const hab = (await como(db, D, `select public.calcular_habilidades_usuario($1) h`, [D])).rows[0].h;
ok(hab.predisposicion_ayudar.nivel === 0, 'consulta de 1 sola persona: sin estrellas aunque se valore (anti-gaming 1)');

console.log('-- certificados');
const c = (await como(db, A, `insert into public.certificados (usuario_id, habilidad, emisor, horas, nivel, origen) values ($1,'Excel','Curso corto',2,'Avanzado','verificada') returning nivel, origen`, [A])).rows[0];
ok(c.nivel === 'Básico' && c.origen === 'declarada', 'nivel y origen los decide el servidor (2 h sin enlace → Básico, declarada)');
const c2 = (await como(db, A, `insert into public.certificados (usuario_id, habilidad, emisor, horas, tiene_evaluacion, url) values ($1,'Excel','Coursera',10,true,'https://coursera.org/verify/x') returning nivel, origen`, [A])).rows[0];
ok(c2.nivel === 'Intermedio' && c2.origen === 'con_evidencia', 'con evaluación → Intermedio; con enlace → con evidencia');
const c3 = (await como(db, A, `insert into public.certificados (usuario_id, habilidad, emisor, horas) values ($1,'Python','Google',61) returning nivel`, [A])).rows[0];
ok(c3.nivel === 'Avanzado', '> 60 h → Avanzado');
await falla(como(db, A, `insert into public.certificados (usuario_id, habilidad, emisor, url) values ($1,'Excel','Curso raro','javascript:alert(1)')`, [A]), /https/, 'enlace no http rechazado');

console.log('-- fotos');
await falla(como(db, A, `update public.perfiles set foto_url='data:image/jpeg;base64,AAAA' where id=$1`, [A]), /foto_url_no_base64/, 'no se guarda una foto en base64');
const bucket = (await db.query(`select file_size_limit, allowed_mime_types from storage.buckets where id='avatares'`)).rows[0];
ok(bucket.file_size_limit === '1048576' || bucket.file_size_limit === 1048576, 'bucket avatares limitado a 1 MB e imágenes');

console.log('-- funciones sin sesión');
await falla(como(db, null, `select public.umbral_visibilidad()`), /permission denied/, 'anon no ejecuta funciones de negocio');
await falla(como(db, null, `select public.calcular_alcance_encuesta('{}'::jsonb)`), /permission denied/, 'anon no calcula alcances');
