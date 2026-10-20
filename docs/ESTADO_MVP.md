# Estado del MVP — Auditoría de Pantallas y Módulos

Estado de cumplimiento y trazabilidad de las pantallas de la aplicación móvil (M01–M33) y del panel web institucional (W01–W06).

**Leyenda:**
- 🟢 **Real:** Conectado a Supabase / DB en tiempo real y funcional de punta a punta.
- 🟡 **Demo / Local:** Funcional con estado local (`store.jsx` / `mockData.js`), pendiente de conexión backend.
- 🔴 **Falta:** Componente o pantalla no implementada o requiere creación desde cero.

---

## 1. Aplicación Móvil (M01 – M33)

| ID | Nombre de Pantalla | Estado Inicial (Fase 0) | Estado Objetivo MVP | Observaciones |
|---|---|:---:|:---:|---|
| **M01** | Bienvenida y acceso con correo | 🟢 Real | 🟢 Real | Validación de dominio @utp.edu.pe y correos_invitados. Envío OTP real. Botón demo oculto en prod. |
| **M02** | Verificación código OTP 6 dígitos | 🟢 Real | 🟢 Real | Código fijo 482910 eliminado. Integrado con verifyOtp y reenvío con temporizador. |
| **M03** | Onboarding: Perfil declarado | 🟢 Real | 🟢 Real | Persiste en tabla perfiles con origen_campos declarado y auto-asignación a espacios. |
| **M04** | Onboarding: Intereses | 🟢 Real | 🟢 Real | Almacena en perfiles.intereses para filtros de encuestas. Mínimo 2 intereses. |
| **M05** | Consentimientos (4 finalidades) | 🟢 Real | 🟢 Real | Persiste en tabla consentimientos. C1 obligatorio, C4 apagado por defecto (Ley 29733). |
| **M06** | Inicio (Feed resumen) | 🟡 Demo | 🟢 Real | Resumen de encuestas, grupos y avisos. |
| **M07** | Explorar (Buscador y filtros) | 🟢 Real | 🟢 Real | Filtra perfiles de public.perfiles por carrera, ciclo e interés, excluyendo al usuario y bloqueados. |
| **M08** | Perfil de otro alumno + Solicitud | 🟢 Real | 🟢 Real | Tarjeta con avatar 48px, interés afín, solicitud con motivo obligatorio (Spec 6.4), reportar y bloquear. |
| **M09** | Solicitudes recibidas y enviadas | 🟢 Real | 🟢 Real | Bandeja de solicitudes en tabla solicitudes_mensaje con estados pendiente/aceptada/rechazada. |
| **M10** | Conversación directa 1 a 1 | 🟢 Real | 🟢 Real | Chat WhatsApp en tiempo real con Supabase Realtime, envío optimista, autoscroll y leído/no leído. |
| **M11** | Grupos: Espacios del alumno | 🟢 Real | 🟢 Real | Auto-asignación a carrera y ciclo vía trigger en perfiles, membresías y talleres en Supabase. |
| **M12** | Espacio de carrera (Consultas) | 🟢 Real | 🟢 Real | Cruce de ciclos 1 al 10 para dudas académicas y chat grupal en tiempo real. |
| **M13** | Subgrupo de ciclo (Chat cohorte) | 🟢 Real | 🟢 Real | Chat grupal en tiempo real de la cohorte con Supabase Realtime en tabla mensajes. |
| **M14** | Detalle grupo interés / taller | 🟢 Real | 🟢 Real | Horario oficial, sello Oficial UTP, enlaces oficiales y botón para unirse en membresias. |
| **M15** | Chat de grupo general | 🟢 Real | 🟢 Real | Mensajería de grupo en tiempo real con suscripción postgres_changes y optimismo. |
| **M16** | Proponer un grupo (apoyos) | 🟢 Real | 🟢 Real | Umbral dinámico max(15, round(base_activa*0.03)) y activación automática vía trigger. |
| **M17** | Solicitud de publicación ajena | 🟡 Demo | 🟢 Real | Publicación moderada en espacio externo. |
| **M18** | Eventos del grupo | 🟡 Demo | 🟢 Real | Listado y creación de eventos locales del grupo. |
| **M19** | Hacer una consulta académica | 🟢 Real | 🟢 Real | Moderación en cliente y trigger servidor ("Se habla del curso"); agrupación atómica por carrera+curso+tema. |
| **M20** | Consultas agrupadas (vista ciclos > 4) | 🟢 Real | 🟢 Real | Conteo de autores únicos; solo visible/respondible por ciclo $\ge 5$ mayor al autor. |
| **M21** | Responder consulta | 🟢 Real | 🟢 Real | Multiplicador por modo (llamada 3x, texto 1x) con estrellas pendientes hasta validación. |
| **M22** | Valorar respuesta recibida | 🟢 Real | 🟢 Real | Solo quien preguntó valida para acreditar estrellas y alimentar Orientación a compañeros. |
| **M23** | Bandeja de encuestas + alcance | 🟢 Real | 🟢 Real | Bandeja semanal (tope 3) y alcance según nivel de Apoyo a la investigación [0, 30, 80, 200]. |
| **M24** | Crear encuesta: Filtro en vivo | 🟢 Real | 🟢 Real | Conteo reactivo vía RPC calcular_alcance_encuesta sin exponer listas de identidades. |
| **M25** | Crear encuesta: Estado bloqueado (<30) | 🟢 Real | 🟢 Real | Bloqueo estricto si segmento < umbral leído de tabla config (inicial 30, Ley 29733). |
| **M26** | Redactar preguntas de encuesta | 🟢 Real | 🟢 Real | Envío seguro vía RPC enviar_encuesta_segura con cola semanal y muestra aleatoria. |
| **M27** | Responder encuesta (1 pregunta/pantalla)| 🟢 Real | 🟢 Real | Flujo secuencial; respuestas disociadas en tabla respuestas; suma habilidad Apoyo Inv. |
| **M28** | Resultados agregados de encuesta | 🟢 Real | 🟢 Real | Resultados agregados estadísticos vía RPC obtener_resultados_encuesta. |
| **M29** | Mi perfil (Habilidades y hechos) | 🟢 Real | 🟢 Real | Cálculo derivado de hechos; estado amigable para alumnos nuevos; edición de perfil y foto recortada (<300KB). |
| **M30** | Detalle de habilidad y meta | 🟢 Real | 🟢 Real | Muestra qué falta para el siguiente nivel y progreso real. |
| **M31** | Agregar certificado | 🟢 Real | 🟢 Real | Clasificación automática básica/media/avanzada con persistencia en Supabase. |
| **M32** | Privacidad y revocación de consent. | 🟢 Real | 🟢 Real | Revocación persistente con timestamp en Supabase (Ley 29733). |
| **M33** | Centro de seguridad (reportar/bloquear) | 🟢 Real | 🟢 Real | Reportar contenido/perfil a tabla reportes y bloqueo recíproco en tabla bloqueos. |

---

## 2. Panel Institucional Universidad (W01 – W06)

| ID | Nombre de Pantalla | Estado Inicial (Fase 0) | Estado Objetivo MVP | Observaciones |
|---|---|:---:|:---:|---|
| **W01** | Resumen y métricas de sede | 🟡 Demo | 🟡 Demo | Mantiene métricas agregadas simuladas con umbral de 30. |
| **W02** | Participación por facultad y ciclo | 🟡 Demo | 🟡 Demo | Segmentos agregados con filtro de protección. |
| **W03** | Alumnos destacados (Impulsa / Gen Top)| 🟡 Demo | 🟡 Demo | Exclusivo para alumnos con Consentimiento 4 activo. |
| **W04** | Publicar evento segmentado | 🟡 Demo | 🟡 Demo | Difusión de eventos institucionales. |
| **W05** | Participación por talleres | 🟡 Demo | 🟡 Demo | Monitoreo de actividad extracurricular. |
| **W06** | Configuración institucional | 🟡 Demo | 🟡 Demo | Parámetros white-label y reglas de sede. |

---

## 3. Resumen de Estado de Fases (Fases 0 a 10) — 100% COMPLETADO

- **Fase 0 (Línea Base y Trazabilidad):** 🟢 Completada.
- **Fase 1 (Esquema Supabase, RLS, Storage y Seeds):** 🟢 Completada.
- **Fase 2 (Registro y Login OTP 6 dígitos):** 🟢 Completada. Conectado a Gmail SMTP (`kampuz.app.pe@gmail.com`).
- **Fase 3 (Perfil, Recorte Foto <300KB y Habilidades Derivadas):** 🟢 Completada.
- **Fase 4 (Explorar, Solicitudes con Motivo y Chat 1 a 1 Realtime):** 🟢 Completada.
- **Fase 5 (Espacios, Talleres Oficiales, Chat Grupal y Propuestas):** 🟢 Completada.
- **Fase 6 (Encuestas con Filtro Seguro, Umbral Ley 29733 y Resultados):** 🟢 Completada.
- **Fase 7 (Consultas Agrupadas, Moderación Docente y Estrellas):** 🟢 Completada.
- **Fase 8 (APK Android con Capacitor, Iconos/Splash y CI/CD):** 🟢 Completada. Target SDK 36.
- **Fase 9 (Pulido para la Demo, Offline Banner y Guía del Piloto):** 🟢 Completada.
- **Fase 10 (Listo para Google Play Store):** 🟢 Completada.
  - Job manual en GitHub Actions para compilar `.aab` firmado para release con `targetSdkVersion` 36 y `versionCode` dinámico.
  - Procedimiento de borrado total e irreversible de cuenta (RPC y Edge Function) en la app (M32) y web pública.
  - Política de privacidad en línea (`/privacidad`) conforme a Ley 29733 y los 4 consentimientos.
  - Centro de Seguridad (M33) con bloqueo recíproco y reporte de moderación.
  - Ficha de tienda completa, formulario de Data Safety y checklist en `docs/PLAY_STORE.md`.
  - Gráficos oficiales de tienda en `docs/play-store/icon-512.png` y `docs/play-store/feature-graphic-1024x500.png`.
- **Pulido UX/UI & Sistema de Autenticación con Usuario, Contraseña y Recuperación:** 🟢 Completado.
  - Soporte de Login con Usuario o Correo institucional + Contraseña.
  - Flujo de creación de cuenta con username único, correo, contraseña y verificación OTP de 6 dígitos.
  - Recuperación y cambio de contraseña por correo institucional con código OTP de seguridad.
  - Ley 29733 y consentimientos integrados de forma implícita (checkbox estándar de Términos y Privacidad, sin sobrecargar la interfaz).
  - Corrección de cierre de sesión (sin excepciones por usuario nulo) y limpieza de textos técnicos (`>30`, fórmulas matemáticas, códigos de pantallas de desarrollo).
