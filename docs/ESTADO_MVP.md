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
| **M07** | Explorar (Buscador y filtros) | 🟡 Demo | 🟢 Real | Filtrará perfiles y grupos reales de la DB excluyéndose a sí mismo. |
| **M08** | Perfil de otro alumno + Solicitud | 🟡 Demo | 🟢 Real | Enviar solicitud de mensaje con motivo. |
| **M09** | Solicitudes recibidas y enviadas | 🟡 Demo | 🟢 Real | Bandeja de solicitudes de contacto. |
| **M10** | Conversación directa 1 a 1 | 🟡 Demo | 🟢 Real | Debe soportar Realtime, envío optimista y autoscroll. |
| **M11** | Grupos: Espacios del alumno | 🟡 Demo | 🟢 Real | Auto-asignación a carrera y ciclo, más talleres. |
| **M12** | Espacio de carrera (Consultas) | 🟡 Demo | 🟢 Real | Cruce de ciclos 1 al 10 para dudas académicas. |
| **M13** | Subgrupo de ciclo (Chat cohorte) | 🟡 Demo | 🟢 Real | Chat grupal en tiempo real de la cohorte. |
| **M14** | Detalle grupo interés / taller | 🟡 Demo | 🟢 Real | Info de taller oficial con horarios y enlaces UTP. |
| **M15** | Chat de grupo general | 🟡 Demo | 🟢 Real | Mensajería de grupo en tiempo real. |
| **M16** | Proponer un grupo (apoyos) | 🟡 Demo | 🟢 Real | Umbral dinámico con visibilidad automática. |
| **M17** | Solicitud de publicación ajena | 🟡 Demo | 🟢 Real | Publicación moderada en espacio externo. |
| **M18** | Eventos del grupo | 🟡 Demo | 🟢 Real | Listado y creación de eventos locales del grupo. |
| **M19** | Hacer una consulta académica | 🟡 Demo | 🟢 Real | Moderación en cliente y servidor (*"Se habla del curso..."*). |
| **M20** | Consultas agrupadas (vista ciclos > 4) | 🟡 Demo | 🟢 Real | Solo visible/respondible por ciclo $\ge 5$ mayor al autor. |
| **M21** | Responder consulta | 🟡 Demo | 🟢 Real | Acumula estrellas pendientes. |
| **M22** | Valorar respuesta recibida | 🟡 Demo | 🟢 Real | Solo el autor valida para acreditar estrellas (anti-gaming). |
| **M23** | Bandeja de encuestas + alcance | 🟡 Demo | 🟢 Real | Muestra encuestas asignadas y alcance semanal según nivel. |
| **M24** | Crear encuesta: Filtro en vivo | 🟡 Demo | 🟢 Real | Contador de alcance reactivo vía RPC. |
| **M25** | Crear encuesta: Estado bloqueado (<30) | 🟡 Demo | 🟢 Real | Pantalla propia que exige ampliar segmento. |
| **M26** | Redactar preguntas de encuesta | 🟡 Demo | 🟢 Real | Creación de preguntas tipo única/múltiple/abierta. |
| **M27** | Responder encuesta (1 pregunta/pantalla)| 🟡 Demo | 🟢 Real | Flujo paso a paso para responder. Alimenta Apoyo Inv. |
| **M28** | Resultados agregados de encuesta | 🟡 Demo | 🟢 Real | Vistas agregadas vía RPC sin exponer identidad de votantes. |
| **M29** | Mi perfil (Habilidades y hechos) | 🟡 Demo | 🟢 Real | Cálculo derivado de hechos; no vacío para alumnos nuevos. |
| **M30** | Detalle de habilidad y meta | 🟡 Demo | 🟢 Real | Muestra qué falta para el siguiente nivel. |
| **M31** | Agregar certificado | 🟡 Demo | 🟢 Real | Clasificación automática básica/media/avanzada. |
| **M32** | Privacidad y revocación de consent. | 🟡 Demo | 🟢 Real | Revocación persistente de cada finalidad. |
| **M33** | Centro de seguridad (reportar/bloquear) | 🟡 Demo | 🟢 Real | Flujo de reporte de contenido y usuarios. |

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

## 3. Resumen de la Línea Base (Fase 0)
- **Compilación actual:** `npm run build` ejecutado exitosamente sin advertencias críticas.
- **Componentes React:** Vistas completas existentes en `src/views/` con lógica en `src/data/store.jsx`.
- **Siguiente paso:** Fase 1 (Configuración de Supabase, esquemas DDL con RLS, RPCs, Storage y Seeds).
