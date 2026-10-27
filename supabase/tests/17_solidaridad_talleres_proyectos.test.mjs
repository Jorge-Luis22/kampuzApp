import { crearBase, como } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

// Migración 017: Solidaridad ("Me ayudó"), talleres con puntos, proyectos y umbral de grupos.
const db = await crearBase();
console.log('migraciones + seed OK');

const habilidades = async (uid) => (await como(db, uid, `select public.calcular_habilidades_usuario($1) h`, [uid])).rows[0].h;

// ------------------------------------------------------------------------------
console.log('-- umbral de grupos del piloto');
const cfg = (await db.query(`select clave, valor from public.config where clave in ('umbral_apoyos_grupo','min_alumnos_estrellas') order by clave`)).rows;
const valorCfg = Object.fromEntries(cfg.map((c) => [c.clave, c.valor]));
ok(cfg.length === 2 && valorCfg.umbral_apoyos_grupo === '5' && valorCfg.min_alumnos_estrellas === '1', 'config del piloto: 5 apoyos y 1 alumno');
ok((await db.query(`select public.umbral_visibilidad() u`)).rows[0].u === 5, 'el umbral de visibilidad es 5');

const P = [];
for (let i = 0; i < 6; i++) P.push(await alumno(db, { carrera: 'Psicología', ciclo: 3 }));
const prop = (await como(db, P[0], `select public.proponer_grupo('Club de Cine','Funciones los jueves') id`)).rows[0].id;
for (let i = 1; i <= 3; i++) await como(db, P[i], `select public.apoyar_propuesta($1)`, [prop]);
ok((await db.query(`select estado from public.espacios where id = $1`, [prop])).rows[0].estado === 'oculto', 'con 4 apoyos sigue oculto');
await como(db, P[4], `select public.apoyar_propuesta($1)`, [prop]);
ok((await db.query(`select estado from public.espacios where id = $1`, [prop])).rows[0].estado === 'visible', 'con 5 apoyos se abre el grupo');
const reglas = (await como(db, P[0], `select public.reglas_piloto() r`)).rows[0].r;
ok(reglas.umbral_apoyos_grupo === 5 && reglas.min_alumnos_estrellas === 1, 'la app puede leer las reglas del piloto');
await falla(como(db, null, `select public.reglas_piloto()`), /permission denied/, 'sin sesión no se leen');
await db.query(`update public.config set valor = '15' where clave = 'umbral_apoyos_grupo'`);
ok((await db.query(`select public.umbral_visibilidad() u`)).rows[0].u === 15, 'volver el valor a 15 restaura la regla de la spec');
await db.query(`update public.config set valor = '5' where clave = 'umbral_apoyos_grupo'`);

// ------------------------------------------------------------------------------
console.log('-- Solidaridad: "Me ayudó"');
const Q1 = await alumno(db, { carrera: 'Derecho', ciclo: 2 });
const Q2 = await alumno(db, { carrera: 'Derecho', ciclo: 3 });
const Q3 = await alumno(db, { carrera: 'Derecho', ciclo: 2 });
const Z = await alumno(db, { carrera: 'Derecho', ciclo: 8 });

const preguntar = async (uid, curso, tema, texto) => (await como(db, uid, `select public.crear_consulta($1,$2,$3) r`, [curso, tema, texto])).rows[0].r;
const orientar = async (uid, grupo, texto) => (await como(db, uid, `select public.responder_consulta($1,$2) id`, [grupo, texto])).rows[0].id;
const meAyudo = async (uid, asesoria, util = true) => (await como(db, uid, `select public.valorar_asesoria($1,$2) r`, [asesoria, util])).rows[0].r;

const g1 = (await preguntar(Q1, 'Derecho Civil I', 'Examen parcial', '¿Qué casos entran en el parcial?')).grupo_id;
const as1 = await orientar(Z, g1, 'Repasa los casos de las semanas 3 a 6.');
ok((await db.query(`select estrellas_pendientes e from public.asesorias where id = $1`, [as1])).rows[0].e === 1, 'con un solo alumno ya hay 1 estrella pendiente');
await falla(meAyudo(Q2, as1), /Solo quienes hicieron/, 'solo quien preguntó confirma la ayuda');
ok((await meAyudo(Q1, as1)).estrellas_acreditadas === 1, '"Me ayudó" acredita 1 estrella');
await falla(meAyudo(Q1, as1), /Ya valoraste/, 'no confirma dos veces');
let h = await habilidades(Z);
ok(h.predisposicion_ayudar.nombre === 'Solidaridad' && h.predisposicion_ayudar.nivel === 1 && h.predisposicion_ayudar.progreso === 1, 'Solidaridad nivel 1 con 1 alumno ayudado');

const g2 = (await preguntar(Q2, 'Derecho Penal I', 'Trabajo grupal', '¿Cómo cito jurisprudencia en el trabajo?')).grupo_id;
const as2 = await orientar(Z, g2, 'Usa el formato del manual de la facultad.');
await meAyudo(Q2, as2);
h = await habilidades(Z);
ok(h.predisposicion_ayudar.nivel === 2 && h.predisposicion_ayudar.progreso === 2, 'dos alumnos distintos -> nivel 2');

const g3 = (await preguntar(Q1, 'Derecho Civil II', 'Práctica', '¿Cómo me preparo para la práctica calificada?')).grupo_id;
const as3 = await orientar(Z, g3, 'Practica con los casos del aula virtual.');
await meAyudo(Q1, as3);
h = await habilidades(Z);
ok(h.predisposicion_ayudar.progreso === 2 && h.predisposicion_ayudar.estrellas === 3, 'el mismo alumno otra vez suma estrellas pero no sube de nivel');

const g4 = (await preguntar(Q3, 'Derecho Laboral', 'Examen final', '¿Qué temas entran en el examen final?')).grupo_id;
const as4 = await orientar(Z, g4, 'Entran los temas de las unidades 2 y 3.');
ok((await meAyudo(Q3, as4, false)).estrellas_acreditadas === 0, '"No me ayudó" no acredita nada');
h = await habilidades(Z);
ok(h.predisposicion_ayudar.progreso === 2, '"No me ayudó" no cuenta como solidaridad');

// Un contacto directo no cuenta (evita acuerdos entre amigos para inflar la habilidad)
const sol = (await como(db, Q3, `select public.enviar_solicitud($1,'Hola, te agradezco la ayuda') id`, [Z])).rows[0].id;
await como(db, Z, `select public.responder_solicitud($1, true)`, [sol]);
const g5 = (await preguntar(Q3, 'Derecho Mercantil', 'Parcial', '¿Qué lecturas entran en el parcial?')).grupo_id;
const as5 = await orientar(Z, g5, 'Lee los capítulos 1 y 2 del manual.');
ok((await meAyudo(Q3, as5)).estrellas_acreditadas === 0, 'entre contactos directos no se acreditan estrellas');
h = await habilidades(Z);
ok(h.predisposicion_ayudar.progreso === 2, 'ni suma a la Solidaridad');

// Con el valor de la spec (2 alumnos) una sola persona ya no acredita
await db.query(`update public.config set valor = '2' where clave = 'min_alumnos_estrellas'`);
const Q4 = await alumno(db, { carrera: 'Derecho', ciclo: 2 });
const g6 = (await preguntar(Q4, 'Derecho Romano', 'Tarea', '¿Cómo se entrega la tarea semanal?')).grupo_id;
const as6 = await orientar(Z, g6, 'Se sube al aula virtual en PDF.');
ok((await db.query(`select estrellas_pendientes e from public.asesorias where id = $1`, [as6])).rows[0].e === 0, 'con mínimo 2 y un solo alumno no hay estrellas pendientes');
ok((await meAyudo(Q4, as6)).estrellas_acreditadas === 0, 'y "Me ayudó" no acredita');
await db.query(`update public.config set valor = '1' where clave = 'min_alumnos_estrellas'`);

// ------------------------------------------------------------------------------
console.log('-- talleres con puntos y constancia');
const staff = await alumno(db, { carrera: 'Psicología', ciclo: 6 });
await db.query(`update public.perfiles set rol = 'moderador' where id = $1`, [staff]);
const S1 = await alumno(db, { carrera: 'Psicología', ciclo: 2 });
const S2 = await alumno(db, { carrera: 'Derecho', ciclo: 4 });
const S3 = await alumno(db, { carrera: 'Enfermería', ciclo: 1 });

const ia = (await db.query(`select id from public.espacios where nombre = 'Taller de IA Aplicada a la Universidad'`)).rows[0].id;
const futsal = (await db.query(`select id from public.espacios where nombre = 'Taller de Futsal UTP Lima Sur'`)).rows[0].id;
const info = (await como(db, S1, `select * from public.info_talleres()`)).rows;
const iaInfo = info.find((t) => t.espacio_id === ia);
ok(iaInfo && iaInfo.habilidad === 'Inteligencia artificial' && iaInfo.puntos === 20 && !iaInfo.constancia_en && !iaInfo.puedo_gestionar, 'el taller de IA da 20 puntos de Inteligencia artificial');
ok(info.find((t) => t.espacio_id === futsal)?.habilidad === null, 'el de futsal no da puntos');

for (const u of [S1, S2]) await como(db, u, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [u, ia]);
await como(db, S3, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [S3, futsal]);
await falla(como(db, S1, `insert into public.membresias (usuario_id, espacio_id, rol) values ($1,$2,'admin')`, [S1, futsal]), /row-level security/, 'un alumno no se hace admin de un taller');

await falla(como(db, S1, `select * from public.miembros_taller($1)`, [ia]), /No puedes gestionar/, 'un alumno no ve la lista para dar constancias');
await falla(como(db, S1, `select public.otorgar_constancias_taller($1, $2::uuid[])`, [ia, [S1]]), /No puedes entregar/, 'un alumno no se da constancia a sí mismo');
await falla(como(db, S1, `select public.crear_taller('Taller de Liderazgo','x','Lunes','', 'Liderazgo', 20)`), /Solo el personal/, 'un alumno no crea talleres');
await falla(como(db, S1, `insert into public.constancias_taller (espacio_id, usuario_id, habilidad, puntos) values ($1,$2,'IA',20)`, [ia, S1]), /permission denied/, 'no se escribe la constancia directo');
ok((await como(db, staff, `select * from public.info_talleres() where espacio_id = $1`, [ia])).rows[0].puedo_gestionar === true, 'el personal UTP puede gestionar');

const miembros = (await como(db, staff, `select * from public.miembros_taller($1)`, [ia])).rows;
ok(miembros.length === 2 && miembros.every((m) => m.constancia_en === null), 'el personal ve a los 2 inscritos sin constancia');
ok((await como(db, staff, `select public.otorgar_constancias_taller($1, $2::uuid[]) n`, [ia, [S1, S3]])).rows[0].n === 1, 'solo recibe quien está inscrito (S3 no está en IA)');
ok((await como(db, staff, `select public.otorgar_constancias_taller($1, $2::uuid[]) n`, [ia, [S1]])).rows[0].n === 0, 'no se entrega dos veces');
await falla(como(db, staff, `select public.otorgar_constancias_taller($1, $2::uuid[])`, [futsal, [S3]]), /no otorga puntos/, 'un taller sin habilidad no entrega constancias');
await falla(como(db, staff, `select public.otorgar_constancias_taller($1, $2::uuid[])`, [ia, []]), /al menos un alumno/, 'hay que elegir a alguien');

h = await habilidades(S1);
ok(h.taller_inteligencia_artificial?.nombre === 'Inteligencia artificial' && h.taller_inteligencia_artificial.progreso === 20 && h.taller_inteligencia_artificial.nivel === 1, 'S1 gana 20 puntos y nivel 1 en Inteligencia artificial');
ok(h.taller_inteligencia_artificial.taller === true && h.taller_inteligencia_artificial.talleres === 1, 'la habilidad se marca como de taller');
ok(!(await habilidades(S2)).taller_inteligencia_artificial, 'S2 sin constancia no tiene la habilidad');
ok((await como(db, S1, `select count(*)::int n from public.constancias_taller`)).rows[0].n === 1, 'cada alumno ve solo su constancia');
ok((await como(db, S2, `select count(*)::int n from public.constancias_taller`)).rows[0].n === 0, 'S2 no ve la de S1');
ok((await como(db, S1, `select constancia_en from public.info_talleres() where espacio_id = $1`, [ia])).rows[0].constancia_en !== null, 'S1 ve su constancia en el taller');

console.log('-- crear un taller (personal UTP)');
await falla(como(db, staff, `select public.crear_taller('x','','', '', 'Liderazgo', 20)`), /entre 3 y 80/, 'nombre muy corto');
await falla(como(db, staff, `select public.crear_taller('Taller de Liderazgo','','', '', 'Liderazgo', 99)`), /entre 1 y 60/, 'puntos fuera de rango');
await falla(como(db, staff, `select public.crear_taller('Taller de Liderazgo','','', 'utp.edu.pe/inscribete', 'Liderazgo', 20)`), /http/, 'enlace sin http');
await falla(como(db, staff, `select public.crear_taller('Taller de IA Aplicada a la Universidad','','', '', 'Liderazgo', 20)`), /Ya existe/, 'no repite un nombre');
const lid = (await como(db, staff, `select public.crear_taller('Taller de Liderazgo','Dinámicas para liderar equipos','Miércoles 18:00','https://portal.utp.edu.pe/liderazgo','Liderazgo',30) id`)).rows[0].id;
const nuevo = (await db.query(`select tipo, oficial, estado, habilidad_taller, puntos_taller from public.espacios where id = $1`, [lid])).rows[0];
ok(nuevo.tipo === 'taller' && nuevo.oficial && nuevo.estado === 'visible' && nuevo.habilidad_taller === 'Liderazgo' && nuevo.puntos_taller === 30, 'queda como taller oficial visible con 30 puntos');
ok((await como(db, S2, `select count(*)::int n from public.listar_espacios() where id = $1`, [lid])).rows[0].n === 1, 'los alumnos lo ven en Grupos');
await como(db, S2, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [S2, lid]);
await como(db, staff, `select public.otorgar_constancias_taller($1, $2::uuid[])`, [lid, [S2]]);
h = await habilidades(S2);
ok(h.taller_liderazgo?.progreso === 30 && h.taller_liderazgo.nivel === 1, 'S2 gana 30 puntos de Liderazgo');

// Los puntos de la misma habilidad se acumulan entre talleres
const lid2 = (await como(db, staff, `select public.crear_taller('Liderazgo avanzado','','', '', 'liderazgo', 30) id`)).rows[0].id;
await como(db, S2, `insert into public.membresias (usuario_id, espacio_id) values ($1,$2)`, [S2, lid2]);
await como(db, staff, `select public.otorgar_constancias_taller($1, $2::uuid[])`, [lid2, [S2]]);
h = await habilidades(S2);
ok(Object.keys(h).filter((k) => k.startsWith('taller_')).length === 1, 'Liderazgo y liderazgo son la misma habilidad');
ok(h.taller_liderazgo.progreso === 60 && h.taller_liderazgo.nivel === 3 && h.taller_liderazgo.talleres === 2, '60 puntos -> nivel 3 con 2 talleres');

// ------------------------------------------------------------------------------
console.log('-- proyectos buscando equipo');
const AU = await alumno(db, { carrera: 'Ingeniería de Sistemas e Informática', ciclo: 5 });
const B1 = await alumno(db, { carrera: 'Diseño', ciclo: 4 });
const B2 = await alumno(db, { carrera: 'Marketing', ciclo: 6 });
const B3 = await alumno(db, { carrera: 'Psicología', ciclo: 3 });
const OTRA = await alumno(db, { carrera: 'Diseño', ciclo: 4 });
await db.query(`update public.perfiles set universidad = 'Otra Universidad' where id = $1`, [OTRA]);

const crear = (uid, o = {}) => como(db, uid, `select public.crear_proyecto($1,$2,$3,$4::text[],$5,$6::date,$7) id`, [
    o.tipo ?? 'hackaton',
    o.titulo ?? 'Hackatón Perú Innova',
    o.descripcion ?? 'Buscamos gente para armar un equipo y competir en la hackatón de octubre.',
    o.roles ?? ['Diseño UX', 'Marketing'],
    o.cupos ?? 2,
    o.fecha ?? null,
    o.enlace ?? 'https://hackaton.example.pe',
]).then((r) => r.rows[0].id);

await falla(crear(AU, { tipo: 'broma' }), /qué tipo/, 'el tipo debe ser válido');
await falla(crear(AU, { titulo: 'Hi' }), /título/, 'título muy corto');
await falla(crear(AU, { descripcion: 'corto' }), /20 a 800/, 'descripción muy corta');
await falla(crear(AU, { cupos: 0 }), /cuántas personas/, 'al menos 1 cupo');
await falla(crear(AU, { cupos: 50 }), /cuántas personas/, 'máximo 20 cupos');
await falla(crear(AU, { fecha: '2020-01-01' }), /fecha límite/, 'fecha pasada');
await falla(crear(AU, { enlace: 'javascript:alert(1)' }), /http/, 'el enlace debe ser http(s)');
await falla(como(db, null, `select public.crear_proyecto('hackaton','Título largo','Descripción suficientemente larga para pasar',null,2,null,null)`), /permission denied/, 'sin sesión no se publica');
await falla(como(db, AU, `insert into public.proyectos (autor_id, tipo, titulo, descripcion) values ($1,'otro','Directo','Insertado sin pasar por la función ok')`, [AU]), /permission denied|row-level security/, 'no se inserta directo en la tabla');
await falla(como(db, AU, `select * from public.proyectos`), /permission denied/, 'no se lee la tabla directo');

const pr1 = await crear(AU);
const pr2 = await crear(AU, { tipo: 'tesis', titulo: 'Tesis sobre estrés', descripcion: 'Busco a alguien de estadística para analizar datos de mi tesis.', roles: [], cupos: 1, enlace: '' });
const pr3 = await crear(AU, { tipo: 'startup', titulo: 'App de reciclaje', descripcion: 'Startup de reciclaje en campus; buscamos desarrollo y diseño gráfico.' });
await falla(crear(AU, { titulo: 'Cuarto proyecto' }), /3 proyectos abiertos/, 'máximo 3 proyectos abiertos');

const lista = (uid) => como(db, uid, `select public.listar_proyectos() l`).then((r) => r.rows[0].l);
let l = await lista(B1);
ok(l.length === 3 && l.every((p) => p.soy_autor === false && p.mi_postulacion === null && p.pendientes === 0), 'otro alumno ve los 3 proyectos abiertos');
ok(l.find((p) => p.id === pr1).roles.length === 2 && l.find((p) => p.id === pr1).autor_nombre.startsWith('Nombre'), 'trae roles y nombre del autor');
ok((await lista(OTRA)).length === 0, 'otra universidad no los ve');
await como(db, B3, `insert into public.bloqueos (bloqueador_id, bloqueado_id) values ($1,$2)`, [B3, AU]);
ok((await lista(B3)).length === 0, 'quien bloqueó al autor no ve su proyecto');

console.log('-- postular y responder');
await falla(como(db, AU, `select public.postular_proyecto($1,'Diseño','Quiero sumarme a mi propio proyecto')`, [pr1]), /propio proyecto/, 'el autor no se postula');
await falla(como(db, B1, `select public.postular_proyecto($1,'Diseño','corto')`, [pr1]), /10 a 400/, 'el mensaje debe ser más completo');
await falla(como(db, OTRA, `select public.postular_proyecto($1,'Diseño','Soy de otra universidad y quiero entrar')`, [pr1]), /No encontramos/, 'otra universidad no se postula');
await falla(como(db, B3, `select public.postular_proyecto($1,'Diseño','Soy quien bloqueó al autor y quiero entrar')`, [pr1]), /No encontramos/, 'tampoco quien bloqueó');
const po1 = (await como(db, B1, `select public.postular_proyecto($1,'Diseño UX','Hice la identidad de dos proyectos del curso.') id`, [pr1])).rows[0].id;
await falla(como(db, B1, `select public.postular_proyecto($1,'Diseño UX','Intento de postular otra vez al mismo')`, [pr1]), /Ya te postulaste/, 'una postulación por proyecto');
const po2 = (await como(db, B2, `select public.postular_proyecto($1,'Marketing','Manejo redes y presupuestos de campaña.') id`, [pr1])).rows[0].id;
await falla(como(db, B2, `select public.listar_postulaciones_proyecto($1)`, [pr1]), /Solo quien publicó/, 'un alumno no ve las postulaciones ajenas');
await falla(como(db, B2, `select public.responder_postulacion($1, true)`, [po1]), /Solo quien publicó/, 'ni responde por el autor');
await falla(como(db, null, `select public.postular_proyecto($1,'x','Sin sesión no se puede postular')`, [pr1]), /permission denied/, 'sin sesión no se postula');

l = await lista(AU);
ok(l.find((p) => p.id === pr1).pendientes === 2 && l.find((p) => p.id === pr1).soy_autor, 'el autor ve 2 postulaciones pendientes');
l = await lista(B1);
ok(l.find((p) => p.id === pr1).mi_postulacion === 'pendiente', 'B1 ve que su postulación está pendiente');
const posts = (await como(db, AU, `select public.listar_postulaciones_proyecto($1) l`, [pr1])).rows[0].l;
ok(posts.length === 2 && posts[0].estado === 'pendiente' && posts.some((p) => p.rol_deseado === 'Marketing'), 'el autor lee las postulaciones con su mensaje');

const conv = (await como(db, AU, `select public.responder_postulacion($1, true) c`, [po1])).rows[0].c;
ok(conv, 'al aceptar se abre un chat entre ambos');
ok((await como(db, B1, `select count(*)::int n from public.mis_conversaciones() where id = $1`, [conv])).rows[0].n === 1, 'B1 ve el chat en Chats');
await falla(como(db, AU, `select public.responder_postulacion($1, false)`, [po1]), /Ya respondiste/, 'no se responde dos veces');
l = await lista(AU);
ok(l.find((p) => p.id === pr1).integrantes === 1 && l.find((p) => p.id === pr1).estado === 'abierto', 'queda 1 integrante y sigue abierto');
await como(db, AU, `select public.responder_postulacion($1, true)`, [po2]);
l = await lista(AU);
ok(l.find((p) => p.id === pr1).estado === 'cerrado' && l.find((p) => p.id === pr1).integrantes === 2, 'con los cupos llenos el proyecto se cierra solo');
l = await lista(B3);
ok(!l.some((p) => p.id === pr1), 'un proyecto cerrado deja de aparecer a los demás');
l = await lista(B1);
ok(l.find((p) => p.id === pr1)?.mi_postulacion === 'aceptada', 'pero el aceptado lo sigue viendo');
const B4 = await alumno(db, { carrera: 'Contabilidad', ciclo: 4 });
await falla(como(db, B4, `select public.postular_proyecto($1,'Contabilidad','Quiero sumarme al proyecto cerrado')`, [pr1]), /ya no recibe/, 'no se postula a uno cerrado');

console.log('-- rechazar, cerrar y límites');
const B5 = await alumno(db, { carrera: 'Estadística', ciclo: 5 });
const po3 = (await como(db, B5, `select public.postular_proyecto($1,'Estadística','Llevé estadística y manejo SPSS.') id`, [pr2])).rows[0].id;
await como(db, AU, `select public.responder_postulacion($1, false)`, [po3]);
ok((await como(db, B5, `select public.listar_proyectos() l`)).rows[0].l.find((p) => p.id === pr2)?.mi_postulacion === 'rechazada', 'la postulación rechazada se ve como rechazada');
ok((await db.query(`select count(*)::int n from public.conversaciones where origen = 'solicitud'`)).rows[0].n >= 2, 'rechazar no abre chat');
const po4 = (await como(db, B4, `select public.postular_proyecto($1,'Contabilidad','Puedo ayudar con el presupuesto.') id`, [pr3])).rows[0].id;
await falla(como(db, B1, `select public.cerrar_proyecto($1)`, [pr3]), /Solo quien publicó/, 'solo el autor cierra');
await como(db, AU, `select public.cerrar_proyecto($1)`, [pr3]);
ok((await db.query(`select estado from public.postulaciones_proyecto where id = $1`, [po4])).rows[0].estado === 'rechazada', 'al cerrar se responden las pendientes');
await falla(como(db, AU, `select public.responder_postulacion($1, true)`, [po4]), /Ya respondiste/, 'y no se aceptan después');
await como(db, AU, `select public.crear_proyecto('otro','Proyecto nuevo','Ahora que cerré uno puedo publicar otro proyecto.',null,3,null,null)`);
ok(true, 'cerrar uno libera un lugar para publicar');

// 5 postulaciones pendientes como máximo (cada autor puede tener 3 proyectos abiertos)
const ajenos = [];
for (let k = 0; k < 2; k++) {
  const autor = await alumno(db, { carrera: 'Arquitectura', ciclo: 6 });
  for (let i = 0; i < 3; i++) ajenos.push(await crear(autor, { titulo: `Proyecto ${k}-${i}` }));
}
const POST = await alumno(db, { carrera: 'Biología', ciclo: 4 });
for (let i = 0; i < 5; i++) await como(db, POST, `select public.postular_proyecto($1,'Apoyo','Quiero sumarme y aportar lo que pueda.')`, [ajenos[i]]);
await falla(como(db, POST, `select public.postular_proyecto($1,'Apoyo','Una postulación más de las permitidas.')`, [ajenos[5]]), /5 postulaciones/, 'máximo 5 postulaciones esperando respuesta');

// ------------------------------------------------------------------------------
console.log('-- permisos');
for (const f of [
  'public.crear_proyecto(text,text,text,text[],integer,date,text)',
  'public.listar_proyectos()',
  'public.postular_proyecto(uuid,text,text)',
  'public.listar_postulaciones_proyecto(uuid)',
  'public.responder_postulacion(uuid,boolean)',
  'public.cerrar_proyecto(uuid)',
  'public.info_talleres()',
  'public.crear_taller(text,text,text,text,text,integer)',
  'public.miembros_taller(uuid)',
  'public.otorgar_constancias_taller(uuid,uuid[])',
  'public.reglas_piloto()',
  'public.es_personal_utp()',
  'public.gestiona_taller(uuid)',
]) {
  const r = await db.query(`select has_function_privilege('anon', $1::regprocedure, 'execute') a, has_function_privilege('authenticated', $1::regprocedure, 'execute') u`, [f]);
  ok(!r.rows[0].a && r.rows[0].u, `${f.split('(')[0].replace('public.', '')}: sin acceso para anon, sí para alumnos`);
}
