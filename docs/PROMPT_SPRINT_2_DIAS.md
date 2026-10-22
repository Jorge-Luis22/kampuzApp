# Kampuz — Sprint de 2 días: "Pasando hoy en tu sede"

> Para Claude Code, en la carpeta `kampusApp`. Lee antes `docs/KAMPUS-spec-antigravity.md`, `docs/DECISIONES.md` y `docs/ESTADO_MVP.md`.
> Contexto: el MVP ya funciona entre dos celulares reales (registro, perfil, explorar, solicitudes, chat 1 a 1 y grupos). El profesor lo va a evaluar en **2 días**. Funciona, pero se siente **aburrido**: no da ninguna razón para abrir la app todos los días.

## Objetivo

Que Kampus tenga un **gancho diario y social**: ver qué está pasando hoy en tu sede, sumarte, pedir ayuda, vender algo o encontrar un evento, cruzándote con gente de otras carreras. Inspiración: Warpin (planes en vivo que vencen solos, botón "¡Voy!") y Luma (eventos con portada y "Asistiré").

**Tono de la app: neutral, claro y cercano, con un estilo semi-formal.** La interfaz (botones, títulos, mensajes, estados vacíos) **no** usa jerga, chistes ni modismos peruanos. Lo informal lo ponen los propios alumnos en sus publicaciones y grupos, no la app. Tampoco va jerga técnica: nada de "≥", "> 5", "umbral", "segmento", "M01", "nAlumnos", etc.

**Hay solo 2 días.** Prioriza que funcione bien y se vea bien antes que agregar más cosas. Si algo no entra, anótalo en `docs/DECISIONES.md` como pendiente.

## Día 1

### 1. Arreglos que el usuario reportó probando el APK en un Android real (empieza por aquí)

El usuario instaló el APK en un Android con la barra de **3 botones** (atrás, inicio, recientes). Lo que vio:

**a) La app se mete debajo de las barras del sistema (lo más urgente)**
- Arriba, el contenido queda pegado o debajo de la barra de estado (hora, batería): "Bienvenido(a)" en Inicio, las pestañas de Explorar y la portada del Perfil.
- Abajo, los 3 botones de Android **se dibujan encima de la barra inferior de la app** y tapan "Explorar" y "Grupos".
- La causa: con target SDK 35+ Android fuerza el modo edge-to-edge. Usa la solución oficial de **Capacitor 8** para las áreas seguras (revisa la documentación de Capacitor 8 sobre SystemBars / edge-to-edge / safe area) junto con `viewport-fit=cover` y `env(safe-area-inset-top/bottom)`, o las variables de inset que exponga Capacitor 8.
- Resultado esperado: la barra inferior de la app queda **encima** de los botones de Android, sin taparse, y nada queda debajo de la barra de estado.
- **No ocultes** los botones de Android (modo inmersivo): el usuario los necesita.
- Prueba con barra de 3 botones y con navegación por gestos.

**b) Login**
- El formulario está pegado arriba con un gran espacio vacío abajo. **Céntralo verticalmente** en la pantalla, con el logo arriba del formulario.
- **Placeholders genéricos** en login y registro. Quita "ej. jorge_utp o u2320732@utp.edu.pe" y cualquier nombre o código que parezca de una persona real del equipo:
  - login, campo usuario o correo → "Tu usuario o correo institucional";
  - registro, campo @usuario → "ej. ana.torres";
  - registro, campo correo → "tucodigo@utp.edu.pe";
  - contraseña → "Tu contraseña".
  
  Busca en todo `src/` otros placeholders o textos de ejemplo con nombres del equipo (Jorge, David, Luz, etc.) y hazlos genéricos.
- La etiqueta dice "Usuario o Correo Institucional", pero **solo funciona con el correo**. Haz que funcione también con el **@usuario**. Para no exponer el correo de nadie, que la búsqueda usuario → correo **no** sea una RPC pública que devuelva el correo. Crea una **Edge Function `login`** que reciba usuario o correo y contraseña, resuelva el correo con la service role del lado del servidor, inicie sesión y devuelva solo la sesión. Si las credenciales fallan, el mensaje es siempre el mismo ("Usuario o contraseña incorrectos"), sin revelar si el usuario existe. Si eliminaste antes la RPC `obtener_correo_por_identificador` o el acceso anónimo a correos, mantenlo así.

**c) Contactos (decisión de producto ya tomada)**
- La relación entre dos alumnos que aceptaron una solicitud se llama **"Contacto"**: "Agregar contacto", "Solicitud enviada", "Mis contactos", "Ya son contactos". Es neutral y semi-formal, como LinkedIn. "Amigos" sonaría a red social de ocio. Centraliza esos textos en un solo archivo de constantes de texto, para poder cambiar la palabra en un solo lugar si el equipo decide otra.
- En **Explorar**, cada tarjeta muestra el estado real **antes** de que el usuario haga algo:
  - sin relación → "Agregar contacto";
  - solicitud enviada → "Solicitud enviada", deshabilitado;
  - solicitud recibida → "Responder", que lleva a la solicitud;
  - ya son contactos → "**Chatear**", que abre el chat directo, más una marca "Contacto".
  
  Hoy dice "Conectar", deja escribir el motivo y recién al enviar responde "Ya están conectados". Eso no puede volver a pasar. Los bloqueados no aparecen.
- En el modal de perfil de otro alumno: quita "(Spec 6.4)" y cualquier referencia interna. Si ya son contactos, no muestres el campo de motivo: muestra "Chatear".
- Agrega en Chats (o en Perfil) una lista **"Mis contactos"**.

**d) Chat 1 a 1**
- Hoy ocupa solo un tercio de la pantalla y deja el resto vacío. Debe ser **pantalla completa**, tipo WhatsApp:
  - cabecera fija y lista de mensajes con scroll que ocupa todo el alto;
  - el input queda pegado abajo, respetando el área segura, y el teclado no lo tapa (Capacitor y web);
  - la barra inferior de la app **se oculta** mientras estás en el chat;
  - el botón atrás de Android vuelve a la lista de chats.
- Cambia el placeholder "Escribe un mensaje académico..." por "Escribe un mensaje...". El aviso de arriba puede quedarse, más corto: "Chat privado entre contactos de Kampuz".

**e) Perfil**
- El encuadre está desordenado:
  - la portada se mete bajo la barra de estado;
  - la insignia "Identidad Verificada" se monta sobre el borde de la portada;
  - "Estudiante UTP" queda suelto;
  - el punto verde del estado choca con el botón de la cámara.
- Rehazlo limpio: portada, avatar centrado o a la izquierda, nombre, carrera y ciclo, y una fila de insignias (verificado y estado) **debajo** del nombre. El botón de cámara va dentro del avatar, sin chocar con el punto de estado.
- Tarjeta "Tu primer logro": quita "30 destinatarios semanales". Usa: "Responde una encuesta y desbloquea la opción de enviar las tuyas".
- **Selector de estado:** el menú se corta y no deja hacer scroll. Cámbialo por un **panel desde abajo** con todas las opciones visibles.

**f) Explorar**
- La fila de filtros se corta ("Ciclo" queda cortado) y muestra una barra de scroll horizontal fea. Usa chips en scroll horizontal sin barra visible, o un botón "Filtros" que abra un panel.
- El ícono de escudo junto a "Conectar" no se entiende. Mueve "Reportar o bloquear" a un menú ⋮ en la tarjeta o en el perfil.

**g) Lenguaje:** recorre todas las vistas y reemplaza los textos técnicos o internos. Ejemplos:
- "Ciclo ≥ 5 orienta" → "Responden alumnos de 5.° ciclo en adelante";
- "(Spec 6.4)" → se elimina;
- cualquier mención al umbral → "Para cuidar el anonimato, tu encuesta necesita llegar a más compañeros".

Busca en el código `Spec`, `≥`, `>=`, `M0`, `W0`, `umbral` y `segmento` en textos visibles.

**Prueba de este punto:** después de arreglarlo, genera el APK por GitHub Actions (al hacer push) o explica al usuario cómo probarlo, y pídele que lo revise en su Android antes de seguir con el tablón.

### 2. Tablón "Pasando hoy" (el gancho)
Un solo tablón con 4 tipos de publicación, para no construir 4 módulos:

| Tipo | Ejemplo | Vence | Acción principal |
|---|---|---|---|
| **Plan** | "Buscamos 2 personas para el partido de fútbol de las 5", "Grupo de estudio de Cálculo a las 4 en la biblioteca", "Almuerzo en la cafetería a la 1" | A las pocas horas (por defecto 3 h; máximo el mismo día) | **"¡Voy!"** |
| **Ayuda** | "¿Alguien tiene un cargador tipo C en el pabellón B?", "Perdí mi carné en el aula 302" | 2 h por defecto | **"Yo te ayudo"** → abre un chat directo con esa persona, **sin solicitud previa**, solo para esa publicación |
| **Evento** | "Torneo de vóley de Ingeniería", "Charla de emprendimiento" | En su fecha | **"Asistiré"** |
| **Mercadito** | "Vendo mandil talla M", "Postres caseros a S/ 3", "Calculadora científica usada" | 7 días | **"Me interesa"** → manda una solicitud de mensaje con el motivo ya escrito |

**Backend (migración `013_tablon.sql`):**
- `publicaciones`: id, autor_id, universidad, sede, tipo (`plan|ayuda|evento|mercadito`), título (máx. 80), descripción (máx. 500), lugar, empieza_en, vence_en, cupo (opcional), precio (opcional, solo mercadito), foto_url (opcional, en Storage), estado (`activa|cerrada|eliminada`) y creado_en.
- `publicacion_respuestas`: publicacion_id, usuario_id, tipo (`voy|ayudo|asistire|interesa`), creado_en. Restricción única por publicación y usuario.
- **RLS:**
  - leen los autenticados de la misma universidad;
  - solo el autor edita o cierra;
  - cada usuario solo inserta y borra sus propias respuestas;
  - no se puede responder una publicación vencida o cerrada (validado en el servidor);
  - si hay cupo, no se pasa del cupo.
- Las vencidas no se muestran: filtra por `vence_en > now()`. No borres datos.
- **Límites antispam en el servidor:** máximo 5 publicaciones activas por usuario y 3 en mercadito.
- **Moderación en el servidor para mercadito y ayuda:** se rechazan textos que ofrezcan resolver exámenes o prácticas, hacer trabajos o tareas por dinero, o vender respuestas. Ejemplos de palabras a detectar: "resuelvo examen", "hago tu trabajo", "te paso las respuestas", "solucionario del examen". Usa el mismo enfoque que la moderación de consultas. El mensaje al usuario: *"Kampus no permite ofrecer ayuda para hacer trampa en evaluaciones. Puedes ofrecer tutorías o apuntes propios."* Las tutorías legítimas sí se permiten.
- Realtime en `publicaciones` y `publicacion_respuestas`, para que los "¡Voy!" se actualicen en vivo.
- Botón de **reportar** en cada publicación, usando la tabla `reportes` existente.

**Interfaz:**
- Botón flotante **"+ Publicar"** que abre un panel desde abajo:
  1. elegir el tipo con 4 tarjetas grandes, cada una con su ícono;
  2. un formulario corto según el tipo, con valores por defecto inteligentes (vence en 3 h para planes, lugar sugerido con los pabellones y la biblioteca de la sede);
  3. publicar.
- Tarjeta de publicación con: avatar, nombre, carrera y ciclo del autor ("Psicología · 8.°"); tipo con su ícono; título; lugar; **"vence en 2 h"** o la fecha del evento; avatares apilados de quienes van ("Ana, Luis y 3 más van"); y el botón de acción. Si es tuya: "Cerrar" y ver quiénes respondieron.
- Filtros arriba en chips: Todo · Planes · Ayuda · Eventos · Mercadito.
- **Estados vacíos** con un texto amable y una acción clara. Por ejemplo, Planes vacío: *"Todavía no hay planes en tu sede. Sé el primero en proponer uno."* → "+ Publicar plan".

### 3. Nuevo Inicio: "Pasando hoy en tu sede"
Reemplaza el Inicio actual, en este orden de arriba a abajo:
1. Saludo corto con el estado del usuario.
2. **"Ahora mismo"**: planes y ayudas activos de tu sede en carrusel horizontal, con "Ver todo" que lleva al tablón.
3. **"Próximos eventos"**: 2 o 3 eventos, más los talleres oficiales de hoy si hay.
4. **"Dudas de tu carrera"**: las consultas abiertas de tu carrera (ver punto 5).
5. **"Recién llegados"**: 3 a 5 alumnos nuevos de **otras carreras** de tu sede, con "Conectar". Esto empuja la métrica del producto: interacciones entre carreras.
6. Accesos a tus grupos (salón y carrera), más compactos que hoy.

**Navegación:** la barra inferior queda con 5 ítems: **Inicio · Tablón · Grupos · Chats · Perfil**.
- Explorar pasa a ser un botón de búsqueda arriba en el Inicio, más "Recién llegados".
- Las Encuestas se mueven dentro de Grupos o del Perfil como "Encuestas". No las borres, solo cámbialas de lugar.
- Chats junta los chats 1 a 1 y las solicitudes.

Si cambiar la navegación rompe algo, prioriza el tablón y el Inicio y deja la navegación para el final.

## Día 2

### 4. Catálogo real de la UTP (escalabilidad)
- En `seed.sql`, actualiza el catálogo con las **carreras presenciales reales de la UTP por facultad**:
  - **Ingeniería:** Aeronáutica, Ambiental, Automotriz, Biomédica, Civil, Electrónica, Eléctrica y de Potencia, Empresarial, Industrial, Mecatrónica, Mecánica, de Minas, de Seguridad Industrial y Minera, de Sistemas e Informática, de Software, de Telecomunicaciones, de Ciberseguridad.
  - **Negocios:** Administración Banca y Finanzas, Administración de Empresas, Administración de Negocios Internacionales, Administración Hotelera y de Turismo, Administración y Marketing, Contabilidad, Economía.
  - **Medicina:** Medicina.
  - **Psicología:** Psicología.
  - **Arquitectura:** Arquitectura, Diseño Profesional de Interiores.
  - **Ciencias de la Salud:** Enfermería, Farmacia y Bioquímica, Laboratorio Clínico y Anatomía Patológica, Nutrición y Dietética, Obstetricia, Odontología, Terapia Física.
  - **Comunicaciones:** Ciencias de la Comunicación, Comunicación y Publicidad, Diseño Digital Publicitario, Diseño Profesional Gráfico.
  - **Derecho:** Derecho.
  - **Educación:** Educación Inicial, Educación Primaria.
- **Sedes:** Lima Centro, Lima Norte, Lima Sur, Lima Este (SJL), Lima Este (Ate), Arequipa, Chiclayo, Chimbote, Huancayo, Ica, Iquitos, Piura, Pucallpa, Tacna y Trujillo.
- Agrega en el perfil el campo **modalidad** (Presencial / Gente que trabaja / Virtual), opcional.
- Asegúrate de que **universidad** sea un dato en todas las tablas y consultas que lo necesiten (perfiles, espacios, publicaciones). Así otra universidad puede entrar mañana con solo agregar sus datos, sin tocar el código. No construyas el panel multiuniversidad, solo deja la base lista.
- Los selectores de carrera y sede leen de la base, no de `mockData.js`.

### 5. Consultas más claras
- Se mantiene el nombre **"Consultas"**, sin renombrar. En la interfaz se explican en una línea simple: *"Pregunta sobre un curso y te responden alumnos de ciclos superiores de tu carrera."*
- Los ejemplos de placeholder deben ser neutrales: *"¿Qué temas entran en el parcial de Estadística?"*, *"¿Qué libro recomiendan para Anatomía?"*.
- Mantén todas las reglas actuales de moderación, agrupación, quién responde y estrellas.
- Sugerencias de temas al crear: "Qué entra en el examen", "Material que sirve", "Cómo organizarme", "Dónde estudiar".

### 6. Insignias de comunidad (solo si hay tiempo)
Insignias calculadas en el servidor, que se muestran en el perfil y junto al nombre en el tablón. Son decorativas: no son moneda, no se gastan y no hay ranking público. Usa nombres neutrales y claros:
- "Organizador": creó 3 planes o eventos.
- "Colaborador": ayudó 3 veces.
- "Participante activo": se sumó a 5 planes.
- "Emprendedor": tiene una publicación en el mercadito.
- "Referente en [curso]": recibió 3 valoraciones positivas en ese curso.

### 7. Cierre
- `npm run build` y el linter sin errores.
- Extiende `npm run test:sql` con pruebas del tablón:
  - RLS;
  - no responder publicaciones vencidas ni pasarse del cupo;
  - límites antispam;
  - moderación anti-trampa.
- Extiende `npm run test:e2e` con este flujo: A publica un plan, B lo ve en vivo y toca "¡Voy!", y A ve el contador subir sin recargar.
- Actualiza `docs/ESTADO_MVP.md` y `docs/DECISIONES.md`, y escribe un **guion de demo de 3 minutos** en `docs/DEMO.md` para presentarlo al profesor, con qué mostrar en dos celulares.

## Fuera de este sprint (no lo hagas)
Login con Microsoft, dominio propio para el correo, Play Store, panel multiuniversidad, pagos dentro de la app y mapa en vivo con GPS. El tablón usa "lugar" como texto, sin mapa.

## Forma de trabajo
- Haz un commit por punto. **No hagas push** hasta que el usuario lo apruebe.
- Al terminar el Día 1, para y avísale al usuario para que lo pruebe en dos celulares antes de seguir con el Día 2.
- Todas las migraciones se pueden volver a ejecutar sin romper nada. Al final, dile exactamente qué archivos SQL debe correr en Supabase y en qué orden.
