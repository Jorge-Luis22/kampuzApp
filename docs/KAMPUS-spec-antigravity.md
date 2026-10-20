---
name: kampus
description: Especificación completa del MVP de Kampus, la red social cerrada por universidad con identidad verificada por correo institucional. Contiene el problema, las dos personas, los tres flujos con su lógica exacta, el sistema unificado de puntaje, las reglas de negocio no negociables, el modelo de datos, el mapa de pantallas y el alcance del piloto. Úsala en toda tarea de diseño, modelado o implementación de Kampus.
---

# Kampus — especificación del MVP

> **Cómo usar este documento.** En Antigravity, guárdalo como `.agents/skills/kampus/SKILL.md`, o pégalo como primer mensaje de la sesión. Es la fuente de verdad del producto.
>
> **Antes de proponer cualquier cosa, lee la sección 5 (sistema de puntaje) y la 6 (reglas no negociables).** Casi todos los errores de interpretación de este producto vienen de ahí.
>
> **Hay un prototipo funcional** que implementa la lógica de las secciones 5 a 8. Ante cualquier duda sobre cómo se comporta algo, ese prototipo manda sobre tu intuición. Pídele el enlace a Jorge.
>
> **No propongas** funciones que están en la sección 12.2 (descartadas). Ya se evaluaron y se rechazaron con motivo.

---

## 1. Qué es Kampus

Una red social **cerrada por universidad**, con **identidad real**, que arranca como piloto en **una sola sede de la Universidad Tecnológica del Perú (UTP)**, aproximadamente 19,300 alumnos.

Solo entra quien tiene un correo institucional válido. Todos usan nombre y apellido reales. No hay anonimato ni seudónimos.

**La frase que resume el producto:** el valor no está en otro chat más. Está en garantizar que al otro lado hay un alumno real de tu universidad, con nombre, carrera y ciclo. Todo lo demás se construye encima de eso.

**Plataforma:** aplicación **web responsive** (mobile-first, instalable como PWA) más un **panel web** para la universidad. No es nativa. La decisión fue por velocidad: un solo desarrollador backend, sin revisión de tienda de aplicaciones, y el profesor puede abrirla desde su laptop. El costo conocido es que las notificaciones push en web son débiles, sobre todo en iPhone; el canal de aviso de respaldo para el piloto es el correo institucional.

---

## 2. El problema

### 2.1 Qué pasa hoy

Un alumno no tiene forma de encontrar a alguien de otra carrera. Su red completa es su salón.

- Los grupos de WhatsApp son por salón, y la única forma de conectar es a través del número, que se obtiene solo si ya hubo interacción previa.
- Los grupos de Facebook son abiertos, anónimos y llenos de gente que no es de la universidad.
- Outlook, Teams y Discord existen, pero nadie los usa para conocer gente.
- Para conseguir encuestados de un trabajo académico se recurre a una cadena de conocidos, o se inventan los datos.
- El alumno de primer ciclo no sabe que existen comunidades, eventos ni conferencias, así que cree que el promedio es la única ruta para ser buen profesional.

### 2.2 La evidencia

| Dato | Fuente |
|---|---|
| Un salón de 35 alumnos es el **0.18%** de una sede de 19,300 | Cálculo propio sobre matrícula UTP |
| Ingeniería tiene **68,101** alumnos y Salud **2,525** en la UTP: 27 veces más gente de la propia facultad que del resto | Portal de transparencia UTP, 2022-1 |
| El **100%** de los alumnos debe producir investigación para graduarse: trabajo de investigación para el bachiller y tesis o trabajo de suficiencia para el título | Ley Universitaria 30220, para todos los que entraron desde 2016 |
| **38%** de alumnos vio falsificar datos de laboratorio o investigación y **44%** admitió rellenar bibliografías con referencias que nunca leyó | 360 alumnos, universidad pública de Puerto Rico, 2016 |
| WhatsApp: **20.73 M** de usuarios en Perú y 98.6% del uso de apps de mensajería. Pero exige el número | Reportes de redes sociales Perú |
| LinkedIn lo usa el **6%** de peruanos frente al 89% que usa WhatsApp | Ipsos Perú |
| **Facebook Campus** —red cerrada por universidad, con correo institucional— operó de set-2020 a mar-2022 y cerró | Cementerio de referencia |
| **Fizz** llegó al 95% de los ~7,600 alumnos de Stanford con el mismo principio de red cerrada por campus | Caso de referencia |

**Dos advertencias de honestidad que deben respetarse en todo material del producto:**

1. El 38%/44% es de **Puerto Rico**. No existe estudio peruano público que mida esto. Nunca se presenta como cifra local.
2. **Discord no aparece en ningún reporte de redes sociales del Perú.** No es que se use poco: es que no se mide. Se presenta como ausencia de dato, nunca como dato bajo.

---

## 3. Las dos personas

El producto necesita a las dos. Diseñar solo para una lo rompe.

### 3.1 Camila — la cachimba (demanda)

18 años, primer ciclo de Administración, UTP Lima Norte. Primera de su familia en la universidad.

Tímida, introvertida, responsable. Entra con ilusión. Pertenece al grupo de WhatsApp de su salón y a nada más.

- **Motivaciones:** pertenecer a un grupo, conocer gente, oportunidades de desarrollo.
- **Frustraciones:** no sabe cómo conectar, no tiene recomendaciones de su carrera, no sabe qué programas o eventos existen.
- **Sus palabras:** *"No conozco los programas de mi universidad"*. *"Me siento mal porque no me desarrollo profesionalmente fuera de mi salón"*. *"Quiero saber más sobre mi carrera conectando con personas de ciclos superiores"*.
- **Está hoy en:** WhatsApp, Instagram, TikTok, correo UTP sin abrir.

Es el usuario con más ciclos por delante y sin red previa a la que volver. El más fácil de ganar y el que más tiempo se queda.

### 3.2 Marcos — el de ciclos superiores (oferta)

21 años, séptimo ciclo de Ingeniería Industrial. Conoce a su salón y a nadie más.

- **Su dolor:** necesita encuestados para su trabajo de investigación y su tesis, y hoy depende de una cadena de favores entre conocidos. Cuando falla, inventa los datos.
- **Sus palabras:** *"Tener contactos de otras carreras para proyectos, validar datos sin mentir"*.
- **Qué lo trae a Kampus hoy:** las encuestas con filtro. Es lo único que le resuelve algo esta semana.
- **Qué lo retiene a futuro:** que su perfil de habilidades lo haga visible para los programas de empleabilidad de la UTP.

**Lo crítico:** los tres flujos dependen de que Marcos esté dentro. Sin ciclos superiores, no hay quién responda consultas, los grupos son solo novatos y los perfiles de habilidades están vacíos.

### 3.3 El trueque que sostiene el producto

Camila tiene tiempo y necesita respuestas. Marcos tiene conocimiento y necesita encuestados. Ese intercambio es el motor.

---

## 4. La arquitectura de espacios

Hay **tres tipos de espacio**, y cada uno produce un tipo distinto de cruce. Esta distinción es estructural: no la simplifiques.

| Espacio | Cómo entras | Quién está | Para qué | Qué cruza |
|---|---|---|---|---|
| **Grupo de carrera y ciclo** | Automático: tu carrera + tu ciclo. Solo accedes al tuyo | Tus compañeros de clase | Cursos, horarios, trabajos, el día a día | Nada: es el piso que evita la app vacía |
| **Espacio de carrera** | Automático: tu carrera, todos los ciclos | Toda la carrera, de ciclo 1 a 10 | **Aquí viven las consultas agrupadas** | Cruza **ciclos** |
| **Grupo de interés** | Te unes tú, o lo propones | Cualquier alumno de la universidad | Talleres, comunidades, eventos, conferencias | Cruza **carreras** |

**Por qué el espacio de carrera existe aparte:** si una consulta de un cachimbo de ciclo 1 vive en el grupo de "Enfermería 1.er ciclo", solo la ven otros de ciclo 1, que no saben la respuesta. El alumno de ciclo 9 que podría contestarla no está en ese grupo. Sin el espacio de carrera completo, el flujo 1 no funciona.

**Grupos de taller:** al lanzar, se espejan los talleres que ya existen en el portal de la UTP (karate, futsal, vóley, básquet, portugués, inglés, lettering, IA aplicada), **con su horario real**. Esto es deliberado: el horario es un disparador recurrente y con hora fija, y es lo que hace que el grupo se active dos veces por semana sin inventar gamificación. Llevan sello **Oficial**.

**No copies los códigos internos del portal** (`REG TALLER DE KARATE BASICO / TPDEP`). Nombra los grupos por tema. El sello Oficial se usa solo donde de verdad lo es.

**Solicitud de publicación:** para llegar a un espacio cerrado que no es tuyo, no pides entrar. Mandas **un solo mensaje** y el admin decide si se publica. Así un tesista llega a Psicología sin romper el espacio de Psicología.

---

## 5. El sistema de puntaje — leer dos veces

### 5.1 No hay monedas

**Kampus tiene una sola dimensión de puntaje: el nivel de habilidad.** No existen créditos, no existe un saldo que se gaste, no existe una billetera.

Todo lo que el alumno hace alimenta una habilidad:

| Lo que hace | Qué habilidad alimenta |
|---|---|
| Responde encuestas de otros | **Apoyo a la investigación** |
| Resuelve consultas de ciclos menores | **Predisposición a ayudar** |
| Participa en talleres y grupos de forma sostenida | **Constancia** |
| Crea y administra grupos, organiza eventos | **Liderazgo** |
| Sube certificados verificables | La habilidad técnica que corresponda |

### 5.2 El alcance se desbloquea, no se paga

El control contra el spam de encuestas **no es un precio**: es un límite que se desbloquea con el nivel.

```
alcanceSemanal(usuario) = [0, 30, 80, 200][nivel(usuario, "apoyo_investigacion")]
```

| Nivel de apoyo a la investigación | A cuántos puede llegar por semana |
|---|---|
| 0 — no ha respondido nada | **0.** No puede enviar |
| 1 | 30 |
| 2 | 80 |
| 3 | 200 |

Mientras más apoyas la investigación de otros, a más gente puedes llegar con la tuya. Es desbloquear, no pagar. Y arranca en cero a propósito: el primer gesto en Kampus es ayudar a alguien, no pedir.

### 5.3 Los tres niveles

Son los mismos para toda habilidad, visibles desde el primer día con el camino completo a la vista (*"te faltan 2 asesorías para Nivel 3"*).

| Nivel | Nombre | Qué significa |
|---|---|---|
| 1 | **La he usado** | Hay al menos una evidencia |
| 2 | **La he aplicado con otros** | La usó en un proyecto o grupo real, y alguien que estuvo ahí lo confirma |
| 3 | **La he enseñado** | Resolvió consultas de esa habilidad, o dirigió un grupo o taller sobre el tema |

El nivel 3 es el más difícil de falsear, y no es casualidad: haber enseñado algo es la prueba más fuerte de que lo sabes.

**Umbrales calibrados para el piloto** (un ciclo). Cuando la base crezca, suben:

```
apoyo_investigacion:  nivel 1 = 1 encuesta respondida  · nivel 2 = 3  · nivel 3 = 8
predisposicion_ayudar: nivel 1 = 1 consulta resuelta   · nivel 2 = 2  · nivel 3 = 5
constancia:            nivel 1 = 1 grupo con actividad · nivel 2 = 3  · nivel 3 = 5
liderazgo:             nivel 1 = 1 grupo creado        · nivel 2 = 2  · nivel 3 = 3
```

### 5.4 El origen del dato: cuatro escalones

Cada habilidad del perfil lleva una marca de origen. Es la extensión del concepto `declarado` / `verificado` que gobierna todo el modelo de datos.

| Origen | Cómo se consigue | Cómo se ve |
|---|---|---|
| **Declarada** | El alumno la escribió | Sin sello, en gris |
| **Con evidencia** | Adjuntó algo revisable: repositorio, certificado, proyecto | Sello claro |
| **Respaldada** | Compañeros que estuvieron en el mismo grupo o proyecto lo confirman | Sello medio |
| **Verificada** | La universidad lo confirma, o **Kampus lo observó dentro de la app** | Sello fuerte, turquesa |

Las cuatro habilidades de la tabla 5.1 nacen **Verificadas**, porque las observa el sistema. Nadie las escribe.

### 5.5 Certificados

Dos sellos visibles, no uno. Son cosas distintas y las dos importan de un vistazo:

- **Profundidad:** Básico · Intermedio · Avanzado
- **Confianza:** con enlace verificable, o solo archivo

```
clasificar(horas, tieneEvaluacion):
  si horas > 60 o examen supervisado  -> "Avanzado"   (6 estrellas)
  si horas >= 20 o tieneEvaluacion    -> "Intermedio" (3 estrellas)
  si no                               -> "Básico"     (1 estrella)
  si horas es desconocido             -> "Básico"
```

**Regla anti-farmeo obligatoria: solo cuenta el certificado más alto por habilidad.** Si alguien sube cinco cursos de Excel de dos horas, cuenta uno. Sin esta regla, se llega a Avanzado sin saber nada.

**Pide el enlace de verificación antes que el PDF.** Coursera, Google, Microsoft y LinkedIn Learning emiten certificados con URL propia; con ese enlace cualquiera que mire el perfil comprueba sin que Kampus revise nada. El PDF suelto se acepta, pero queda un escalón abajo y visible para quien quiera abrirlo.

Un agente puede leer el certificado y **proponer** emisor, horas y nivel; el alumno confirma, y queda registrado que la clasificación la propuso el agente.

### 5.6 Habilidades blandas: hechos, no etiquetas

"Liderazgo" y "trabajo en equipo" no se pueden verificar jamás, y un chip que los nombre no le dice nada a nadie. En el perfil se muestran como **hechos**:

```
Creó y administra Startups UTP Lima Norte · 248 miembros · 2 ciclos
Resolvió 12 consultas de Química Inorgánica · 4 por llamada
Respondió 9 encuestas de otros alumnos
```

Y lo que cuenta es **el rol**, no la presencia:

| Qué hizo en el grupo | Qué evidencia de verdad |
|---|---|
| Se unió y participó un ciclo completo | Constancia e interés en el tema |
| Organizó una actividad o evento del grupo | Organización y trabajo en equipo |
| Creó el grupo y lo administró | Liderazgo |
| Representó al grupo fuera (torneo, concurso) | Representación |

**Asistir a un taller no es evidencia de liderazgo.** Si por ir a futsal sale un chip de "Liderazgo", el perfil vale cero y se pierde el diferenciador entero.

### 5.7 Progreso privado, evidencia pública

El alumno ve su propio avance y qué le falta para el siguiente nivel. **No hay tabla de posiciones pública.** La persona objetivo es tímida y ya siente que va atrasada: verse última confirma lo que teme y cierra la app.

Los demás ven sus habilidades y su evidencia, no su posición en un ranking.

### 5.8 Para qué sirve todo esto fuera de la app

La UTP tiene programas de empleabilidad —**Impulsa** y **Generación Top**— cuyo filtro de entrada es el promedio ponderado ≥ 17 y el tercio superior. Hoy la universidad **solo puede ver a sus alumnos por la nota**: no tiene forma de detectar al alumno de 15 que enseñó a 40 compañeros y administra un grupo de 200, aunque en el Assessment Center de esos programas —que es trabajo en equipo y dinámica grupal— probablemente gane.

**Kampus le da a la UTP un segundo radar.** Ese es el argumento de venta, y es lo que da sentido a las estrellas.

**No se promete lo que no se controla.** Mientras no exista convenio firmado, toda la copia sobre esto va en condicional: *"cuando tu universidad se sume a Kampus"*, nunca *"la UTP va a ver tu perfil"*.

---

## 6. Reglas de negocio que no se negocian

### 6.1 Entrada
- Solo se registra quien tiene un correo institucional válido de una universidad habilitada.
- Verificación por código de 6 dígitos enviado a ese correo.
- Nombre y apellido reales. Sin seudónimos. Foto opcional.
- Mayores de 18. La fecha de nacimiento sirve para el filtro de edad y para confirmar mayoría de edad.

### 6.2 Identidad: declarado vs verificado
- El alumno **declara** carrera, ciclo, sede y fecha de nacimiento. No se le pide nada a la universidad.
- El correo institucional prueba una sola cosa: que es alumno de esa universidad.
- **Cada campo del perfil lleva marca de origen: `declarado` o `verificado`.**
- Cuando la universidad firma, se cruza su base y los campos pasan a `verificado` sin tocar el producto.
- Verificado lleva sello discreto. Declarado **no lleva nada**: marcarlo como "no verificado" estigmatizaría al 100% de los usuarios al inicio.
- **Nunca pidas al alumno declarar su ranking académico ni sus cursos aprobados.** Son datos que invitan a mentir justo en la pantalla donde otro decide si confiar en él. Esos datos llegan verificados, con el convenio, o no llegan.

### 6.3 El perfil es la única fuente del filtro
Los intereses son **un campo del perfil**, no algo que se deduzca de los grupos a los que alguien se unió. Si el filtro leyera la membresía de grupos, un alumno podría manipular qué encuestas le alcanzan entrando y saliendo de grupos, y los segmentos dejarían de ser confiables justo en lo que se vende.

Los grupos son para conversar. El perfil es para filtrar.

### 6.4 Mensajes directos
- No hay mensaje directo libre. Se manda una **solicitud**; hasta que la otra persona acepta, no se puede escribir.
- Dentro de un espacio al que perteneces, el chat es libre.

### 6.5 Encuestas con filtro
- El filtro se arma con: universidad, sede, carrera, ciclo (rango), edad (rango) e intereses.
- La app muestra **en vivo** cuántos alumnos caen en el filtro, recalculando con cada cambio.
- **Si el segmento tiene menos de 30 personas, el envío se bloquea.** Límite duro, no advertencia. Es la garantía de anonimato y es lo que hace que las métricas agregadas sean legalmente defendibles.
- El envío se recorta además al `alcanceSemanal` del emisor (sección 5.2).
- La encuesta llega a una **bandeja dentro de la app**, nunca como enlace externo.
- Cada alumno recibe como máximo **3 encuestas por semana**. Si el tope está lleno, el envío se **encola**, no se descarta.
- **El emisor nunca ve quién respondió qué.** Ve respuestas agregadas.

### 6.6 Moderación
- Botón de reportar en cada mensaje, perfil, grupo y consulta. Bloquear usuarios.
- Los grupos de interés tienen admin (quien lo creó); los de carrera, moderador asignado.
- **La universidad no modera el contenido ni ve los mensajes.** Va por escrito en el contrato. Solo ve métricas agregadas, y perfiles individuales solo de quienes dieron el consentimiento 4.
- Regla dura y visible: **se habla del curso, no de la persona** (ver 7.1).

### 6.7 Arranque
- Al lanzar, los grupos de carrera y los de taller ya deben existir y tener gente.
- **Ninguna pantalla debe verse vacía en el primer uso.** Cada estado vacío necesita diseño propio con una acción clara. El primer logro de un cachimbo debe ser alcanzable en su primera semana: responde una encuesta y ya tiene Nivel 1 en apoyo a la investigación.

### 6.8 Legal — Perú
- Ley 29733 de Protección de Datos Personales y su reglamento DS 016-2024-JUS. Multas de hasta aproximadamente S/550,000.
- Registro del banco de datos en el Registro Nacional **antes** de recolectar.
- **Cuatro consentimientos separados por finalidad**, nunca una casilla única. Cada uno revocable y demostrable:

| # | Finalidad | Por defecto |
|---|---|---|
| 1 | Crear la cuenta | Activo y bloqueado, marcado "Necesario" |
| 2 | Recibir encuestas de otros alumnos | Activo |
| 3 | Métricas agregadas para la universidad | Activo |
| 4 | **Compartir mi perfil de habilidades con mi universidad** | **Apagado** |

- El consentimiento 4 es cesión de datos a un tercero con efectos sobre el acceso a una oportunidad laboral. Necesita consentimiento expreso propio, apagado por defecto, revocable, y la consecuencia dicha con claridad: si está apagado, el perfil no aparece en las convocatorias.
- Datos mínimos: no se pide DNI, dirección ni teléfono.
- El nivel de habilidad es **elaboración de perfiles**. El alumno puede ocultarlo.

**Texto aprobado del consentimiento 4:**

> **Que tu universidad vea lo que haces aquí**
>
> La UTP tiene programas como Impulsa y Generación Top, y hoy solo puede encontrarte por tu promedio. Si activas esto, cuando tu universidad se sume a Kampus también va a ver lo que construiste aquí: a cuántos compañeros asesoraste, qué grupos creaste, en qué te has venido formando.
>
> **Qué compartimos:** tu nombre, tu carrera, tu ciclo y tu perfil de habilidades con su evidencia.
> **Qué no:** tus mensajes, tus chats, ni qué respondiste en las encuestas.
>
> Puedes apagarlo cuando quieras. Si está apagado, tu perfil no aparece en las convocatorias.

### 6.9 Egresados
Al egresar, el alumno pierde el correo institucional **justo cuando más necesita su perfil**, porque está postulando a trabajos. Mecanismo decidido: **correo alterno registrado antes de egresar**. El perfil sobrevive con rol de egresado.

---

## 7. Los tres flujos, con su lógica

### 7.1 Flujo 1 — Consultas agrupadas

**Quién:** el cachimbo pregunta, el de ciclos superiores responde.
**Dónde vive:** en el espacio de carrera completo (todos los ciclos), nunca en el grupo de carrera y ciclo.

**Temas típicos** (sacados de entrevistas reales): dónde consigo materiales para el curso X · lugares para estudiar en la universidad · ¿existen grupos de estudio? · ayuda con una tarea · tips de qué estudiar en mis cursos · cómo me preparo para el examen.

**Lógica de agrupación:**

```
al crear consulta(autor, curso, tema, texto):
  bloqueo = moderar(texto)
  si bloqueo: rechazar y mostrar el motivo al autor
  clave = carrera + "|" + curso + "|" + tema
  grupo = grupoAbierto(clave) o crearGrupo(clave)
  grupo.consultas += consulta
  grupo.nAlumnos = contarAutoresDistintos(grupo)
```

**Moderación — el agente supervisa que no se hable de profesores.** Es la primera capa, no la única:

```
moderar(texto):
  mencionaDocente = /\b(profe|profesor|profesora|docente|maestro|maestra)\b/i
  emiteJuicio    = /\b(mejor|peor|cuál|recomienda|evita|jala|regala|bueno|malo)\b/i
  nombrePropio   = /\bprofesor(a)?\s+[A-ZÁÉÍÓÚ]/

  si mencionaDocente y emiteJuicio:
    -> "Se habla del curso, no de la persona. Reformula hacia qué necesitas
        saber para llevarlo: qué temas pesan más, cómo son las evaluaciones,
        qué material conviene."
  si nombrePropio:
    -> "Mencionaste a un docente por su nombre. Se habla del curso, no de la persona."
```

El agente detecta el nombre propio y la pregunta directa, pero **no detecta la insinuación** ("el de la sección 3 de Cálculo"). Por eso debajo van siempre la regla escrita y visible y el botón de reportar. Esto no es un detalle: las opiniones sobre docentes son el riesgo que puede hacer que la universidad rechace la app.

**Quién puede responder:** alumnos de ciclo ≥ 5, y de ciclo superior al del que preguntó.

**Estrellas:**

```
estrellas = (modo == "llamada" ? 3 : 1) * grupo.nAlumnos
```

Una respuesta sirve a todo el grupo, por eso se multiplica. La llamada vale más porque cuesta más.

**Anti-gaming, obligatorio:**
1. **Solo cuentan las consultas agrupadas** (`nAlumnos >= 2`). Una consulta de una sola persona no da estrellas. Esto impide que dos amigos se hagan consultas falsas entre sí.
2. **El que preguntó valora la respuesta** antes de que las estrellas se acrediten.
3. No cuentan las asesorías entre personas que ya tienen conexión aceptada.

**Efecto perverso a vigilar:** el multiplicador empuja a responder solo las consultas masivas, y las dudas raras —las de quien más perdido está— quedan al fondo de la cola. Mitigación sugerida: una consulta sin responder más de N días sube de prioridad en la lista.

**La llamada es el punto ciego de moderación.** Si se implementa: ocurre **dentro de la app**, sin intercambiar números, con botón de reportar visible durante la llamada y registro de que ocurrió.

### 7.2 Flujo 2 — Grupos de talleres y comunidades

**Al lanzar:** se espejan los talleres de la UTP con su horario. Esto resuelve el riesgo de la app vacía sin pedirle nada a la universidad.

**Grupos nuevos — creación libre con visibilidad por umbral:**

```
crearPropuesta(nombre, descripcion, creador):
  grupo = crear(estado="oculto", apoyos=[creador])

umbralVisibilidad(baseActiva):
  return max(15, round(baseActiva * 0.03))

al apoyar(grupo, usuario):
  grupo.apoyos += usuario
  si grupo.apoyos.length >= umbralVisibilidad():
    grupo.estado = "visible"   // ahora aparece en Explorar
```

El grupo **existe desde el minuto uno**; lo que el umbral controla es si **aparece en Explorar**. Así nadie se topa con un grupo vacío, pero tampoco se bloquea la iniciativa de quien propone algo. El creador ve un contador: *"faltan 11 para que tu grupo sea visible"*, y eso mismo lo empuja a invitar gente.

El umbral arranca en **15** y escala con la base. Un umbral fijo de 50 sería el 10% de toda la base del piloto: para "cinéfilos" no pasaría nunca.

**Eventos:** los grupos generan sus propios eventos con fecha (un torneo, una junta). Es un objeto distinto del tablón institucional de eventos de la universidad.

**Enlaces de inscripción:** en el MVP, los grupos de taller enlazan al portal de la UTP para inscribirse. Es honesto: Kampus es la capa de descubrimiento. Que la inscripción pase por Kampus es el siguiente paso de la venta, no del MVP.

### 7.3 Flujo 3 — Perfil de habilidades

Ya descrito en la sección 5. Lo que hay que entender de la arquitectura:

**Los flujos 1 y 2 son la máquina de evidencia del flujo 3.** Las habilidades no se escriben, se ganan de cosas que ya pasaron dentro de la app. Eso es lo que hace que el perfil valga algo, y es lo que convierte los tres flujos en un solo producto en vez de tres funciones sueltas.

**Respaldos entre compañeros** (fase 2) — tres restricciones, y si le quitas una se vuelve LinkedIn:
1. Solo puede respaldarte alguien que **compartió contexto contigo dentro de Kampus**: mismo grupo, mismo proyecto, misma asesoría. Sin contexto compartido, no aparece el botón.
2. El respaldo es **nominal y dice dónde**: "Lucía Ramos, en Startups UTP". Si tienes que poner tu nombre al lado, piensas dos veces.
3. Cada alumno tiene **pocos respaldos por ciclo** (cinco). Lo que hace valioso un aval es que sea escaso.

### 7.4 El núcleo — encuestas con filtro

Es lo que trae al alumno de ciclos superiores, y por lo tanto lo que hace posibles los otros tres.

```
alcanceDelFiltro(filtro):
  return alumnos.filter(a =>
       (!filtro.carrera  || a.carrera === filtro.carrera)
    && a.ciclo >= filtro.cicloMin && a.ciclo <= filtro.cicloMax
    && a.edad  >= filtro.edadMin  && a.edad  <= filtro.edadMax
    && (!filtro.intereses.length || filtro.intereses.some(i => a.intereses.includes(i)))
  ).length

puedeEnviar(filtro, emisor):
  n = alcanceDelFiltro(filtro)
  si n < 30:            -> bloquear, "Muy pocos. Con menos de 30 alguien podría
                            quedar identificado. Amplía el ciclo o quita un filtro."
  si alcanceSemanal(emisor) === 0 -> bloquear, "Responde una encuesta de otro
                                       para desbloquear 30 destinatarios."
  destinatarios = muestraAleatoria(filtro, min(n, alcanceSemanal(emisor)))
  los que ya tienen 3 encuestas esta semana -> a la cola, no se descartan
```

El contador de alcance es **el elemento más importante de la pantalla de creación**. Es el número grande, lo primero que salta a la vista, y cambia en vivo con cada ajuste del filtro.

---

## 8. Modelo de datos

```
Universidad(id, nombre, dominioCorreo, colorPrimario, nombreApp)   // white-label
Sede(id, universidadId, nombre)
Carrera(id, universidadId, nombre, facultad)
Curso(id, carreraId, nombre)

Usuario(id, correoInstitucional, correoAlterno?, nombre, apellido, fotoUrl?,
        universidadId, sedeId, carreraId, ciclo, fechaNacimiento,
        rol: alumno|egresado|moderador|admin_universidad, creadoEn, estado)

CampoPerfil(id, usuarioId, campo, valor, origen: declarado|verificado, verificadoEn?)
Interes(id, nombre)
UsuarioInteres(usuarioId, interesId)

Consentimiento(id, usuarioId, finalidad: cuenta|encuestas|metricas|perfil_universidad,
               otorgado: bool, versionPolitica, otorgadoEn, revocadoEn?)

Espacio(id, tipo: carrera_ciclo|carrera|interes|taller, nombre, descripcion,
        universidadId, sedeId, carreraId?, ciclo?, creadorId?,
        estado: oculto|visible, horario?, oficial: bool, creadoEn)
Membresia(id, usuarioId, espacioId, rol: miembro|admin|moderador, desde)
ApoyoPropuesta(id, espacioId, usuarioId, creadoEn)      // para el umbral de visibilidad

Mensaje(id, espacioId, autorId, texto, creadoEn, editadoEn?, estado)
SolicitudPublicacion(id, espacioDestinoId, autorId, texto,
                     estado: pendiente|aprobada|rechazada, resueltoPor?, resueltoEn?)
SolicitudMensaje(id, deId, aId, estado: pendiente|aceptada|rechazada, creadoEn)
ConversacionDirecta(id, usuarioAId, usuarioBId, abiertaEn)
MensajeDirecto(id, conversacionId, autorId, texto, creadoEn)

Consulta(id, autorId, carreraId, cicloAutor, cursoId, tema, texto,
         estado: abierta|agrupada|resuelta|bloqueada, grupoConsultaId?,
         motivoBloqueo?, creadoEn)
GrupoConsulta(id, carreraId, cursoId, tema, nAlumnos,
              estado: abierto|resuelto, creadoEn, resueltoEn?)
Asesoria(id, grupoConsultaId, asesorId, modo: mensaje|llamada, texto?,
         duracionSegundos?, estrellas, creadoEn)
ValoracionAsesoria(id, asesoriaId, usuarioId, util: bool, creadoEn)   // anti-gaming

Encuesta(id, autorId, titulo, filtro: json, alcanceCalculado, alcanceEnviado,
         estado: borrador|enviada|cerrada, creadoEn)
Pregunta(id, encuestaId, orden, texto, tipo: unica|multiple|abierta, opciones: json)
EnvioEncuesta(id, encuestaId, destinatarioId,
              estado: pendiente|respondida|descartada|encolada, enviadoEn, respondidoEn?)
Respuesta(id, envioId, preguntaId, valor)
  // El emisor NUNCA accede a Respuesta ligada a destinatarioId. Solo agregados.

Habilidad(id, nombre, tipo: tecnica|blanda|rol|idioma)
UsuarioHabilidad(id, usuarioId, habilidadId, nivel: 0..3,
                 origen: declarada|con_evidencia|respaldada|verificada,
                 estrellas, actualizadoEn)
Evidencia(id, usuarioHabilidadId, tipo: certificado|hecho|respaldo,
          emisor?, horas?, nivelCertificado?, url?, archivoId?,
          hechoTipo?, hechoRefId?, propuestoPorAgente: bool, creadoEn)
Respaldo(id, usuarioHabilidadId, avalistaId, espacioComunId, comentario?, creadoEn)

Evento(id, espacioId?, titulo, descripcion, fechaInicio, lugar, oficial: bool, creadorId)
Reporte(id, tipo: mensaje|perfil|espacio|consulta, objetoId, autorId, motivo,
        estado: abierto|revisado|accionado, creadoEn)
```

**Índices que importan:** `Usuario(carreraId, ciclo, edad)` para el filtro de encuestas; `GrupoConsulta(carreraId, cursoId, tema, estado)` para la agrupación; `EnvioEncuesta(destinatarioId, enviadoEn)` para el tope semanal.

**Nivel y alcance son derivados, no columnas.** Se calculan de las evidencias. Guárdalos en caché si hace falta, pero la fuente son los hechos.

---

## 9. Mapa de pantallas

### Móvil — navegación inferior de 5 ítems: Inicio · Explorar · Grupos · Encuestas · Perfil

**Entrada**
- M01 Bienvenida y acceso con correo institucional
- M02 Verificación por código de 6 dígitos
- M03 Onboarding: perfil declarado (nombre, carrera, ciclo, sede, fecha de nacimiento)
- M04 Onboarding: intereses (chips)
- M05 Consentimientos — los cuatro, separados

**Núcleo**
- M06 Inicio: encuestas pendientes, consultas de tu carrera, tus grupos, eventos de la sede
- M07 Explorar: buscador de personas y grupos con filtros
- M08 Perfil de otro alumno + enviar solicitud
- M09 Solicitudes recibidas y enviadas
- M10 Conversación directa

**Espacios**
- M11 Grupos: tu espacio de carrera, tu subgrupo de ciclo, talleres, grupos de interés
- M12 Espacio de carrera (consultas agrupadas)
- M13 Subgrupo de ciclo (chat)
- M14 Detalle de grupo de interés o taller
- M15 Chat de grupo
- M16 Proponer un grupo (con contador de apoyos)
- M17 Solicitud de publicación en un grupo ajeno
- M18 Evento del grupo

**Consultas**
- M19 Hacer una consulta (curso, tema, texto) — con el aviso de moderación
- M20 Lista de consultas agrupadas (vista de ciclos superiores)
- M21 Responder una consulta (mensaje o llamada)
- M22 Valorar una respuesta recibida

**Encuestas**
- M23 Bandeja de encuestas + alcance actual
- M24 Crear encuesta: filtro con contador de alcance en vivo
- M25 Crear encuesta: estado bloqueado bajo 30 — **pantalla propia, no un mensaje de error**
- M26 Redactar preguntas
- M27 Responder una encuesta (una pregunta por pantalla)
- M28 Resultados agregados de una encuesta propia

**Perfil**
- M29 Mi perfil: habilidades con nivel y origen, hechos, estrellas
- M30 Detalle de una habilidad: evidencias y qué falta para el siguiente nivel
- M31 Agregar certificado (enlace o archivo)
- M32 Privacidad: los cuatro consentimientos, revocables
- M33 Centro de seguridad: reportar, bloquear, normas

### Web — panel de la universidad
- W01 Resumen: registrados, activos semanales, grupos creados, retención
- W02 Participación por facultad y por ciclo
- W03 **Alumnos destacados** — solo los que dieron el consentimiento 4
- W04 Publicar un evento segmentado por interés
- W05 Grupos y talleres: participación por taller
- W06 Configuración y marca (white-label)

**W01, W02 y W05 muestran solo agregados, con el umbral de 30 aplicado: ningún segmento con menos de 30 alumnos se muestra.** W03 es la única vista con nombres, y solo con consentimiento.

---

## 10. Dirección visual

**Principio:** juvenil pero institucional. El alumno tiene que sentir que es un espacio serio de su universidad, no otra red social de entretenimiento. Limpio, con mucho aire, tipografía grande y pocos colores. **Nada de gradientes, sombras pesadas, glassmorphism ni ilustraciones decorativas.**

```css
/* Marca — variables por universidad (white-label) */
--brand-primary:      #2F2A6B;   /* indigo profundo, por defecto */
--brand-primary-soft: #EDECF7;

/* Acento de acción */
--accent:             #00A896;
--accent-soft:        #E0F5F2;

/* Semánticos */
--success: #2DC75C;  --warning: #F2A541;  --danger: #E5484D;

/* Neutrales */
--ink:      #111318;   /* títulos */
--ink-soft: #5B6070;   /* cuerpo */
--line:     #E6E8EF;
--surface:  #F7F8FB;   /* fondo de pantalla */
--card:     #FFFFFF;

/* Forma */
--radius-sm: 8px; --radius-md: 16px; --radius-lg: 24px; --radius-pill: 999px;
--space: 4, 8, 12, 16, 24, 32, 48;
```

- **Tipografía:** Inter (alternativa: Plus Jakarta Sans). Display 28/36 bold · Título 22/28 bold · Subtítulo 17/24 semibold · Cuerpo 15/22 regular · Caption 13/18 regular. Nunca más de tres tamaños por pantalla.
- **Tarjeta de persona:** avatar circular 48px, nombre en seminegrita, debajo "Psicología · Ciclo 7 · Lima Norte" en caption gris, chip de interés en común, botón secundario a la derecha.
- **Movimiento:** nada de animación en acciones de teclado o que se repitan muchas veces al día (chat, buscador). Las animaciones de UI por debajo de 300 ms; feedback de botón 100-160 ms; modales 200-500 ms. `ease-out` para entradas, nunca `ease-in`. Respeta `prefers-reduced-motion`.
- **Modo oscuro obligatorio.** Define todos los colores como tokens y redefínelos; ningún color con su única definición dentro de un bloque de tema.
- **Datos de ejemplo:** nombres peruanos verosímiles pero ficticios, carreras reales de la UTP, grupos como "Startups UTP Lima Norte" o "Tesis UTP 2026".
- **No reproduzcas el logo oficial de la UTP** ni imites su identidad gráfica. "UTP" solo como texto.

---

## 11. Alcance del piloto

### 11.1 Dentro
Registro con correo institucional y perfil declarado · grupos de carrera y ciclo automáticos · espacio de carrera completo · grupos de taller espejados con horario · grupos de interés con creación libre y umbral de visibilidad · eventos que nacen del grupo · chat de grupo · buscador con filtros · mensaje directo con solicitud · **encuestas con filtro, umbral de 30 y alcance por nivel** · perfil de habilidades con niveles, hechos automáticos y certificados · los cuatro consentimientos · reportar y bloquear · panel web básico.

### 11.2 Fase 2
Flujo 1 completo con agrupación automática por agente (en el piloto, agrupación por curso + tema con etiquetas, sin IA: con pocos usuarios no hay dos preguntas parecidas que agrupar) · respaldos entre compañeros · niveles 2 y 3 llenos · solicitud de publicación · inscripción a talleres dentro de Kampus.

### 11.3 Fuera, conscientemente
- **Llamadas**, hasta resolver cómo se moderan. Es el único punto donde no se ve lo que pasa, y lo que mata a estas apps siempre es el primer caso grave.
- **Ranking público** (ver 5.7).
- Canales por tema dentro de los grupos · feed algorítmico · marketplace o pagos · opiniones de cursos como sección propia · grupo de egresados · verificación cruzada con la base de la universidad.

### 11.4 Orden de construcción

No es 1, 2, 3. Es:

**Grupos de taller → encuestas → consultas → habilidades.**

- Los grupos de taller no dependen de nadie: existen el día uno porque se espejan del portal. Resuelven el riesgo número uno.
- Las encuestas van segundo porque **traen al alumno de ciclos superiores**, que es el insumo de todo lo demás.
- Las consultas van tercero porque necesitan volumen.
- Las habilidades se **diseñan primero** (el modelo de datos toca todo) pero **se llenan al final**.

---

## 12. Los cuatro riesgos y lo descartado

### 12.1 Riesgos, cada uno con su mitigación

| Riesgo | Mitigación |
|---|---|
| **La app vacía** | Lanzar con los grupos de carrera y de taller ya poblados, y un ciclo de encuestas pactado con tres profesores desde el día uno |
| **Spam de encuestas** | Alcance por nivel, tope de 3 por semana con cola, mínimo de 30 por segmento |
| **Choque con la universidad** | La universidad ve agregados, nunca mensajes; el agente modera lo que se dice de docentes; no modera la universidad |
| **Lo legal** | Consentimientos separados por finalidad, datos mínimos, registro del banco de datos, asesoría legal desde la semana uno |

El riesgo número uno es siempre la app vacía: todo lo demás se arregla, eso no.

### 12.2 Decisiones descartadas — no las vuelvas a proponer

| Se descartó | Por qué |
|---|---|
| Canales por tema dentro de cada grupo (tipo Discord) | Complejidad innecesaria con pocos usuarios. Un espacio = un chat |
| Créditos como moneda que se gasta | Dos sistemas de puntos confunden. Se reemplazó por alcance desbloqueado por nivel |
| Dar puntaje por conectarse N días a la semana | Regala puntos por presencia, no por valor. Devuelve el spam que el sistema evita |
| Anonimato (modelo Fizz) | El valor del producto es justo lo contrario |
| Encuestas como enlace externo a Google Forms | Se pierde el filtro, el control de alcance y la tasa de respuesta |
| Feed algorítmico o contenido tipo TikTok | No hay volumen, y desvía el producto hacia entretenimiento |
| Premiar al que responde con acceso a más grupos | Convierte los grupos en moneda |
| Vender datos personales a la universidad | Ilegal bajo la Ley 29733 y mata la confianza |
| Pedir al alumno su ranking académico | Invita a mentir en la pantalla donde se decide confiar |
| Umbral fijo de 50 para crear un grupo | Es el 10% de la base del piloto. Nunca se alcanzaría |

---

## 13. Métricas

### 13.1 La métrica única del conjunto

**Porcentaje de interacciones que cruzan carreras.**

Si Kampus logra mucha actividad pero toda dentro de la misma carrera, fracasó: eso ya lo hace el grupo de WhatsApp del salón. Los tres flujos existen para producir cruce.

### 13.2 La métrica para venderle a la universidad

**Porcentaje de alumnos de ciclos 1 a 3 que participa en al menos una actividad extracurricular.**

Hoy debe ser bajísimo, la universidad lo puede medir en su propio portal, y se mueve en un ciclo. Vale más que el argumento de deserción, que tarda años en demostrarse.

### 13.3 Las del producto

| Métrica | Meta del piloto |
|---|---|
| Registrados sobre el total de la sede | 15% en un ciclo |
| Completa el onboarding | > 80% |
| Entra a al menos un grupo de interés | > 50% |
| Mensajes por activo semanal | > 3 |
| Tasa de respuesta de encuestas | > 35% |
| Solicitudes de mensaje aceptadas | > 40% |
| **Retención a 4 semanas** | **> 25%** — lo único que importa de verdad |

---

## 14. Glosario

| Término | Qué significa aquí |
|---|---|
| **Dato declarado** | Lo que el alumno escribió él mismo. El estado por defecto de todo perfil |
| **Dato verificado** | Lo que confirmó la universidad, o lo que observó Kampus dentro de la app |
| **Grupo de carrera y ciclo** | Cerrado y automático. Carrera + ciclo + sede |
| **Espacio de carrera** | Toda la carrera, todos los ciclos. Donde viven las consultas |
| **Grupo de interés** | Abierto, creado por alumnos, cruza carreras. Incluye los talleres |
| **Consulta agrupada** | Varias dudas parecidas juntadas en una sola para que una respuesta sirva a todos |
| **Solicitud de publicación** | Mandar un mensaje a un espacio ajeno sin entrar a él. El admin decide |
| **Alcance** | Cuántos alumnos caen en el filtro de una encuesta |
| **Alcance semanal** | A cuántos puede llegar el emisor, según su nivel de apoyo a la investigación |
| **Umbral de 30** | Mínimo de personas en un segmento para enviar una encuesta o mostrar una métrica |
| **Umbral de visibilidad** | Apoyos que necesita un grupo propuesto para aparecer en Explorar |
| **Estrella** | Unidad de evidencia de una habilidad. No es moneda: no se gasta |
| **White-label** | La app toma el nombre y el color de cada universidad |

---

## 15. Decisiones abiertas

Si el diseño toca uno de estos puntos, **pregunta a Jorge antes de decidir**. Él es el Product Owner y es quien cierra estas.

1. Qué sede exacta de la UTP es el piloto.
2. Si el flujo 1 (consultas) entra al piloto o espera a fase 2.
3. Qué hace exactamente el agente, más allá de agrupar y moderar: ¿redacta encuestas? ¿resume respuestas? ¿sugiere a quién encuestar? Son tres cosas distintas y solo una es MVP.
4. Quién modera los espacios de carrera al inicio, cuando no hay comunidad establecida.
5. Si se recupera "opiniones de cursos" como función propia, y bajo qué reglas.

---

## 16. Cómo trabajar en este proyecto

- **Respeta las decisiones tomadas.** Si una choca con otra o con la evidencia, dilo una vez con claridad y deja que Jorge decida; no la cambies por tu cuenta.
- **Separa hipótesis de hechos.** La hipótesis central —que conectar con gente de otra carrera sea un dolor frecuente y no episódico— todavía no está validada. No la presentes como probada.
- **No inventes cifras.** Usa las de la sección 2.2 con su fuente. Si falta un dato, dilo.
- **Distingue usuario de pagador.** El alumno nunca paga. Pagan la universidad, los organizadores de eventos y, con escala, las empresas.
- **Nunca propongas vender datos individuales.** Lo vendible es alcance segmentado y métricas agregadas con el umbral de 30.
- **En temas legales, aclara que no eres abogado** y recomienda que un especialista revise la política de privacidad antes de lanzar.
- Todos los textos de la interfaz en **español**, con nombres y carreras reales de la UTP.
