# Kampus — MVP Web-Mobile UTP Lima Sur

Aplicación MVP de **Kampus**, la red social universitaria cerrada con identidad verificada por correo institucional (`@utp.edu.pe`), desarrollada conforme a todas las reglas de negocio, scoring y arquitectura especificadas en [`KAMPUS-spec-antigravity.md`](../KAMPUS-spec-antigravity.md).

---

## 🎯 Persona de Demostración
- **Usuario:** **Luz Martínez** (`luz.martinez@utp.edu.pe`, 21 años).
- **Carrera:** Enfermería (Facultad de Ciencias de la Salud).
- **Ciclo:** 5.° Ciclo (estudiante de ciclos intermedios/superiores).
- **Sede:** UTP Lima Sur (~19,300 alumnos).

---

## 🚀 Arquitectura y Tecnologías
- **Frontend:** React 18 + Vite 6 + Tailwind CSS + Lucide Icons.
- **Modo Presentación:**
  - **Smartphone Bezel:** Marco realista de iPhone 15 Pro con Dynamic Island, barra de estado (9:41, 5G, Wi-Fi, Batería) y Home Indicator.
  - **Selector de Pantallas (M01 - M33):** Desplegable de atajos para saltar directamente a cualquier flujo durante la sustentación ante el jurado.
  - **Panel Universidad (W01 - W06):** Vista completa del dashboard para directores de carrera y empleabilidad (Impulsa / Generación Top).
  - **Responsive Toggle:** Alterna entre marco de teléfono y pantalla completa.
  - **Modo Oscuro / Claro:** Basado en tokens `--brand-primary`, `--accent`, `--surface`, `--ink`.
  - **Persistencia Reactiva:** `localStorage` sincronizado con restablecimiento instantáneo de demo.

---

## 📐 Cumplimiento de Reglas No Negociables del Spec

### 1. Sistema de Puntaje (Sección 5 y 12.2)
- **Cero monedas / cero créditos:** No existen monedas ficticias ni billeteras.
- **Escala de Habilidad (0 a 3):**
  - `Nivel 1: La he usado`
  - `Nivel 2: La he aplicado con otros`
  - `Nivel 3: La he enseñado`
- **Alcance Semanal Desbloqueado:**
  $$\text{alcanceSemanal} = [0, 30, 80, 200][\text{nivel}(\text{"apoyo\_investigacion"})]$$
  Arranca en 0 para forzar el primer gesto de responder a otros antes de enviar.

### 2. Los Tres Espacios Distintos (Sección 4)
1. **Grupo de Carrera y Ciclo:** Cohorte cerrada (Enfermería C5). Solo compañeros de salón.
2. **Espacio de Carrera:** Ciclos 1 al 10. **Aquí viven las consultas agrupadas**.
3. **Talleres Oficiales y Comunidades:**
   - Talleres de bienestar de la UTP con horario real (Lettering, Futsal, Karate, IA aplicada) con sello **Oficial**.
   - Propuestas de alumnos con **umbral de visibilidad de 15 apoyos** para aparecer en Explorar (evita grupos vacíos).

### 3. Consultas Agrupadas y Moderación (Flujo 1, Sección 7.1)
- **Regla dura:** *"Se habla del curso, no de la persona"*.
- Algoritmo de moderación con regex para nombres de docentes o juicios de valor.
- Solo responden alumnos de ciclo $\ge 5$.
- Multiplicador de estrellas: $(modo == "llamada" ? 3 : 1) \times nAlumnos$ (solo si $nAlumnos \ge 2$ y calificado por solicitante).

### 4. Encuestas con Filtro y Umbral de 30 (Flujo 3, Sección 6.5 y 7.4)
- Filtro en vivo por Sede, Carrera, Rango de ciclos, Rango de edades e Intereses.
- **Pantalla Bloqueada M25:** Si el segmento tiene $< 30$ alumnos, se bloquea en una pantalla dedicada para garantizar el anonimato legal bajo Ley 29733.

### 5. Legalidad y Consentimientos (Ley 29733, Sección 6.8)
- 4 consentimientos separados:
  1. Cuenta (Obligatorio/Bloqueado).
  2. Encuestas (Activo por defecto).
  3. Métricas agregadas (Activo por defecto).
  4. **Compartir perfil con la UTP (Apagado por defecto):** Texto legal aprobado para los programas Impulsa y Generación Top.

### 6. Certificados y Anti-Farmeo (Sección 5.5)
- Clasificación: Básico, Intermedio, Avanzado.
- Enlace verificable público prioritario sobre PDFs.
- **Regla anti-farmeo:** Solo cuenta el certificado más alto por habilidad.

---

## 📱 Empaquetado como APK / Play Store (Escalabilidad)
Para compilar la app a APK Android nativo utilizando Capacitor:
```bash
# 1. Compilar la aplicación web
npm run build

# 2. Sincronizar assets con Android
npx cap sync android

# 3. Compilar APK debug con Gradle
cd android && ./gradlew assembleDebug
```
Como PWA web-mobile, ya cuenta con manifest, viewport optimizado para notch/dynamic island y safe areas.

---

## 📲 Cómo instalar el APK en tu celular Android

1. **Descargar el APK:**
   - Ve a la pestaña **Actions** en el repositorio de GitHub.
   - Haz clic en la última ejecución del workflow **Build Android APK & AAB**.
   - En la sección **Artifacts** al pie de la página, descarga el archivo `kampuz.apk` (o descárgalo directamente desde el navegador de tu teléfono).
2. **Permitir orígenes desconocidos:**
   - En tu celular Android, abre el archivo descargado.
   - Si el sistema muestra la advertencia de seguridad, entra a **Ajustes** y activa la opción **"Permitir instalar aplicaciones de fuentes desconocidas"** para ese navegador o gestor de archivos.
3. **Instalación e Inicio:**
   - Toca en **Instalar**.
   - Abre la aplicación **Kampuz**.
   - Ingresa con tu correo institucional UTP (`@utp.edu.pe`) o correo invitado y digita tu código de 6 dígitos para ingresar.

---

## 💻 Comandos de Ejecución
```bash
# Desarrollo local
npm run dev

# Compilación de producción
npm run build

# Vista previa de producción
npm run preview
```
Servidor local disponible en: `http://localhost:5173`
