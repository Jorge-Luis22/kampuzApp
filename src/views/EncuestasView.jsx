import React, { useState } from 'react';
import { useStore } from '../data/store';
import { CARRERAS_UTP, INTERESES_DISPONIBLES } from '../data/mockData';
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
  ChevronRight
} from 'lucide-react';

export default function EncuestasView() {
  const {
    user,
    encuestasBandeja,
    encuestaPropia,
    getAlcanceSemanal,
    calcularAlcanceFiltro,
    responderEncuesta
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('bandeja'); // 'bandeja' | 'crear' | 'mis_encuestas'

  // Flujo Crear Encuesta: Filtro (M24)
  const [filtro, setFiltro] = useState({
    sede: 'Lima Sur',
    carreras: ['Enfermería'],
    cicloMin: 3,
    cicloMax: 7,
    edadMin: 18,
    edadMax: 26,
    intereses: []
  });

  const [crearStep, setCrearStep] = useState('filtro'); // 'filtro' | 'bloqueado_m25' | 'preguntas'
  const [encuestaTitulo, setEncuestaTitulo] = useState('');
  const [encuestaObjetivo, setEncuestaObjetivo] = useState('');
  const [preguntasNuevas, setPreguntasNuevas] = useState([
    {
      id: 1,
      texto: '¿Cuántas horas dedicas a la preparación de prácticas clínicas por semana?',
      tipo: 'unica',
      opciones: ['Menos de 3 horas', '3 a 6 horas', 'Más de 6 horas']
    }
  ]);
  const [encuestaEnviadaExito, setEncuestaEnviadaExito] = useState(false);

  // Flujo Responder Encuesta (M27)
  const [encuestaParaResponder, setEncuestaParaResponder] = useState(null);
  const [respuestasUsuario, setRespuestasUsuario] = useState({});
  const [preguntaIndex, setPreguntaIndex] = useState(0);

  // Cálculos en vivo
  const alcanceSemanal = getAlcanceSemanal(user);
  const alcanceCalculado = calcularAlcanceFiltro(filtro);
  const nivelApoyo = user.habilidades?.apoyo_investigacion?.nivel ?? 1;

  const toggleCarreraFiltro = (nombre) => {
    if (filtro.carreras.includes(nombre)) {
      if (filtro.carreras.length === 1) return;
      setFiltro({ ...filtro, carreras: filtro.carreras.filter(c => c !== nombre) });
    } else {
      setFiltro({ ...filtro, carreras: [...filtro.carreras, nombre] });
    }
  };

  const toggleInteresFiltro = (interes) => {
    if (filtro.intereses.includes(interes)) {
      setFiltro({ ...filtro, intereses: filtro.intereses.filter(i => i !== interes) });
    } else {
      setFiltro({ ...filtro, intereses: [...filtro.intereses, interes] });
    }
  };

  const handleVerificarFiltro = () => {
    if (alcanceCalculado < 30) {
      setCrearStep('bloqueado_m25');
      return;
    }
    // Sección 5.2 / 7.4: con nivel 0 de Apoyo a la investigación el alcance semanal es 0.
    // El primer gesto en Kampus es ayudar, no pedir.
    if (alcanceSemanal === 0) {
      setCrearStep('bloqueado_alcance');
      return;
    }
    setCrearStep('preguntas');
  };

  const handleEnviarEncuestaFinal = (e) => {
    e.preventDefault();
    if (!encuestaTitulo.trim()) return;
    // Doble chequeo: nunca se envía con segmento < 30 ni con alcance semanal 0
    if (alcanceCalculado < 30) { setCrearStep('bloqueado_m25'); return; }
    if (alcanceSemanal === 0) { setCrearStep('bloqueado_alcance'); return; }
    setEncuestaEnviadaExito(true);
    setTimeout(() => {
      setEncuestaEnviadaExito(false);
      setCrearStep('filtro');
      setActiveSubTab('mis_encuestas');
    }, 1500);
  };

  const handleIniciarResponder = (encuesta) => {
    setEncuestaParaResponder(encuesta);
    setPreguntaIndex(0);
    setRespuestasUsuario({});
  };

  const handleSeleccionarOpcionRespuesta = (preguntaId, opcion) => {
    setRespuestasUsuario(prev => ({
      ...prev,
      [preguntaId]: opcion
    }));
  };

  const handleSiguientePregunta = () => {
    if (!encuestaParaResponder) return;
    if (preguntaIndex < encuestaParaResponder.preguntas.length - 1) {
      setPreguntaIndex(preguntaIndex + 1);
    } else {
      responderEncuesta(encuestaParaResponder.id, respuestasUsuario);
      setEncuestaParaResponder(null);
    }
  };

  // --- M27: RESPONDER ENCUESTA ---
  if (encuestaParaResponder) {
    const totalPreguntas = encuestaParaResponder.preguntas.length;
    const currentP = encuestaParaResponder.preguntas[preguntaIndex];
    const tieneRespuesta = !!respuestasUsuario[currentP.id];

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
              Pregunta {preguntaIndex + 1} de {totalPreguntas}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-200 dark:bg-line-dark rounded-full overflow-hidden mt-3.5">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((preguntaIndex + 1) / totalPreguntas) * 100}%` }}
            />
          </div>

          <div className="mt-6 space-y-3">
            <span className="text-xs font-black text-brand-primary dark:text-teal-300 uppercase tracking-wider block">
              {encuestaParaResponder.titulo}
            </span>
            <h2 className="text-base font-black text-ink dark:text-ink-light tracking-tight leading-snug">
              {currentP.texto}
            </h2>

            {/* Opciones */}
            <div className="space-y-2.5 pt-2">
              {currentP.opciones.map((opcion) => {
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
        </div>

        <div className="space-y-3 pt-5">
          <div className="flex items-center space-x-1.5 text-xs text-ink-muted justify-center font-medium">
            <ShieldCheck size={16} className="text-accent" />
            <span>Respuestas 100% anónimas y agregadas según Ley 29733</span>
          </div>

          <button
            onClick={handleSiguientePregunta}
            disabled={!tieneRespuesta}
            className="w-full py-3.5 bg-brand-primary disabled:opacity-40 hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition"
          >
            <span>{preguntaIndex < totalPreguntas - 1 ? 'Siguiente Pregunta' : 'Finalizar y Sumar Apoyo a Tesis'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // --- M25: PANTALLA BLOQUEADA BAJO 30 (PANTALLA COMPLETA DEDICADA) ---
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

          <div className="k-card p-5 space-y-4 border-2 border-rose-300 dark:border-rose-900/60 rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-semantic-danger flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>

            <div>
              <span className="text-xs font-black text-semantic-danger uppercase tracking-wider block">
                Bloqueo de Seguridad Legal (Umbral &lt; 30)
              </span>
              <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-1">
                Segmento menor a 30 alumnos
              </h1>
            </div>

            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900">
              <div className="text-3xl font-black text-semantic-danger">
                {alcanceCalculado} alumnos
              </div>
              <p className="text-sm text-rose-900 dark:text-rose-200 font-semibold mt-1">
                "Muy pocos. Con menos de 30 personas alguien podría quedar identificado. Amplía el rango de ciclos o quita un filtro."
              </p>
            </div>

            <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
              Bajo la <strong>Ley 29733 de Protección de Datos Personales</strong>, los segmentos deben contar con un mínimo de 30 estudiantes para garantizar el anonimato estadístico estricto.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-4">
          <button
            onClick={() => {
              setFiltro(prev => ({
                ...prev,
                carreras: ['Enfermería', 'Psicología', 'Ingeniería Industrial'],
                cicloMin: 1,
                cicloMax: 10
              }));
              setCrearStep('filtro');
            }}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl shadow-sm transition"
          >
            Ampliar filtro automáticamente (&gt;30)
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

  // --- BLOQUEO POR ALCANCE SEMANAL 0 (nivel 0 de Apoyo a la investigación) ---
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

          <div className="k-card p-5 space-y-4 border-2 border-line dark:border-line-dark rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <span className="text-xs font-black text-accent uppercase tracking-wider block">
                Alcance semanal: 0
              </span>
              <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-1">
                Primero ayuda a alguien
              </h1>
            </div>
            <p className="text-sm text-ink-soft dark:text-ink-muted leading-relaxed">
              Responde una encuesta de otro alumno para desbloquear <strong>30 destinatarios</strong> por semana. Mientras más apoyas la investigación de otros, a más gente llegas con la tuya.
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
          <div className="k-card p-8 text-center space-y-3 rounded-3xl border-2 border-emerald-300">
            <CheckCircle2 size={44} className="text-semantic-success mx-auto" />
            <h3 className="text-base font-black text-ink dark:text-ink-light">
              ¡Encuesta enviada con éxito!
            </h3>
            <p className="text-xs text-ink-soft dark:text-ink-muted">
              Llegará a la bandeja de {Math.min(alcanceCalculado, alcanceSemanal)} estudiantes de la sede.
            </p>
          </div>
        ) : (
          <form onSubmit={handleEnviarEncuestaFinal} className="k-card p-4 space-y-3.5 border-2 border-line/80 dark:border-line-dark rounded-2xl">
            <div>
              <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                Título del estudio
              </label>
              <input
                type="text"
                placeholder="Ej: Rendimiento en prácticas clínicas hospitalarias"
                value={encuestaTitulo}
                onChange={(e) => setEncuestaTitulo(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
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
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
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
                    className="w-full px-3 py-2 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-sm font-medium"
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

            <button
              type="submit"
              disabled={!encuestaTitulo.trim()}
              className="w-full py-3.5 bg-brand-primary disabled:opacity-40 hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition"
            >
              <span>Enviar a bandejas estudiantiles</span>
              <Send size={15} />
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
          className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${
            activeSubTab === 'bandeja'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          Bandeja Recibida
        </button>
        <button
          onClick={() => setActiveSubTab('crear')}
          className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${
            activeSubTab === 'crear'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          Crear Encuesta
        </button>
        <button
          onClick={() => setActiveSubTab('mis_encuestas')}
          className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${
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
          {/* Card: Alcance Semanal Desbloqueado (Sin monedas) */}
          <div className="bg-gradient-to-r from-brand-primary via-[#2E2675] to-[#3B3294] text-white p-4 rounded-2xl shadow-sm space-y-2 border border-brand-primary/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Unlock size={14} />
                <span>Alcance Semanal Desbloqueado</span>
              </span>
              <span className="text-xs bg-white/20 font-black px-2.5 py-0.5 rounded-full">
                Nivel {nivelApoyo} de 3
              </span>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black tracking-tight">{alcanceSemanal}</span>
              <span className="text-xs text-indigo-100 font-semibold">alumnos alcanzables por semana</span>
            </div>

            <p className="text-xs text-indigo-200 pt-1.5 border-t border-white/10 font-medium">
              Desbloqueas alcance apoyando encuestas: [0, 30, 80, 200] según tu nivel.
            </p>
          </div>

          {/* Listado de Encuestas Recibidas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-ink-muted">
                Bandeja Semanal (Tope: 3 por semana)
              </h3>
              <span className="text-xs text-ink-muted font-semibold">
                {encuestasBandeja.filter(e => e.estado === 'pendiente').length} pendientes
              </span>
            </div>

            <div className="space-y-2.5">
              {encuestasBandeja.map((enc) => {
                const esPendiente = enc.estado === 'pendiente';

                return (
                  <div
                    key={enc.id}
                    className={`k-card p-4 space-y-2.5 border-2 ${
                      esPendiente ? 'border-brand-primary/50' : 'border-line/70 opacity-90'
                    } rounded-2xl shadow-sm`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-brand-primary dark:text-teal-300">
                            {enc.autorCarrera}
                          </span>
                          <span className="text-xs text-ink-muted">• {enc.fechaEnvio}</span>
                        </div>
                        <h4 className="text-sm font-black text-ink dark:text-ink-light mt-0.5">
                          {enc.titulo}
                        </h4>
                      </div>
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        esPendiente ? 'bg-accent text-white shadow-sm' : 'bg-slate-100 text-ink-muted'
                      }`}>
                        {esPendiente ? 'Pendiente' : 'Respondida'}
                      </span>
                    </div>

                    <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-2 font-medium leading-relaxed">
                      {enc.objetivo}
                    </p>

                    <div className="pt-2 border-t border-line dark:border-line-dark flex items-center justify-between text-xs">
                      <span className="text-ink-muted font-medium">Por {enc.autorNombre} (~{enc.tiempoEstimado})</span>
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
          </div>
        </div>
      )}

      {/* SubTab 2: Crear Encuesta y Filtro en Vivo (M24) */}
      {activeSubTab === 'crear' && (
        <div className="space-y-4">
          {/* Card Contador Grande en Vivo */}
          <div className="k-card p-4 text-center space-y-1.5 border-2 border-brand-primary/40 rounded-2xl shadow-sm">
            <span className="text-xs font-black text-ink-muted uppercase tracking-wider">
              Alcance de tu filtro en vivo (UTP Lima Sur)
            </span>
            <div className={`text-4xl font-black ${
              alcanceCalculado < 30 ? 'text-semantic-danger' : 'text-brand-primary dark:text-teal-300'
            }`}>
              {alcanceCalculado}
            </div>
            <p className="text-xs text-ink-soft dark:text-ink-muted font-semibold">
              estudiantes cumplen este perfil
            </p>

            {alcanceCalculado < 30 ? (
              <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/40 text-semantic-danger rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border border-rose-200">
                <AlertTriangle size={15} />
                <span>Bajo el umbral legal (&lt;30). Se bloqueará el envío.</span>
              </div>
            ) : (
              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 text-semantic-success rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border border-emerald-200">
                <CheckCircle2 size={15} />
                <span>Segmento anónimo y válido según Ley 29733 (≥30)</span>
              </div>
            )}
          </div>

          {/* Filtros de Carrera */}
          <div className="k-card p-4 space-y-3.5 text-xs border-2 border-line/80 dark:border-line-dark rounded-2xl">
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
                  min="18"
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
                  min="18"
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
          <div className="k-card p-4 space-y-3.5 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full">
                  Estudio Activo
                </span>
                <h3 className="text-sm font-black text-ink dark:text-ink-light mt-1.5 leading-snug">
                  {encuestaPropia.titulo}
                </h3>
                <p className="text-xs text-ink-muted font-medium mt-0.5">
                  Alcance enviado: {encuestaPropia.alcanceEnviado} estudiantes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-line dark:border-line-dark text-center">
              <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl">
                <span className="text-2xl font-black text-brand-primary dark:text-teal-300">
                  {encuestaPropia.respuestasRecibidas}
                </span>
                <p className="text-xs text-ink-muted font-bold">Respuestas Recibidas</p>
              </div>
              <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl">
                <span className="text-2xl font-black text-accent">
                  {Math.round((encuestaPropia.respuestasRecibidas / encuestaPropia.alcanceEnviado) * 100)}%
                </span>
                <p className="text-xs text-ink-muted font-bold">Tasa de Respuesta</p>
              </div>
            </div>

            {/* Resultados Agregados */}
            <div className="pt-2 space-y-3">
              {encuestaPropia.preguntas.map((q) => (
                <div key={q.id} className="p-3.5 bg-surface dark:bg-surface-dark rounded-xl space-y-2 border border-line dark:border-line-dark">
                  <p className="text-xs font-extrabold text-ink dark:text-ink-light">
                    {q.texto}
                  </p>
                  <div className="space-y-2">
                    {q.resultados.map((res) => (
                      <div key={res.label} className="space-y-1">
                        <div className="flex justify-between text-xs text-ink-soft dark:text-ink-muted">
                          <span>{res.label}</span>
                          <span className="font-black text-ink dark:text-ink-light">{res.porcentaje}% ({res.votos})</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary dark:bg-accent rounded-full"
                            style={{ width: `${res.porcentaje}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
