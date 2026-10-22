import { crearBase, como, crearUsuarioAuth } from './harness.mjs';
import { ok, falla, alumno } from './util.mjs';

// Migración 014: permisos de funciones de trigger, search_path fijo y correos_invitados.
// El resto de pruebas (09–12) corre con 014 aplicada y comprueba que la app sigue igual.
const db = await crearBase();
console.log('migraciones + seed OK');

console.log('-- funciones de trigger sin EXECUTE para la app');
const triggers = (await db.query(`
  select p.proname,
         has_function_privilege('anon', p.oid, 'EXECUTE') anon,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') auth
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)`)).rows;
const esperadas = [
  'auto_asignar_espacios_alumno', 'cerrar_solicitudes_al_bloquear', 'descartar_encuestas_al_revocar',
  'registrar_historial_consentimiento', 'tocar_conversacion', 'validar_correo_institucional',
  'validar_dominio_auth_user', 'verificar_umbral_propuesta'
];
ok(esperadas.every((n) => triggers.some((t) => t.proname === n)), 'las funciones de trigger de la auditoría existen');
const conPermiso = triggers.filter((t) => t.anon || t.auth).map((t) => t.proname);
ok(conPermiso.length === 0, `ninguna función de trigger es ejecutable por anon ni authenticated${conPermiso.length ? ': ' + conPermiso.join(', ') : ''}`);

console.log('-- search_path fijo');
const conf = (await db.query(`
  select p.proname, p.proconfig from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('proteger_perfil','default_origen_campos','validar_correo_institucional','validar_consentimiento',
                      'moderar_consulta_servidor','firma_alumno','clasificar_certificado')`)).rows;
ok(conf.length === 7, 'las 7 funciones existen');
const sinPath = conf.filter((f) => !(f.proconfig || []).includes('search_path=public')).map((f) => f.proname);
ok(sinPath.length === 0, `las 7 tienen search_path = public${sinPath.length ? ' (faltan: ' + sinPath.join(', ') + ')' : ''}`);

console.log('-- correos_invitados');
const pol = (await db.query(`select count(*)::int n from pg_policies where tablename = 'correos_invitados'`)).rows[0].n;
ok(pol >= 1, 'correos_invitados tiene una política explícita');
await falla(como(db, null, `select * from public.correos_invitados`), /permission denied/, 'anon no puede leer correos_invitados');
const lector = await alumno(db);
await falla(como(db, lector, `select * from public.correos_invitados`), /permission denied/, 'un alumno no puede leer correos_invitados');
await falla(
  como(db, lector, `insert into public.correos_invitados (correo) values ('yo@gmail.com')`),
  /permission denied/,
  'un alumno no puede invitarse solo'
);

console.log('-- la app sigue funcionando');
// Registro: el trigger de auth.users sigue consultando correos_invitados (security definer)
await falla(crearUsuarioAuth(db, 'intruso@gmail.com'), /KAMPUZ_CORREO_NO_PERMITIDO/, 'registro con gmail no invitado rechazado');
ok(!!(await crearUsuarioAuth(db, 'kampuz.app.pe+revision@gmail.com')), 'registro de un correo invitado aceptado');
// Perfil: proteger_perfil, validar_correo_institucional y auto_asignar_espacios_alumno corren como triggers
const A = await alumno(db, { ciclo: 3 });
const B = await alumno(db, { ciclo: 6 });
const pA = (await db.query(`select rol, origen_campos from public.perfiles where id = $1`, [A])).rows[0];
ok(pA.rol === 'alumno' && pA.origen_campos && Object.keys(pA.origen_campos).length > 0, 'perfil creado con rol y origen de campos del servidor');
const memb = (await db.query(`select count(*)::int n from public.membresias where usuario_id = $1`, [A])).rows[0].n;
ok(memb === 2, 'el alumno queda en su grupo de carrera y ciclo');
// Solicitud, contacto y chat
const sol = (await como(db, A, `select public.enviar_solicitud($1, 'Coordinar un trabajo') id`, [B])).rows[0].id;
const conv = (await como(db, B, `select public.responder_solicitud($1, true) c`, [sol])).rows[0].c;
await como(db, A, `insert into public.mensajes_directos (conversacion_id, autor_id, texto) values ($1, $2, 'Hola')`, [conv, A]);
ok((await como(db, B, `select ultimo_texto from public.mis_conversaciones()`)).rows[0]?.ultimo_texto === 'Hola', 'solicitud, contacto y chat funcionan');
// Grupos
const ciclo = (await como(db, A, `select id from public.listar_espacios() where tipo = 'carrera_ciclo'`)).rows[0].id;
await como(db, A, `insert into public.mensajes (espacio_id, autor_id, texto) values ($1, $2, 'Hola salón')`, [ciclo, A]);
ok(true, 'el alumno escribe en su grupo');
// Certificados: clasificar_certificado sigue corriendo como trigger
await como(db, A, `insert into public.certificados (usuario_id, habilidad, emisor, horas) values ($1, 'Excel', 'Coursera', 25)`, [A]);
ok((await db.query(`select nivel from public.certificados where usuario_id = $1`, [A])).rows[0]?.nivel === 'Intermedio', 'el certificado se clasifica en el servidor');
