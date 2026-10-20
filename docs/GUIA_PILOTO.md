# Guía del Piloto Estudiantil — Kampuz MVP

Guía paso a paso para coordinar la prueba piloto con **10 estudiantes universitarios**, validar la experiencia de usuario y registrar incidentes de forma estructurada.

---

## 1. Objetivo del Piloto

Validar en condiciones reales de campus el flujo completo de Kampuz:
1. Registro seguro con correo institucional (`@utp.edu.pe`) o invitado mediante código OTP de 6 dígitos.
2. Interacción 1 a 1 entre compañeros de diferentes ciclos mediante solicitudes con motivo académico.
3. Mensajería grupal en tiempo real en los espacios de carrera, ciclo y talleres.
4. Resolución de dudas con moderación docente y acreditación de estrellas.
5. Participación en encuestas disociadas bajo umbral de privacidad (Ley 29733).

---

## 2. Preparación y Acceso para los 10 Testers

### A. Si tienen correo `@utp.edu.pe`:
- Los estudiantes pueden ingresar directamente con su correo institucional.
- Recibirán el código de verificación de 6 dígitos en su bandeja de entrada (o en la carpeta *Correo no deseado* / *Cuarentena* si su organización tiene filtros estrictos de Microsoft 365 Defender).

### B. Si tienen correos externos (Gmail, Hotmail, etc.) o testers invitados:
1. Ingresa al panel de Supabase → **Table Editor** → tabla `correos_invitados`.
2. Inserta una fila por cada tester con:
   - `email`: `ejemplo@gmail.com`
   - `motivo`: `Tester piloto 1`
   - `activo`: `true`
3. Con esto, el sistema les permitirá solicitar y recibir el OTP sin ser rechazados por el filtro de dominio.

### C. Distribución de la Aplicación
1. **APK Android:**
   - Descargar el archivo `kampuz.apk` generado en los artefactos de GitHub Actions del repositorio.
   - Enviar el archivo APK a los testers por WhatsApp / Drive.
   - Indicar que habiliten *"Permitir instalación de apps de fuentes desconocidas"* en Ajustes de Android.
2. **Acceso Web Móvil (Alternativa):**
   - Abrir el enlace en Chrome / Safari móvil: `https://kampuz.vercel.app/`
   - Se recomienda presionar *"Agregar a la pantalla principal"* para usarla como PWA.

---

## 3. Matriz de Pruebas: Escenarios a Ejecutar

Pide a los 10 testers que se dividan en parejas o grupos para completar los siguientes 6 escenarios:

| Escenario | Pantallas | Tarea del Tester | Criterio de Éxito |
|---|---|---|---|
| **1. Registro y Perfil** | M01–M05 | 1. Ingresar correo.<br>2. Digitar código OTP de 6 dígitos.<br>3. Subir foto de perfil (se recortará cuadrada y optimizada a <300 KB).<br>4. Elegir carrera, ciclo, campus y al menos 2 intereses.<br>5. Aceptar C1 obligatorio y revisar C2–C4. | El alumno ingresa al Inicio y aparece su nombre y carrera en la cabecera. |
| **2. Conectar y Chatear 1 a 1** | M07–M10 | 1. Ir a la pestaña **Explorar**.<br>2. Buscar a otro tester.<br>3. Enviar solicitud de conexión ingresando un motivo académico obligatorio.<br>4. El otro tester va a la subpestaña **Solicitudes** y la acepta.<br>5. Ambos abren el chat 1 a 1 y envían mensajes. | Mensajes aparecen instantáneamente para ambos sin recargar la pantalla. Check de leído y scroll automático. |
| **3. Grupos y Talleres** | M11–M16 | 1. Ir a la pestaña **Grupos**.<br>2. Comprobar que ya pertenecen al espacio de su carrera y al grupo de su ciclo.<br>3. Escribir un mensaje en el chat del ciclo.<br>4. Explorar los talleres extracurriculares oficiales (Futsal, Lettering, IA aplicada) y hacer clic en *"Unirse"*.<br>5. Crear una propuesta de grupo nuevo y ver cómo calcula el umbral de apoyos necesarios. | El mensaje grupal llega en tiempo real a los demás del ciclo. El botón del taller cambia a *"Miembro"*. |
| **4. Consultas y Estrellas** | M19–M22 | 1. Un alumno de ciclo menor crea una consulta de un curso.<br>2. Probar escribir el nombre de un profesor con un insulto (debe bloquearlo el filtro de moderación: *"Se habla del curso, no de la persona"*).<br>3. Redactar una duda académica real.<br>4. Un alumno de ciclo 5 o superior responde.<br>5. El autor valida la respuesta con *"Me sirvió"*. | El filtro bloquea las faltas de respeto. Al validar la respuesta, se acreditan las estrellas al orientador. |
| **5. Encuestas Estudiantiles** | M23–M28 | 1. Responder encuestas activas una por una.<br>2. Ver cómo sube el nivel de habilidad *"Apoyo a la investigación"*.<br>3. Intentar crear una encuesta segmentando a menos de 30 personas.<br>4. Crear una con segmento mayor a 30 y revisar los resultados agregados. | El sistema bloquea encuestas con alcance menor a 30 (Ley 29733). Al responder, no se expone quién votó qué. |
| **6. Privacidad y Modo Offline** | M29–M32 | 1. Ir a **Perfil** → **Privacidad**.<br>2. Revocar el consentimiento de analíticas (C2) y verificar que guarde el cambio con fecha.<br>3. Poner el celular en Modo Avión.<br>4. Quitar el Modo Avión. | Aparece el banner amarillo *"Sin conexión a internet"*. Al reconectar, desaparece automáticamente. |

---

## 4. Cómo Reportar Fallas y Feedback

Para que el equipo de desarrollo pueda solucionar cualquier inconveniente rápidamente, pide a los testers enviar sus observaciones por WhatsApp o formulario con el siguiente formato:

```text
[REPORTE DE PILOTO]
- Nombre / Correo del Tester:
- Modelo de Celular y Versión de Android: (ej. Samsung A52, Android 13)
- Pantalla donde ocurrió: (ej. M10 Chat Directo)
- ¿Qué estabas intentando hacer?:
- ¿Qué pasó?: (ej. Mensaje de error, pantalla en blanco, botón no responde)
- Captura de pantalla o video corto adjunto:
```

### Canales de Soporte Inmediato
- **Chat de WhatsApp del Piloto:** Grupo creado con los 10 alumnos seleccionados.
- **Canal de Issues en GitHub:** Para el equipo técnico con etiquetas `bug`, `ux`, `piloto`.
