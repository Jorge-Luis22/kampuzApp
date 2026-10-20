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

### 2.1 Umbral Mínimo de Segmento para Encuestas (30 usuarios)
- **Regla:** El umbral por defecto es **30** (almacenado en la tabla `config` con clave `umbral_minimo_segmento`).
- **Consideración para Piloto:** Para un piloto de 10 alumnos reales, un umbral de 30 impedirá enviar encuestas con filtros estrechos en pruebas de laboratorio.
- **Decisión:** La regla de servidor se mantiene en 30 para respetar la especificación de anonimato bajo la Ley 29733. El valor se parametriza en la tabla `config` para que el equipo/Jorge decida si lo ajusta temporalmente a un valor menor (ej. 5) durante la sustentación en vivo.

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
