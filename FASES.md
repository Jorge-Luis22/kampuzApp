# Resumen de Fases del Proyecto — Kampuz

Avance por fases de **Kampuz**, la red social universitaria cerrada para estudiantes de la UTP.

> **Corrección (auditoría del 2026-10-20).** La versión anterior de este archivo marcaba todas las fases como "✅ Completada" e incluía una "certificación de pruebas 10/10". Esas pruebas corrían con un solo almacenamiento compartido en un mismo navegador: no probaban que dos personas en dos celulares se vieran. El detalle de qué estaba mal y qué se corrigió está en la **Fase 14**. El estado pantalla por pantalla está en `docs/ESTADO_MVP.md`.

**Leyenda:** 🔵 implementado contra Supabase con reglas en el servidor, **falta verificar en dos dispositivos** · 🟡 demo a propósito · ⚠️ parcial · ❌ revertido.

---

## 🗺️ Mapa de fases y estado real

| Fase | Alcance | Estado real | Notas de la auditoría |
| :--- | :--- | :---: | :--- |
| **0** | Línea base (npm, sin gh-pages ni pnpm) | 🔵 | No se había hecho: quedaban `gh-pages` y los archivos de pnpm. Corregido. |
| **1** | Supabase, esquema, RLS, Storage, seed | ⚠️ → 🔵 | En producción solo están 001–003. La 006 fallaba en una base nueva. Varias políticas dejaban saltarse las reglas y dos se referenciaban entre sí (recursión infinita en encuestas). Corregido en 009–012; falta aplicarlas en Supabase. |
| **2** | Registro y login con código de 6 dígitos | ❌ → 🔵 | El código se generaba en el cliente y se aceptaba cualquier número de 6 dígitos. Reescrito con Supabase Auth. |
| **3** | Perfil, foto y habilidades | ⚠️ → 🔵 | El perfil no llegaba a la base (columna `usuario` inexistente y error tragado); la foto caía a base64. Corregido. |
| **4** | Explorar, solicitudes y chat 1 a 1 | ❌ → 🔵 | Funcionaba solo con localStorage + BroadcastChannel (misma máquina). Reescrito sobre Supabase + Realtime. |
| **5** | Espacios, talleres, chat grupal, propuestas | ⚠️ → 🔵 | Mezclaba espacios inventados; se podía entrar a grupos de otra carrera y el creador podía hacer visible su propuesta. Corregido. |
| **6** | Encuestas con filtro | ⚠️ → 🔵 | La bandeja fallaba siempre (recursión de RLS); se podía marcar "respondida" sin responder; el autor veía quién respondió. Corregido. |
| **7** | Consultas agrupadas y estrellas | ❌ → 🔵 | No funcionaba (columnas inexistentes). Reimplementado en el servidor. |
| **8** | APK con Capacitor y GitHub Actions | ⚠️ → 🔵 | El workflow usaba `secrets` en un `if` (inválido). Corregido. |
| **9** | Pulido, estados vacíos, guía del piloto | ⚠️ → 🔵 | Los estados vacíos se tapaban con datos de ejemplo. Ahora hay estados vacíos y errores con "Reintentar". |
| **10** | Listo para Play Store | ⚠️ | Eliminar cuenta corregido (fallaba en silencio). El .aab ya no sale sin firmar. La cuenta de revisión es una cuenta verificada con contraseña. Falta crear el keystore y la cuenta de Play Console. |
| **11** | Rediseño de auth y UX | ⚠️ | Se mantiene el login con @usuario y contraseña. Se revirtió la "privacidad implícita" (casilla única de Términos marcada por defecto), que incumplía la spec 6.8. |
| **12** | Validador de @usuario, "anti-cuarentena", conexión y chat | ❌ | Ver Fase 14: el "asistente anti-cuarentena" saltaba la verificación y el chat era local. |
| **13** | UUID, jerga, grilla 2x2, estado en vivo, enlaces | ⚠️ | Se mantienen la grilla, la limpieza de jerga y los enlaces (ahora guardados en Supabase). El "estado en vivo" ahora es opcional y empieza en "Sin estado" (ver `docs/DECISIONES.md` 4.1). Se quitó el respaldo de foto en base64. |
| **14** | **Auditoría y corrección final** | 🔵 | Ver detalle abajo. |
| W | Panel de la universidad (W01–W06) | 🟡 | Datos de ejemplo por decisión del MVP. |

---

## 🔍 Fase 14 — Auditoría y corrección final

Instrucciones: `docs/PROMPT_CLAUDE_CODE_AUDITORIA.md`. Un commit por paso.

### Qué estaba mal
1. **Dos personas en dos celulares no se veían.** Usuarios, solicitudes, conversaciones y mensajes vivían en localStorage y se "sincronizaban" con BroadcastChannel, que solo comunica pestañas del mismo navegador.
2. **La app fingía éxito.** Timeouts de 1.6–2.5 s y, si Supabase tardaba o fallaba, seguía en modo local sin avisar. Los inserts fallaban por RLS y el error se tragaba.
3. **La identidad verificada no existía.** Cualquier número de 6 dígitos (y `123456`) servía; el código se mostraba en pantalla con "Autocompletar"; correos de prueba como `test@gmail.com` estaban en el código; contraseñas en texto plano en el teléfono y login local con cualquier contraseña.
4. **Ley 29733:** una sola casilla marcada por defecto en vez de los 4 consentimientos separados; los consentimientos del perfil estaban fijos en el código.
5. **Build:** workflow de Android inválido; restos de gh-pages y pnpm.
6. **Base de datos:** solo 001–003 aplicadas en producción; 006 fallaba; recursión de RLS en encuestas; atajos que permitían subir de nivel sin responder encuestas, orientar sin el ciclo requerido, valorar sin ser autor, escalar el rol a moderador o crear chats sin solicitud.

### Qué se cambió
- `campusStorage.js` eliminado. Toda la capa de datos lee y escribe solo en Supabase con la sesión real, con timeout de 15 s, estados de carga y errores en español con "Reintentar".
- Auth real (registro, código del correo, login con @usuario o correo, recuperación). Dominio validado solo en el servidor.
- 4 consentimientos separados (M05 y M32) con historial demostrable.
- Migraciones 009–012 con las reglas en el servidor y 109 comprobaciones automáticas (`npm run test:sql`).
- Chat sin duplicados (id temporal reemplazado por el del servidor), Realtime en mensajes, mensajes de grupo y solicitudes.
- Prueba de dos dispositivos con Playwright (`npm run test:e2e`).

### Qué falta para dar el MVP por cerrado
1. Aplicar 009–012 en Supabase y configurar Resend + plantillas (`docs/GUIA_PILOTO.md`, sección 0).
2. Crear dos cuentas de prueba y correr `npm run test:e2e` hasta que pase.
3. Probar con dos celulares reales (APK) los escenarios de `docs/GUIA_PILOTO.md`.
4. Pendientes de producto: M17 (solicitud de publicación), M18 (eventos), panel W con datos reales, moderadores por espacio, egresados (ver `docs/DECISIONES.md`).
