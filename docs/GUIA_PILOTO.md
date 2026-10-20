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

### 0. Configuración del correo (una sola vez, antes del piloto)

El registro funciona así: el alumno crea su cuenta con correo, contraseña y @usuario; Supabase le envía un **código de 6 dígitos** a su correo; lo escribe en la app y recién ahí entra. **No existe ningún atajo** que salte esa verificación: es lo que garantiza que al otro lado hay un alumno real de la UTP.

1. **Supabase → Authentication → Sign In / Providers → Email:** deja activado **"Confirm email"**. Si está apagado, cualquiera podría registrarse con un correo ajeno sin verificarlo.
2. **SMTP propio con Resend** (el SMTP de prueba de Supabase solo envía unos pocos correos por hora y suele caer en spam):
   - En resend.com, crea la cuenta y **verifica un dominio propio** (Domains → Add domain, y copia los registros DNS SPF/DKIM que te muestra en el proveedor del dominio). Sin dominio verificado, Outlook de la UTP tiende a mandar el correo a cuarentena.
   - Crea una API key en Resend.
   - Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key, remitente `no-responder@tu-dominio` con nombre "Kampuz".
3. **Plantillas en español con el código** (Authentication → Emails → Templates). Cada plantilla debe mostrar `{{ .Token }}` (el código de 6 dígitos), no el enlace:
   - **Confirm signup** — asunto: `Tu código de Kampuz`; cuerpo: `Tu código para verificar tu correo en Kampuz es: <h2>{{ .Token }}</h2> Vence en 1 hora. Si no fuiste tú, ignora este correo.`
   - **Reset Password** — asunto: `Código para cambiar tu contraseña de Kampuz`; cuerpo: `Usa este código para elegir una nueva contraseña: <h2>{{ .Token }}</h2> Si no lo pediste, ignora este correo.`
4. Authentication → **Rate Limits**: sube "Emails sent per hour" a 30 o más para el piloto (con SMTP propio está permitido).

### A. Si tienen correo `@utp.edu.pe`:
- Los estudiantes se registran directamente con su correo institucional.
- El código llega a su bandeja. **Los servidores de la UTP (Microsoft 365 / Defender) a veces lo retienen unos minutos o lo mandan a *Correo no deseado* o a *Cuarentena*.** La solución es la del punto 0 (SMTP con dominio verificado en Resend). Durante el piloto, pide a los testers que revisen esas dos carpetas antes de pedir otro código (el botón "Reenviar" se habilita a los 60 segundos).
- Si un correo queda en cuarentena: en Outlook web, **Seguridad → Cuarentena** (o el enlace del aviso de cuarentena que manda la UTP) → **Liberar**.

### B. Si tienen correos externos (Gmail, Hotmail, etc.) o testers invitados:
1. Supabase → **SQL Editor** (o Table Editor → tabla `correos_invitados`).
2. Agrega una fila por cada tester:
   ```sql
   insert into public.correos_invitados (correo, nombre_contacto, motivo, activo)
   values ('ejemplo@gmail.com', 'Nombre del tester', 'Tester piloto 1', true);
   ```
3. El servidor (trigger `trg_validar_auth_user`) solo deja crear cuentas con `@utp.edu.pe` o con un correo de esta tabla con `activo = true`. Para quitarle el acceso a alguien, pon `activo = false`.
4. La tabla no es visible desde la app: nadie puede listar los correos invitados.

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
