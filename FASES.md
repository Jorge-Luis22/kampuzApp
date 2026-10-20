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
| **Fase 11** | **Rediseño Integral de Auth y Pulido UX/UI Estudiantil** | ✅ Completada | - Autenticación con **Usuario único (`@usuario`)**, contraseña y OTP de 6 dígitos.<br>- **Recuperación de contraseña** por correo institucional.<br>- **Privacidad implícita**: Eliminación de pancartas legales en favor de aceptación estándar de Términos.<br>- **UX/UI Humanizada**: Eliminación de jerga técnica (`>30`, `<30`, `M01-M33`, `W01-W06`, fórmulas matemáticas).<br>- Corrección de errores de cierre de sesión y pantalla en blanco. |

---

## 🔍 Detalle de la Fase 11 (Última Implementación)

### 1. Sistema de Cuentas y Acceso Estudiantil
- **Registro de Nueva Cuenta**:
  - Nombre y apellido completos.
  - Nombre de usuario único (formato `@usuario`, alfanumérico con guiones bajos o puntos).
  - Correo institucional UTP (`@utp.edu.pe` o correos de prueba invitados).
  - Carrera universitaria y ciclo de inicio.
  - Contraseña segura (mínimo 6 caracteres).
  - Código OTP de verificación de **6 dígitos** enviado por correo.
- **Inicio de Sesión Flexible**:
  - Permite ingresar directamente con el **nombre de usuario** (`@usuario` o `usuario`) o con el correo institucional UTP.
  - Validación de contraseña con retroalimentación clara.
- **Recuperación de Contraseña**:
  - Flujo dedicado *"¿Olvidaste tu contraseña?"*.
  - Envío de código de restablecimiento de 6 dígitos al correo registrado.
  - Ingreso de nueva contraseña con confirmación.

### 2. Privacidad de Datos Implícita (Ley 29733)
- Se eliminaron los textos legales invasivos de la pantalla principal y del onboarding.
- El consentimiento legal de la Ley 29733 ahora se formaliza de manera moderna e implícita mediante la casilla de aceptación: *"Acepto los Términos de Servicio y la Política de Privacidad de Datos (Ley N° 29733)"*.
- En la sección **Perfil**, la pestaña se renombró a *"Preferencias y Privacidad"*, ofreciendo selectores limpios para:
  - Participación en encuestas anónimas.
  - Aporte a estadísticas comunitarias agregadas.
  - Compartición con programas de empleabilidad (Impulsa / Generación Top).
  - Zona de eliminación total de cuenta.

### 3. Humanización del Lenguaje y UX/UI
- **Encuestas**: Se sustituyó el mensaje de fórmula `<30` por un aviso amigable y claro: *"Aún faltan respuestas para mostrar resultados representativos y proteger el anonimato de tus compañeros."*
- **Grupos y Comunidades**: Se reemplazó el cálculo de umbral técnico por una barra de progreso motivacional: *"x compañeros apoyaron esta iniciativa. ¡Casi lista para abrirse a todos!"*
- **Interfaz y Header**: Se removieron etiquetas de desarrollo (`M01-M33`, `W01-W06`, `Flujo 1`, etc.), priorizando una experiencia 100% enfocada en el alumno.

### 4. Estabilidad y Corrección de Bugs
- **Cierre de sesión seguro**: Manejo controlado de estado `null` en el almacenamiento local y en el contenedor `PhoneShell`.
- **Corrección de pantalla en blanco**: Manejo seguro del listado de carreras (`CARRERAS_UTP`) y renderizado por defecto de la pantalla de bienvenida / login.
