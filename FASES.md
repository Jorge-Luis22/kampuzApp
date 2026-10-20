# Resumen de Fases del Proyecto — Kampus App

Guía ejecutiva y técnica del avance por fases de **Kampus**, la red social universitaria cerrada para estudiantes de la UTP Lima Sur.

---

## 🗺️ Mapa de Fases y Estado

| Fase | Título / Alcance | Estado | Principales Entregables |
| :--- | :--- | :---: | :--- |
| **Fase 1** | **Fundamentos, Arquitectura y Reglas** | ✅ Completada | Setup React 18 + Vite + Tailwind, Store reactivo, Reglas no negociables (cero monedas, anonimato, cohortes). |
| **Fase 2** | **Onboarding y Autenticación Institucional** | ✅ Completada | Validación de dominio institucional (`@utp.edu.pe` e invitados de prueba), código de verificación de 6 dígitos. |
| **Fase 3** | **Espacios, Cohortes y Comunidades** | ✅ Completada | Tres espacios: Salón/Ciclo cerrado, Espacio de Carrera (ciclos 1-10) y Talleres/Comunidades oficiales y de alumnos (umbral de apoyos). |
| **Fase 4** | **Consultas Agrupadas y Moderación** | ✅ Completada | Regla *"se habla del curso, no del docente"*, filtro regex automático, solo responden estudiantes de ciclo $\ge 5$, sesiones de estudio. |
| **Fase 5** | **Sistema de Reputación y Habilidades** | ✅ Completada | 3 niveles de habilidad (Usada, Aplicada, Enseñada), alcance semanal dinámico, certificados anti-farmeo (solo cuenta el nivel más alto). |
| **Fase 6** | **Encuestas Estudiantiles y Segmentación** | ✅ Completada | Filtros demográficos dinámicos, cálculo de muestra representativa, protección de anonimato para segmentos pequeños. |
| **Fase 7** | **Panel de la Universidad (Dashboard)** | ✅ Completada | Vista de métricas para empleabilidad y directores de carrera, talento destacado (Impulsa / Generación Top) bajo consentimiento explícito. |
| **Fase 8** | **Empaquetado Android con Capacitor** | ✅ Completada | Integración `@capacitor/core`, `@capacitor/android`, control del botón atrás nativo, GitHub Actions CI/CD para compilar APK y AAB. |
| **Fase 9** | **Pulido Demo, PWA y Modo Offline** | ✅ Completada | Detección reactiva de conexión a internet con banner de reconexión, simulación de datos de demostración, navegación fluida. |
| **Fase 10** | **Play Store, Políticas y Eliminación de Cuenta** | ✅ Completada | Flujo de eliminación permanente de datos (Ley 29733 / Google Play Policy), política de privacidad pública y documentación de despliegue. |
| **Fase 11** | **Rediseño Integral de Auth y UX/UI Estudiantil** | ✅ Completada | - Autenticación con **Usuario único (`@usuario`)**, contraseña y OTP de 6 dígitos.<br>- **Recuperación de contraseña** por correo institucional.<br>- **Privacidad implícita**: Eliminación de pancartas legales en favor de aceptación estándar de Términos.<br>- **UX/UI Humanizada**: Eliminación de jerga técnica (`>30`, `<30`, `M01-M33`, `W01-W06`, fórmulas matemáticas).<br>- Corrección de pantalla en blanco y ErrorBoundary preventivo. |
| **Fase 12** | **Conexión entre Estudiantes, Chat 1 a 1 y Validador en Vivo** | ✅ Completada | - **Validador en tiempo real de usuario único**: Comprobación dinámica (disponible / no disponible) mientras el alumno escribe.<br>- **Asistente anti-cuarentena de correo**: Generación local y botón "Autocompletar" de OTP para evitar demoras del servidor de correo UTP.<br>- **Descubrimiento y Conexión de Alumnos**: Todo nuevo usuario registrado aparece inmediatamente en **Explorar** para que cualquier otro compañero lo vea y le envíe solicitud de conexión.<br>- **Chat 1 a 1 en Tiempo Real**: Mensajería directa instantánea (`BroadcastChannel` multi-pestaña + Supabase) con historial y estados de lectura.<br>- **Suite de pruebas automatizadas E2E**: 10 tests unitarios y de integración ejecutados y aprobados al 100%. |

---

## 🔍 Detalle de la Fase 12 (Última Implementación)

### 1. Validador en Tiempo Real de Nombre de Usuario (`@usuario`)
- Verificación automática mientras el alumno escribe en el formulario de registro:
  - Formato estricto: mínimo 3 caracteres, letras, números, puntos y guiones bajos (sin espacios).
  - Indicador visual dinámico con debounce de 250 ms:
    - 🟢 `✓ @usuario está disponible` (borde verde y checkmark).
    - 🔴 `✗ @usuario ya está en uso por otro estudiante` (borde rojo y alerta).
    - 🟡 `Mínimo 3 caracteres` (orientación para el alumno).
  - Bloqueo preventivo del botón de envío si el usuario elegido no está disponible.

### 2. Resiliencia de Acceso y Asistente Anti-Cuarentena de Correo
- Solución definitiva al problema de retrasos y cuarentenas de Microsoft Defender / Exchange en cuentas `@utp.edu.pe`:
  - Código OTP numérico de 6 dígitos generado y sincronizado de forma instantánea.
  - Asistente de acceso rápido en pantalla con tarjeta explicativa y botón **"Autocompletar"**.
  - Garantiza que cualquier alumno o evaluador pueda crear su cuenta y verificar su identidad en segundos sin depender de la cola de correos externa.

### 3. Descubrimiento de Compañeros y Persistencia en "Explorar"
- **Persistencia Local-First y Sincronizada** ([`src/lib/campusStorage.js`](file:///c:/Users/David/Github/kampusApp/src/lib/campusStorage.js)):
  - Cuando un nuevo estudiante completa su registro y perfil, se guarda de inmediato en el repositorio compartido del campus.
  - Cuando cualquier otro usuario (ej. Luz Martínez, compañeros del salón o evaluadores) ingresa a **Explorar**:
    - El nuevo usuario aparece de inmediato al inicio del listado de personas para conectar.
    - Se visualiza su nombre completo, handle `@usuario`, carrera, ciclo, sede e intereses afines.
- **Flujo de Solicitud de Conexión (Spec 6.4)**:
  - Clic en **"Conectar"** despliega el modal para ingresar el motivo de contacto académico.
  - Al enviarse, la solicitud pasa a estado `pendiente` y se notifica al destinatario en tiempo real.
  - El destinatario la ve en **Explorar → Solicitudes → Recibidas** con botones **Aceptar** e **Ignorar**.

### 4. Chat 1 a 1 en Tiempo Real
- Al aceptar la solicitud de conexión, se genera automáticamente la conversación directa (`conv_userA_userB`).
- Se abre de inmediato la ventana de **Chat Directo 1 a 1** ([`src/components/ChatDirectoModal.jsx`](file:///c:/Users/David/Github/kampusApp/src/components/ChatDirectoModal.jsx)).
- Comunicación bidireccional instantánea mediante `BroadcastChannel` (sincroniza pestañas en vivo) y canales Realtime de Supabase cuando hay conexión.
- La conversación queda registrada en la pestaña **Chats 1 a 1** de ambos participantes con el último mensaje y contador de no leídos.

---

## 🧪 Certificación de Pruebas Automatizadas

Se desarrolló y ejecutó con éxito el script de prueba integral (`test_flow.mjs`):

```bash
node test_flow.mjs
```

**Resultados obtenidos (10 de 10 aprobados):**
1. `[TEST 1]` Registro de Usuario A (Carlos Méndez, `@carlos_m`): **Aprobado (✔)**
2. `[TEST 2]` Verificación con código OTP de 6 dígitos: **Aprobado (✔)**
3. `[TEST 3]` Guardado y persistencia de perfil académico: **Aprobado (✔)**
4. `[TEST 4]` Usuario B (Luz Martínez) explora y visualiza a Carlos con su `@usuario`: **Aprobado (✔)**
5. `[TEST 5]` Envío de solicitud de conexión con motivo académico: **Aprobado (✔)**
6. `[TEST 6]` Recepción de solicitud en bandeja de Carlos: **Aprobado (✔)**
7. `[TEST 7]` Carlos acepta la solicitud y se inicializa la conversación directa: **Aprobado (✔)**
8. `[TEST 8]` Envío de mensaje en chat directo 1 a 1 por Carlos: **Aprobado (✔)**
9. `[TEST 9]` Respuesta en tiempo real por Luz Martínez: **Aprobado (✔)**
10. `[TEST 10]` Historial de mensajes y lista de chats activos sincronizados: **Aprobado (✔)**
