import React, { useState } from 'react';
import { useStore } from '../data/store';
import { CURSOS_ENFERMERIA } from '../data/mockData';
import {
  Users,
  MessageSquare,
  Sparkles,
  Clock,
  Plus,
  ArrowLeft,
  Send,
  ExternalLink,
  ShieldAlert,
  Award,
  HelpCircle,
  ThumbsUp,
  Phone,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Lock,
  Flame,
  Search
} from 'lucide-react';

export default function GruposView() {
  const {
    user,
    espacios,
    consultas,
    activeEspacioId,
    setActiveEspacioId,
    activeConsultaId,
    setActiveConsultaId,
    apoyarGrupo,
    enviarMensaje,
    proponerGrupo,
    agregarConsulta,
    responderConsulta,
    puedeOrientarConsulta,
    esAutorDeConsulta,
    valorarRespuesta,
    yaApoye,
    moderarConsultaTexto
  } = useStore();

  const [activeCategory, setActiveCategory] = useState('todos'); // 'todos' | 'cohorte' | 'carrera' | 'talleres'
  const [showProponerModal, setShowProponerModal] = useState(false);
  const [propNombre, setPropNombre] = useState('');
  const [propDesc, setPropDesc] = useState('');

  // Chat message input
  const [chatTexto, setChatTexto] = useState('');

  // Flujo 1: Modal Hacer Consulta (M19)
  const [showCrearConsultaModal, setShowCrearConsultaModal] = useState(false);
  const [cursoConsulta, setCursoConsulta] = useState(CURSOS_ENFERMERIA[0]);
  const [temaConsulta, setTemaConsulta] = useState('');
  const [textoConsulta, setTextoConsulta] = useState('');
  const [moderationWarning, setModerationWarning] = useState(null);

  // Flujo 1: Modal Responder Consulta (M21)
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [modoRespuesta, setModoRespuesta] = useState('mensaje'); // 'mensaje' | 'llamada'
  const [errorRespuesta, setErrorRespuesta] = useState(null);

  // Selected space detail
  const currentEspacio = espacios.find(e => e.id === activeEspacioId);
  const currentConsulta = consultas.find(c => c.id === activeConsultaId);

  // Espacios filtrados
  const espaciosFiltrados = espacios.filter(e => {
    if (activeCategory === 'cohorte') return e.tipo === 'carrera_ciclo';
    if (activeCategory === 'carrera') return e.tipo === 'carrera';
    if (activeCategory === 'talleres') return e.tipo === 'taller' || e.tipo === 'interes';
    return true;
  });

  const handleProponerSubmit = (e) => {
    e.preventDefault();
    if (!propNombre.trim()) return;
    const nuevoId = proponerGrupo(propNombre, propDesc);
    setShowProponerModal(false);
    setPropNombre('');
    setPropDesc('');
    setActiveEspacioId(nuevoId);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatTexto.trim() || !activeEspacioId) return;
    enviarMensaje(activeEspacioId, chatTexto);
    setChatTexto('');
  };

  const handleTextoConsultaChange = (val) => {
    setTextoConsulta(val);
    const mod = moderarConsultaTexto(val);
    if (mod.bloqueado) {
      setModerationWarning(mod.motivo);
    } else {
      setModerationWarning(null);
    }
  };

  const handleCrearConsultaSubmit = (e) => {
    e.preventDefault();
    if (!temaConsulta.trim() || !textoConsulta.trim()) return;
    const res = agregarConsulta(cursoConsulta, temaConsulta, textoConsulta);
    if (!res.exito) {
      setModerationWarning(res.motivo);
      return;
    }
    setShowCrearConsultaModal(false);
    setTemaConsulta('');
    setTextoConsulta('');
    setModerationWarning(null);
    setActiveConsultaId(res.consultaId);
  };

  const handleResponderSubmit = (e) => {
    e.preventDefault();
    if (!textoRespuesta.trim() || !activeConsultaId) return;
    const res = responderConsulta(activeConsultaId, textoRespuesta, modoRespuesta);
    if (res.exito) {
      setShowResponderModal(false);
      setTextoRespuesta('');
      setErrorRespuesta(null);
    } else {
      setErrorRespuesta(res.motivo);
    }
  };

  // --- VISTA DETALLE DE ESPACIO (M12, M13, M14, M15) ---
  // Si hay una consulta abierta, manda la consulta (M20). Antes, dentro del espacio de carrera,
  // tocar una consulta no hacía nada porque esta vista se devolvía primero.
  if (currentEspacio && !currentConsulta) {
    const isEspacioCarrera = currentEspacio.tipo === 'carrera';
    const isCohorte = currentEspacio.tipo === 'carrera_ciclo';
    const isTaller = currentEspacio.tipo === 'taller';

    return (
      <div className="flex-1 flex flex-col h-full bg-surface dark:bg-surface-dark select-none animate-fadeIn">
        {/* Espacio Header con Foto de Portada Heroica */}
        <div className="relative h-36 w-full bg-slate-900 overflow-hidden shrink-0">
          {currentEspacio.portadaUrl ? (
            <img
              src={currentEspacio.portadaUrl}
              alt={currentEspacio.nombre}
              className="w-full h-full object-cover opacity-75"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-brand-primary to-indigo-900" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 flex flex-col justify-between p-3.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveEspacioId(null)}
                className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition shadow-md"
              >
                <ArrowLeft size={18} />
              </button>

              {isTaller && currentEspacio.linkInscripcion && (
                <a
                  href={currentEspacio.linkInscripcion}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-md transition"
                >
                  <span>Portal Oficial UTP</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-base font-black text-white line-clamp-1 drop-shadow-sm">
                  {currentEspacio.nombre}
                </h2>
                {currentEspacio.oficial && (
                  <span className="text-xs bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                    Oficial
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 font-semibold drop-shadow-sm">
                {currentEspacio.miembrosCount} miembros activos · Sede {currentEspacio.sede}
              </p>
            </div>
          </div>
        </div>

        {/* Banner de Contexto de Espacio */}
        <div className="px-4 py-2.5 bg-white dark:bg-surface-cardDark border-b border-line dark:border-line-dark flex items-center justify-between shadow-sm">
          {isCohorte && (
            <div className="flex items-center space-x-2 text-brand-primary dark:text-teal-300 font-bold text-xs">
              <Lock size={14} />
              <span>Cohorte cerrada · Salón {user.carrera} Ciclo {user.ciclo}</span>
            </div>
          )}
          {isEspacioCarrera && (
            <div className="flex items-center space-x-2 text-brand-primary dark:text-teal-300 font-bold text-xs">
              <Sparkles size={14} />
              <span>Espacio de Carrera (Ciclos 1 al 10)</span>
            </div>
          )}
          {isTaller && (
            <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
              <Clock size={14} />
              <span>{currentEspacio.horario}</span>
            </div>
          )}
          {currentEspacio.tipo === 'interes' && (
            <span className="text-xs text-ink-muted line-clamp-1 font-medium">{currentEspacio.descripcion}</span>
          )}
        </div>

        {/* Consultas Agrupadas si es Espacio de Carrera */}
        {isEspacioCarrera && (
          <div className="p-3.5 bg-brand-primary-soft/50 dark:bg-brand-dark/40 border-b border-line dark:border-line-dark">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-brand-primary dark:text-teal-300 flex items-center space-x-1.5">
                <HelpCircle size={15} />
                <span>Consultas Agrupadas ({consultas.length})</span>
              </span>
              <button
                onClick={() => setShowCrearConsultaModal(true)}
                className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm"
              >
                <Plus size={13} />
                <span>Nueva Consulta</span>
              </button>
            </div>

            <div className="space-y-2">
              {consultas.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveConsultaId(c.id)}
                  className="k-card p-3 cursor-pointer hover:border-accent transition text-xs space-y-1.5 border border-line dark:border-line-dark"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-ink dark:text-ink-light">{c.curso}</span>
                    <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                      {c.nAlumnos} alumnos con la duda
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-1 font-medium">
                    {c.tema}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-surface dark:bg-surface-dark">
          {(!currentEspacio.mensajes || currentEspacio.mensajes.length === 0) ? (
            <div className="text-center py-12 text-ink-muted text-xs">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-40 text-brand-primary" />
              <p className="font-bold text-sm text-ink dark:text-ink-light">Conversación de {currentEspacio.nombre}</p>
              <p className="text-xs mt-1 text-ink-muted">Sé el primero en enviar un mensaje a la comunidad.</p>
            </div>
          ) : (
            currentEspacio.mensajes.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.esMio ? 'items-end' : 'items-start'}`}
              >
                {!m.esMio && (
                  <span className="text-xs font-bold text-ink-muted ml-1 mb-1">
                    {m.autor}
                  </span>
                )}
                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.esMio
                      ? 'bg-brand-primary text-white rounded-br-none shadow-sm'
                      : 'bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark text-ink dark:text-ink-light rounded-bl-none shadow-sm font-medium'
                  }`}
                >
                  {m.texto}
                </div>
                <span className="text-xs text-ink-muted mt-1 px-1 font-medium">
                  {m.hora}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-line dark:border-line-dark bg-white dark:bg-surface-cardDark flex items-center space-x-2 shrink-0 shadow-sm"
        >
          <input
            type="text"
            placeholder="Escribe un mensaje al grupo..."
            value={chatTexto}
            onChange={(e) => setChatTexto(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
          />
          <button
            type="submit"
            disabled={!chatTexto.trim()}
            className="p-2.5 bg-brand-primary disabled:opacity-40 text-white rounded-xl shadow-sm transition"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    );
  }

  // --- VISTA DETALLE DE CONSULTA AGRUPADA (M20, M21, M22) ---
  if (currentConsulta) {
    // Regla 7.1: ciclo >= 5, ciclo mayor que el de quien preguntó, y no ser autor
    const permisoOrientar = puedeOrientarConsulta(currentConsulta);
    const puedoOrientar = permisoOrientar.puede;
    const soyAutor = esAutorDeConsulta(currentConsulta);
    const factorModo = modoRespuesta === 'llamada' ? 3 : 1;
    const estrellasPotenciales = currentConsulta.nAlumnos >= 2 ? factorModo * currentConsulta.nAlumnos : 0;

    return (
      <div className="flex-1 flex flex-col h-full bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div className="p-4 border-b border-line dark:border-line-dark flex items-center space-x-2.5 bg-white dark:bg-surface-cardDark shadow-sm">
          <button
            onClick={() => setActiveConsultaId(null)}
            className="p-1.5 -ml-1 text-ink-muted hover:text-ink rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider block">
              Consulta de Carrera
            </span>
            <h2 className="text-sm font-extrabold text-ink dark:text-ink-light">
              {currentConsulta.curso}
            </h2>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Main Query Card */}
          <div className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark">
            <div className="flex justify-between items-start">
              <span className="px-2.5 py-1 bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 font-bold text-xs rounded-lg">
                {currentConsulta.curso}
              </span>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
                {currentConsulta.nAlumnos} alumnos consultan
              </span>
            </div>

            <h3 className="text-base font-black text-ink dark:text-ink-light">
              {currentConsulta.tema}
            </h3>

            <p className="text-sm text-ink-soft dark:text-ink-muted leading-relaxed italic bg-surface dark:bg-surface-dark p-3 rounded-xl border border-line dark:border-line-dark">
              "{currentConsulta.textoResumen}"
            </p>

            {currentConsulta.nAlumnos < 2 && (
              <div className="p-2.5 bg-surface dark:bg-surface-dark rounded-xl text-xs text-ink-soft dark:text-ink-muted font-semibold border border-line dark:border-line-dark">
                Solo 1 alumno preguntó esto. Las consultas de una sola persona no dan estrellas: cuando alguien más tenga la misma duda, se agrupa y empieza a contar.
              </div>
            )}

            <div className="pt-2 border-t border-line dark:border-line-dark flex justify-between items-center text-xs text-ink-muted font-medium">
              <span>Alumnos: {currentConsulta.autores.join(', ')}</span>
              <span>{currentConsulta.fecha}</span>
            </div>
          </div>

          {/* Orientaciones Brindadas */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-ink-muted uppercase tracking-wider">
              Orientaciones de Compañeros ({currentConsulta.respuestas.length})
            </h4>

            {currentConsulta.respuestas.length === 0 ? (
              <div className="k-card p-5 text-center text-xs text-ink-muted">
                Aún no hay respuestas. Alumnos de ciclo ≥ 5 pueden orientar.
              </div>
            ) : (
              currentConsulta.respuestas.map((r) => (
                <div key={r.id} className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center font-black text-sm">
                        {r.asesorNombre[0]}
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-ink dark:text-ink-light">
                          {r.asesorNombre}
                        </h5>
                        <p className="text-xs text-ink-muted font-medium">
                          {r.asesorCarrera} · Ciclo {r.asesorCiclo}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                        r.calificadoPorSolicitante
                          ? 'bg-accent-soft text-accent border-accent/20'
                          : 'bg-surface dark:bg-surface-dark text-ink-muted border-line dark:border-line-dark'
                      }`}
                      title={r.calificadoPorSolicitante ? 'Estrellas acreditadas' : 'Se acreditan cuando quien preguntó valora la respuesta'}
                    >
                      ★ +{r.estrellasCalculadas}{!r.calificadoPorSolicitante && ' pendiente'}
                    </span>
                  </div>

                  <p className="text-sm text-ink dark:text-ink-light leading-relaxed font-medium">
                    {r.texto}
                  </p>

                  <div className="pt-2.5 border-t border-line dark:border-line-dark flex justify-between items-center text-xs">
                    <span className="text-ink-muted font-medium">{r.fecha}</span>
                    {!r.calificadoPorSolicitante ? (
                      soyAutor && !r.esMio ? (
                        // M22: solo quien preguntó valora, y recién ahí se acreditan las estrellas
                        <button
                          onClick={() => valorarRespuesta(currentConsulta.id, r.id, true)}
                          className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg flex items-center space-x-1.5 shadow-sm"
                        >
                          <ThumbsUp size={12} />
                          <span>Me sirvió</span>
                        </button>
                      ) : (
                        <span className="text-ink-muted font-semibold italic">
                          Esperando valoración de quien preguntó
                        </span>
                      )
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                        <CheckCircle2 size={14} />
                        <span>Validada por Alumnos</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Botón de Orientar */}
          {!puedoOrientar && !soyAutor && (
            <div className="k-card p-3 text-xs text-ink-muted font-semibold text-center">
              {permisoOrientar.motivo}
            </div>
          )}
          {puedoOrientar && (
            <button
              onClick={() => setShowResponderModal(true)}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition"
            >
              <Sparkles size={16} />
              <span>Orientar a este grupo de alumnos</span>
            </button>
          )}
        </div>

        {/* Modal: Responder */}
        {showResponderModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
              <h3 className="text-sm font-black text-ink dark:text-ink-light">
                Orientar en {currentConsulta.curso}
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModoRespuesta('mensaje')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition ${
                    modoRespuesta === 'mensaje'
                      ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                      : 'bg-surface border-line text-ink-muted'
                  }`}
                >
                  Mensaje Texto (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setModoRespuesta('llamada')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition ${
                    modoRespuesta === 'llamada'
                      ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                      : 'bg-surface border-line text-ink-muted'
                  }`}
                >
                  Llamada App (3x)
                </button>
              </div>

              <textarea
                rows={3}
                placeholder="Escribe tu recomendación o tips clave..."
                value={textoRespuesta}
                onChange={(e) => setTextoRespuesta(e.target.value)}
                className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary resize-none"
              />

              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold border border-amber-200">
                {estrellasPotenciales > 0
                  ? `★ +${estrellasPotenciales} estrellas de ayuda cuando quien preguntó valore tu respuesta`
                  : 'Esta consulta es de 1 sola persona: no da estrellas hasta que se agrupe'}
              </div>

              {errorRespuesta && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-xs text-semantic-danger font-bold border border-rose-200">
                  {errorRespuesta}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={() => { setShowResponderModal(false); setErrorRespuesta(null); }}
                  className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResponderSubmit}
                  disabled={!textoRespuesta.trim()}
                  className="px-4 py-2 bg-brand-primary disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Publicar Orientación
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA LISTA DE GRUPOS (M11) ---
  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Header con Título Claro y Botón Proponer */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight">
            Comunidades y Espacios
          </h1>
          <p className="text-xs font-semibold text-ink-muted">
            Vida universitaria activa en sede {user.sede}
          </p>
        </div>

        <button
          onClick={() => setShowProponerModal(true)}
          className="px-3.5 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white text-xs font-extrabold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
        >
          <Plus size={15} />
          <span>Proponer</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'todos', label: 'Todos los Espacios' },
          { id: 'cohorte', label: 'Tu Salón (Ciclo 5)' },
          { id: 'carrera', label: 'Toda la Carrera' },
          { id: 'talleres', label: 'Talleres & Clubes' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap text-xs transition ${
              activeCategory === tab.id
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-white dark:bg-surface-cardDark text-ink-soft dark:text-ink-muted border border-line dark:border-line-dark shadow-sm'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Group Cards List — Estilo Hero Visual con Portada Completa */}
      <div className="space-y-4">
        {espaciosFiltrados.map((esp) => {
          const isTaller = esp.tipo === 'taller';
          const isPropuesta = esp.tipo === 'interes' && esp.estado === 'oculto';

          return (
            <div
              key={esp.id}
              onClick={() => setActiveEspacioId(esp.id)}
              className="k-card overflow-hidden hover:border-brand-primary cursor-pointer transition-all duration-200 shadow-sm flex flex-col group border-2 border-line/80 dark:border-line-dark rounded-2xl"
            >
              {/* Cover Banner Hero */}
              {esp.portadaUrl && (
                <div className="relative h-32 w-full bg-slate-800 overflow-hidden">
                  <img
                    src={esp.portadaUrl}
                    alt={esp.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-3">
                    <div className="flex items-center space-x-2">
                      {esp.oficial && (
                        <span className="text-xs bg-emerald-500 text-white font-black px-2.5 py-0.5 rounded-full shadow-sm">
                          Oficial UTP
                        </span>
                      )}
                      {esp.tipo === 'carrera_ciclo' && (
                        <span className="text-xs bg-brand-primary text-white font-black px-2.5 py-0.5 rounded-full shadow-sm">
                          Tu Salón Cerrado
                        </span>
                      )}
                      {esp.tipo === 'carrera' && (
                        <span className="text-xs bg-teal-600 text-white font-black px-2.5 py-0.5 rounded-full shadow-sm">
                          Comunidad de Carrera
                        </span>
                      )}
                      {isPropuesta && (
                        <span className="text-xs bg-amber-500 text-white font-black px-2.5 py-0.5 rounded-full shadow-sm flex items-center space-x-1">
                          <Flame size={12} fill="white" />
                          <span>Propuesta Estudiantil</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Card Body */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-ink dark:text-ink-light leading-snug group-hover:text-brand-primary transition">
                      {esp.nombre}
                    </h3>
                    <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-2 font-medium leading-relaxed">
                      {esp.descripcion}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-ink-muted shrink-0 ml-2 group-hover:translate-x-1 transition" />
                </div>

                {isTaller && esp.horario && (
                  <div className="flex items-center space-x-2 text-xs text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <Clock size={14} />
                    <span>{esp.horario}</span>
                  </div>
                )}

                {/* Propuesta: Contador de apoyos (Umbral de 15 apoyos de alumnos) */}
                {isPropuesta && (
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl space-y-2 border border-amber-200 dark:border-amber-900/40">
                    <div className="flex justify-between items-center text-xs text-amber-900 dark:text-amber-200 font-black">
                      <span>Apoyos de estudiantes</span>
                      <span>{esp.apoyosCount} de {esp.umbralRequerido} requeridos</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, ((esp.apoyosCount || 1) / (esp.umbralRequerido || 15)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs text-ink-muted font-medium">
                        Faltan {Math.max(0, (esp.umbralRequerido || 15) - (esp.apoyosCount || 1))} para visibilidad pública
                      </span>
                      {yaApoye(esp) ? (
                        // Cada alumno apoya una sola vez
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl flex items-center space-x-1">
                          <CheckCircle2 size={12} />
                          <span>Apoyado</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            apoyarGrupo(esp.id);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center space-x-1 shadow-sm transition"
                        >
                          <ThumbsUp size={12} />
                          <span>Apoyar (+1)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-ink-muted pt-2 border-t border-line dark:border-line-dark font-medium">
                  <span className="font-semibold text-ink dark:text-ink-light">{esp.miembrosCount} miembros</span>
                  <span className="italic">{esp.horaUltimoMensaje}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Proponer Grupo (M16) */}
      {showProponerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <h3 className="text-sm font-black text-ink dark:text-ink-light">
              Proponer una comunidad estudiantil
            </h3>
            <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
              Requiere <strong>15 apoyos</strong> de otros alumnos para convertirse en un espacio público de campus.
            </p>

            <form onSubmit={handleProponerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Nombre de la comunidad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Club de Robótica UTP"
                  value={propNombre}
                  onChange={(e) => setPropNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="Objetivos, actividades y a quiénes va dirigido..."
                  value={propDesc}
                  onChange={(e) => setPropDesc(e.target.value)}
                  className="w-full p-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-medium text-ink dark:text-ink-light resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowProponerModal(false)}
                  className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!propNombre.trim()}
                  className="px-4 py-2 bg-brand-primary disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Crear propuesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Hacer Consulta de Carrera con Moderación (M19) */}
      {showCrearConsultaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <h3 className="text-sm font-black text-ink dark:text-ink-light">
              Nueva Consulta en {user.carrera}
            </h3>

            <form onSubmit={handleCrearConsultaSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Curso
                </label>
                <select
                  value={cursoConsulta}
                  onChange={(e) => setCursoConsulta(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                >
                  {CURSOS_ENFERMERIA.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Tema específico
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cálculo de dosis y goteo"
                  value={temaConsulta}
                  onChange={(e) => setTemaConsulta(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Tu duda académica:
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalla qué tema necesitas comprender..."
                  value={textoConsulta}
                  onChange={(e) => handleTextoConsultaChange(e.target.value)}
                  className="w-full p-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-medium text-ink dark:text-ink-light resize-none"
                  required
                />
              </div>

              {/* Live Moderation Warning */}
              {moderationWarning ? (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle size={14} />
                    <span>Aviso de Moderación Automática</span>
                  </div>
                  <p className="text-xs leading-snug">{moderationWarning}</p>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-100 dark:bg-surface-dark rounded-xl text-xs text-ink-muted">
                  <strong>Regla Kampuz:</strong> Se consulta sobre el curso y su contenido académico, no sobre personas ni docentes.
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCrearConsultaModal(false)}
                  className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!temaConsulta.trim() || !textoConsulta.trim() || !!moderationWarning}
                  className="px-4 py-2 bg-brand-primary disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Publicar Consulta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
