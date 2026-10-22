// Genera supabase/full_schema.sql: todas las migraciones en orden + seed.
// Uso: node scripts/generar_full_schema.mjs
import fs from 'node:fs';
import path from 'node:path';

const dir = 'supabase/migrations';
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const ultima = archivos.at(-1).slice(0, 3);
const cabecera = `-- ==============================================================================
-- KAMPUZ - ESQUEMA COMPLETO (generado): migraciones 001 a ${ultima} + seed, en orden.
-- Úsalo solo para crear una base NUEVA desde cero. Es idempotente (se puede
-- ejecutar dos veces). Para actualizar la base existente, ejecuta las que falten
-- (ver docs/GUIA_PILOTO.md, sección 0).
-- Se genera con: node scripts/generar_full_schema.mjs
-- ==============================================================================
`;
const partes = archivos.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim());
partes.push(fs.readFileSync('supabase/seed.sql', 'utf8').trim());
fs.writeFileSync('supabase/full_schema.sql', `${cabecera}\n${partes.join('\n\n')}\n`);
console.log(`full_schema.sql generado con ${archivos.length} migraciones + seed`);
