import React, { useState, useEffect } from 'react';
import { useStore } from '../data/store';
import ErrorConReintento from '../components/ErrorConReintento';
import CrearEncuesta from '../components/CrearEncuesta';
import {
  fetchUmbralMinimoSegmento,
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
  const [errorResponder, setErrorResponder] = useState('');
  const [errorResultados, setErrorResultados] = useState('');

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
      .catch(() => {}); // si falla se usa el valor por defecto; el servidor valida igual
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

  // --- VISTA PRINCIPAL: BANDEJA Y ALCANCE (M23) ---
  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight">
          Encuestas
        </h1>
        <p className="text-xs font-semibold text-ink-muted">
          Responde las de tus compañeros y crea las tuyas. Las respuestas son anónimas.
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
          Crear
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

      {/* SubTab 2: Crear encuesta en 3 pasos (M24–M26) */}
      {activeSubTab === 'crear' && (
        <CrearEncuesta
          user={user}
          umbralMinimo={umbralMinimo}
          alcanceSemanal={alcanceSemanal}
          onEnviada={() => {
            setActiveSubTab('mis_encuestas');
            cargarMisEncuestas();
          }}
          onIrABandeja={() => setActiveSubTab('bandeja')}
        />
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
