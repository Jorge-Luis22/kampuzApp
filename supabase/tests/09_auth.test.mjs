import { crearBase, como, crearUsuarioAuth } from './harness.mjs';
const ok = (c, m) => console.log(c ? '  ✔' : '  ✘ FALLO', m);
const db = await crearBase();
console.log('migraciones + seed OK');
// dominio
try { await crearUsuarioAuth(db, 'intruso@gmail.com'); ok(false, 'gmail no invitado debe fallar'); } catch (e) { ok(/KAMPUZ_CORREO_NO_PERMITIDO/.test(e.message), 'rechaza gmail no invitado'); }
try { await crearUsuarioAuth(db, 'x@utp.edu.pe.evil.com'); ok(false, 'dominio falso'); } catch (e) { ok(true, 'rechaza utp.edu.pe.evil.com'); }
const a = await crearUsuarioAuth(db, 'U2320732@UTP.EDU.PE', { usuario: 'ana.q' });
ok(!!a, 'acepta @utp.edu.pe (mayúsculas)');
const inv = await crearUsuarioAuth(db, 'kampuz.app.pe+revision@gmail.com');
ok(!!inv, 'acepta invitado de revisión');
await db.query(`update public.correos_invitados set activo=false where correo='kampuz.app.pe@gmail.com'`);
try { await crearUsuarioAuth(db, 'kampuz.app.pe@gmail.com'); ok(false, 'inactivo'); } catch { ok(true, 'rechaza invitado inactivo'); }
// lectura de invitados
const r = await como(db, null, 'select count(*)::int n from public.correos_invitados');
ok(r.rows[0].n === 0, 'anon no lee correos_invitados');
// usuario disponible
ok((await como(db, null, `select public.usuario_disponible('ana.q') v`)).rows[0].v === false, 'usuario reservado en metadata no disponible');
ok((await como(db, null, `select public.usuario_disponible('libre_1') v`)).rows[0].v === true, 'usuario libre disponible');
ok((await como(db, null, `select public.usuario_disponible('A B') v`)).rows[0].v === false, 'formato inválido no disponible');
ok((await como(db, a, `select public.usuario_disponible('ana.q') v`)).rows[0].v === true, 'el propio dueño ve su reserva disponible');
// perfil
const ins = `insert into public.perfiles (id, correo_institucional, nombre, apellido, usuario, sede, carrera, ciclo, fecha_nacimiento, rol)
  values ($1, 'otro@utp.edu.pe', 'Ana', 'Quispe', 'Ana.Q', 'Lima Sur', 'Psicología', 3, $2, 'moderador') returning rol, correo_institucional, usuario`;
const haceAnios = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
try { await como(db, a, ins, [a, haceAnios(13)]); ok(false, 'menor de 14'); } catch (e) { ok(/EDAD_MINIMA/.test(e.message) && /14/.test(e.message), 'rechaza a quien tiene 13 años (mínimo 14 por defecto)'); }
const p = await como(db, a, ins, [a, '2004-05-01']);
ok(p.rows[0].rol === 'alumno', 'rol forzado a alumno');
ok(p.rows[0].correo_institucional === 'u2320732@utp.edu.pe', 'correo tomado de la sesión');
ok(p.rows[0].usuario === 'ana.q', 'usuario normalizado');
await como(db, a, `update public.perfiles set rol='moderador', ciclo=4 where id=$1`, [a]);
const p2 = await db.query('select rol, ciclo from public.perfiles where id=$1', [a]);
ok(p2.rows[0].rol === 'alumno' && p2.rows[0].ciclo === 4, 'no puede escalar rol; sí editar ciclo');
ok((await como(db, null, `select public.obtener_correo_por_identificador('ANA.Q') c`)).rows[0].c === 'u2320732@utp.edu.pe', 'login por @usuario');
ok((await como(db, null, `select public.obtener_correo_por_identificador('nadie') c`)).rows[0].c === null, 'usuario inexistente -> null');
const memb = await db.query('select count(*)::int n from public.membresias where usuario_id=$1', [a]);
ok(memb.rows[0].n === 2, "auto-asignado a carrera y carrera_ciclo (y fuera del ciclo anterior)");

// Edad mínima configurable (config edad_minima_registro)
const b15 = await crearUsuarioAuth(db, 'quince@utp.edu.pe', { usuario: 'quince' });
const p15 = await como(db, b15, ins.replace("'Ana.Q'", "'quince'"), [b15, haceAnios(15)]);
ok(p15.rows.length === 1, 'acepta a un alumno de 15 años');
await db.query(`update public.config set valor='16' where clave='edad_minima_registro'`);
const b16 = await crearUsuarioAuth(db, 'otro15@utp.edu.pe', { usuario: 'otro15' });
try { await como(db, b16, ins.replace("'Ana.Q'", "'otro15'"), [b16, haceAnios(15)]); ok(false, 'config 16'); } catch (e) { ok(/al menos 16/.test(e.message), 'si el equipo sube la edad mínima a 16, el servidor la aplica'); }
await db.query(`update public.config set valor='10' where clave='edad_minima_registro'`);
try { await como(db, b16, ins.replace("'Ana.Q'", "'otro15'"), [b16, haceAnios(12)]); ok(false, 'piso 14'); } catch (e) { ok(/al menos 14/.test(e.message), 'no baja de 14 aunque config diga 10 (menores de 14 requieren consentimiento de los padres)'); }
try { await como(db, b16, ins.replace("'Ana.Q'", "'otro15'"), [b16, '1900-01-01']); ok(false, 'fecha absurda'); } catch (e) { ok(/Revisa tu fecha/.test(e.message), 'rechaza fechas de nacimiento imposibles'); }
