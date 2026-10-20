// Kampus Application State & Business Logic Engine
import { useState, useEffect, createContext, useContext } from 'react';
import {
  USUARIO_DEMO,
  ESPACIOS_INICIALES,
  CONSULTAS_AGRUPADAS_INICIALES,
  ENCUESTAS_BANDEJA_INICIALES,
  ENCUESTA_PROPIA_DEMO,
  BASE_ALUMNOS_SIMULADA,
  METRICAS_PANEL_UTP,
  HABILIDADES_BASE_NUEVO_ALUMNO
} from './mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getProfile, signOut } from '../lib/auth';

const StoreContext = createContext(null);

// v4: cambia la forma de consultas y propuestas (autorIds, apoyadoPor, estrellas pendientes).
// Subir la versión evita que el localStorage viejo de la v3 rompa la demo.
// v5: las imágenes ahora son locales (antes Unsplash). Subir versión limpia rutas viejas guardadas.
const STORAGE_KEY = 'kampus_state_v5';

// Firma visible de un alumno en una consulta: "Luz M. (Ciclo 5)"
export const firmaUsuario = (u) => `${u.nombre} ${(u.apellido || '').charAt(0)}. (Ciclo ${u.ciclo})`;

// Ciclo más alto entre los autores de una consulta (se lee de "(Ciclo N)")
const cicloMaximoAutores = (consulta) =>
  Math.max(0, ...(consulta.autores || []).map(a => Number((a.match(/Ciclo (\d+)/) || [])[1]) || 0));

// Umbral de visibilidad de grupos propuestos (Sección 7.2):
// umbralVisibilidad(baseActiva) = max(15, round(baseActiva * 0.03))
// En la demo la base activa es la muestra simulada de alumnos.
export const umbralVisibilidad = (baseActiva = BASE_ALUMNOS_SIMULADA.length) =>
  Math.max(15, Math.round(baseActiva * 0.03));

export function StoreProvider({ children }) {
  // Load saved state or default
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_user`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...USUARIO_DEMO, ...parsed, medallas: parsed.medallas || USUARIO_DEMO.medallas };
    }
    return USUARIO_DEMO;
  });

  const [espacios, setEspacios] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_espacios`);
    return saved ? JSON.parse(saved) : ESPACIOS_INICIALES;
  });

  const [consultas, setConsultas] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_consultas`);
    return saved ? JSON.parse(saved) : CONSULTAS_AGRUPADAS_INICIALES;
  });

  const [encuestasBandeja, setEncuestasBandeja] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_encuestas`);
    return saved ? JSON.parse(saved) : ENCUESTAS_BANDEJA_INICIALES;
  });

  const [encuestaPropia, setEncuestaPropia] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_encuesta_propia`);
    return saved ? JSON.parse(saved) : ENCUESTA_PROPIA_DEMO;
  });

  // App UI State — Comienza en inicio de sesión / registro para presentación fluida
  const [activeTab, setActiveTab] = useState('inicio'); // 'inicio' | 'explorar' | 'grupos' | 'encuestas' | 'perfil'
  const [currentScreen, setCurrentScreen] = useState('m01_bienvenida'); // 'app' | 'm01_bienvenida' | 'm02_otp' | 'm03_onboarding' | 'm04_intereses' | 'm05_consentimientos' | 'panel_utp'
  const [activeEspacioId, setActiveEspacioId] = useState(null);
  const [activeConsultaId, setActiveConsultaId] = useState(null);
  const [activeEncuestaId, setActiveEncuestaId] = useState(null);
  const [activeHabilidadId, setActiveHabilidadId] = useState(null);

  // Device & Presentation Mode
  const [deviceFrame, setDeviceFrame] = useState(true); // true = iPhone bezel, false = responsive full width
  const [darkMode, setDarkMode] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_user`, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_espacios`, JSON.stringify(espacios));
  }, [espacios]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_consultas`, JSON.stringify(consultas));
  }, [consultas]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_encuestas`, JSON.stringify(encuestasBandeja));
  }, [encuestasBandeja]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sincronización y persistencia de sesión real con Supabase Auth (Fase 2)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const perfil = await getProfile(session.user.id);
        if (perfil && perfil.nombre) {
          setUser({
            ...perfil,
            correoInstitucional: session.user.email,
            habilidades: perfil.habilidades || HABILIDADES_BASE_NUEVO_ALUMNO,
            certificados: perfil.certificados || [],
            medallas: []
          });
          setCurrentScreen('app');
        } else {
          setUser(prev => ({
            ...(prev || {}),
            id: session.user.id,
            correoInstitucional: session.user.email
          }));
          setCurrentScreen('m03_onboarding');
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(`${STORAGE_KEY}_user`);
        setUser(import.meta.env.VITE_MODO_DEMO === 'true' ? USUARIO_DEMO : null);
        setCurrentScreen('m01_bienvenida');
      } else if (event === 'SIGNED_IN' && session?.user) {
        const perfil = await getProfile(session.user.id);
        if (perfil && perfil.nombre) {
          setUser({
            ...perfil,
            correoInstitucional: session.user.email,
            habilidades: perfil.habilidades || HABILIDADES_BASE_NUEVO_ALUMNO,
            certificados: perfil.certificados || [],
            medallas: []
          });
          setCurrentScreen('app');
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Business Logic Helpers (Non-negotiable rules from Spec)

  // 1. Alcance Semanal según nivel de Apoyo a la investigación (Sección 5.2)
  // alcanceSemanal(usuario) = [0, 30, 80, 200][nivel(usuario, "apoyo_investigacion")]
  const getAlcanceSemanal = (usuario = user) => {
    const nivel = usuario?.habilidades?.apoyo_investigacion?.nivel || 0;
    const tabla = [0, 30, 80, 200];
    return tabla[Math.min(nivel, 3)];
  };

  // 2. Filtro y cálculo de alcance en vivo (Sección 6.5 & 7.4)
  const calcularAlcanceFiltro = (filtro) => {
    if (!filtro) return 0;
    return BASE_ALUMNOS_SIMULADA.filter(alumno => {
      // Sede (siempre cerrada por sede en piloto)
      if (filtro.sede && alumno.sede !== filtro.sede) return false;
      // Carrera (opcional o múltiple)
      if (filtro.carreras && filtro.carreras.length > 0) {
        if (!filtro.carreras.includes(alumno.carrera)) return false;
      }
      // Rango de ciclo
      if (filtro.cicloMin && alumno.ciclo < filtro.cicloMin) return false;
      if (filtro.cicloMax && alumno.ciclo > filtro.cicloMax) return false;
      // Rango de edad
      if (filtro.edadMin && alumno.edad < filtro.edadMin) return false;
      if (filtro.edadMax && alumno.edad > filtro.edadMax) return false;
      // Intereses
      if (filtro.intereses && filtro.intereses.length > 0) {
        const tieneInteresComun = filtro.intereses.some(i => alumno.intereses.includes(i));
        if (!tieneInteresComun) return false;
      }
      return true;
    }).length;
  };

  // 3. Moderación Automática de Consultas (Sección 7.1)
  // Regla dura: "Se habla del curso, no de la persona"
  const moderarConsultaTexto = (texto) => {
    const mencionaDocente = /\b(profe|profesor|profesora|docente|maestro|maestra)\b/i.test(texto);
    const emiteJuicio = /\b(mejor|peor|cu[aá]l|recomienda|evita|jala|regala|bueno|malo|dif[ií]cil|f[aá]cil)\b/i.test(texto);
    // Sin bandera /i: solo detecta mayúscula real después de "profesor" (un nombre propio).
    // Con /i, "el profesor dijo..." se bloqueaba por error.
    const nombrePropio = /\b[Pp]rofesor(a)?\s+[A-ZÁÉÍÓÚÑ]/.test(texto);

    if (mencionaDocente && emiteJuicio) {
      return {
        bloqueado: true,
        motivo: "Se habla del curso, no de la persona. Reformula hacia qué necesitas saber para llevarlo: qué temas pesan más, cómo son las evaluaciones, qué material conviene."
      };
    }

    if (nombrePropio) {
      return {
        bloqueado: true,
        motivo: "Mencionaste a un docente por su nombre. En Kampus se habla del contenido académico del curso, no de la persona."
      };
    }

    return { bloqueado: false, motivo: null };
  };

  // ¿El usuario actual es uno de los que preguntó?
  const esAutorDeConsulta = (consulta, usuario = user) =>
    (consulta.autorIds || []).includes(usuario.id) ||
    (consulta.autores || []).includes(firmaUsuario(usuario));

  // 4. Agregar consulta agrupada
  const agregarConsulta = (curso, tema, texto) => {
    const mod = moderarConsultaTexto(texto);
    if (mod.bloqueado) {
      return { exito: false, motivo: mod.motivo };
    }

    const firma = firmaUsuario(user);

    // Clave de agrupación (Sección 7.1): carrera + curso + tema
    const existente = consultas.find(
      c => c.carrera === user.carrera &&
           c.curso.toLowerCase() === curso.toLowerCase() &&
           c.tema.toLowerCase() === tema.toLowerCase()
    );

    if (existente) {
      // Anti-gaming: nAlumnos cuenta autores DISTINTOS. Preguntar dos veces no suma.
      if (esAutorDeConsulta(existente)) {
        return { exito: true, agrupada: true, yaEstabas: true, consultaId: existente.id };
      }
      setConsultas(prev => prev.map(c => {
        if (c.id !== existente.id) return c;
        const autorIds = [...(c.autorIds || []), user.id];
        const autores = [...c.autores, firma];
        return { ...c, autorIds, autores, nAlumnos: autores.length };
      }));
      return { exito: true, agrupada: true, consultaId: existente.id };
    } else {
      const nueva = {
        id: `grp_con_${Date.now()}`,
        carrera: user.carrera,
        curso,
        tema,
        textoResumen: texto,
        estado: "abierto",
        nAlumnos: 1,
        autorIds: [user.id],
        autores: [firma],
        fecha: "Ahora",
        respuestas: []
      };
      setConsultas([nueva, ...consultas]);
      return { exito: true, agrupada: false, consultaId: nueva.id };
    }
  };

  // 5. Responder a una consulta agrupada
  // Quién puede responder (Sección 7.1): ciclo >= 5 Y ciclo superior al de quien preguntó.
  // Las estrellas NO se acreditan aquí: quedan pendientes hasta que el que preguntó valore.
  const puedeOrientarConsulta = (consulta, usuario = user) => {
    if (usuario.ciclo < 5) {
      return { puede: false, motivo: "Solo alumnos de ciclo 5 o superior pueden orientar en consultas agrupadas." };
    }
    if (esAutorDeConsulta(consulta, usuario)) {
      return { puede: false, motivo: "No puedes orientar una consulta en la que tú preguntaste." };
    }
    const cicloMax = cicloMaximoAutores(consulta);
    if (usuario.ciclo <= cicloMax) {
      return { puede: false, motivo: `Para orientar aquí debes estar en un ciclo mayor que ${cicloMax}.` };
    }
    return { puede: true, motivo: null };
  };

  const responderConsulta = (consultaId, textoRespuesta, modo = "mensaje") => {
    const consulta = consultas.find(c => c.id === consultaId);
    if (!consulta) return { exito: false, motivo: "Consulta no encontrada." };

    const permiso = puedeOrientarConsulta(consulta);
    if (!permiso.puede) return { exito: false, motivo: permiso.motivo };

    // estrellas = (modo == "llamada" ? 3 : 1) * nAlumnos — solo si la consulta está agrupada (nAlumnos >= 2)
    const factorModo = modo === "llamada" ? 3 : 1;
    const estrellas = consulta.nAlumnos >= 2 ? factorModo * consulta.nAlumnos : 0;

    const nuevaRespuesta = {
      id: `resp_${Date.now()}`,
      asesorId: user.id,
      asesorNombre: `${user.nombre} ${user.apellido}`,
      asesorCiclo: user.ciclo,
      asesorCarrera: user.carrera,
      esMio: true,
      modo,
      texto: textoRespuesta,
      fecha: "Hace un momento",
      estrellasCalculadas: estrellas, // pendientes hasta la valoración
      valoraciones: [],
      calificadoPorSolicitante: false
    };

    setConsultas(prev => prev.map(c =>
      c.id === consultaId ? { ...c, respuestas: [...c.respuestas, nuevaRespuesta] } : c
    ));

    return { exito: true, estrellas, pendiente: true };
  };

  // Acredita la asesoría en "Predisposición a ayudar" del asesor.
  // Umbrales piloto: nivel 1 = 1 consulta · nivel 2 = 2 · nivel 3 = 5
  // En la demo solo se ve cuando el asesor es el usuario actual; con backend se acredita al asesorId.
  const acreditarAsesoria = (consulta, respuesta) => {
    if (!respuesta.esMio || respuesta.estrellasCalculadas <= 0) return;
    setUser(prev => {
      const hab = prev.habilidades.predisposicion_ayudar;
      const progreso = hab.progresoActual + 1;
      const nivel = progreso >= 5 ? 3 : progreso >= 2 ? 2 : 1;
      return {
        ...prev,
        habilidades: {
          ...prev.habilidades,
          predisposicion_ayudar: {
            ...hab,
            progresoActual: progreso,
            nivel,
            siguienteNivelMeta: nivel === 1 ? 2 : 5,
            estrellas: (hab.estrellas || 0) + respuesta.estrellasCalculadas,
            hechos: [
              `Orientó en duda académica de ${consulta.curso} (${consulta.nAlumnos} alumnos beneficiados)`,
              ...hab.hechos
            ]
          }
        }
      };
    });
  };

  // 6. Valorar respuesta (Anti-gaming: SOLO alguien que preguntó puede valorar,
  //    y recién ahí se acreditan las estrellas al asesor)
  const valorarRespuesta = (consultaId, respuestaId, util) => {
    const consulta = consultas.find(c => c.id === consultaId);
    if (!consulta || !esAutorDeConsulta(consulta)) {
      return { exito: false, motivo: "Solo quienes hicieron la consulta pueden valorar la respuesta." };
    }
    const respuesta = consulta.respuestas.find(r => r.id === respuestaId);
    if (!respuesta || respuesta.calificadoPorSolicitante) return { exito: false };

    setConsultas(prev => prev.map(c => {
      if (c.id !== consultaId) return c;
      return {
        ...c,
        respuestas: c.respuestas.map(r => r.id === respuestaId
          ? {
              ...r,
              calificadoPorSolicitante: true,
              valoraciones: [...r.valoraciones, { alumno: firmaUsuario(user), util }]
            }
          : r)
      };
    }));

    if (util) acreditarAsesoria(consulta, respuesta);
    return { exito: true };
  };

  // 7. Responder encuesta de la bandeja (Alimenta "Apoyo a la investigación")
  const responderEncuesta = (encuestaId, respuestasForm) => {
    setEncuestasBandeja(prev =>
      prev.map(e => (e.id === encuestaId ? { ...e, estado: "respondida" } : e))
    );

    // Incrementar progreso en habilidad
    const prevProgreso = user.habilidades.apoyo_investigacion.progresoActual + 1;
    const nuevoNivel = prevProgreso >= 8 ? 3 : prevProgreso >= 3 ? 2 : prevProgreso >= 1 ? 1 : 0;
    const siguienteMeta = nuevoNivel === 0 ? 1 : nuevoNivel === 1 ? 3 : 8;

    setUser(prev => ({
      ...prev,
      habilidades: {
        ...prev.habilidades,
        apoyo_investigacion: {
          ...prev.habilidades.apoyo_investigacion,
          progresoActual: prevProgreso,
          nivel: nuevoNivel,
          siguienteNivelMeta: siguienteMeta,
          estrellas: prev.habilidades.apoyo_investigacion.estrellas + 1,
          hechos: [
            `Respondió encuesta académica de investigación (${new Date().toLocaleDateString('es-PE')})`,
            ...prev.habilidades.apoyo_investigacion.hechos
          ]
        }
      }
    }));
  };

  // 8. Apoyar propuesta de grupo (Sección 7.2)
  // Cada alumno apoya UNA sola vez. El umbral sale de umbralVisibilidad(), no de un 15 fijo.
  const yaApoye = (esp, usuario = user) => (esp.apoyadoPor || []).includes(usuario.id);

  const apoyarGrupo = (espacioId) => {
    setEspacios(prev =>
      prev.map(esp => {
        if (esp.id !== espacioId || yaApoye(esp)) return esp;
        const nuevosApoyos = (esp.apoyosCount || 0) + 1;
        const umbral = umbralVisibilidad();
        return {
          ...esp,
          apoyadoPor: [...(esp.apoyadoPor || []), user.id],
          apoyosCount: nuevosApoyos,
          umbralRequerido: umbral,
          estado: nuevosApoyos >= umbral ? "visible" : esp.estado
        };
      })
    );
  };

  // 9. Enviar mensaje en un espacio
  const enviarMensaje = (espacioId, texto) => {
    if (!texto.trim()) return;
    const nuevoMsg = {
      id: `msg_${Date.now()}`,
      autor: `${user.nombre} ${user.apellido}`,
      texto,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      esMio: true
    };

    setEspacios(prev =>
      prev.map(esp => {
        if (esp.id === espacioId) {
          return {
            ...esp,
            ultimoMensaje: texto,
            horaUltimoMensaje: "Ahora",
            mensajes: [...(esp.mensajes || []), nuevoMsg]
          };
        }
        return esp;
      })
    );
  };

  // 10. Proponer nuevo grupo de interés
  const proponerGrupo = (nombre, descripcion) => {
    const nuevo = {
      id: `esp_prop_${Date.now()}`,
      tipo: "interes",
      nombre,
      descripcion,
      carrera: null,
      ciclo: null,
      sede: user.sede,
      creador: `${user.nombre} ${user.apellido} (${user.carrera})`,
      miembrosCount: 1,
      estado: "oculto",
      apoyosCount: 1, // El creador cuenta como primer apoyo
      apoyadoPor: [user.id],
      umbralRequerido: umbralVisibilidad(),
      esMiembro: true,
      oficial: false,
      ultimoMensaje: `Propuesta creada. Faltan ${umbralVisibilidad() - 1} apoyos para visibilidad pública.`,
      horaUltimoMensaje: "Ahora",
      mensajes: []
    };

    setEspacios(prev => [nuevo, ...prev]);

    // Alimenta liderazgo progreso
    const nuevoProg = user.habilidades.liderazgo.progresoActual + 1;
    setUser(prev => ({
      ...prev,
      habilidades: {
        ...prev.habilidades,
        liderazgo: {
          ...prev.habilidades.liderazgo,
          progresoActual: nuevoProg,
          nivel: nuevoProg >= 3 ? 3 : nuevoProg >= 2 ? 2 : nuevoProg >= 1 ? 1 : 0,
          hechos: [
            `Propuso la comunidad "${nombre}" en UTP Lima Sur`,
            ...prev.habilidades.liderazgo.hechos
          ]
        }
      }
    }));

    return nuevo.id;
  };

  // 11. Agregar certificado con reglas de anti-farmeo (Sección 5.5)
  const agregarCertificado = ({ habilidad, emisor, horas, url, archivoNombre, tieneEvaluacion }) => {
    // Clasificar: Básico, Intermedio, Avanzado
    // clasificar(horas, tieneEvaluacion) — Sección 5.5:
    //   horas > 60 (o examen supervisado) -> Avanzado
    //   horas >= 20 o tiene evaluación    -> Intermedio
    //   si no / horas desconocidas        -> Básico
    // Antes: cualquier curso con evaluación salía Avanzado.
    const h = Number(horas) || 0;
    let nivel = "Básico";
    if (h > 60) {
      nivel = "Avanzado";
    } else if (h >= 20 || tieneEvaluacion) {
      nivel = "Intermedio";
    }

    const nuevoCert = {
      id: `cert_${Date.now()}`,
      habilidad,
      emisor,
      horas: Number(horas) || 0,
      nivel,
      tieneEvaluacion: !!tieneEvaluacion,
      url: url || "",
      archivoNombre: archivoNombre || "",
      origen: "con_evidencia",
      propuestoPorAgente: true,
      aprobado: true,
      fecha: "Hoy"
    };

    setUser(prev => ({
      ...prev,
      certificados: [nuevoCert, ...prev.certificados]
    }));

    return nuevoCert;
  };

  // 12. Actualizar Consentimientos (Ley 29733, Sección 6.8)
  const toggleConsentimiento = (tipo) => {
    if (tipo === 'cuenta') return; // Bloqueado, obligatorio
    setUser(prev => ({
      ...prev,
      consentimientos: {
        ...prev.consentimientos,
        [tipo]: !prev.consentimientos[tipo]
      }
    }));
  };

  // Atajo rápido para presentación: entrar como Luz Martínez directamente
  const loginDirectoDemo = () => {
    setUser(USUARIO_DEMO);
    setActiveTab('inicio');
    setCurrentScreen('app');
  };

  // Cerrar sesión real con Supabase y volver a bienvenida
  const cerrarSesion = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('Error en signOut:', e);
    }
    localStorage.removeItem(`${STORAGE_KEY}_user`);
    setUser(null);
    setActiveTab('inicio');
    setCurrentScreen('m01_bienvenida');
  };

  // Reiniciar datos al demo inicial (útil para presentaciones)
  const resetDemoState = () => {
    localStorage.removeItem(`${STORAGE_KEY}_user`);
    localStorage.removeItem(`${STORAGE_KEY}_espacios`);
    localStorage.removeItem(`${STORAGE_KEY}_consultas`);
    localStorage.removeItem(`${STORAGE_KEY}_encuestas`);
    localStorage.removeItem(`${STORAGE_KEY}_encuesta_propia`);
    setUser(USUARIO_DEMO);
    setEspacios(ESPACIOS_INICIALES);
    setConsultas(CONSULTAS_AGRUPADAS_INICIALES);
    setEncuestasBandeja(ENCUESTAS_BANDEJA_INICIALES);
    setEncuestaPropia(ENCUESTA_PROPIA_DEMO);
    setActiveTab('inicio');
    setCurrentScreen('m01_bienvenida');
  };

  return (
    <StoreContext.Provider
      value={{
        user,
        setUser,
        espacios,
        consultas,
        encuestasBandeja,
        encuestaPropia,
        activeTab,
        setActiveTab,
        currentScreen,
        setCurrentScreen,
        activeEspacioId,
        setActiveEspacioId,
        activeConsultaId,
        setActiveConsultaId,
        activeEncuestaId,
        setActiveEncuestaId,
        activeHabilidadId,
        setActiveHabilidadId,
        deviceFrame,
        setDeviceFrame,
        darkMode,
        setDarkMode,
        quickJumpOpen,
        setQuickJumpOpen,
        getAlcanceSemanal,
        calcularAlcanceFiltro,
        moderarConsultaTexto,
        agregarConsulta,
        responderConsulta,
        puedeOrientarConsulta,
        esAutorDeConsulta,
        valorarRespuesta,
        yaApoye,
        responderEncuesta,
        apoyarGrupo,
        enviarMensaje,
        proponerGrupo,
        agregarCertificado,
        toggleConsentimiento,
        resetDemoState,
        loginDirectoDemo,
        cerrarSesion,
        metricasPanel: METRICAS_PANEL_UTP
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
