# Guía de Publicación en Google Play Store — Kampuz

Documento técnico y operativo para preparar, compilar y publicar **Kampuz** en Google Play Store sin rehacer ninguna configuración de la aplicación.

---

## 1. Requisitos Técnicos y Versión de Android

- **Application ID:** `pe.kampuz.app`
- **Nombre de la aplicación:** Kampuz
- **`targetSdkVersion`:** **36** (Android 16) — Cumple con la exigencia obligatoria de Google Play a partir de agosto de 2026.
- **`compileSdkVersion`:** **36**
- **`minSdkVersion`:** **24** (Android 7.0 Nougat o superior, cubriendo >97% del parque de dispositivos).
- **Control de Versiones (`versionCode`):** Auto-incrementado en cada compilación de release en GitHub Actions mediante `${{ github.run_number }}`.

---

## 2. Generación del Keystore de Producción y Firma

> [!CAUTION]
> **ADVERTENCIA CRÍTICA:**  
> Si pierdes el archivo `release.keystore` o su contraseña, **nunca podrás volver a actualizar la aplicación en Google Play Store**.  
> Guarda una copia del keystore y de las contraseñas en un lugar seguro (gestor de contraseñas, almacenamiento cifrado fuera de este repositorio). **Nunca subas el archivo `.keystore` al repositorio git**.

### Paso 2.1: Crear el Keystore con `keytool`
Abre una terminal (PowerShell o bash) en tu computadora y ejecuta el siguiente comando:

```bash
keytool -genkey -v -keystore release.keystore -alias kampuz -keyalg RSA -keysize 2048 -validity 10000
```

Se te solicitarán los siguientes datos:
1. **Contraseña del almacén de claves (keystore):** Elige una contraseña segura (ej. 16+ caracteres) y guárdala.
2. **Nombre y apellido / Unidad organizativa / Organización / Ciudad / Provincia / Código de país (PE).**
3. Confirma con `sí` o `yes`.

### Paso 2.2: Convertir el Keystore a Base64
Para almacenar el archivo binario en los GitHub Secrets:

- **En Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Set-Clipboard
  ```
  *(La cadena base64 quedará copiada en tu portapapeles).*

- **En Linux / macOS:**
  ```bash
  base64 -w 0 release.keystore | pbcopy # en mac
  # o
  base64 -w 0 release.keystore > keystore_base64.txt
  ```

### Paso 2.3: Configurar GitHub Secrets
En tu repositorio de GitHub, dirígete a:  
**Settings → Secrets and variables → Actions → New repository secret** y crea las siguientes variables:

| Nombre del Secret | Descripción / Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Cadena en Base64 generada en el paso anterior. |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña que definiste al crear el keystore. |
| `ANDROID_KEY_ALIAS` | `kampuz` |
| `ANDROID_KEY_PASSWORD` | Misma contraseña del keystore (o la asignada al alias). |
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase (`https://xyz.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Llave anónima pública de Supabase (`eyJhbG...`). |

---

## 3. Generación del Paquete de Producción (.aab)

El flujo de GitHub Actions `.github/workflows/android.yml` está preparado para generar el Android App Bundle firmado:

1. Ve a la pestaña **Actions** en tu repositorio de GitHub.
2. En la barra lateral izquierda, selecciona el workflow **Build Android APK & AAB**.
3. Haz clic en el botón desplegable **Run workflow**:
   - Selecciona la rama: `main`
   - En **Objetivo de compilación**, elige: `aab_release`
4. Presiona el botón verde **Run workflow**.
5. Al finalizar (aprox. 3-4 minutos), descarga el artefacto **`kampuz-release.aab`** listo para subir a Google Play Console.

---

## 4. Ficha de Google Play Store (Metadatos)

### A. Título y Descripciones (Español)

- **Nombre de la aplicación (máx. 30 caracteres):**  
  `Kampuz`

- **Descripción corta (máx. 80 caracteres):**  
  `Conéctate con tu comunidad universitaria: dudas, talleres y apoyo académico.` *(76 caracteres)*

- **Descripción completa (máx. 4000 caracteres):**  
  ```text
  Kampuz es la plataforma de conexión, aprendizaje y colaboración exclusiva para la comunidad universitaria de campus.

  Diseñada para acompañarte a lo largo de tu vida estudiantil, Kampuz te permite colaborar con compañeros de tu carrera y sede de forma segura, privada y enfocada en el crecimiento académico.

  ¿Qué encontrarás en Kampuz?

  • CONSULTAS ACADÉMICAS MODERADAS:
  ¿Tienes dudas con un ejercicio o tema de tu curso? Publica consultas agrupadas por curso y tema. Alumnos de ciclos avanzados orientan las dudas de forma respetuosa con moderación comunitaria centrada en la materia y el respeto al docente.

  • ESPACIOS DE CARRERA Y CICLO:
  Asignación automática a comunidades de tu especialidad y grupos de cohorte. Coordina trabajos grupales, comparte materiales y mantente al día con lo que pasa en tu sede.

  • TALLERES Y ACTIVIDADES EXTRACURRICULARES:
  Descubre talleres oficiales (futsal, lettering, inteligencia artificial aplicada, habilidades blandas), consulta horarios verificados y únete en un solo toque.

  • INVESTIGACIÓN Y ENCUESTAS SEGURAS:
  Participa en encuestas académicas para proyectos de tesis y cursos de investigación bajo los más altos estándares de privacidad: resultados agrupados con umbral mínimo de protección y respuestas totalmente disociadas (Ley 29733).

  • PERFIL DE HABILIDADES VERIFICADAS:
  Desarrolla habilidades blandas y técnicas (orientación, constancia, liderazgo) respaldadas por evidencia real de tus aportes en la comunidad universitaria.

  • PRIVACIDAD Y SEGURIDAD PRIMERO:
  Control total de tus consentimientos, reporte confidencial de contenidos, bloqueo recíproco y opción de eliminación total e irreversible de cuenta y datos en cualquier momento.

  ¡Únete a Kampuz y transforma tu experiencia universitaria!
  ```

### B. Elementos Gráficos
Los archivos han sido generados conforme a las especificaciones exactas de Google Play y están guardados en la carpeta `docs/play-store/`:

1. **Ícono de la aplicación:** `docs/play-store/icon-512.png` (512 × 512 px, PNG de 32 bits, sin transparencia en bordes).
2. **Gráfico destacado:** `docs/play-store/feature-graphic-1024x500.png` (1024 × 500 px, PNG con identidad visual y tipografía legible).
3. **Capturas de pantalla sugeridas para el teléfono (mínimo 2, recomendado 6-8):**
   - Pantalla 1: Bienvenida e inicio de sesión con correo institucional (M01).
   - Pantalla 2: Explorador de compañeros con filtros de carrera y ciclo (M07).
   - Pantalla 3: Mensajería directa 1 a 1 en tiempo real con motivo de conexión (M10).
   - Pantalla 4: Espacio de carrera y talleres extracurriculares oficiales (M12/M14).
   - Pantalla 5: Dudas académicas agrupadas y sistema de estrellas por orientación (M20).
   - Pantalla 6: Creador y resultados de encuestas con umbral ético de protección (M24/M28).
   - Pantalla 7: Perfil de habilidades derivadas y evidencias de campus (M29).

---

## 5. Declaración de Seguridad de los Datos (Data Safety Form)

Completa las preguntas de la sección **Seguridad de los datos** en Google Play Console con las siguientes respuestas:

| Pregunta / Sección | Respuesta | Justificación técnica |
|---|---|---|
| **¿La app recopila o comparte datos de los usuarios?** | **Sí** | Se recopilan datos para funcionamiento de la cuenta y mensajería. |
| **¿Los datos recopilados se cifran en tránsito?** | **Sí** | Todo el tráfico viaja mediante HTTPS / TLS 1.3 hacia los servidores de Supabase. |
| **¿Ofreces un método para que los usuarios soliciten la eliminación de sus datos?** | **Sí** | - En la app: Perfil → Privacidad → Eliminar mi cuenta.<br>- En la web: `https://kampuz.vercel.app/eliminar-cuenta`. |
| **Datos personales recopilados:** | - Nombre<br>- Dirección de correo electrónico<br>- Carrera, ciclo, sede | Necesarios para autenticación y emparejamiento académico. |
| **Mensajes:** | - Correos o mensajes de texto (chats 1 a 1 y mensajes grupales) | Para la funcionalidad principal de mensajería entre compañeros. |
| **Fotos y videos:** | - Fotos (Avatar de perfil opcional) | Para personalizar el perfil de usuario. |
| **Información y rendimiento de la app:** | - Registros de fallos o métricas agregadas | Solo resúmenes estadísticos anónimos bajo umbral ≥ 30 alumnos. |
| **¿Se comparten datos con terceros?** | **No** | No se transfieren ni venden datos a anunciantes o terceros comerciales. Supabase actúa exclusivamente como procesador de infraestructura. |

---

## 6. Cuestionario de Clasificación de Contenido (IARC)

En la sección **Contenido de la app → Clasificación de contenido**:
- **Categoría:** *Aplicaciones de comunicación, foros o redes sociales estudiantiles*.
- **¿La aplicación permite que los usuarios interactúen o intercambien mensajes de texto con otros usuarios?**  
  **Sí.**
- **¿La app comparte la ubicación física del usuario con otros usuarios?**  
  **No** (solo se indica la sede del campus seleccionada).
- **¿La app incluye moderación de contenido y herramientas de seguridad?**  
  **Sí** (sistema de reporte formal en la app, bloqueo recíproco de usuarios y filtro de moderación que prohíbe el juicio o difamación de docentes/compañeros).

---

## 7. Cuenta de Prueba para el Equipo de Revisión de Google

Google Play exige que proporciones credenciales de acceso para que el revisor humano pruebe la aplicación si esta requiere login. El revisor no tiene correo `@utp.edu.pe` y **no existe ningún código de prueba ni atajo**: se le entrega una cuenta ya verificada con usuario y contraseña.

1. La cuenta de revisión es `kampuz.app.pe+revision@gmail.com`. Ya está en `supabase/seed.sql` dentro de `correos_invitados`. Gracias al alias "+" de Gmail, el código de verificación llega al buzón del equipo (`kampuz.app.pe@gmail.com`).
2. Desde la app, crea esa cuenta (Crear cuenta → correo de revisión → contraseña larga solo para Google), verifica el código que llega al buzón del equipo y completa el perfil (por ejemplo, Ingeniería de Sistemas, ciclo 6).
3. En Google Play Console: **Contenido de la app → Acceso a la app → Administrar**:
   - Selecciona: *"Todas las funciones o algunas de ellas están restringidas"*.
   - Agrega las instrucciones de inicio de sesión:
     - Nombre de la instrucción: `Cuenta de prueba para revisión`
     - Usuario / Correo: `kampuz.app.pe+revision@gmail.com`
     - Contraseña: la que elegiste en el paso 2.
     - Nota para el revisor: *"Abra la app, elija Iniciar sesión e ingrese este correo y contraseña. La cuenta ya está verificada; no se necesita ningún código."*
4. Cuando termine la revisión, puedes cambiar la contraseña o desactivar el correo (`update public.correos_invitados set activo = false where correo = 'kampuz.app.pe+revision@gmail.com';` solo impide crear cuentas nuevas; la existente sigue funcionando).

---

## 8. Checklist Obligatorio para el Desarrollador

Antes de enviar la app a revisión para producción, sigue este orden:

- [ ] **1. Cuenta de desarrollador de Google Play:**
  - Crea la cuenta en [Google Play Console](https://play.google.com/console).
  - Realiza el pago único de **US$ 25**.
  - Completa la verificación de identidad (DNI peruano y comprobación en un dispositivo físico Android).
- [ ] **2. Crear la aplicación en la consola:**
  - Nombre: `Kampuz`
  - Idioma predeterminado: `Español (Latinoamérica) - es-419`
  - Tipo: `Aplicación`
  - Gratis o de pago: `Gratis`
- [ ] **3. Declaraciones de la app:**
  - Política de privacidad: `https://kampuz.vercel.app/privacidad`
  - Acceso a la app: Proporcionar la cuenta de prueba del punto 7.
  - Anuncios: Marcar *"No, mi aplicación no contiene anuncios"*.
  - Seguridad de los datos: Responder según la tabla de la Sección 5.
  - URL de eliminación de datos: `https://kampuz.vercel.app/eliminar-cuenta`
- [ ] **4. Prueba cerrada de 14 días (Requisito estricto de Google):**
  - Google exige que toda cuenta de desarrollador personal nueva ejecute una **prueba cerrada con al menos 12 evaluadores continuos durante 14 días ininterrumpidos**.
  - Invita a los 10 alumnos del piloto más 2 o más evaluadores adicionales ingresando sus correos de Google Play.
  - Sube el `.aab` a la pista de prueba cerrada.
  - **Importante:** Ningún evaluador debe salirse de la prueba cerrada durante los 14 días, de lo contrario Google reiniciará el conteo de días.
- [ ] **5. Solicitud de acceso a producción:**
  - Tras cumplir los 14 días de prueba cerrada con actividad registrada, completa el cuestionario de retroalimentación de la prueba cerrada y solicita el acceso a producción a Google.
