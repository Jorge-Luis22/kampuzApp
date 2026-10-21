import { crearBase, como } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

const db = await crearBase();
console.log('migraciones + seed OK');
const A = await alumno(db, { ciclo: 3 });
const B = await alumno(db, { ciclo: 7 });
const C = await alumno(db, { ciclo: 3 });

console.log('-- membresías');
await como(db, A, `update public.perfiles set ciclo = 4 where id = $1`, [A]);
const m = await db.query(`select e.tipo, e.ciclo from public.membresias m join public.espacios e on e.id=m.espacio_id where usuario_id=$1 order by 1`, [A]);
ok(m.rows.length === 2 && m.rows[1].ciclo === 4, 'cambiar de ciclo deja solo el grupo nuevo');

console.log('-- solicitudes y chat');
await falla(como(db, A, `insert into public.solicitudes_mensaje (de_id,a_id,motivo) values ($1,$2,'hola!')`, [A, B]), /row-level security|permission/, 'insert directo de solicitud bloqueado');
await falla(como(db, A, `insert into public.conversaciones (usuario_a_id,usuario_b_id) values ($1,$2)`, [A, B]), /row-level security|permission/, 'crear conversación sin solicitud bloqueado');
await falla(como(db, A, `select public.enviar_solicitud($1,'hi')`, [B]), /mínimo 5/, 'motivo corto rechazado');
const sol = (await como(db, A, `select public.enviar_solicitud($1,'Coordinar tesis') id`, [B])).rows[0].id;
ok(!!sol, 'A envía solicitud a B');
await falla(como(db, A, `select public.enviar_solicitud($1,'Otra vez hola')`, [B]), /Ya le enviaste/, 'no duplica solicitud');
await falla(como(db, B, `select public.enviar_solicitud($1,'Y yo a ti hola')`, [A]), /ya te envió/, 'no cruza solicitud inversa');
ok((await como(db, B, `select count(*)::int n from public.solicitudes_mensaje where a_id=$1`, [B])).rows[0].n === 1, 'B ve la solicitud recibida');
await falla(como(db, A, `select public.responder_solicitud($1,true)`, [sol]), /No encontramos/, 'el emisor no puede aceptarla');
const conv = (await como(db, B, `select public.responder_solicitud($1,true) c`, [sol])).rows[0].c;
ok(!!conv, 'B acepta y se crea la conversación');
ok((await como(db, B, `select public.responder_solicitud($1,true) c`, [sol])).rows[0].c === conv, 'aceptar dos veces es idempotente');
await como(db, A, `insert into public.mensajes_directos (conversacion_id, autor_id, texto) values ($1,$2,'Hola B')`, [conv, A]);
await falla(como(db, C, `insert into public.mensajes_directos (conversacion_id, autor_id, texto) values ($1,$2,'intruso')`, [conv, C]), /row-level security/, 'C no escribe en chat ajeno');
ok((await como(db, C, `select count(*)::int n from public.mensajes_directos`)).rows[0].n === 0, 'C no lee chat ajeno');
const bc = (await como(db, B, `select * from public.mis_conversaciones()`)).rows;
ok(bc.length === 1 && bc[0].no_leidos === 1 && bc[0].ultimo_texto === 'Hola B' && bc[0].otro_id === A, 'B ve chat con 1 no leído');
await como(db, B, `update public.mensajes_directos set leido = true where conversacion_id=$1 and autor_id<>$2`, [conv, B]);
ok((await como(db, B, `select no_leidos from public.mis_conversaciones()`)).rows[0].no_leidos === 0, 'marcar leído');
await falla(como(db, B, `update public.mensajes_directos set texto='editado' where conversacion_id=$1`, [conv]), /permission denied/, 'B no edita el texto de A');

console.log('-- bloqueos');
await como(db, B, `insert into public.bloqueos (bloqueador_id, bloqueado_id) values ($1,$2)`, [B, C]);
ok((await como(db, C, `select count(*)::int n from public.perfiles where id=$1`, [B])).rows[0].n === 0, 'C (bloqueado) ya no ve el perfil de B');
await falla(como(db, C, `select public.enviar_solicitud($1,'Hola de nuevo')`, [B]), /No puedes contactar/, 'C no puede enviar solicitud a quien lo bloqueó');

console.log('-- espacios');
const esp = (await como(db, A, `select * from public.listar_espacios()`)).rows;
ok(esp.filter(e => e.tipo === 'carrera_ciclo').length === 1 && esp.some(e => e.tipo === 'taller'), 'A ve su grupo de ciclo y talleres');
const otroCiclo = (await db.query(`insert into public.espacios (tipo,nombre,carrera,ciclo,sede,estado) values ('carrera_ciclo','Derecho - Ciclo 1','Derecho',1,'Lima Sur','visible') returning id`)).rows[0].id;
await falla(como(db, A, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [A, otroCiclo]), /row-level security/, 'no puede unirse a grupo de ciclo ajeno');
const taller = esp.find(e => e.tipo === 'taller').id;
await como(db, A, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [A, taller]);
ok(true, 'A se une a un taller');
await falla(como(db, A, `insert into public.espacios (tipo,nombre,sede,estado,creador_id) values ('interes','X','Lima Sur','visible',$1)`, [A]), /row-level security/, 'no crea espacios visibles directo');
const prop = (await como(db, A, `select public.proponer_grupo('Club de Ajedrez','Partidas los viernes') id`)).rows[0].id;
const p1 = (await como(db, B, `select * from public.listar_espacios() where id=$1`, [prop])).rows[0];
ok(p1 && p1.estado === 'oculto' && p1.apoyos === 1 && p1.umbral === 15, 'propuesta oculta, 1 apoyo, umbral 15 visible para B');
ok((await como(db, B, `select public.apoyar_propuesta($1) e`, [prop])).rows[0].e === 'oculto', 'B apoya');
await falla(como(db, B, `select public.apoyar_propuesta($1)`, [prop]), /Ya apoyaste/, 'apoyo único');
await falla(como(db, B, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [B, prop]), /row-level security/, 'no se une a propuesta oculta');
const ciclo = esp.find(e => e.tipo === 'carrera_ciclo').id;
await como(db, A, `insert into public.mensajes (espacio_id, autor_id, texto) values ($1,$2,'Hola salón')`, [ciclo, A]);
await falla(como(db, B, `insert into public.mensajes (espacio_id, autor_id, texto) values ($1,$2,'colado')`, [ciclo, B]), /row-level security/, 'B no escribe en el ciclo de A');

console.log('-- consultas');
const C2 = await alumno(db, { ciclo: 2 });
const r1 = (await como(db, A, `select public.crear_consulta('Psicopatología I','Examen parcial','¿Qué temas entran en el parcial?') r`)).rows[0].r;
ok(r1.agrupada === false, 'A crea consulta');
await falla(como(db, C2, `select public.crear_consulta('Psicopatología I','Examen parcial','El profesor es malo, ¿lo evito?')`), /Se habla del curso/, 'moderación en servidor');
await falla(como(db, C2, `select public.crear_consulta('Psicopatología I','Examen parcial','Pregunta sobre el profesor Ramírez y sus clases')`), /por su nombre/, 'moderación nombre propio');
const r2 = (await como(db, C2, `select public.crear_consulta('psicopatología i','examen parcial','¿Cómo me preparo para el parcial?') r`)).rows[0].r;
ok(r2.agrupada === true && r2.grupo_id === r1.grupo_id, 'C2 se agrupa (mayúsculas distintas)');
const r3 = (await como(db, A, `select public.crear_consulta('Psicopatología I','Examen parcial','Otra duda más sobre el parcial') r`)).rows[0].r;
ok(r3.ya_estabas === true, 'preguntar dos veces no suma');
ok((await db.query(`select n_alumnos from public.grupos_consulta where id=$1`, [r1.grupo_id])).rows[0].n_alumnos === 2, 'nAlumnos = 2 autores distintos');
await falla(como(db, C, `select public.responder_consulta($1,'Te explico los temas del parcial')`, [r1.grupo_id]), /ciclo 5/, 'ciclo 3 no orienta');
const D = await alumno(db, { ciclo: 6 });
const E = await alumno(db, { ciclo: 8, carrera: 'Derecho' });
await falla(como(db, E, `select public.responder_consulta($1,'Te explico los temas del parcial')`, [r1.grupo_id]), /tu carrera/, 'otra carrera no orienta');
const as = (await como(db, D, `select public.responder_consulta($1,'Repasa los capítulos 3 a 5 y los casos.') id`, [r1.grupo_id])).rows[0].id;
ok((await db.query(`select estrellas_pendientes from public.asesorias where id=$1`, [as])).rows[0].estrellas_pendientes === 2, 'estrellas pendientes = 1 x 2');
await falla(como(db, B, `select public.valorar_asesoria($1,true)`, [as]), /Solo quienes hicieron/, 'no autor no valora');
const v = (await como(db, C2, `select public.valorar_asesoria($1,true) r`, [as])).rows[0].r;
ok(v.estrellas_acreditadas === 2, 'C2 valora: se acreditan 2 estrellas');
await falla(como(db, C2, `select public.valorar_asesoria($1,true)`, [as]), /Ya valoraste/, 'no valora dos veces');
const lista = (await como(db, A, `select public.listar_consultas_carrera() l`)).rows[0].l;
ok(lista.length === 1 && lista[0].respuestas.length === 1 && lista[0].textos.length === 2 && lista[0].soy_autor, 'listar consultas de mi carrera');
ok((await como(db, E, `select public.listar_consultas_carrera() l`)).rows[0].l.length === 0, 'otra carrera no ve las consultas');
const hab = (await como(db, D, `select public.calcular_habilidades_usuario($1) h`, [D])).rows[0].h;
ok(hab.predisposicion_ayudar.nivel === 1 && hab.predisposicion_ayudar.estrellas === 2, 'habilidad Predisposición nivel 1');
const habA = (await como(db, A, `select public.calcular_habilidades_usuario($1) h`, [A])).rows[0].h;
ok(habA.constancia.nivel === 0 && habA.liderazgo.nivel === 0, 'inscribirse sin escribir o proponer no da Constancia/Liderazgo');

console.log('-- encuestas');
for (let i = 0; i < 6; i++) await alumno(db, { ciclo: 5 });
await db.query(`update public.config set valor='5' where clave='umbral_minimo_segmento'`);
const filtro = { carrera: 'Psicología', cicloMin: 1, cicloMax: 10 };
const preg = [
  { orden: 1, texto: '¿Estudias de noche?', tipo: 'unica', opciones: ['Sí', 'No'] },
  { orden: 2, texto: 'Comentario', tipo: 'abierta', opciones: [] }
];
await falla(como(db, A, `select public.enviar_encuesta_segura('Hábitos de estudio','',$1,$2)`, [{ carrera: 'Derecho' }, preg]), /Muy pocos/, 'umbral bloquea segmento chico');
await falla(como(db, A, `select public.enviar_encuesta_segura('Hábitos de estudio','',$1,$2)`, [filtro, preg]), /desbloquear 30/, 'nivel 0 no puede enviar');
await falla(como(db, A, `insert into public.envios_encuesta (encuesta_id, destinatario_id) values (gen_random_uuid(), $1)`, [B]), /row-level security/, 'no inserta envíos directo');
const alc = (await como(db, A, `select public.calcular_alcance_encuesta($1) n`, [filtro])).rows[0].n;
ok(alc === 10, 'alcance en vivo = 10 (sin contar al emisor) -> ' + alc);
const encS = (await db.query(`insert into public.encuestas (autor_id,titulo,estado) values ($1,'Semilla','enviada') returning id`, [B])).rows[0].id;
const prS = (await db.query(`insert into public.preguntas (encuesta_id,orden,texto,tipo,opciones) values ($1,1,'¿Ok?','unica','["Sí","No"]') returning id`, [encS])).rows[0].id;
const envS = (await db.query(`insert into public.envios_encuesta (encuesta_id,destinatario_id,estado) values ($1,$2,'pendiente') returning id`, [encS, A])).rows[0].id;
const band = (await como(db, A, `select * from public.mi_bandeja_encuestas()`)).rows;
ok(band.length === 1 && band[0].n_preguntas === 1, 'bandeja de A');
await falla(como(db, A, `select public.responder_encuesta($1,'{}'::jsonb)`, [envS]), /todas las preguntas/, 'exige responder todo');
await como(db, A, `select public.responder_encuesta($1,$2)`, [envS, { [prS]: 'Sí' }]);
await falla(como(db, A, `select public.responder_encuesta($1,$2)`, [envS, { [prS]: 'Sí' }]), /Ya respondiste/, 'no responde dos veces');
const res = (await como(db, A, `select public.enviar_encuesta_segura('Hábitos de estudio','',$1,$2) r`, [filtro, preg])).rows[0].r;
ok(res.enviados + res.encolados === alc, 'nivel 1: envía a todo el segmento (menor que 30)');
const res2 = (await como(db, A, `select public.enviar_encuesta_segura('Segunda encuesta','',$1,$2) r`, [filtro, preg])).rows[0].r;
ok(res2.enviados + res2.encolados === alc, 'segunda encuesta de la semana cabe en el alcance (20 de 30)');
const res3 = (await como(db, A, `select public.enviar_encuesta_segura('Tercera encuesta','',$1,$2) r`, [filtro, preg])).rows[0].r;
ok(res3.enviados + res3.encolados === 10, 'tercera: solo quedan 10 de 30 -> se recorta');
await falla(como(db, A, `select public.enviar_encuesta_segura('Cuarta encuesta','',$1,$2)`, [filtro, preg]), /alcance de esta semana/, 'cuarta: alcance semanal agotado');
ok((await como(db, A, `select count(*)::int n from public.envios_encuesta where encuesta_id=$1`, [res.encuesta_id])).rows[0].n === 0, 'el autor no ve quién recibió/respondió');
await falla(como(db, B, `select public.obtener_resultados_encuesta($1)`, [res.encuesta_id]), /Solo quien creó/, 'otro no ve resultados');
const envB = (await db.query(`select id, estado from public.envios_encuesta where encuesta_id=$1 and destinatario_id=$2`, [res.encuesta_id, D])).rows[0];
const prs = (await db.query(`select id from public.preguntas where encuesta_id=$1 order by orden`, [res.encuesta_id])).rows;
await como(db, D, `select public.responder_encuesta($1,$2)`, [envB.id, { [prs[0].id]: 'No', [prs[1].id]: 'Estudio de día' }]);
const out = (await como(db, A, `select public.obtener_resultados_encuesta($1) r`, [res.encuesta_id])).rows[0].r;
ok(out.total_respuestas === 1 && out.preguntas[0].conteo.No === 1 && out.preguntas[1].textos[0] === 'Estudio de día', 'resultados agregados');
ok((await como(db, A, `select count(*)::int n from public.respuestas r join public.envios_encuesta e on e.id=r.envio_id where e.encuesta_id=$1`, [res.encuesta_id])).rows[0].n === 0, 'el autor no lee respuestas individuales');
const mis = (await como(db, A, `select * from public.mis_encuestas_creadas()`)).rows;
ok(mis.find(x => x.id === res.encuesta_id).respuestas === 1, 'mis encuestas con conteo');

console.log('-- tope semanal y cola');
const X = await alumno(db, { ciclo: 5, carrera: 'Derecho' });
for (let i = 0; i < 4; i++) {
  const e = (await db.query(`insert into public.encuestas (autor_id,titulo,estado) values ($1,$2,'enviada') returning id`, [B, 'T' + i])).rows[0].id;
  await db.query(`insert into public.envios_encuesta (encuesta_id,destinatario_id,estado,enviado_en) values ($1,$2,$3, now() - make_interval(mins => $4))`, [e, X, i < 3 ? 'pendiente' : 'encolada', i]);
}
ok((await como(db, X, `select count(*)::int n from public.mi_bandeja_encuestas() where estado='pendiente'`)).rows[0].n === 3, 'tope 3: la 4ta sigue en cola');
await db.query(`update public.envios_encuesta set enviado_en = now() - interval '8 days' where destinatario_id=$1 and estado='pendiente'`, [X]);
ok((await como(db, X, `select count(*)::int n from public.mi_bandeja_encuestas() where estado='pendiente'`)).rows[0].n === 4, 'pasada la semana, la encolada se libera');

console.log('-- eliminar cuenta');
await como(db, C2, `select public.eliminar_mi_cuenta()`);
ok((await db.query(`select count(*)::int n from auth.users where id=$1`, [C2])).rows[0].n === 0, 'eliminar cuenta borra auth.users y perfil');

console.log('-- extras');
const F = await alumno(db, { ciclo: 2 });
await falla(como(db, F, `select public.crear_consulta('Psicopatología I','Otro tema','Profesor García explica muy rápido')`), /por su nombre/, 'nombre propio al inicio de frase');
ok((await como(db, F, `select public.crear_consulta('Psicopatología I','Otro tema','El profesor dijo que el examen incluye casos') r`)).rows.length === 1, '"el profesor dijo" permitido');
const G = await alumno(db, { ciclo: 4 });
await como(db, G, `insert into public.bloqueos (bloqueador_id, bloqueado_id) values ($1,$2)`, [G, F]);
ok((await como(db, G, `select count(*)::int n from public.perfiles where id=$1`, [F])).rows[0].n === 1, 'quien bloquea sigue viendo al bloqueado');
ok((await como(db, F, `select count(*)::int n from public.perfiles where id=$1`, [G])).rows[0].n === 0, 'el bloqueado no ve a quien lo bloqueó');
const H = await alumno(db, { ciclo: 4 });
await como(db, H, `select public.enviar_solicitud($1,'Hola, coordinemos')`, [G]);
await como(db, G, `insert into public.bloqueos (bloqueador_id, bloqueado_id) values ($1,$2)`, [G, H]);
ok((await db.query(`select estado from public.solicitudes_mensaje where de_id=$1 and a_id=$2`, [H, G])).rows[0].estado === 'rechazada', 'bloquear cierra la solicitud pendiente');
ok((await como(db, A, `select public.calcular_alcance_encuesta($1) n`, [{ carreras: ['Psicología', 'Derecho'] }])).rows[0].n > (await como(db, A, `select public.calcular_alcance_encuesta($1) n`, [{ carreras: ['Psicología'] }])).rows[0].n, 'filtro con varias carreras suma');

console.log('-- sin modo llamada');
await falla(como(db, D, `select public.responder_consulta($1,'Te llamo y te explico el tema','llamada')`, [r1.grupo_id]), /solo se puede orientar por mensaje/, 'el modo "llamada" ya no se acepta');
