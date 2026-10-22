import React, { useState, useEffect } from 'react';
import { useStore } from '../data/store';
import { CARRERAS_UTP, INTERESES_DISPONIBLES } from '../data/mockData';
import ErrorConReintento from '../components/ErrorConReintento';
import {
  fetchUmbralMinimoSegmento,
  calcularAlcanceEnVivo,
  enviarEncuestaSegura,
  fetchBandejaEncuestas,
  fetchPreguntasEncuesta,
  responderEncuestaSegura,
  obtenerResultadosAgregados,
  fetchMisEncuestasCreadas
} from '../lib/surveys';
import {
  ClipboardList,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  PieChart,
  BarChart2,
  Sliders,
  Send,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function EncuestasView() {
  const { user, getAlcanceSemanal, refrescarHabilidades } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('bandeja'); // 'bandeja' | 'crear' | 'mis_encuestas'

  // Umbral dinámico leído de config (por defecto 30)
  const [umbralMinimo, setUmbralMinimo] = useState(30);

  // Bandeja real y mis encuestas
  const [bandejaReal, setBandejaReal] = useState([]);
  const [isLoadingBandeja, setIsLoadingBandeja] = useState(false);
  const [misEncuestas, setMisEncuestas] = useState([]);
  const [isLoadingMisEncuestas, setIsLoadingMisEncuestas] = useState(false);
  const [errorBandeja, setErrorBandeja] = useState('');
  const [errorMisEncuestas, setErrorMisEncuestas] = useState('');
  const [errorAlcance, setErrorAlcance] = useState('');
  const [errorResponder, setErrorResponder] = useState('');
  const [errorResultados, setErrorResultados] = useState('');
  const [resultadoEnvio, setResultadoEnvio] = useState(null);

  // Flujo Crear Encuesta: Filtro (M24)
  const [filtro, setFiltro] = useState({
    sede: user?.sede || 'Lima Sur',
    carreras: [user?.carrera || 'Enfermería'],
    cicloMin: 1,
    cicloMax: 10,
    edadMin: 18,
    edadMax: 30,
    intereses: []
  });

  const [alcanceCalculado, setAlcanceCalculado] = useState(0);
  const [isCalculandoAlcance, setIsCalculandoAlcance] = useState(false);
  const [crearStep, setCrearStep] = useState('filtro'); // 'filtro' | 'bloqueado_m25' | 'bloqueado_alcance' | 'preguntas'
  const [encuestaTitulo, setEncuestaTitulo] = useState('');
  const [encuestaObjetivo, setEncuestaObjetivo] = useState('');
  const [preguntasNuevas, setPreguntasNuevas] = useState([
    {
      id: 1,
      texto: '¿Cuántas horas dedicas al estudio independiente por semana?',
      tipo: 'unica',
      opciones: ['Menos de 3 horas', '3 a 6 horas', 'Más de 6 horas']
    }
  ]);
  const [isEnviandoEncuesta, setIsEnviandoEncuesta] = useState(false);
  const [encuestaEnviadaExito, setEncuestaEnviadaExito] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  // Flujo Responder Encuesta (M27)
  const [encuestaParaResponder, setEncuestaParaResponder] = useState(null);
  const [preguntasParaResponder, setPreguntasParaResponder] = useState([]);
  const [isLoadingPreguntas, setIsLoadingPreguntas] = useState(false);
  const [respuestasUsuario, setRespuestasUsuario] = useState({});
  const [preguntaIndex, setPreguntaIndex] = useState(0);
  const [isGuardandoRespuesta, setIsGuardandoRespuesta] = useState(false);
  const [respuestaFinalizada, setRespuestaFinalizada] = useState(false);

  // Resultados agregados seleccionados (M28)
  const [encuestaResultadosSeleccionada, setEncuestaResultadosSeleccionada] = useState(null);
  const [resultadosAgregados, setResultadosAgregados] = useState(null);
  const [isLoadingResultados, setIsLoadingResultados] = useState(false);

  // Alcance semanal según nivel de Apoyo a la Investigación [0, 30, 80, 200]
  const alcanceSemanal = getAlcanceSemanal(user);
  const nivelApoyo = user?.habilidades?.apoyo_investigacion?.nivel ?? 0;

  // Cargar umbral inicial y bandeja
  useEffect(() => {
    fetchUmbralMinimoSegmento()
      .then(setUmbralMinimo)
      .catch((err) => setErrorAlcance(err.message));
  }, []);

  const cargarBandeja = async () => {
    setIsLoadingBandeja(true);
    setErrorBandeja('');
    try {
      setBandejaReal(await fetchBandejaEncuestas());
    } catch (err) {
      setErrorBandeja(err.message);
    } finally {
      setIsLoadingBandeja(false);
    }
  };

  const cargarMisEncuestas = async () => {
    setIsLoadingMisEncuestas(true);
    setErrorMisEncuestas('');
    try {
      setMisEncuestas(await fetchMisEncuestasCreadas());
    } catch (err) {
      setErrorMisEncuestas(err.message);
    } finally {
      setIsLoadingMisEncuestas(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'bandeja') {
      cargarBandeja();
    } else if (activeSubTab === 'mis_encuestas') {
      cargarMisEncuestas();
    }
  }, [activeSubTab, user?.id]);

  // Recalcular alcance en vivo con RPC al cambiar filtros (M24)
  useEffect(() => {
    let timer = setTimeout(async () => {
      setIsCalculandoAlcance(true);
      setErrorAlcance('');
      try {
        const alcance = await calcularAlcanceEnVivo(filtro);
        setAlcanceCalculado(alcance);
      } catch (e) {
        setErrorAlcance(e.message);
      } finally {
        setIsCalculandoAlcance(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [filtro]);

  const toggleCarreraFiltro = (nombre) => {
    if (filtro.carreras.includes(nombre)) {
      if (filtro.carreras.length === 1) return;
      setFiltro({ ...filtro, carreras: filtro.carreras.filter(c => c !== nombre) });
    } else {
      setFiltro({ ...filtro, carreras: [...filtro.carreras, nombre] });
    }
  };

  const handleVerificarFiltro = () => {
    if (errorAlcance || isCalculandoAlcance) return;
    // Si el alcance es menor al umbral configurado (30), bloquear con pantalla M25
    if (alcanceCalculado < umbralMinimo) {
      setCrearStep('bloqueado_m25');
      return;
    }
    // Si el alcance semanal del alumno es 0 (no ha apoyado encuestas antes)
    if (alcanceSemanal === 0) {
      setCrearStep('bloqueado_alcance');
      return;
    }
    setCrearStep('preguntas');
  };

  // Enviar encuesta mediante RPC de servidor (M26)
  const handleEnviarEncuestaFinal = async (e) => {
    e.preventDefault();
    if (!encuestaTitulo.trim() || isEnviandoEncuesta) return;

    if (alcanceCalculado < umbralMinimo) {
      setCrearStep('bloqueado_m25');
      return;
    }

    if (alcanceSemanal === 0) {
      setCrearStep('bloqueado_alcance');
      return;
    }

    setIsEnviandoEncuesta(true);
    setErrorEnvio('');

    try {
      const res = await enviarEncuestaSegura({
        titulo: encuestaTitulo,
        descripcion: encuestaObjetivo,
        filtro,
        preguntas: preguntasNuevas
      });

      setResultadoEnvio(res);
      setEncuestaEnviadaExito(true);
      setTimeout(() => {
        setEncuestaEnviadaExito(false);
        setCrearStep('filtro');
        setEncuestaTitulo('');
        setEncuestaObjetivo('');
        setActiveSubTab('mis_encuestas');
        cargarMisEncuestas();
      }, 2500);
    } catch (err) {
      setErrorEnvio(err.message);
    } finally {
      setIsEnviandoEncuesta(false);
    }
  };

  // Iniciar respuesta de encuesta (M27)
  const handleIniciarResponder = async (encuesta) => {
    setEncuestaParaResponder(encuesta);
    setPreguntaIndex(0);
    setRespuestasUsuario({});
    setRespuestaFinalizada(false);
    setErrorResponder('');
    setPreguntasParaResponder([]);
    setIsLoadingPreguntas(true);

    try {
      setPreguntasParaResponder(await fetchPreguntasEncuesta(encuesta.encuestaId));
    } catch (err) {
      setErrorResponder(err.message);
    } finally {
      setIsLoadingPreguntas(false);
    }
  };

  const handleSeleccionarOpcionRespuesta = (preguntaId, opcion) => {
    setRespuestasUsuario(prev => ({
      ...prev,
      [preguntaId]: opcion
    }));
  };

  const handleSiguientePregunta = async () => {
    if (!encuestaParaResponder || !preguntasParaResponder.length) return;

    if (preguntaIndex < preguntasParaResponder.length - 1) {
      setPreguntaIndex(preguntaIndex + 1);
    } else {
      // Última pregunta: guardar respuestas de forma segura
      setIsGuardandoRespuesta(true);
      setErrorResponder('');
      try {
        await responderEncuestaSegura({
          envioId: encuestaParaResponder.envioId,
          respuestas: respuestasUsuario
        });

        // El nivel lo recalcula el servidor a partir de las encuestas respondidas
        refrescarHabilidades?.();

        setRespuestaFinalizada(true);
        setTimeout(() => {
          setEncuestaParaResponder(null);
          setRespuestaFinalizada(false);
          cargarBandeja();
        }, 1500);
      } catch (err) {
        setErrorResponder(err.message);
      } finally {
        setIsGuardandoRespuesta(false);
      }
    }
  };

  // Ver resultados agregados de una encuesta (M28)
  const handleVerResultados = async (enc) => {
    setEncuestaResultadosSeleccionada(enc);
    setResultadosAgregados(null);
    setErrorResultados('');
    setIsLoadingResultados(true);
    try {
      setResultadosAgregados(await obtenerResultadosAgregados(enc.id));
    } catch (err) {
      setErrorResultados(err.message);
    } finally {
      setIsLoadingResultados(false);
    }
  };

  // --- M27: RESPONDER ENCUESTA (1 PREGUNTA POR PANTALLA) ---
  if (encuestaParaResponder) {
    const totalPreguntas = preguntasParaResponder.length;
    const currentP = preguntasParaResponder[preguntaIndex];
    const tieneRespuesta = currentP && !!respuestasUsuario[currentP.id];

    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-line dark:border-line-dark">
            <button
              onClick={() => setEncuestaParaResponder(null)}
              className="text-xs font-bold text-ink-muted hover:text-ink flex items-center space-x-1"
            >
              <ArrowLeft size={18} />
              <span>Volver</span>
            </button>
            <span className="text-xs font-black text-accent">
              Pregunta {preguntaIndex + 1} de {totalPreguntas || 1}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-200 dark:bg-line-dark rounded-full overflow-hidden mt-3.5">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((preguntaIndex + 1) / (totalPreguntas || 1)) * 100}%` }}
            />
          </div>

          {isLoadingPreguntas ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2 text-ink-muted">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando preguntas de la encuesta...</p>
            </div>
          ) : respuestaFinalizada ? (
            <div className="p-8 text-center space-y-3 bg-white dark:bg-surface-cardDark rounded-3xl border-2 border-emerald-300 mt-6 animate-fadeIn">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
              <h3 className="text-base font-black text-ink dark:text-ink-light">
                ¡Encuesta completada con éxito!
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Tus respuestas fueron agregadas anónimamente. Suma a tu habilidad <strong>Apoyo a la investigación</strong>.
              </p>
            </div>
          ) : errorResponder && !currentP ? (
            <div className="mt-6">
              <ErrorConReintento mensaje={errorResponder} onReintentar={() => handleIniciarResponder(encuestaParaResponder)} />
            </div>
          ) : currentP ? (
            <div className="mt-6 space-y-3">
              <span className="text-xs font-black text-brand-primary dark:text-teal-300 uppercase tracking-wider block">
                {encuestaParaResponder.titulo}
              </span>
              <h2 className="text-base font-black text-ink dark:text-ink-light tracking-tight leading-snug">
                {currentP.texto}
              </h2>

              {/* Opciones */}
              <div className="space-y-2.5 pt-2">
                {(currentP.opciones || []).map((opcion) => {
                  const seleccionada = respuestasUsuario[currentP.id] === opcion;
                  return (
                    <button
                      key={opcion}
                      type="button"
                      onClick={() => handleSeleccionarOpcionRespuesta(currentP.id, opcion)}
                      className={`w-full p-4 rounded-2xl border-2 text-left text-sm font-semibold transition ${
                        seleccionada
                          ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                          : 'bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light border-line dark:border-line-dark hover:border-brand-primary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          seleccionada ? 'border-white bg-white text-brand-primary' : 'border-ink-muted'
                        }`}>
                          {seleccionada && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary" />}
                        </div>
                        <span className="leading-snug">{opcion}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {!respuestaFinalizada && (
          <div className="space-y-3 pt-5">
            {errorResponder && currentP && <ErrorConReintento compacto mensaje={errorResponder} />}
            <div className="flex items-center space-x-1.5 text-xs text-ink-muted justify-center font-medium">
              <ShieldCheck size={16} className="text-accent" />
              <span>Tus respuestas son totalmente anónimas y confidenciales</span>
            </div>

            <button
              onClick={handleSiguientePregunta}
              disabled={!tieneRespuesta || isGuardandoRespuesta}
              className="w-full py-3.5 bg-brand-primary disabled:opacity-40 hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition"
            >
              {isGuardandoRespuesta ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{preguntaIndex < totalPreguntas - 1 ? 'Siguiente Pregunta' : 'Finalizar y Sumar Apoyo a Tesis'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- M25: ESTADO BLOQUEADO (< 30) (PANTALLA DEDICADA) ---
  if (crearStep === 'bloqueado_m25') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn">
        <div>
          <button
            onClick={() => setCrearStep('filtro')}
            className="p-1 -ml-1 text-ink-muted hover:text-ink mb-4 flex items-center space-x-1 text-xs font-bold"
          >
            <ArrowLeft size={18} />
            <span>Ajustar filtro</span>
          </button>

          <div className="k-card p-5 space-y-4 border-2 border-amber-300 dark:border-amber-900/60 rounded-3xl bg-white dark:bg-surface-cardDark shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>

            <div>
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider block">
                Faltan compañeros
              </span>
              <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-1">
                Para cuidar el anonimato, tu encuesta necesita llegar a más compañeros
              </h1>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900">
              <div className="text-3xl font-black text-amber-700 dark:text-amber-300">
                {alcanceCalculado} {alcanceCalculado === 1 ? 'compañero' : 'compañeros'} con este filtro
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold mt-1.5 leading-relaxed">
                Necesitas al menos {umbralMinimo} para que nadie pueda deducir quién respondió qué.
              </p>
            </div>

            <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
              Te recomendamos ampliar los ciclos o incluir otras carreras afines de tu sede para que tu investigación tenga el alcance necesario.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-4">
          <button
            onClick={() => {
              setFiltro(prev => ({
                ...prev,
                carreras: ['Enfermería', 'Psicología', 'Ingeniería Industrial', 'Ingeniería de Sistemas'],
                cicloMin: 1,
                cicloMax: 10
              }));
              setCrearStep('filtro');
            }}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl shadow-sm transition"
          >
            Ampliar el filtro automáticamente
          </button>
          <button
            onClick={() => setCrearStep('filtro')}
            className="w-full py-2.5 bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light font-bold text-xs rounded-xl border border-line dark:border-line-dark"
          >
            Ajustar manualmente
          </button>
        </div>
      </div>
    );
  }

  // --- BLOQUEO POR ALCANCE SEMANAL 0 (Nivel 0 Apoyo a la Investigación) ---
  if (crearStep === 'bloqueado_alcance') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn">
        <div>
          <button
            onClick={() => setCrearStep('filtro')}
            className="p-1 -ml-1 text-ink-muted hover:text-ink mb-4 flex items-center space-x-1 text-xs font-bold"
          >
            <ArrowLeft size={18} />
            <span>Volver al filtro</span>
          </button>

          <div className="k-card p-5 space-y-4 border-2 border-line dark:border-line-dark rounded-3xl bg-white dark:bg-surface-cardDark shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <span className="text-xs font-black text-accent uppercase tracking-wider block">
                Aún no puedes enviar encuestas
              </span>
              <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-1">
                Primero ayuda a alguien
              </h1>
            </div>
            <p className="text-sm text-ink-soft dark:text-ink-muted leading-relaxed">
              Responde una encuesta de otro alumno y desbloquea la opción de enviar las tuyas. Mientras más encuestas respondas, a más compañeros podrá llegar la tuya.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={() => {
              setCrearStep('filtro');
              setActiveSubTab('bandeja');
            }}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl shadow-sm transition"
          >
            Ir a mi bandeja de encuestas
          </button>
        </div>
      </div>
    );
  }

  // --- M26: REDACTAR PREGUNTAS ---
  if (crearStep === 'preguntas') {
    return (
      <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-line dark:border-line-dark">
          <button
            onClick={() => setCrearStep('filtro')}
            className="p-1 -ml-1 text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-sm font-black text-ink dark:text-ink-light">
              Paso 2: Redactar Preguntas
            </h2>
            <p className="text-xs text-accent font-bold">
              Destinatarios: {Math.min(alcanceCalculado, alcanceSemanal)} alumnos
            </p>
          </div>
        </div>

        {encuestaEnviadaExito ? (
          <div className="k-card p-8 text-center space-y-3 rounded-3xl border-2 border-emerald-300 bg-white dark:bg-surface-cardDark shadow-sm">
            <CheckCircle2 size={44} className="text-semantic-success mx-auto" />
            <h3 className="text-base font-black text-ink dark:text-ink-light">
              ¡Encuesta enviada con éxito!
            </h3>
            <p className="text-xs text-ink-soft dark:text-ink-muted">
              {resultadoEnvio
                ? `Llegó a la bandeja de ${resultadoEnvio.enviados} estudiantes${resultadoEnvio.encolados ? ` y ${resultadoEnvio.encolados} la recibirán cuando liberen cupo (máximo 3 encuestas por semana)` : ''}.`
                : ''}
            </p>
          </div>
        ) : (
          <form onSubmit={handleEnviarEncuestaFinal} className="k-card p-4 space-y-3.5 border-2 border-line/80 dark:border-line-dark rounded-2xl bg-white dark:bg-surface-cardDark shadow-sm">
            <div>
              <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                Título del estudio
              </label>
              <input
                type="text"
                placeholder="Ej: Rendimiento en prácticas clínicas hospitalarias"
                value={encuestaTitulo}
                onChange={(e) => setEncuestaTitulo(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                Objetivo
              </label>
              <input
                type="text"
                placeholder="Ej: Tesis de bachiller / Suficiencia profesional"
                value={encuestaObjetivo}
                onChange={(e) => setEncuestaObjetivo(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
                required
              />
            </div>

            <div className="space-y-2 pt-1">
              <span className="text-xs font-black text-ink dark:text-ink-light block">
                Pregunta del formulario
              </span>

              {preguntasNuevas.map((p, idx) => (
                <div key={p.id} className="p-3.5 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark space-y-2.5">
                  <input
                    type="text"
                    value={p.texto}
                    onChange={(e) => {
                      const updated = [...preguntasNuevas];
                      updated[idx].texto = e.target.value;
                      setPreguntasNuevas(updated);
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary"
                  />
                  <div className="space-y-1.5">
                    {p.opciones.map((opc, opcIdx) => (
                      <div key={opcIdx} className="flex items-center space-x-2 text-xs text-ink-soft">
                        <span className="text-ink-muted font-bold">•</span>
                        <span>{opc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {errorEnvio && (
              <p className="text-xs text-semantic-danger font-semibold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200">
                {errorEnvio}
              </p>
            )}

            <button
              type="submit"
              disabled={!encuestaTitulo.trim() || isEnviandoEncuesta}
              className="w-full py-3.5 bg-brand-primary disabled:opacity-40 hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition"
            >
              {isEnviandoEncuesta ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>Enviar a bandejas estudiantiles</span>
                  <Send size={15} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    );
  }

  // --- VISTA PRINCIPAL: BANDEJA Y ALCANCE (M23) ---
  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight">
          Encuestas Académicas
        </h1>
        <p className="text-xs font-semibold text-ink-muted">
          Datos de investigación reales sin recurrir a muestras inventadas
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex bg-white dark:bg-surface-cardDark p-1.5 rounded-2xl border border-line dark:border-line-dark shadow-sm">
        <button
          onClick={() => setActiveSubTab('bandeja')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'bandeja'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          Bandeja
        </button>
        <button
          onClick={() => setActiveSubTab('crear')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'crear'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          Crear Encuesta
        </button>
        <button
          onClick={() => setActiveSubTab('mis_encuestas')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'mis_encuestas'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          Mis Resultados
        </button>
      </div>

      {/* SubTab 1: Bandeja (M23) */}
      {activeSubTab === 'bandeja' && (
        <div className="space-y-4">
          {/* Card: Alcance Semanal Desbloqueado */}
          <div className="bg-gradient-to-r from-brand-primary via-[#2E2675] to-[#3B3294] text-white p-4 rounded-2xl shadow-sm space-y-2 border border-brand-primary/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Unlock size={14} />
                <span>Tus encuestas</span>
              </span>
              <span className="text-xs bg-white/20 font-black px-2.5 py-0.5 rounded-full">
                Nivel {nivelApoyo} de 3
              </span>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black tracking-tight">{alcanceSemanal}</span>
              <span className="text-xs text-indigo-100 font-semibold">compañeros por semana pueden recibir tus encuestas</span>
            </div>

            <p className="text-xs text-indigo-200 pt-1.5 border-t border-white/10 font-medium">
              Mientras más encuestas de otros respondas, a más compañeros podrá llegar la tuya.
            </p>
          </div>

          {/* Listado de Encuestas Recibidas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-ink-muted">
                Bandeja Semanal (Tope: 3 por semana)
              </h3>
              <span className="text-xs text-ink-muted font-semibold">
                {bandejaReal.filter(e => e.estado === 'pendiente').length} pendientes
              </span>
            </div>

            {isLoadingBandeja && bandejaReal.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-ink-muted space-y-2">
                <Loader2 size={22} className="animate-spin text-accent" />
                <p className="text-xs font-semibold">Cargando bandeja de encuestas...</p>
              </div>
            ) : errorBandeja ? (
              <ErrorConReintento mensaje={errorBandeja} onReintentar={cargarBandeja} />
            ) : bandejaReal.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark space-y-1">
                <p className="font-bold text-sm text-ink dark:text-ink-light">No tienes encuestas por responder</p>
                <p>Cuando un compañero envíe una encuesta a un grupo en el que estás, llegará aquí. Responder una te da Nivel 1 en Apoyo a la investigación.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {bandejaReal.map((enc) => {
                  const esPendiente = enc.estado === 'pendiente';

                  return (
                    <div
                      key={enc.envioId || enc.id}
                      className={`k-card p-4 space-y-2.5 border-2 ${
                        esPendiente ? 'border-brand-primary/50' : 'border-line/70 opacity-90'
                      } rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-brand-primary dark:text-teal-300">
                              Investigación UTP
                            </span>
                            <span className="text-xs text-ink-muted">• {enc.duracionMin || 2} min</span>
                          </div>
                          <h4 className="text-sm font-black text-ink dark:text-ink-light mt-0.5">
                            {enc.titulo}
                          </h4>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          esPendiente ? 'bg-accent text-white shadow-sm' : 'bg-slate-100 text-ink-muted'
                        }`}>
                          {esPendiente ? 'Pendiente' : 'Respondida'}
                        </span>
                      </div>

                      <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-2 font-medium leading-relaxed">
                        {enc.objetivo || enc.descripcion}
                      </p>

                      <div className="pt-2 border-t border-line dark:border-line-dark flex items-center justify-between text-xs">
                        <span className="text-ink-muted font-medium">Estudio universitario en sede</span>
                        {esPendiente ? (
                          <button
                            onClick={() => handleIniciarResponder(enc)}
                            className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center space-x-1"
                          >
                            <span>Responder</span>
                            <ArrowRight size={13} />
                          </button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                            <CheckCircle2 size={14} />
                            <span>Apoyo sumado</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SubTab 2: Crear Encuesta y Filtro en Vivo (M24) */}
      {activeSubTab === 'crear' && (
        <div className="space-y-4">
          {/* Card Contador Grande en Vivo */}
          <div className="k-card p-4 text-center space-y-1.5 border-2 border-brand-primary/40 rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark">
            <span className="text-xs font-black text-ink-muted uppercase tracking-wider">
              Alcance de tu filtro en vivo
            </span>
            <div className={`text-4xl font-black ${
              alcanceCalculado < umbralMinimo ? 'text-semantic-danger' : 'text-brand-primary dark:text-teal-300'
            }`}>
              {isCalculandoAlcance ? (
                <Loader2 size={32} className="animate-spin inline text-accent" />
              ) : (
                alcanceCalculado
              )}
            </div>
            <p className="text-xs text-ink-soft dark:text-ink-muted font-semibold">
              estudiantes cumplen este perfil
            </p>

            {errorAlcance ? (
              <div className="mt-2">
                <ErrorConReintento compacto mensaje={errorAlcance} onReintentar={() => setFiltro({ ...filtro })} />
              </div>
            ) : alcanceCalculado < umbralMinimo ? (
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border border-amber-200">
                <AlertTriangle size={15} />
                <span>Para cuidar el anonimato, tu encuesta necesita llegar a más compañeros. Amplía el filtro.</span>
              </div>
            ) : (
              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border border-emerald-200">
                <CheckCircle2 size={15} />
                <span>Listo: llega a suficientes compañeros para cuidar el anonimato</span>
              </div>
            )}
          </div>

          {/* Filtros de Carrera */}
          <div className="k-card p-4 space-y-3.5 text-xs border-2 border-line/80 dark:border-line-dark rounded-2xl bg-white dark:bg-surface-cardDark shadow-sm">
            <div>
              <label className="block font-bold text-ink dark:text-ink-light mb-1.5">
                Carreras a encuestar
              </label>
              <div className="flex flex-wrap gap-2">
                {CARRERAS_UTP.slice(0, 6).map(c => {
                  const sel = filtro.carreras.includes(c.nombre);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCarreraFiltro(c.nombre)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                        sel
                          ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                          : 'bg-surface dark:bg-surface-dark text-ink border-line dark:border-line-dark'
                      }`}
                    >
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ciclos Min - Max */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-ink dark:text-ink-light mb-1">
                  Ciclo min: {filtro.cicloMin}.°
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={filtro.cicloMin}
                  onChange={(e) => setFiltro({ ...filtro, cicloMin: Number(e.target.value) })}
                  className="w-full accent-brand-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-ink dark:text-ink-light mb-1">
                  Ciclo max: {filtro.cicloMax}.°
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={filtro.cicloMax}
                  onChange={(e) => setFiltro({ ...filtro, cicloMax: Number(e.target.value) })}
                  className="w-full accent-brand-primary"
                />
              </div>
            </div>

            {/* Edades Min - Max */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-ink dark:text-ink-light mb-1">
                  Edad min: {filtro.edadMin} años
                </label>
                <input
                  type="range"
                  min="14"
                  max="35"
                  value={filtro.edadMin}
                  onChange={(e) => setFiltro({ ...filtro, edadMin: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>

              <div>
                <label className="block font-bold text-ink dark:text-ink-light mb-1">
                  Edad max: {filtro.edadMax} años
                </label>
                <input
                  type="range"
                  min="14"
                  max="35"
                  value={filtro.edadMax}
                  onChange={(e) => setFiltro({ ...filtro, edadMax: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleVerificarFiltro}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition"
          >
            <span>Verificar y Redactar Preguntas</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* SubTab 3: Mis Resultados Propios (M28) */}
      {activeSubTab === 'mis_encuestas' && (
        <div className="space-y-3">
          {isLoadingMisEncuestas && misEncuestas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando tus estudios...</p>
            </div>
          ) : errorMisEncuestas ? (
            <ErrorConReintento mensaje={errorMisEncuestas} onReintentar={cargarMisEncuestas} />
          ) : misEncuestas.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark space-y-2">
              <ClipboardList size={32} className="mx-auto text-ink-muted/50" />
              <p className="font-bold text-sm text-ink dark:text-ink-light">Aún no has creado encuestas</p>
              <p className="text-xs text-ink-muted">Usa la pestaña "Crear Encuesta" para lanzar tu primer estudio de tesis.</p>
              <button
                onClick={() => setActiveSubTab('crear')}
                className="mt-2 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl"
              >
                Crear encuesta
              </button>
            </div>
          ) : (
            misEncuestas.map((enc) => (
              <div
                key={enc.id}
                className="k-card p-4 space-y-3 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full">
                      {enc.estado === 'enviada' ? 'Estudio Activo' : 'Completado'}
                    </span>
                    <h3 className="text-sm font-black text-ink dark:text-ink-light mt-1.5 leading-snug">
                      {enc.titulo}
                    </h3>
                    <p className="text-xs text-ink-muted font-medium mt-0.5">
                      Alcance enviado: {enc.alcanceEnviado} estudiantes
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-line dark:border-line-dark text-center">
                  <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl">
                    <span className="text-2xl font-black text-brand-primary dark:text-teal-300">
                      {enc.respuestasCount || 0}
                    </span>
                    <p className="text-xs text-ink-muted font-bold">Respuestas Recibidas</p>
                  </div>
                  <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl">
                    <span className="text-2xl font-black text-accent">
                      {enc.alcanceEnviado > 0 ? Math.round(((enc.respuestasCount || 0) / enc.alcanceEnviado) * 100) : 0}%
                    </span>
                    <p className="text-xs text-ink-muted font-bold">Tasa de Respuesta</p>
                  </div>
                </div>

                <button
                  onClick={() => handleVerResultados(enc)}
                  className="w-full py-2 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition"
                >
                  <BarChart2 size={14} />
                  <span>Ver Resultados Agregados</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Resultados Agregados de Encuesta (M28) */}
      {encuestaResultadosSeleccionada && (
        <div className="fixed inset-0 !m-0 bg-black/60 z-50 flex items-center justify-center px-4 safe-overlay">
          <div className="w-full max-w-sm max-h-full overflow-y-auto bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5 flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark shrink-0">
              <span className="text-xs font-black uppercase text-ink dark:text-ink-light tracking-wider">
                Resultados de la Encuesta
              </span>
              <button
                onClick={() => setEncuestaResultadosSeleccionada(null)}
                className="p-1 text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              <h3 className="text-sm font-black text-ink dark:text-ink-light leading-snug">
                {encuestaResultadosSeleccionada.titulo}
              </h3>

              {isLoadingResultados ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-2 text-ink-muted">
                  <Loader2 size={24} className="animate-spin text-accent" />
                  <p className="text-xs font-semibold">Cargando resultados agregados...</p>
                </div>
              ) : errorResultados ? (
                <ErrorConReintento mensaje={errorResultados} onReintentar={() => handleVerResultados(encuestaResultadosSeleccionada)} />
              ) : resultadosAgregados?.total_respuestas === 0 ? (
                <p className="text-xs text-ink-muted text-center py-6">
                  Aún no se han recibido respuestas para este estudio.
                </p>
              ) : resultadosAgregados?.preguntas && resultadosAgregados.preguntas.length > 0 ? (
                resultadosAgregados.preguntas.map((q, qIdx) => {
                  const conteos = q.conteo_respuestas || {};
                  const totalVotos = Object.values(conteos).reduce((acc, v) => acc + (Number(v) || 0), 0);

                  return (
                    <div key={q.pregunta_id || qIdx} className="p-3 bg-surface dark:bg-surface-dark rounded-xl space-y-2">
                      <p className="text-xs font-extrabold text-ink dark:text-ink-light">
                        {q.texto}
                      </p>
                      <div className="space-y-2">
                        {q.opciones?.map((opc) => {
                          const votos = Number(conteos[opc] || 0);
                          const pct = totalVotos > 0 ? Math.round((votos / totalVotos) * 100) : 0;

                          return (
                            <div key={opc} className="space-y-1">
                              <div className="flex justify-between text-xs text-ink-muted">
                                <span>{opc}</span>
                                <span className="font-bold">{pct}% ({votos})</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-primary dark:bg-accent rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-ink-muted text-center py-6">
                  Aún no se han recibido respuestas para este estudio.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-line dark:border-line-dark flex justify-end shrink-0">
              <button
                onClick={() => setEncuestaResultadosSeleccionada(null)}
                className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
