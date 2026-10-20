# Kampuz — Auditoría y corrección final (instrucciones para Claude Code)

> Ábrelo en la carpeta `kampusApp`. Lee primero `docs/KAMPUS-spec-antigravity.md` (en especial las secciones 5, 6, 7 y 8), `docs/PROMPT_ANTIGRAVITY_MVP.md`, `docs/ESTADO_MVP.md`, `docs/DECISIONES.md` y `FASES.md`.

## Contexto

Antigravity construyó el MVP: Supabase (migraciones 001–008), Capacitor, chat, perfiles y Play Store. El esquema y las políticas RLS de Supabase están razonablemente bien. **El problema está en el cliente.** Casi todo lo que el MVP promete está anulado por una capa "local-first" que finge éxito cuando Supabase no responde. Una revisión del código encontró lo siguiente.

### Hallazgos confirmados (léelos en el código antes de tocar nada)

**P0. La app no cumple su promesa principal: dos personas en dos celulares no se ven**

1. `src/lib/campusStorage.js` guarda usuarios, solicitudes, conversaciones y mensajes en **localStorage** y los sincroniza con `BroadcastChannel`. Eso solo comunica pestañas **del mismo navegador en el mismo equipo**. La prueba de `test_flow.mjs` "10/10" probablemente corrió con un solo almacenamiento compartido, así que no prueba nada entre dos dispositivos.
2. `auth.js`, `chat.js`, `explore.js` y `profile.js` usan timeouts de 1.6–2.5 s y, si Supabase tarda o falla, **siguen en modo local sin avisar**. En datos móviles eso pasa seguido. El usuario cree que se registró o que envió un mensaje, pero nada llegó a la base, y nadie más lo ve.
3. `saveProfile` y los inserts de chat se llaman con usuarios que **no tienen sesión real de Supabase**: el ID lo genera `generateUUID()` local. RLS los rechaza y el error se traga en silencio (`catch (err) {}`).

**P0. Seguridad: la identidad verificada, el valor central del producto (spec 1 y 6.1), no existe**

4. `verifyOtp` acepta **cualquier número de 6 dígitos** (`/^\d{6}$/.test(cleanToken)`) y además `'123456'`.
5. El OTP se genera en el cliente (`generateOtpCode`), se guarda en localStorage y **se muestra en pantalla con un botón "Autocompletar"** (`OnboardingFlow.jsx` ~L279–536). Cualquiera puede registrarse con cualquier correo @utp.edu.pe ajeno.
6. `isEmailAllowed` devuelve `true` ante error, timeout o falta de configuración. Además tiene correos de prueba **hardcodeados**, incluidos `test@gmail.com` y `alumno.prueba@gmail.com`.
7. **Contraseñas en texto plano en localStorage** (`saveRegisteredUser({ password })`). Y el login local entra **con cualquier contraseña** si el usuario local no tiene una guardada (`!localUser.password || ...`).

**P0. Ley 29733 y spec 6.8 (regla no negociable)**

8. Los **4 consentimientos separados** se reemplazaron por una sola casilla de "Acepto los Términos", marcada por defecto (`regAceptaTerminos = true`). `getProfile` devuelve los consentimientos **hardcodeados**, no los guardados. La spec prohíbe explícitamente la casilla única, y el consentimiento 4 debe estar apagado por defecto.

**P0. Build y despliegue**

9. `.github/workflows/android.yml`: `if: ${{ secrets.ANDROID_KEYSTORE_BASE64 != '' }}` no es válido, porque el contexto `secrets` no se puede usar en `if` de un step. Esto puede invalidar el workflow completo. Pasa el secreto a `env` y evalúa `env.X != ''`, o usa un step previo que exporte un output.
10. La Fase 0 nunca se hizo:
    - `package.json` todavía tiene `"deploy": "gh-pages -d src/"` y la dependencia `gh-pages`;
    - siguen `pnpm-lock.yaml` y `pnpm-workspace.yaml`, este último con un valor inválido.
    
    El proyecto usa **npm**. Borra todo eso.

**P1. Calidad**

11. Fotos de perfil: si falla Storage, `profile.js` guarda la foto como **Data URL base64** en `foto_url`. Eso infla la base y las respuestas. Usa solo Storage; si falla, muestra un error y permite reintentar.
12. Chat: al combinar mensajes locales y remotos con IDs distintos, y al recibir por Realtime tu propio INSERT, se **duplican mensajes**. Haz un envío optimista con un id temporal que se reemplaza por el id del servidor, y deduplica por id.
13. "Estado en vivo" (En campus / En clase / En biblioteca): todos arrancan con "En campus" aunque no sea verdad. Además expone dónde está una persona, lo cual es delicado para la persona objetivo. Ponle por defecto "Sin estado", hazlo opcional y anótalo en `docs/DECISIONES.md` para que el equipo decida si se queda.
14. `docs/ESTADO_MVP.md` y `FASES.md` marcan como "completado" cosas que funcionan solo en local. Después de corregir, actualízalos con el estado **real**.

## Qué hacer

### Regla general
**Supabase es la única fuente de verdad para todo lo compartido**: perfiles, solicitudes, conversaciones, mensajes, espacios, encuestas y consultas. localStorage solo puede usarse para la sesión de Supabase (la maneja el SDK) y para preferencias de interfaz (modo oscuro, pestaña activa).

Si no hay conexión o Supabase falla, **se muestra el error y se ofrece reintentar. Nunca se finge éxito.** El banner offline que ya existe sirve para esto.

### Pasos

1. **Fase 0 pendiente:** limpia gh-pages y pnpm. Corre `npm install` y `npm run build`. Commit.
2. **Auth real:**
   - Borra la generación local de OTP, `'123456'`, la aceptación de cualquier 6 dígitos, el botón "Autocompletar", el login local y las contraseñas en localStorage.
   - Flujo: registro con correo, contraseña y @usuario mediante `supabase.auth.signUp`. Luego, verificación con el **código de 6 dígitos que llega al correo**, usando `verifyOtp({ type: 'signup' })`; la plantilla "Confirm signup" de Supabase debe usar `{{ .Token }}`. Después, login con usuario o correo más contraseña, y recuperación con `resetPasswordForEmail` y su código.
   - Validación de dominio **solo en el servidor**: el trigger de `004_auth_domain_trigger.sql` más la tabla `correos_invitados`. Saca la lista hardcodeada del cliente y pásala a `seed.sql` (solo `kampuz.app.pe@gmail.com` y el correo de revisión de Google). Revisa que el trigger realmente rechace dominios no permitidos.
   - Dale al usuario los pasos para dejar Supabase listo:
     - Authentication → "Confirm email" activado;
     - SMTP de Resend configurado;
     - plantillas en español con `{{ .Token }}`.
   - Sobre el problema de que los correos UTP llegan tarde o a cuarentena: documenta en `docs/GUIA_PILOTO.md` que la solución es SMTP con dominio verificado en Resend y, para el piloto, revisar "Correo no deseado" o "Cuarentena". **No vuelvas a meter un atajo que salte la verificación.** Si hace falta un modo de presentación, que solo exista con `VITE_MODO_DEMO=true`, que nunca se compile en el APK de producción ni en Vercel production, y que use datos de ejemplo aislados que no toquen usuarios reales.
3. **Elimina `campusStorage.js` como capa de datos.** Reescribe `chat.js`, `explore.js`, `profile.js`, `spaces.js`, `surveys.js` y `consultas.js` para que lean y escriban solo en Supabase con la sesión real (`auth.uid()`).
   - Usa timeouts de 15 s con estado de carga visible.
   - Los errores llegan a la interfaz con un mensaje en español.
   - Realtime en `mensajes_directos`, `mensajes` y `solicitudes_mensaje` para avisos en vivo.
4. **Restaura los 4 consentimientos separados** en el onboarding (M05), con los textos de la spec 6.8, incluido el texto aprobado del consentimiento 4.
   - Se guardan en la tabla `consentimientos` con versión y fecha.
   - `getProfile` y M32 leen los valores reales.
   - El 1 va bloqueado y marcado "Necesario"; el 4 va apagado por defecto.
   - La casilla de Términos puede quedarse, pero **desmarcada** por defecto y aparte de los consentimientos.
5. Corrige los puntos 9, 11, 12 y 13.
6. **Prueba real de dos dispositivos.** Reescribe `test_flow.mjs` (o crea `scripts/e2e_dos_usuarios.mjs`) con **Playwright y dos contextos de navegador separados**, cada uno con su propio almacenamiento, contra el Supabase real con dos cuentas de prueba de `correos_invitados`.
   - A se registra o inicia sesión. B hace lo mismo.
   - B ve a A en Explorar y le envía una solicitud.
   - A la recibe sin recargar y la acepta.
   - A escribe y B recibe el mensaje en tiempo real, sin duplicados.
   - Los dos ven su grupo de carrera y ciclo.
   
   Si no tienes credenciales de prueba, pide al usuario que cree las dos cuentas y te pase los datos por `.env.local` (`E2E_USER_A_EMAIL`, etc.). Nunca los dejes en el repo.
7. **Revisión contra la spec:** recorre las reglas de la sección 6 y las reglas portadas listadas en la sección 5 del `PROMPT_ANTIGRAVITY_MVP.md`. Para cada una, indica si se aplica **en el servidor** (RPC, trigger o RLS) o solo en el cliente. Corrige las que solo están en el cliente y deberían estar en el servidor: umbral de segmento, tope semanal de encuestas, quién valora, apoyos únicos y moderación.
8. Actualiza `docs/ESTADO_MVP.md`, `docs/DECISIONES.md` y `FASES.md` con el estado **real** después de las correcciones. Marca como "real" solo lo que funciona entre dos dispositivos.

## Forma de trabajo

- Haz un commit por cada paso, con mensajes claros (`fix(auth): ...`, `refactor(chat): ...`).
- Después de cada paso, corre `npm run build`. No sigas si falla.
- **No hagas push** hasta que el usuario lo apruebe. Al final, dale un resumen en español sencillo con:
  - qué estaba mal,
  - qué cambiaste,
  - qué tiene que configurar él en Supabase, Resend, Vercel y GitHub Secrets,
  - y cómo probar con dos celulares.
- Si una corrección choca con una decisión de producto, para y pregunta.
