# Registro de Decisiones de Arquitectura y Producto — Kampus MVP

Este documento registra las decisiones tomadas para la transición de `kampusApp` (prototipo estático React + mockData) a MVP real respaldado por Supabase, empaquetado como APK Android y listo para auditoría.

---

## 1. Decisiones Base e Inmutables

| Decisión | Detalle | Justificación |
|---|---|---|
| **Backend: Supabase** | Auth (Email OTP), Postgres, Realtime y Storage en plan gratuito. Región: `sa-east-1` (São Paulo). | Menor latencia para Perú, stack completo gestionado, sin necesidad de backend Node/Go propio. |
| **Frontend: React + Vite + Tailwind** | Se mantiene la estructura actual y el diseño visual. Se reemplaza `mockData.js` por Supabase. | Preserva el trabajo visual y la fidelidad del prototipo validado por el usuario. |
| **App Móvil: Capacitor** | Envuelve la aplicación web React existente para generar el APK debug / release. | Una sola base de código para Web y Android. |
| **Generación de APK: GitHub Actions** | Workflow automatizado que compila con Gradle y publica el APK como artefacto. | El desarrollador y los evaluadores no requieren Android Studio local. |
| **Autenticación: OTP 6 dígitos** | Código numérico de 6 dígitos enviado por correo (Supabase Email OTP) sin enlaces mágicos ni deep links. | Funciona uniformemente dentro del APK Android y en el navegador. |
| **Restricción de Dominio** | Solo `@utp.edu.pe` o correos en tabla `correos_invitados`. Validador a nivel de base de datos (trigger/check). | Garantía de red cerrada universitaria, con excepción controlada para jurados y profesores. |
| **Seguridad: Anon Key Única** | Únicamente la clave `anon` entra al cliente frontend y al APK. RLS habilitado en todas las tablas. | La clave `service_role` jamás debe compilarse ni exponerse al repositorio. |
| **Panel Universidad (W01–W06)** | Mantiene datos de demostración / métricas agregadas. | El foco del MVP son los 10 alumnos reales usando la app móvil. |

---

## 2. Decisiones de Producto y Reglas de Negocio

### 2.1 Umbral Mínimo de Segmento para Encuestas (30 en la spec, 5 en el piloto)
- **Regla:** El umbral por defecto es **30** (almacenado en la tabla `config` con clave `umbral_minimo_segmento`).
- **Consideración para Piloto:** Para un piloto de 10 alumnos reales, un umbral de 30 impedirá enviar encuestas con filtros estrechos en pruebas de laboratorio.
- **Decisión inicial:** 30 (desde la auditoría, solo cuentan alumnos con el consentimiento 2 otorgado), parametrizado en `config`.
- **Decisión del equipo para el piloto (2026-10-20):** **5**. `supabase/seed.sql` lo deja en 5. Con unos 10 alumnos, un umbral de 30 hacía imposible enviar cualquier encuesta.
- **Riesgo aceptado:** con segmentos de 5 a 29 alumnos es más fácil deducir quién respondió qué (por ejemplo, si el filtro deja a 5 compañeros del mismo salón). La spec presenta el 30 como la garantía de anonimato que hace defendibles las métricas. Por eso el consentimiento 2 y la política de privacidad ya no prometen "30 o más" (versión de la política 1.1).
- **Antes de abrir Kampuz a más alumnos, volver a 30:**
  ```sql
  update public.config set valor = '30' where clave = 'umbral_minimo_segmento';
  ```
  y cambiar también `supabase/seed.sql`, porque al ejecutarlo de nuevo sobrescribe el valor.

### 2.2 Sistema de Puntaje Unificado
- **Sin monedas ni créditos:** No existe una billetera ni saldo consumible.
- **Dimensiones de Habilidad (Nivel 0 a 3):**
  - Nivel 1: *La he usado* (1 evidencia / encuesta respondida).
  - Nivel 2: *La he aplicado con otros*.
  - Nivel 3: *La he enseñado*.
- **Alcance Semanal:** Desbloqueado por nivel de `apoyo_investigacion`: `[0, 30, 80, 200]`. Arranca en 0 obligando al primer gesto altruista.
- **Certificados:** Regla anti-farmeo estricta (solo puntúa el certificado más alto por habilidad). Avanzado si > 60 hrs o examen supervisado; Intermedio si $\ge$ 20 hrs o con evaluación; Básico en otro caso.

### 2.3 Espacios y Moderación
- **Tres tipos de espacios:** Cohorte de Carrera y Ciclo (automático), Espacio de Carrera (todos los ciclos, sede de consultas agrupadas), y Grupos de Interés/Talleres.
- **Talleres Oficiales:** Espejados con horario real de bienestar estudiantil UTP (Lettering, Futsal, Karate, IA aplicada) con sello "Oficial".
- **Propuestas de Alumnos:** Umbral de visibilidad dinámico: $\max(15, \text{round}(\text{base} \times 0.03))$. El grupo se crea oculto y pasa a visible en Explorar al alcanzar el umbral.
- **Moderación de Docentes:** Regla *"Se habla del curso, no de la persona"*. Detección en servidor mediante regex estricta sin flag `/i` en nombres propios ("el profesor dijo..." permitido; mención + juicio de valor bloqueado).

---

## 3. Registro de Desviaciones o Ajustes

*(Cualquier divergencia técnica encontrada durante la implementación se registrará en esta sección).*

- **2026-10-20 (Fase 0):** Inicialización del proyecto bajo lineamientos del spec `KAMPUS-spec-antigravity.md` y guía de MVP `PROMPT_ANTIGRAVITY_MVP.md`.
- **2026-10-20 (Fases 1–3):** Esquema Supabase con RLS en São Paulo (`sa-east-1`). Cómputo derivado de habilidades basado en hechos reales. Compresión iterativa de imágenes en cliente con canvas (<300 KB).
- **2026-10-20 (Fases 4–7):** Mensajería directa 1 a 1 en tiempo real con motivo de contacto académico obligatorio. Espacios automáticos por carrera y ciclo. Consultas académicas agrupadas atómicamente por carrera+curso+tema con validación docente en trigger ("Se habla del curso, no de la persona").
- **2026-10-20 (Fase 8):** Integración con Capacitor 8.1.2 para Android. `compileSdkVersion` y `targetSdkVersion` fijados en **36** (Android 16) adelantando el requisito obligatorio de Google Play Store para 2026. Manejo de hardware back button nativo.
- **2026-10-20 (Fase 9):** Banner de desconexión sin internet (`OfflineBanner`), guía detallada del piloto para 10 estudiantes universitarios (`docs/GUIA_PILOTO.md`) y auditoría de pantallas.
- **2026-10-20 (Fase 10):** Preparación completa para Google Play Store:
  - Auto-incremento de `versionCode` en release mediante `${{ github.run_number }}`.
  - Procedimiento de eliminación permanente e irreversible de cuenta (RPC `eliminar_mi_cuenta` y Edge Function) que purga perfil, almacenamiento en Storage y credenciales en `auth.users`.
  - Páginas públicas web conformes a Ley 29733: `public/privacidad.html` y `public/eliminar-cuenta.html`.
  - M33 Centro de Seguridad con normas de convivencia, bloqueo de compañeros y panel de reportes para moderadores.
  - Guía completa de publicación `docs/PLAY_STORE.md` con comandos `keytool`, respuestas a la Declaración de Seguridad de los Datos (Data Safety) y checklist para el desarrollador.
- **2026-10-20 (Ajuste UX/UI & Autenticación):**
  - **Cierre de sesión robusto:** Corrección de referencia a usuario nulo en `PhoneShell.jsx`, `App.jsx` y consistencia de llamada a `isSupabaseConfigured` como booleano en `auth.js` y `safety.js`.
  - **Nuevo flujo de autenticación:** Login con Nombre de Usuario o Correo y Contraseña. Registro con username único, correo `@utp.edu.pe`, contraseña y código de verificación OTP.
  - **Recuperación de contraseña:** Flujo guiado por correo institucional con código de seguridad OTP y actualización de contraseña.
  - **Privacidad implícita:** Eliminación de la sobrecarga de avisos de "Ley 29733" en pantallas de usuario. La aceptación legal se traslada de forma limpia a un checkbox de Términos y Privacidad en el registro y opciones directas en Perfil. **→ Revertido en la auditoría:** la spec 6.8 prohíbe la casilla única; volvieron los 4 consentimientos separados (M05 y M32).
  - **Limpieza de UX estudiantil:** Reemplazo de jerga técnica y matemática (`>30`, fórmulas de umbral, prefijos de pantalla `M01-M33`) por microcopy empático y centrado en la experiencia de campus.

- **2026-10-20 (Auditoría, docs/PROMPT_CLAUDE_CODE_AUDITORIA.md):** se encontró que casi todo lo marcado como real funcionaba solo dentro de un navegador y que la verificación por correo podía saltarse. Se corrigió:
  - **Revertido:** capa local-first (`campusStorage.js`, BroadcastChannel), OTP generado en el cliente con "Autocompletar", aceptación de cualquier código de 6 dígitos, login local, contraseñas en localStorage, correos de prueba en el código, fallback de foto en base64, perfiles y datos de ejemplo mezclados con los reales, casilla única de privacidad.
  - **Regla general nueva:** Supabase es la única fuente de verdad de todo lo compartido. localStorage solo guarda la sesión de Supabase y el modo oscuro. Si el servidor no responde, la app muestra el error y ofrece reintentar; nunca finge éxito.
  - **Modo demo:** se quitó el botón "Acceder con alumno de prueba". No hay modo de presentación con atajos; si hace falta uno, debe usar datos aislados y no compilarse en el APK ni en Vercel production.
  - **Migraciones 009–012** con las reglas en el servidor (ver sección 5). La 006 original fallaba en una base nueva y quedó vacía.
  - **Certificados:** la regla "solo cuenta el más alto por habilidad" se explica al alumno, pero todavía no alimenta ningún nivel (las 4 habilidades verificadas no usan certificados).

---

- **2026-10-21 (Sprint de 2 días, punto 1: arreglos del APK):**
  - **Áreas seguras:** con target SDK 36 Android dibuja la app de borde a borde. Se usa el plugin **SystemBars** que trae Capacitor 8 (`insetsHandling: "css"`), que inyecta `--safe-area-inset-*`; el CSS las lee con respaldo en `env(safe-area-inset-*)` (`viewport-fit=cover`). La barra de estado y los botones de Android se respetan; no se usa modo inmersivo. Se quitó la configuración del plugin Keyboard (no está instalado y SystemBars advierte en contra de `resizeOnFullScreen`).
  - **Modales recortados:** la animación `fadeIn` dejaba un `transform` aplicado y los modales `fixed` quedaban dentro de la vista (el chat ocupaba un tercio de la pantalla). Además `space-y-*` les sumaba margen. Corregido en `index.css` y con `!m-0` en las capas fijas.
  - **"Contacto":** la relación entre dos alumnos que aceptaron una solicitud se llama Contacto. Los textos están en `src/data/textos.js` (y los del servidor en la migración 013).
  - **Botón atrás de Android:** las pantallas que se abren encima (chat, paneles, modales) se registran con `useAtras` (`src/lib/atras.js`) y se cierran primero.
  - **Numeración:** la migración 013 quedó para el login y los contactos y la 014 para los arreglos de seguridad; el tablón del punto 2 será la **015** (`015_tablon.sql`), no la 013 que decía el prompt.
  - **Linter:** el proyecto no tiene ESLint configurado; se valida con `npm run build`.

- **2026-10-22 (Auditoría de Supabase, migración 014):**
  - Las funciones de trigger (y las de event trigger, como `rls_auto_enable` si existe) ya no son ejecutables por `public`, `anon` ni `authenticated`. Los triggers se siguen disparando: Postgres solo pide EXECUTE al crear el trigger.
  - `search_path = public` fijo en `proteger_perfil`, `default_origen_campos`, `validar_correo_institucional`, `validar_consentimiento`, `moderar_consulta_servidor`, `firma_alumno` y `clasificar_certificado`.
  - `correos_invitados`: sin permisos de tabla para la app y con una política explícita que niega todo. Solo la leen `correo_permitido` y `validar_correo_institucional` (security definer).
  - **Ojo al crear funciones nuevas (tablón):** Supabase da EXECUTE a `anon` y `authenticated` por defecto. Cada función nueva debe hacer `revoke all ... from public, anon` y dar `grant execute ... to authenticated` solo si la app la llama.
  - Perfiles sin @usuario (creados antes de que existiera): al entrar eligen uno en una pantalla propia; solo se guarda si el perfil no tenía (no sirve para cambiarlo).

## 4. Pendiente de decisión del equipo

### 4.1 "Estado en vivo" (En campus / En clase / En biblioteca / Buscando equipo / En exámenes)
- **Qué había:** todos los perfiles arrancaban con "En campus", aunque no fuera cierto, y el estado solo se guardaba en el teléfono.
- **Riesgo:** dice dónde está una persona en tiempo real. La persona objetivo (spec 3.1) es tímida y joven; un estado "En biblioteca" visible para cualquier alumno de la sede facilita que alguien la ubique. Ninguna regla de la spec lo pide.
- **Qué se hizo (auditoría, paso 5):** ahora es **opcional**, empieza en **"Sin estado"** (columna `perfiles.estado_en_vivo` en `null`), se guarda en Supabase y el alumno puede volver a "Sin estado" cuando quiera. Solo acepta los 5 valores definidos (restricción en la base).
- **A decidir por Jorge / el equipo:** mantenerlo así, quitar los estados que revelan ubicación ("En campus", "En biblioteca", "En clase") y dejar solo disponibilidad ("Buscando equipo", "En exámenes"), o eliminarlo.

### 4.2 Edad mínima para registrarse (cambio respecto a la spec 6.1)
- **La spec decía:** "Mayores de 18".
- **Decisión del equipo (2026-10-20):** hay alumnos que entran a la UTP desde los 15 años; dejarlos fuera los excluye justo del público que más necesita la app (la cachimba de la spec 3.1). La edad mínima ahora es configurable en `config.edad_minima_registro`, **14 por defecto**.
- **Por qué no menos de 14:** según el reglamento de la Ley 29733, para tratar datos de menores de 14 años se necesita el consentimiento de sus padres o tutores, y Kampuz no tiene ese flujo. El servidor no baja de 14 aunque se configure un valor menor.
- **Encuestas:** el filtro de edad de una encuesta nueva sigue empezando en 18 (el autor puede bajarlo hasta 14). Investigar con menores suele requerir autorización de los padres; que lo decida el equipo con el curso o el comité de ética.
- **Pendiente:** validar con un especialista legal el tratamiento de datos de alumnos de 14 a 17 años (consentimientos, consentimiento 4 sobre convocatorias, chats con adultos) y avisar a Jorge, porque cambia una regla de la spec.

---

## 5. Dónde se aplica cada regla (auditoría, paso 7)

"Servidor" = lo decide Postgres (RLS, trigger o función RPC) y no se puede saltar llamando a la API a mano. "Cliente" = solo la interfaz. Las reglas marcadas **(corregido)** estaban solo en el cliente o tenían un atajo en la base; se movieron al servidor en las migraciones 009–012. Cada regla de servidor tiene su prueba en `supabase/tests/` (`npm run test:sql`).

### 5.1 Reglas de la spec, sección 6

| Regla | Dónde | Cómo |
|---|---|---|
| 6.1 Solo correo @utp.edu.pe o invitado | **Servidor (corregido)** | Trigger `trg_validar_auth_user` en `auth.users` + `correos_invitados.activo` (009). Antes el cliente dejaba pasar ante error o timeout. |
| 6.1 Verificación por código de 6 dígitos | **Servidor** | Supabase Auth con "Confirm email" activado (configuración del proyecto). Se borró todo código local, `123456` y "Autocompletar". |
| 6.1 Edad mínima (la spec decía 18; ver 4.2) | **Servidor (corregido)** | Trigger `proteger_perfil` (009) con `config.edad_minima_registro` (14 por defecto, nunca menos de 14). |
| 6.1 Nombre y apellido reales | Cliente | Solo se exige que no estén vacíos; no es verificable sin convenio. |
| 6.2 Origen declarado/verificado | **Servidor (corregido)** | `proteger_perfil` fija `origen_campos`, `rol` y `correo_institucional`; el alumno no puede cambiárselos (antes podía ponerse `rol = moderador`). |
| 6.3 El perfil es la única fuente del filtro | **Servidor** | `destinatarios_filtro` usa `perfiles.intereses`, nunca las membresías. |
| 6.4 No hay mensaje directo sin solicitud aceptada | **Servidor (corregido)** | Solicitudes solo por `enviar_solicitud`; la conversación solo la crea `responder_solicitud`. Antes cualquiera podía crear una conversación con cualquiera. |
| 6.4 Chat libre dentro de tu espacio | **Servidor** | RLS de `mensajes` con `es_miembro`. Unirse solo a talleres/intereses visibles; el grupo de carrera y ciclo lo asigna el trigger y, al cambiar de ciclo, se sale del anterior (corregido). |
| 6.5 Conteo en vivo, solo un número | **Servidor** | RPC `calcular_alcance_encuesta`. |
| 6.5 Umbral mínimo de segmento (spec: 30; piloto: 5, ver 2.1) | **Servidor** | `enviar_encuesta_segura` lee `config.umbral_minimo_segmento`. |
| 6.5 Alcance semanal [0, 30, 80, 200] | **Servidor (corregido)** | Ahora acumulado en 7 días por emisor (antes era por encuesta: se podían mandar muchas por semana). |
| 6.5 Tope de 3 por semana con cola | **Servidor** | Envío a `encolada`; `mi_bandeja_encuestas` libera la cola cuando hay cupo. |
| 6.5 El emisor nunca ve quién respondió qué | **Servidor (corregido)** | El autor ya no lee `envios_encuesta` (antes veía quién respondió); resultados solo agregados y solo para el autor (antes cualquiera podía pedirlos). |
| 6.5 Responder suma a Apoyo a la investigación | **Servidor (corregido)** | Solo `responder_encuesta` marca "respondida" y exige todas las respuestas. Antes se podía marcar "respondida" sin responder y subir de nivel. |
| 6.6 Reportar y bloquear | **Servidor** | RLS de `reportes` y `bloqueos`; el bloqueo oculta al bloqueador y cierra solicitudes pendientes (corregido). |
| 6.6 Admin/moderador de espacios | Pendiente | El rol solo se asigna por SQL; no hay herramientas de moderación por espacio. |
| 6.6 La universidad no ve mensajes | Servidor | No existe ningún acceso de la universidad a mensajes. El panel W sigue con datos de ejemplo. |
| 6.7 Ninguna pantalla vacía | Cliente | Estados vacíos con acción en Explorar, Grupos, Consultas, Encuestas e Inicio (ya sin datos inventados). |
| 6.8 Cuatro consentimientos separados | **Servidor (corregido)** | Tabla `consentimientos` + `consentimientos_historial`; el 1 no se revoca; el 2 decide quién recibe encuestas (011). Los consentimientos 3 y 4 aún no tienen efecto porque el panel de la universidad no usa datos reales. |
| 6.9 Egresados con correo alterno | Pendiente | Existe la columna `correo_alterno`, sin flujo. |

### 5.2 Reglas portadas de `store.jsx` (sección 5 del prompt de Antigravity)

| Regla | Dónde | Cómo |
|---|---|---|
| 1. Moderación de docentes (nombre propio sin `/i`) | **Servidor** + aviso en cliente | Trigger en `consultas` y ahora también en `asesorias`. Corregido: "Profesor García" al inicio de una frase no se detectaba. |
| 2. Clasificación de certificados | **Servidor (corregido)** | Trigger `clasificar_certificado` (012). Antes el alumno podía guardar "Avanzado" u origen "verificada", y los certificados ni se guardaban en la base. |
| 3. nAlumnos = autores distintos | **Servidor (corregido)** | `crear_consulta`. Antes no funcionaba (columnas inexistentes). |
| 4. Orientar: ciclo ≥ 5, mayor que todos los autores, no ser autor | **Servidor (corregido)** | `responder_consulta`; se cerró el insert directo en `asesorias`. |
| 5. Estrellas = nAlumnos, solo si nAlumnos ≥ 2, pendientes hasta valorar (sin modo "llamada", ver 5.3) | **Servidor (corregido)** | `responder_consulta` + `valorar_asesoria`. Además no cuentan entre alumnos con conexión aceptada (anti-gaming 3 de la spec 7.1). |
| 6. Solo los autores valoran | **Servidor (corregido)** | `valorar_asesoria`; se cerró el insert directo. |
| 7. Un apoyo por alumno; umbral max(15, round(base × 0.03)) | **Servidor** | Restricción única + `apoyar_propuesta` + trigger. Corregido: el creador podía poner su propuesta en "visible" directamente. |
| 8. Nivel 0 = alcance 0 = no puede enviar | **Servidor** | `enviar_encuesta_segura`. |
| 9. Imágenes locales con respaldo de iniciales; fotos de perfil desde Storage | Cliente / **Servidor (corregido)** | Fotos: restricción contra base64 y bucket limitado a 1 MB de imágenes (012). |

### 5.3 Decisiones tomadas en la auditoría (revisables por el equipo)
- **Constancia** cuenta talleres o grupos de interés donde el alumno es miembro **y escribió** al menos un mensaje (spec 5.6: asistir no es evidencia). **Liderazgo** cuenta grupos creados que **alcanzaron el umbral** (una propuesta oculta no es un grupo).
- **Propuestas:** máximo 2 propuestas ocultas a la vez por alumno (anti-spam).
- **Solicitudes:** si una solicitud fue ignorada, el mismo emisor no puede reenviarla.
- **Modo "llamada" (×3) eliminado (decisión del equipo, 2026-10-20):** la llamada no existe en la app (la spec 11.3 la deja fuera del piloto) y el modo lo declaraba quien respondía, así que inflaba estrellas. Ahora solo se orienta por mensaje: estrellas = nAlumnos si son 2 o más. El servidor rechaza cualquier otro modo. Si algún día existe la llamada dentro de la app (con moderación), se puede volver a evaluar el ×3.
- **Sede** no se usa en el filtro de encuestas: el piloto es de una sola sede.
- **Login con @usuario (sprint de 2 días):** la función pública `obtener_correo_por_identificador` se eliminó (migración 013) porque le daba a cualquiera el correo de un @usuario. Ahora el login con @usuario pasa por la Edge Function `login`, que resuelve el correo con la service role y devuelve solo la sesión; el mensaje de error es siempre "Usuario o contraseña incorrectos.". El login con correo sigue yendo directo a Supabase Auth. La recuperación de contraseña se pide solo con el correo institucional.
  - **Riesgo aceptado:** Supabase Auth limita los intentos por IP; con @usuario todos los intentos salen de la IP de la Edge Function. Con un piloto de 10 alumnos no es un problema; si crece, revisar los límites o reenviar la IP del alumno.
