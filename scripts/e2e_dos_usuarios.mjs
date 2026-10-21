#!/usr/bin/env node
// =============================================================================
// Prueba E2E de dos dispositivos contra el Supabase REAL.
//
// Dos contextos de navegador separados (cada uno con su propio almacenamiento,
// como dos celulares). Nada se comparte por localStorage ni BroadcastChannel:
// si A y B se ven, es porque los datos pasaron por Supabase.
//
//   1. A y B inician sesión (si una cuenta no tiene perfil, completa el onboarding
//      con la misma carrera y ciclo para ambas).
//   2. A abre Explorar → Solicitudes y se queda esperando.
//   3. B encuentra a A en Explorar y le envía una solicitud.
//   4. A la recibe SIN recargar (Realtime) y la acepta.
//   5. B abre el chat; A escribe; B recibe el mensaje en tiempo real, sin duplicados.
//   6. Los dos ven su grupo de carrera y ciclo.
//
// Requisitos (en .env.local, NUNCA en el repo):
//   E2E_USER_A_EMAIL, E2E_USER_A_PASSWORD, E2E_USER_B_EMAIL, E2E_USER_B_PASSWORD
//   Dos cuentas ya registradas y verificadas con el código del correo
//   (correos @utp.edu.pe o de la tabla correos_invitados).
//   Opcional: E2E_BASE_URL (por defecto levanta `vite` en http://localhost:5179).
//   Opcional: E2E_HEADED=1 para ver los dos navegadores.
//
// Uso:  npm run test:e2e
// =============================================================================
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function leerEnvLocal() {
  const archivo = path.join(RAIZ, '.env.local');
  if (!fs.existsSync(archivo)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
      })
  );
}

const env = { ...leerEnvLocal(), ...process.env };
const faltan = ['E2E_USER_A_EMAIL', 'E2E_USER_A_PASSWORD', 'E2E_USER_B_EMAIL', 'E2E_USER_B_PASSWORD', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
  (k) => !env[k]
);
if (faltan.length) {
  console.error(`\n✘ Faltan variables en .env.local: ${faltan.join(', ')}`);
  console.error('  Crea dos cuentas reales en la app (registro + código del correo) y agrega sus datos a .env.local.\n');
  process.exit(2);
}

const TIEMPO = 25_000; // Realtime en datos móviles puede tardar unos segundos
const PERFIL_COMUN = { carrera: 'Psicología', ciclo: '3', fecha: '2003-05-10' };

let paso = 0;
const ok = (msg) => console.log(`  ✔ ${++paso}. ${msg}`);
const info = (msg) => console.log(`    · ${msg}`);

async function levantarServidor() {
  if (env.E2E_BASE_URL && !/localhost:5179/.test(env.E2E_BASE_URL)) return { url: env.E2E_BASE_URL, detener: () => {} };
  const url = 'http://localhost:5179';
  const proceso = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', '5179', '--strictPort'], {
    cwd: RAIZ,
    shell: process.platform === 'win32',
    stdio: 'ignore'
  });
  // En Windows, npx deja a vite como proceso hijo: hay que cerrar todo el árbol
  const detener = () =>
    process.platform === 'win32'
      ? spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
      : proceso.kill();
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { url, detener };
    } catch (e) {
      // aún arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  detener();
  throw new Error('No se pudo levantar el servidor de desarrollo en el puerto 5179.');
}

async function irATab(page, nombre) {
  await page.getByRole('button', { name: nombre, exact: true }).click();
}

async function iniciarSesion(page, url, email, password, etiqueta) {
  await page.goto(url);
  await page.getByPlaceholder('ej. jorge_utp o u2320732@utp.edu.pe').fill(email);
  await page.getByPlaceholder('Tu contraseña secreta').fill(password);
  await page.getByRole('button', { name: /Entrar a Kampuz/ }).click();

  const resultado = await Promise.race([
    page.getByRole('button', { name: 'Explorar', exact: true }).waitFor({ timeout: TIEMPO }).then(() => 'app'),
    page.getByText('Tu Perfil en el Campus').waitFor({ timeout: TIEMPO }).then(() => 'onboarding'),
    page.getByText('Tú decides para qué usamos tus datos').waitFor({ timeout: TIEMPO }).then(() => 'consentimientos'),
    page.locator('[role="alert"], .text-rose-700').first().waitFor({ timeout: TIEMPO }).then(() => 'error')
  ]);

  if (resultado === 'error') {
    const texto = await page.locator('.text-rose-700, [role="alert"]').first().innerText();
    throw new Error(`${etiqueta} no pudo iniciar sesión: ${texto}`);
  }
  if (resultado === 'onboarding') {
    info(`${etiqueta} no tenía perfil: completando onboarding (${PERFIL_COMUN.carrera}, ciclo ${PERFIL_COMUN.ciclo})`);
    await page.locator('input[type="date"]').fill(PERFIL_COMUN.fecha);
    await page.locator('select').nth(0).selectOption(PERFIL_COMUN.carrera);
    await page.locator('select').nth(1).selectOption(PERFIL_COMUN.ciclo);
    const chips = page.locator('form button[type="button"]').filter({ hasNotText: /foto/i });
    await chips.nth(1).click();
    await chips.nth(2).click();
    await page.getByRole('button', { name: /Continuar/ }).click();
  }
  if (resultado === 'onboarding' || resultado === 'consentimientos') {
    await page.getByText('Tú decides para qué usamos tus datos').waitFor({ timeout: TIEMPO });
    await page.getByRole('button', { name: /Guardar y entrar a Kampuz/ }).click();
  }
  await page.getByRole('button', { name: 'Explorar', exact: true }).waitFor({ timeout: TIEMPO });

  await irATab(page, 'Inicio');
  const nombre = (await page.locator('h1').first().innerText()).trim();
  const lineaCarrera = (await page.locator('h1 + p').first().innerText()).trim();
  return { nombre, lineaCarrera };
}

async function main() {
  const servidor = await levantarServidor();
  const navegador = await chromium.launch({ headless: !env.E2E_HEADED });
  const errores = [];

  try {
    console.log(`\nKampuz E2E · dos dispositivos · ${servidor.url}\n`);

    // Dos contextos = dos "celulares" con almacenamiento independiente
    const ctxA = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const ctxB = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    for (const [p, n] of [[a, 'A'], [b, 'B']]) {
      p.on('pageerror', (e) => errores.push(`${n}: ${e.message}`));
    }

    const perfilA = await iniciarSesion(a, servidor.url, env.E2E_USER_A_EMAIL, env.E2E_USER_A_PASSWORD, 'A');
    ok(`A inició sesión: ${perfilA.nombre} (${perfilA.lineaCarrera})`);
    const perfilB = await iniciarSesion(b, servidor.url, env.E2E_USER_B_EMAIL, env.E2E_USER_B_PASSWORD, 'B');
    ok(`B inició sesión: ${perfilB.nombre} (${perfilB.lineaCarrera})`);

    const almacenA = await a.evaluate(() => Object.keys(localStorage));
    if (almacenA.some((k) => /usuarios_registrados|mensajes_directos|solicitudes_conexion|active_otp/.test(k))) {
      throw new Error(`A tiene datos compartidos en localStorage: ${almacenA.join(', ')}`);
    }
    ok('Ningún dato compartido vive en localStorage (solo la sesión de Supabase y preferencias)');

    // A espera en Solicitudes → Recibidas (Realtime)
    await irATab(a, 'Explorar');
    await a.getByRole('button', { name: /^Solicitudes/ }).click();

    // B busca a A en Explorar
    await irATab(b, 'Explorar');
    const primerNombreA = perfilA.nombre.split(' ')[0];
    await b.getByPlaceholder('Buscar por nombre o carrera...').fill(primerNombreA);
    const tarjetaA = b.locator('.k-card').filter({ has: b.locator('h3', { hasText: perfilA.nombre }) }).first();
    await tarjetaA.waitFor({ timeout: TIEMPO });
    ok('B ve a A en Explorar');

    await tarjetaA.getByRole('button', { name: /Conectar/ }).click();
    await b.getByPlaceholder(/Hola, me gustaría coordinar/).fill(`Prueba E2E ${new Date().toISOString()}: coordinar un trabajo`);
    await b.getByRole('button', { name: /Enviar Solicitud/ }).click();

    const envio = await Promise.race([
      b.getByText(/Solicitud enviada a/).waitFor({ timeout: TIEMPO }).then(() => 'enviada'),
      b.getByText(/Ya están conectados|Ya le enviaste/).waitFor({ timeout: TIEMPO }).then(() => 'previa')
    ]);
    let yaConectados = false;
    if (envio === 'enviada') {
      ok('B envió la solicitud (validada por el servidor)');
      await a.getByRole('button', { name: /Aceptar Conexión/ }).first().waitFor({ timeout: TIEMPO });
      ok('A recibió la solicitud SIN recargar (Realtime)');
      await a.getByRole('button', { name: /Aceptar Conexión/ }).first().click();
      await a.getByPlaceholder('Escribe un mensaje académico...').waitFor({ timeout: TIEMPO });
      ok('A aceptó: el servidor creó la conversación y se abrió el chat');
    } else {
      yaConectados = true;
      info('A y B ya estaban conectados o con solicitud previa (corrida anterior): se pasa directo al chat');
      await b.getByRole('button', { name: 'Cancelar' }).click();
      await irATab(a, 'Explorar');
      await a.getByRole('button', { name: /^Chats 1 a 1/ }).click();
      await a.locator('.k-card', { hasText: perfilB.nombre }).first().click();
      await a.getByPlaceholder('Escribe un mensaje académico...').waitFor({ timeout: TIEMPO });
    }

    // B abre el chat con A (la lista se actualiza por Realtime al aceptar)
    await b.getByRole('button', { name: /^Chats 1 a 1/ }).click();
    const convB = b.locator('.k-card', { hasText: perfilA.nombre }).first();
    await convB.waitFor({ timeout: TIEMPO });
    ok(`B ve la conversación con A en "Chats 1 a 1"${yaConectados ? '' : ' sin recargar'}`);
    await convB.click();
    await b.getByPlaceholder('Escribe un mensaje académico...').waitFor({ timeout: TIEMPO });

    // A escribe; B lo recibe en tiempo real
    const mensaje = `Hola desde A · e2e ${Date.now()}`;
    await a.getByPlaceholder('Escribe un mensaje académico...').fill(mensaje);
    await a.getByPlaceholder('Escribe un mensaje académico...').press('Enter');
    await b.getByText(mensaje, { exact: true }).waitFor({ timeout: TIEMPO });
    ok('B recibió el mensaje de A en tiempo real');

    await a.waitForTimeout(3000); // deja llegar el eco de Realtime del propio mensaje
    const enA = await a.getByText(mensaje, { exact: true }).count();
    const enB = await b.getByText(mensaje, { exact: true }).count();
    if (enA !== 1 || enB !== 1) throw new Error(`Mensaje duplicado: A lo ve ${enA} veces, B ${enB}`);
    ok('Sin duplicados: el mensaje aparece una sola vez en cada celular');

    const respuesta = `Respuesta de B · e2e ${Date.now()}`;
    await b.getByPlaceholder('Escribe un mensaje académico...').fill(respuesta);
    await b.getByPlaceholder('Escribe un mensaje académico...').press('Enter');
    await a.getByText(respuesta, { exact: true }).waitFor({ timeout: TIEMPO });
    ok('A recibió la respuesta de B en tiempo real');

    // Grupo de carrera y ciclo
    for (const [p, n] of [[a, 'A'], [b, 'B']]) {
      await p.getByTitle('Volver').click();
      await irATab(p, 'Grupos');
      const salon = p.locator('.k-card', { hasText: 'Tu Salón' }).first();
      await salon.waitFor({ timeout: TIEMPO });
      const nombreSalon = (await salon.locator('h3').first().innerText()).trim();
      ok(`${n} ve su grupo de carrera y ciclo: "${nombreSalon}"`);
    }
    if (perfilA.lineaCarrera === perfilB.lineaCarrera) {
      info('A y B tienen la misma carrera y ciclo: comparten ese grupo.');
    } else {
      info('A y B tienen distinta carrera o ciclo: cada uno ve el suyo (lo esperado).');
    }

    if (errores.length) throw new Error(`Errores de JavaScript en la página:\n  ${errores.join('\n  ')}`);
    console.log(`\n✔ Prueba de dos dispositivos superada (${paso} comprobaciones).\n`);
  } catch (err) {
    console.error(`\n✘ Falló en el paso ${paso + 1}: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    await navegador.close();
    servidor.detener();
  }
}

main();
