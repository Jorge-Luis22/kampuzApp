# Kampuz — de prototipo a MVP real (instrucciones para Antigravity)

> Pega este archivo completo como primer mensaje de la sesión, con la carpeta `kampusApp` (la del repositorio de GitHub) abierta.
> Antes, copia `KAMPUS-spec-antigravity.md` a `docs/` dentro del proyecto. Es la fuente de verdad del producto: léela completa antes de tocar código, sobre todo las secciones 5, 6, 7 y 8.

---

## 0. Contexto

- `kampusApp` es un prototipo **React 18 + Vite 6 + Tailwind 3** que hoy funciona solo con datos inventados (`src/data/mockData.js`) y guarda el estado en `localStorage` (`src/data/store.jsx`). No tiene servidor: dos personas no pueden verse ni escribirse.
- Está desplegado en Vercel (kampuz.vercel.app) y conectado a GitHub. Cada `git push` a `main` despliega solo.
- El profesor pide un **MVP usable por al menos 10 alumnos reales**, instalado como **app Android (APK)**, no desde el navegador. Cada alumno debe poder registrarse, personalizar su perfil y chatear con otros.
- **No hay desarrollador backend disponible.** Tú construyes todo. Al final, otro agente (Claude Code) va a auditar el resultado contra este documento y la spec, así que deja todo trazable.

## 1. Decisiones ya tomadas (no las cambies)

| Tema | Decisión |
|---|---|
| Backend | **Supabase**: Auth, Postgres, Realtime y Storage. Plan gratis |
| Cliente | Se mantiene React + Vite + Tailwind y **el diseño actual**. Se reemplazan los datos inventados por datos reales |
| App móvil | **Capacitor** envuelve la misma app web y genera el APK Android. Una sola base de código |
| Build del APK | Por **GitHub Actions**: cada push genera el APK como artefacto descargable. El usuario no tiene Android Studio instalado |
| Login | **Código de 6 dígitos al correo** (Supabase Email OTP), no enlace mágico. El código funciona igual dentro del APK y evita configurar deep links |
| Idioma | Toda la interfaz en español |
| Panel universidad (W01–W05) | Sigue con datos de ejemplo. No es prioridad |
| Play Store | Se publicará después del curso. La app debe quedar **lista** para subirse (fase 10), pero tú no publicas nada |

## 2. Reglas de trabajo

1. **Trabaja por fases (sección 4).** Al terminar cada fase:
   - `npm run build` sin errores,
   - un commit con mensaje claro (`feat(fase-2): ...`),
   - un resumen corto con qué hiciste, cómo probarlo y qué falta.
   
   Luego sigue con la siguiente, salvo que la fase diga **⏸ PARA**.
2. **Seguridad, sin excepciones:**
   - En el cliente solo va la **anon key**. La `service_role` nunca entra al frontend, al repo ni al APK.
   - **RLS activado en todas las tablas**, con políticas explícitas. Ninguna tabla queda con lectura pública abierta salvo catálogos (carreras, sedes, cursos, talleres).
   - Secretos en `.env.local` (ya está en `.gitignore`). Crea `.env.example` con los nombres de las variables, sin valores.
3. **Las reglas de negocio se aplican en la base de datos**, con funciones RPC, triggers y políticas, no solo en React. El cliente puede mostrar avisos, pero quien decide es el servidor. Ejemplo: el umbral de 30, el tope de 3 encuestas por semana y quién puede valorar una respuesta.
4. **No pierdas las reglas que ya están en `store.jsx`.** Fueron corregidas y probadas. Pórtalas tal cual (sección 5).
5. **Esquema versionado:** todo el SQL va en `supabase/migrations/NNN_nombre.sql`, en orden y reproducible desde cero. Más un `supabase/seed.sql` con catálogos y talleres.
6. **No reescribas la app desde cero.** Reutiliza las vistas y componentes existentes. Separa el acceso a datos en `src/lib/` (cliente Supabase y funciones por módulo) y deja `store.jsx` como estado de UI, o reemplázalo por hooks. Evita que las vistas llamen a Supabase directo.
7. **No inventes funciones descartadas** (spec 12.2) ni cambies decisiones de producto. Si algo choca con la spec, anótalo en `docs/DECISIONES.md` y sigue con la opción más fiel a la spec.
8. **Estados vacíos reales.** Con usuarios reales casi todo empieza vacío, así que cada lista necesita su estado vacío con una acción clara (spec 6.7).

## 3. Acciones que hace el usuario (te las pide cuando toque)

El usuario no es experto. Cuando necesites algo, dale los pasos exactos, clic por clic:

- **A. Crear el proyecto en supabase.com.** Región **South America (São Paulo)**. Copiar `Project URL` y `anon public key` a `.env.local` como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Agregar las mismas variables en Vercel → Settings → Environment Variables y en GitHub → Settings → Secrets (para el build del APK).
- **B. Correr las migraciones**, pegando el SQL en el SQL Editor de Supabase en orden o con la CLI. Dale la opción más simple.
- **C. Correo:** el SMTP que trae Supabase envía muy pocos correos por hora y no alcanza para 10 personas. Guíalo para conectar **Resend** (gratis) como SMTP personalizado en Supabase → Authentication → SMTP. Cambia la plantilla del correo de "Magic Link / OTP" para que muestre `{{ .Token }}` (el código de 6 dígitos) en español y con la marca Kampuz.
- **D. Probar con dos cuentas reales** para validar el chat.

## 4. Fases

### Fase 1 — Supabase y esquema
- Instala `@supabase/supabase-js` y crea `src/lib/supabase.js`.
- Escribe las migraciones a partir del modelo de la spec (sección 8), simplificado para el MVP. Como mínimo:
  - `perfiles`: 1 a 1 con `auth.users`. Campos: nombre, apellido, foto_url, bio corta, sede, carrera, ciclo, fecha_nacimiento, intereses (text[]), origen de campos (declarado/verificado), rol, creado_en.
  - `consentimientos`: las 4 finalidades, con versión y fechas de otorgado y revocado.
  - `carreras`, `sedes`, `cursos`, `intereses_catalogo`.
  - `espacios`: tipos carrera_ciclo, carrera, interes y taller. Más estado, horario, oficial, creador, umbral, `membresias` y `apoyos_propuesta`.
  - `mensajes` (chat de espacio), `solicitudes_mensaje`, `conversaciones`, `mensajes_directos`.
  - `consultas`, `grupos_consulta`, `asesorias`, `valoraciones_asesoria`.
  - `encuestas`, `preguntas`, `envios_encuesta`, `respuestas`.
  - `certificados` y `reportes`.
- RLS y políticas para todo. Habilita Realtime en `mensajes` y `mensajes_directos`.
- Bucket de Storage `avatares`: público para leer, y cada usuario solo escribe en su propia carpeta.
- `seed.sql` con: carreras y sedes UTP (reutiliza las de `mockData.js`), cursos de ejemplo por carrera, intereses, y los **talleres oficiales con su horario real** (Lettering, Futsal, Karate, IA aplicada) con sus portadas de `public/grupos/`.
- **⏸ PARA:** pide al usuario las acciones A y B y espera su confirmación.

### Fase 2 — Registro y login reales (M01–M05)
- M01: solo acepta correos `@utp.edu.pe`. Además, una tabla `correos_invitados` permite una lista corta de correos externos (el profesor, pruebas). Valida **en el servidor**: un trigger o hook rechaza registros fuera del dominio o de la lista.
- M02: el código de 6 dígitos se verifica con `verifyOtp`. Borra el código fijo `482910`.
- M03–M05 guardan el perfil, los intereses y los 4 consentimientos en la base. El consentimiento 1 es obligatorio y bloqueado; el 4 viene **apagado** por defecto.
- La sesión persiste: al reabrir la app entra directo. Agrega "Cerrar sesión".
- El botón "Acceso rápido demo" desaparece en producción. Solo queda si `VITE_MODO_DEMO=true`.
- **⏸ PARA:** pide la acción C y prueba un registro real de punta a punta.

### Fase 3 — Perfil personalizable
- Nueva pantalla **"Editar perfil"** desde M29: foto (subir desde galería o cámara, recortada cuadrada, comprimida a menos de 300 KB antes de subir), bio, carrera, ciclo, sede e intereses.
- M29 muestra los datos reales del usuario. Las habilidades se **calculan** desde los hechos de la base (spec 5.1 y 5.3: nivel y alcance son derivados), con una vista o función SQL.
- El perfil de un alumno nuevo no puede verse vacío (spec 6.7). Diseña ese estado con su primer objetivo alcanzable, por ejemplo "responde una encuesta → Nivel 1".
- M32: los consentimientos se pueden revocar y se guarda la fecha.

### Fase 4 — Explorar, solicitudes y chat 1 a 1 (M07–M10)
- Explorar lista **perfiles reales** con los filtros actuales, sin mostrarte a ti mismo.
- No hay mensaje directo libre (spec 6.4): primero va una solicitud con un motivo. Solo cuando la otra persona acepta, se abre la conversación.
- **Chat 1 a 1 en tiempo real** con Supabase Realtime, una pantalla nueva tipo WhatsApp:
  - burbujas propias y ajenas,
  - hora,
  - autoscroll,
  - envío optimista,
  - indicador "no leído" en la bandeja.
- Bloquear y reportar desde el perfil y desde el chat (adelanto de M33).

### Fase 5 — Espacios y chat grupal (M11–M16)
- Al guardar el perfil, un trigger mete al alumno **automáticamente** en su grupo de carrera y ciclo y en su espacio de carrera. Si cambia de carrera o de ciclo, se actualiza.
- Chat grupal en tiempo real en M12–M15.
- Talleres oficiales con horario visible y sello Oficial, y botón para unirse.
- Proponer grupo con las reglas actuales:
  - umbral `max(15, round(base_activa*0.03))`, calculado en el servidor,
  - un apoyo por alumno, con restricción única en la base,
  - el grupo pasa a visible automáticamente al llegar al umbral.

### Fase 6 — Encuestas con filtro (M23–M28)
- El conteo de alcance en vivo se hace con una **RPC** que devuelve solo un número. El emisor nunca recibe la lista de destinatarios.
- El umbral mínimo de segmento sale de una tabla `config`, con clave `umbral_minimo_segmento`. Valor inicial **30**. Con 10 usuarios de piloto nunca se llegaría, así que deja el valor editable desde el SQL y anótalo en `docs/DECISIONES.md` para que el equipo decida si lo baja a 5 en la demo. No lo cambies tú.
- El envío pasa por una RPC que valida todo:
  - umbral mínimo,
  - alcance semanal por nivel `[0,30,80,200]`, con nivel 0 = no puede enviar,
  - muestra aleatoria,
  - tope de 3 encuestas por alumno por semana, con **cola** para el excedente, sin descartar.
- Bandeja, responder una pregunta por pantalla, y **resultados solo agregados** mediante una RPC. La política RLS impide que el emisor lea filas de `respuestas` ligadas a destinatarios.
- Responder una encuesta suma a la habilidad "Apoyo a la investigación".

### Fase 7 — Consultas agrupadas y estrellas (M19–M22)
- Porta exactamente las reglas de la sección 5, ahora en la base: moderación, agrupación por carrera+curso+tema con autores distintos, quién puede orientar, estrellas pendientes hasta la valoración, y que solo el autor valora.
- La moderación de texto corre en el cliente para avisar y **se repite en el servidor**, con una función o trigger antes de insertar.

### Fase 8 — APK Android con Capacitor
- Agrega Capacitor (`@capacitor/core`, `@capacitor/android`). App id `pe.kampuz.app`, nombre "Kampuz". Ícono y splash con la "Z" turquesa sobre índigo del favicon actual.
- Botón atrás de Android: navega hacia atrás dentro de la app; en Inicio, sale.
- El teclado no debe tapar el input del chat. Respeta las áreas seguras.
- Workflow de GitHub Actions `.github/workflows/android.yml`:
  - se dispara en cada push a `main` y manualmente,
  - instala dependencias,
  - corre `npm run build` con las variables `VITE_*` desde Secrets,
  - corre `npx cap sync android`,
  - compila con Gradle un **APK debug firmado**,
  - lo sube como artefacto `kampuz.apk`.
- Agrega al README la sección "Cómo instalar el APK": descargarlo desde GitHub Actions, pasarlo al celular y permitir "instalar apps de origen desconocido".
- La versión web en Vercel sigue funcionando con el mismo código.

### Fase 9 — Pulido para la demo
- Revisa todos los estados vacíos, de carga y de error, incluido "sin internet".
- `docs/GUIA_PILOTO.md`: cómo invitar a los 10 usuarios, qué probar y cómo reportar fallas.
- `docs/ESTADO_MVP.md`: tabla de cada pantalla M01–M33 y W01–W06 con su estado (real / demo / falta), para la auditoría final.

### Fase 10 — Listo para Google Play Store
El objetivo es que la app quede lista para subirla a Play Store sin rehacer nada. **No publiques ni crees cuentas**: eso lo hace el usuario. Tú dejas todo preparado y documentado.

- **Versión de Android:** `targetSdkVersion` y `compileSdkVersion` en **36** (Android 16), que es lo que Google exige desde el 31 de agosto de 2026 para apps nuevas. `minSdkVersion` en 24 o lo que pida Capacitor. Verifica que compile y funcione.
- **Build de producción (.aab):** agrega al workflow de GitHub Actions un segundo job, solo manual (`workflow_dispatch`), que genere un **Android App Bundle (.aab) firmado para release**.
  - La firma usa un keystore guardado en GitHub Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.
  - Dale al usuario los pasos exactos para crear ese keystore una sola vez con `keytool` y subirlo a Secrets.
  - Explícale en `docs/PLAY_STORE.md` que **si pierde el keystore o la contraseña no podrá actualizar la app**, y que debe guardarlo en un lugar seguro fuera del repo.
  - `versionCode` debe subir solo en cada build de release, por ejemplo usando el número de ejecución del workflow.
- **Borrar cuenta (obligatorio en Play Store):**
  - En la app: Perfil → Privacidad (M32) → **"Eliminar mi cuenta"**, con confirmación clara. Llama a una función del servidor que borra de verdad el perfil, la foto en Storage, los mensajes, las membresías y el usuario de `auth`. Suspender o desactivar la cuenta no cuenta como borrado. Como borrar de `auth.users` requiere la `service_role`, hazlo con una **Supabase Edge Function**, nunca desde el cliente.
  - En la web: una página pública `kampuz.vercel.app/eliminar-cuenta` que explique cómo pedir el borrado (desde la app o con un formulario o correo de contacto) y qué datos se eliminan.
- **Política de privacidad:** página pública `kampuz.vercel.app/privacidad`, en español y en HTML (no PDF), enlazada desde M05, M32 y el registro.
  - Debe decir qué datos se recogen (correo institucional, nombre, carrera, ciclo, sede, fecha de nacimiento, intereses, foto, mensajes, respuestas de encuestas agregadas), para qué, con quién se comparten (Supabase como proveedor; la universidad solo con el consentimiento 4), cuánto tiempo se guardan y cómo borrar la cuenta.
  - Debe mencionar la **Ley 29733** y los 4 consentimientos.
  - Pon un aviso visible arriba en el archivo fuente: *"Borrador: debe revisarlo un especialista legal antes de publicar"*.
- **Reportar y bloquear (M33):** completa el centro de seguridad: reportar mensajes, perfiles, grupos y consultas, bloquear usuarios, ver las normas de convivencia y una vista simple para moderadores con los reportes abiertos. Las apps con chat entre usuarios necesitan esto para Play Store.
- **Material para la ficha de Play Store**, en `docs/PLAY_STORE.md`:
  - Nombre, descripción corta (80 caracteres) y descripción larga, en español.
  - Ícono 512×512 PNG y gráfico destacado 1024×500, generados con la marca. Guárdalos en `docs/play-store/`.
  - Lista de capturas sugeridas.
  - **Respuestas para el formulario de Seguridad de los datos** (qué se recoge, si se cifra en tránsito, si se puede borrar, si se comparte), incluyendo lo que recogen las librerías (Supabase).
  - Respuestas para el cuestionario de clasificación de contenido, considerando que hay chat entre usuarios.
  - **Checklist para el usuario:**
    - crear la cuenta de desarrollador (US$25, un solo pago, con DNI y verificación con un celular Android físico),
    - crear la prueba cerrada con **mínimo 12 testers durante 14 días seguidos** (si alguien sale y vuelve, el conteo se reinicia),
    - subir el .aab,
    - pedir el acceso a producción.
- **Cuenta de prueba para la revisión de Google:** los revisores no tienen correo @utp.edu.pe. Usa la tabla `correos_invitados` para permitir un correo de revisión y documenta en `docs/PLAY_STORE.md` cómo darle acceso a Google en la sección "Acceso a la app" de Play Console.

## 5. Reglas ya implementadas en `store.jsx` que deben sobrevivir

1. Moderación de docentes: la regex de nombre propio va **sin** bandera `/i`, porque "el profesor dijo…" no debe bloquearse. Mencionar a un docente junto con un juicio sí bloquea.
2. Certificados: Avanzado si horas > 60; Intermedio si horas ≥ 20 o tiene evaluación; si no, Básico.
3. Consultas: `nAlumnos` = número de **autores distintos**. Preguntar dos veces no suma.
4. Orientar: ciclo ≥ 5, ciclo **mayor** que el de todos los autores, y no ser autor de la consulta.
5. Estrellas = `(llamada ? 3 : 1) × nAlumnos`, solo si nAlumnos ≥ 2. Quedan **pendientes** y se acreditan solo cuando un autor valora "me sirvió".
6. Solo los autores de la consulta pueden valorar.
7. Apoyos a grupos: uno por alumno. Umbral `max(15, round(base*0.03))`.
8. Encuestas: nivel 0 de Apoyo a la investigación = alcance 0 = no puede enviar ("Primero ayuda a alguien").
9. Imágenes: todas locales en `public/`, más el respaldo de `main.jsx` que muestra iniciales si una imagen falla. Las fotos de perfil reales vienen de Storage.

## 6. Criterio de terminado

- 2 personas en 2 celulares distintos, con el APK instalado, se registran con su correo, editan su perfil con foto, se encuentran en Explorar, se envían una solicitud, la aceptan y chatean en tiempo real.
- Las mismas 2 personas aparecen en su grupo de carrera y ciclo y pueden escribir en el chat grupal.
- Una encuesta bajo el umbral se bloquea en el servidor, aunque se llame a la RPC a mano.
- `npm run build` pasa, el workflow del APK sale en verde y kampuz.vercel.app sigue funcionando.
- `docs/ESTADO_MVP.md` y `docs/DECISIONES.md` están completos.
- **Play Store:** el job manual genera un .aab firmado con target API 36. Borrar la cuenta desde la app elimina de verdad los datos, y `/privacidad` y `/eliminar-cuenta` están en línea. `docs/PLAY_STORE.md` tiene la ficha, el formulario de datos y el checklist.
