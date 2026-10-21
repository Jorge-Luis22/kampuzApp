import { como, crearUsuarioAuth } from './harness.mjs';

export const ok = (c, m) => {
  console.log(c ? '  ✔' : '  ✘ FALLO', m);
  if (!c) process.exitCode = 1;
};

export async function falla(p, re, m) {
  try {
    await p;
    ok(false, m + ' (no falló)');
  } catch (e) {
    ok(re.test(e.message), m + (re.test(e.message) ? '' : ' -> ' + e.message));
  }
}

let n = 0;
export async function alumno(db, { carrera = 'Psicología', ciclo = 3, nac = '2003-01-01', intereses = ['Investigación y Tesis'], encuestas = true } = {}) {
  n++;
  const id = await crearUsuarioAuth(db, `u${n}@utp.edu.pe`, { usuario: `alumno${n}` });
  await como(
    db,
    id,
    `insert into public.perfiles (id, correo_institucional, nombre, apellido, usuario, sede, carrera, ciclo, fecha_nacimiento, intereses)
     values ($1, 'x', $2, $3, $4, 'Lima Sur', $5, $6, $7, $8)`,
    [id, `Nombre${n}`, `Apellido${n}`, `alumno${n}`, carrera, ciclo, nac, intereses]
  );
  await como(db, id, `insert into public.consentimientos (usuario_id, finalidad, otorgado) values ($1,'cuenta',true),($1,'encuestas',$2),($1,'metricas',true),($1,'perfil_universidad',false)`, [id, encuestas]);
  return id;
}
