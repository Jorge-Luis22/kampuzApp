// Banco de pruebas: aplica las migraciones de Kampuz sobre un Postgres en memoria (PGlite)
// con stubs mínimos de Supabase (auth, storage, roles, publicación realtime).
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.email() returns text language sql stable security definer as
  $$ select email from auth.users where id = auth.uid() $$;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.email() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid, owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant all on storage.objects to anon, authenticated;

create publication supabase_realtime;
`;

export async function crearBase({ migraciones, conSeed = true } = {}) {
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec(STUBS);
  const dir = path.join(REPO, 'supabase/migrations');
  const archivos = migraciones || fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of archivos) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Falló ${f}: ${e.message}`);
    }
  }
  if (conSeed) {
    await db.exec(fs.readFileSync(path.join(REPO, 'supabase/seed.sql'), 'utf8'));
  }
  return db;
}

// Ejecuta fn como un usuario autenticado (rol "authenticated" + auth.uid()).
export async function como(db, userId, sql, params = []) {
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId || '']);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export async function crearUsuarioAuth(db, email, meta = {}) {
  const r = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, meta]
  );
  return r.rows[0].id;
}
