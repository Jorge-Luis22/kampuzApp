// Ejecuta las pruebas de las migraciones en un Postgres en memoria (PGlite).
// Cada archivo *.test.mjs aplica todas las migraciones + seed desde cero y prueba las reglas
// del servidor (RLS, triggers y RPC) actuando como distintos alumnos.
//
// Uso: npm run test:sql
// Nota: PGlite simula auth/storage/roles de Supabase con stubs mínimos; no
// reemplaza probar contra el Supabase real (scripts/e2e_dos_usuarios.mjs).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let fallidos = 0;

for (const archivo of archivos) {
  console.log(`\n▶ ${archivo}`);
  const r = spawnSync(process.execPath, [path.join(dir, archivo)], { stdio: 'inherit' });
  if (r.status !== 0) fallidos++;
}

console.log(fallidos ? `\n✘ ${fallidos} archivo(s) con fallos.\n` : `\n✔ Todas las pruebas SQL pasaron (${archivos.length} archivos).\n`);
process.exit(fallidos ? 1 : 0);
