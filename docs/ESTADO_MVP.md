# Estado del MVP — después de la auditoría (2026-10-20)

Estado **real** de cada pantalla de la app (M01–M33) y del panel web (W01–W06), revisado contra el código y la base de datos después de la auditoría de `docs/PROMPT_CLAUDE_CODE_AUDITORIA.md`.

> **La versión anterior de este documento marcaba todo como "🟢 Real" y "100% completado". No era cierto:** casi todo funcionaba solo dentro de un mismo navegador (localStorage + BroadcastChannel), la verificación por correo aceptaba cualquier número de 6 dígitos y en la base de producción solo estaban aplicadas las migraciones 001–003 (no existían ni `perfiles.usuario` ni las columnas que usaban las consultas).

**Leyenda:**
- 🟢 **Real:** verificado entre **dos dispositivos** contra el Supabase real (`npm run test:e2e`).
- 🔵 **Listo, falta verificar:** lee y escribe solo en Supabase con la sesión real y las reglas viven en el servidor (probadas con `npm run test:sql`), pero **todavía no se probó entre dos dispositivos**. Requiere aplicar las migraciones 009–012 en Supabase.
- 🟡 **Demo:** datos de ejemplo, a propósito.
- 🔴 **Falta:** no está implementado.

**Hoy ninguna pantalla está en 🟢**: la prueba de dos dispositivos está escrita pero no se ha corrido con cuentas reales. Cuando `npm run test:e2e` pase, M01, M06, M07, M08, M09, M10 y M11 pasan a 🟢 (son las que recorre la prueba; también M03–M05 si una de las cuentas aún no tenía perfil). El resto pasa a 🟢 cuando se pruebe a mano con dos celulares (`GUIA_PILOTO.md`, sección 3).

---

## 1. Aplicación móvil (M01 – M33)

| ID | Pantalla | Estado | Qué hay de verdad / qué falta |
|---|---|:---:|---|
| **M01** | Bienvenida y acceso | 🔵 | Login con @usuario o correo + contraseña (Supabase Auth). Registro con correo, contraseña y @usuario. El dominio @utp.edu.pe / `correos_invitados` lo valida **solo el servidor** (trigger en `auth.users`). |
| **M02** | Código de 6 dígitos | 🔵 | `verifyOtp` de Supabase con el código que llega **al correo**. Sin código local, sin `123456`, sin "Autocompletar". Depende de configurar el SMTP de Gmail y las plantillas (ver `GUIA_PILOTO.md`, sección 0). |
| **M03** | Perfil declarado | 🔵 | Nombre, @usuario, fecha de nacimiento (edad mínima configurable, 14 por defecto, validada en servidor), carrera, ciclo, sede y foto (solo Storage). Trigger asigna el grupo de carrera y ciclo. |
| **M04** | Intereses | 🔵 | Mínimo 2, en la misma pantalla que M03. Se guardan en `perfiles.intereses` (fuente del filtro de encuestas). |
| **M05** | Consentimientos | 🔵 | **Los 4 separados** (spec 6.8): el 1 bloqueado "Necesario", el 4 apagado. Tabla `consentimientos` + historial con versión y fecha. Cuentas antiguas pasan por M05 al entrar. |
| **M06** | Inicio | 🔵 | Encuesta pendiente, espacios, dudas de la carrera y talleres con horario: todo de Supabase. 🔴 "Eventos de la sede": no existe tabla de eventos (antes eran inventados; se quitaron). |
| **M07** | Explorar | 🔵 | Perfiles reales con filtros en el servidor; sin perfiles de muestra. Excluye bloqueos en ambos sentidos. |
| **M08** | Perfil de otro alumno + solicitud | 🔵 | Modal con datos reales y solicitud con motivo (validada por `enviar_solicitud`). Falta mostrar las habilidades del otro alumno. |
| **M09** | Solicitudes | 🔵 | Recibidas/enviadas desde Supabase, aviso en vivo (Realtime). Aceptar crea la conversación en el servidor. |
| **M10** | Chat 1 a 1 | 🔵 | Realtime en `mensajes_directos`, envío optimista sin duplicados, "leído", reintento si falla. |
| **M11** | Grupos | 🔵 | `listar_espacios` con conteos reales; solo tu grupo de carrera y ciclo. |
| **M12** | Espacio de carrera (consultas) | 🔵 | Consultas agrupadas reales (antes no funcionaban: columnas inexistentes). |
| **M13** | Grupo de ciclo (chat) | 🔵 | Chat en tiempo real; solo miembros leen y escriben (RLS). |
| **M14** | Detalle de taller / grupo de interés | 🔵 | Horario, sello Oficial, unirse/salir. |
| **M15** | Chat de grupo | 🔵 | Igual que M13. |
| **M16** | Proponer grupo | 🔵 | `proponer_grupo` en el servidor: nace oculto; umbral max(15, 3%); apoyo único; visible al llegar al umbral. |
| **M17** | Solicitud de publicación en grupo ajeno | 🔴 | No implementada (la spec la deja para fase 2). |
| **M18** | Eventos del grupo | 🔴 | No implementado (no hay tabla de eventos). |
| **M19** | Hacer una consulta | 🔵 | `crear_consulta`: carrera y ciclo los toma el servidor; moderación en el servidor. |
| **M20** | Lista de consultas agrupadas | 🔵 | Solo las de tu carrera, con autores distintos. |
| **M21** | Responder una consulta | 🔵 | `responder_consulta`: solo por mensaje (sin "llamada"); ciclo ≥ 5, mayor que los autores, no autor, misma carrera. Estrellas = nAlumnos, pendientes hasta la valoración. |
| **M22** | Valorar respuesta | 🔵 | `valorar_asesoria`: solo autores; estrellas solo si nAlumnos ≥ 2 y sin conexión aceptada entre ambos. |
| **M23** | Bandeja de encuestas | 🔵 | `mi_bandeja_encuestas` libera la cola si hay cupo (tope 3/semana). |
| **M24** | Crear encuesta: filtro en vivo | 🔵 | Conteo por RPC (solo un número), solo cuenta a quien dio el consentimiento 2. |
| **M25** | Bloqueo bajo el umbral | 🔵 | Pantalla propia; el servidor bloquea igual aunque se llame a la RPC a mano. |
| **M26** | Redactar preguntas | 🔵 | Solo preguntas de opción única en la interfaz (el servidor acepta también múltiple y abierta). |
| **M27** | Responder (una por pantalla) | 🔵 | `responder_encuesta`, todo en una transacción. |
| **M28** | Resultados agregados | 🔵 | Solo para el autor; nunca quién respondió qué. |
| **M29** | Mi perfil | 🔵 | Habilidades calculadas en el servidor desde los hechos; edición con foto solo en Storage; enlaces profesionales y estado opcional guardados en Supabase. |
| **M30** | Detalle de habilidad | 🔵 | Progreso y meta real del siguiente nivel. |
| **M31** | Agregar certificado | 🔵 | Se guarda en `certificados`; nivel y origen los decide el servidor. Solo enlace (no hay subida de archivo). |
| **M32** | Privacidad | 🔵 | Los 4 consentimientos con estado, fecha y versión reales; eliminar cuenta (fotos, datos y usuario de auth). |
| **M33** | Centro de seguridad | 🔵 | Reportar, bloquear/desbloquear y vista de reportes para moderadores (el rol se asigna por SQL). |

## 2. Panel de la universidad (W01 – W06)

| ID | Pantalla | Estado | Observaciones |
|---|---|:---:|---|
| **W01** | Resumen | 🟡 | Datos de ejemplo (decisión del MVP). |
| **W02** | Participación por facultad y ciclo | 🟡 | Datos de ejemplo. |
| **W03** | Alumnos destacados | 🟡 | Datos de ejemplo. Cuando sea real debe leer solo a quienes tienen el consentimiento 4. |
| **W04** | Publicar evento | 🟡 | Datos de ejemplo. |
| **W05** | Participación por taller | 🟡 | Datos de ejemplo. |
| **W06** | Configuración | 🟡 | Datos de ejemplo. |

## 3. Infraestructura

| Pieza | Estado | Observaciones |
|---|:---:|---|
| Migraciones 001–012 | 🔵 | Probadas en Postgres en memoria (`npm run test:sql`, 114 comprobaciones). **En producción solo están 001–003**: hay que aplicar 009–012 (ver `GUIA_PILOTO.md`). |
| Correo con el código (Gmail SMTP, `kampuz.app.pe@gmail.com`) | 🔴 | Pendiente de configurar en Supabase (sección 0.2 de `GUIA_PILOTO.md`). Límite aproximado de 500 correos al día. |
| APK debug (GitHub Actions) | 🔵 | El workflow era inválido (`secrets` en un `if`); corregido. Falla con un mensaje claro si faltan los secretos. |
| AAB firmado para Play Store | 🔵 | Falla si falta el keystore (antes generaba un .aab sin firmar). |
| Prueba de dos dispositivos | 🔵 | `npm run test:e2e`, pendiente de correr con dos cuentas reales. |
| Datos locales | 🟢 | Ya no se guardan usuarios, contraseñas, OTP, solicitudes ni mensajes en el dispositivo; al abrir la app se borran los que dejaron versiones anteriores. |
