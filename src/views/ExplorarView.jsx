import React, { useState, useEffect } from 'react';
import { useStore } from '../data/store';
import { CARRERAS_UTP, INTERESES_DISPONIBLES } from '../data/mockData';
import {
  fetchPerfilesExplorar,
  fetchSolicitudes,
  enviarSolicitudMensaje,
  responderSolicitud,
  reportarContenido,
  bloquearUsuario
} from '../lib/explore';
import { fetchConversaciones, getOrCreateConversacion } from '../lib/chat';
import ChatDirectoModal from '../components/ChatDirectoModal';
import {
  Search,
  UserPlus,
  Check,
  MessageCircle,
  X,
  Sparkles,
  Loader2,
  ShieldAlert,
  UserX,
  MessageSquare,
  RefreshCw,
  Send
} from 'lucide-react';

export default function ExplorarView() {
  const { user } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('personas'); // 'personas' | 'solicitudes' | 'chats'
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCarrera, setFiltroCarrera] = useState('');
  const [filtroCiclo, setFiltroCiclo] = useState('');
  const [filtroInteres, setFiltroInteres] = useState('');

  // Perfiles de estudiantes
  const [perfiles, setPerfiles] = useState([]);
  const [isLoadingPerfiles, setIsLoadingPerfiles] = useState(true);

  // Solicitudes recibidas y enviadas
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState([]);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState([]);
  const [tipoSolTab, setTipoSolTab] = useState('recibidas'); // 'recibidas' | 'enviadas'
  const [isLoadingSolicitudes, setIsLoadingSolicitudes] = useState(false);

  // Conversaciones directas activas
  const [conversaciones, setConversaciones] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Modal: Perfil y Solicitud (M08)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [isSendingSolicitud, setIsSendingSolicitud] = useState(false);
  const [solicitudEnviadaSuccess, setSolicitudEnviadaSuccess] = useState(false);
  const [solicitudError, setSolicitudError] = useState('');

  // Modal: Chat directo 1 a 1 en tiempo real (M10)
  const [activeChat, setActiveChat] = useState(null); // { conversacionId, otherUser }

  // Modal: Reportar y Bloquear (M33)
  const [targetUserOption, setTargetUserOption] = useState(null); // student being reported/blocked
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMotivo, setReportMotivo] = useState('Acoso o mensaje no deseado');
  const [reportDetalle, setReportDetalle] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  // Cargar perfiles reales
  const cargarPerfiles = async () => {
    setIsLoadingPerfiles(true);
    try {
      const data = await fetchPerfilesExplorar({
        currentUserId: user?.id,
        searchTerm,
        carrera: filtroCarrera,
        ciclo: filtroCiclo,
        interes: filtroInteres
      });
      setPerfiles(data);
    } catch (err) {
      console.error('Error al cargar perfiles:', err);
    } finally {
      setIsLoadingPerfiles(false);
    }
  };

  // Cargar solicitudes
  const cargarSolicitudes = async () => {
    if (!user?.id) return;
    setIsLoadingSolicitudes(true);
    try {
      const { recibidas, enviadas } = await fetchSolicitudes(user.id);
      setSolicitudesRecibidas(recibidas);
      setSolicitudesEnviadas(enviadas);
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
    } finally {
      setIsLoadingSolicitudes(false);
    }
  };

  // Cargar conversaciones
  const cargarConversaciones = async () => {
    if (!user?.id) return;
    setIsLoadingChats(true);
    try {
      const data = await fetchConversaciones(user.id);
      setConversaciones(data);
    } catch (err) {
      console.error('Error al cargar conversaciones:', err);
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    cargarPerfiles();
  }, [searchTerm, filtroCarrera, filtroCiclo, filtroInteres, user?.id]);

  useEffect(() => {
    if (activeSubTab === 'solicitudes') {
      cargarSolicitudes();
    } else if (activeSubTab === 'chats') {
      cargarConversaciones();
    }
  }, [activeSubTab, user?.id]);

  // Enviar solicitud con motivo académico (Spec 6.4)
  const handleEnviarSolicitud = async () => {
    if (!motivoSolicitud.trim() || !selectedStudent || !user?.id) return;
    setIsSendingSolicitud(true);
    setSolicitudError('');

    try {
      const res = await enviarSolicitudMensaje({
        deId: user.id,
        aId: selectedStudent.id,
        motivo: motivoSolicitud.trim()
      });

      if (!res.success) {
        setSolicitudError(res.error || 'No se pudo enviar la solicitud.');
        setIsSendingSolicitud(false);
        return;
      }

      setSolicitudEnviadaSuccess(true);
      setTimeout(() => {
        setSelectedStudent(null);
        setSolicitudEnviadaSuccess(false);
        setMotivoSolicitud('');
        cargarSolicitudes();
      }, 1300);
    } catch (err) {
      setSolicitudError('Error de red al enviar la solicitud.');
    } finally {
      setIsSendingSolicitud(false);
    }
  };

  // Aceptar o ignorar solicitud
  const handleResponderSolicitud = async (solicitud, accion) => {
    try {
      const res = await responderSolicitud({
        solicitudId: solicitud.id,
        accion,
        deId: solicitud.de_id,
        aId: solicitud.a_id
      });

      if (res.success && accion === 'aceptada' && res.conversacion) {
        // Abrir chat directo automáticamente si fue aceptada
        setActiveChat({
          conversacionId: res.conversacion.id,
          otherUser: solicitud.otroUsuario
        });
      }

      cargarSolicitudes();
      cargarConversaciones();
    } catch (err) {
      console.error(err);
    }
  };

  // Abrir chat directo con un estudiante ya conectado
  const handleAbrirChatConEstudiante = async (estudiante) => {
    if (!user?.id || !estudiante?.id) return;
    try {
      const res = await getOrCreateConversacion(user.id, estudiante.id);
      if (res.success && res.conversacion) {
        setActiveChat({
          conversacionId: res.conversacion.id,
          otherUser: estudiante
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Confirmar reporte
  const handleReportarUsuario = async () => {
    if (!reportDetalle.trim() || !targetUserOption || !user?.id) return;
    setIsSubmittingReport(true);
    try {
      const motivoCompleto = `${reportMotivo}: ${reportDetalle.trim()}`;
      await reportarContenido({
        autorId: user.id,
        tipo: 'perfil',
        objetoId: targetUserOption.id,
        motivo: motivoCompleto
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
        setReportDetalle('');
        setTargetUserOption(null);
      }, 1400);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Confirmar bloqueo
  const handleBloquearUsuario = async () => {
    if (!targetUserOption || !user?.id) return;
    setIsSubmittingBlock(true);
    try {
      await bloquearUsuario({
        bloqueadorId: user.id,
        bloqueadoId: targetUserOption.id
      });
      setShowBlockModal(false);
      setTargetUserOption(null);
      setSelectedStudent(null);
      cargarPerfiles();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const totalPendientesRecibidas = solicitudesRecibidas.filter(s => s.estado === 'pendiente').length;
  const totalMensajesNoLeidos = conversaciones.reduce((acc, c) => acc + (c.noLeidos || 0), 0);

  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* 3 Sub-pestañas: Explorar Compañeros · Solicitudes · Mensajes */}
      <div className="flex bg-white dark:bg-surface-cardDark p-1.5 rounded-2xl border border-line dark:border-line-dark shadow-sm">
        <button
          onClick={() => setActiveSubTab('personas')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'personas'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
          }`}
        >
          Explorar
        </button>

        <button
          onClick={() => setActiveSubTab('solicitudes')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeSubTab === 'solicitudes'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
          }`}
        >
          <span>Solicitudes</span>
          {totalPendientesRecibidas > 0 && (
            <span className="w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-black">
              {totalPendientesRecibidas}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('chats')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeSubTab === 'chats'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
          }`}
        >
          <span>Chats 1 a 1</span>
          {totalMensajesNoLeidos > 0 && (
            <span className="w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-black">
              {totalMensajesNoLeidos}
            </span>
          )}
        </button>
      </div>

      {/* --- SUBTAB 1: EXPLORAR COMPAÑEROS (M07) --- */}
      {activeSubTab === 'personas' && (
        <>
          {/* Barra de búsqueda */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre o carrera..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary shadow-sm"
            />
            <Search className="absolute left-3.5 top-3 text-ink-muted" size={16} />
          </div>

          {/* Filtros rápidos */}
          <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
            <select
              value={filtroCarrera}
              onChange={(e) => setFiltroCarrera(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-ink dark:text-ink-light text-xs font-bold shadow-sm"
            >
              <option value="">Todas las carreras</option>
              {CARRERAS_UTP.map(c => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>

            <select
              value={filtroCiclo}
              onChange={(e) => setFiltroCiclo(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-ink dark:text-ink-light text-xs font-bold shadow-sm"
            >
              <option value="">Ciclo</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                <option key={c} value={c}>{c}.° Ciclo</option>
              ))}
            </select>

            <select
              value={filtroInteres}
              onChange={(e) => setFiltroInteres(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-ink dark:text-ink-light text-xs font-bold shadow-sm"
            >
              <option value="">Interés afín</option>
              {INTERESES_DISPONIBLES.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          {/* Lista de estudiantes */}
          {isLoadingPerfiles ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-medium">Buscando compañeros en sede...</p>
            </div>
          ) : perfiles.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark space-y-2">
              <p className="text-sm font-bold text-ink dark:text-ink-light">No encontramos compañeros con estos filtros</p>
              <p className="text-xs text-ink-muted">Prueba cambiando la carrera o el ciclo seleccionado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {perfiles.map((est) => {
                const userIntereses = user?.intereses || [];
                const estIntereses = est.intereses || [];
                const interesComun =
                  estIntereses.find(i => userIntereses.includes(i)) ||
                  estIntereses[0] ||
                  'Compañero UTP';

                const nombreEst = `${est.nombre} ${est.apellido || ''}`.trim();

                return (
                  <div
                    key={est.id}
                    className="k-card p-4 space-y-3 border-2 border-line/90 dark:border-line-dark rounded-2xl shadow-sm hover:border-brand-primary/60 transition group bg-white dark:bg-surface-cardDark"
                  >
                    {/* Top Row: Avatar circular 48px + Datos */}
                    <div className="flex items-start space-x-3.5">
                      <div className="relative shrink-0">
                        {est.foto_url ? (
                          <img
                            src={est.foto_url}
                            alt={nombreEst}
                            className="w-14 h-14 rounded-2xl object-cover border border-line dark:border-line-dark shadow-sm group-hover:scale-105 transition duration-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-brand-primary text-white font-black text-base flex items-center justify-center shadow-sm">
                            {(est.nombre?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <div
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-cardDark shadow-sm"
                          title="Estudiante de campus verificado"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h3 className="text-sm font-black text-ink dark:text-ink-light truncate group-hover:text-brand-primary transition">
                            {nombreEst}
                          </h3>
                          {est.rol && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 bg-slate-100 dark:bg-slate-800 text-ink-muted">
                              {est.rol}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-brand-primary dark:text-teal-300 truncate">
                          {est.carrera} · {est.ciclo}.° Ciclo
                        </p>

                        <p className="text-[11px] text-ink-muted truncate font-medium mt-0.5">
                          Sede {est.sede || 'Lima Sur'} {est.bio ? `· ${est.bio}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Interés común + Botón Conectar */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-line/80 dark:border-line-dark">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-accent dark:text-teal-200 bg-accent-soft/70 dark:bg-accent-dark/40 px-3 py-1 rounded-full border border-accent/20 truncate max-w-[58%] shadow-xs">
                        <Sparkles size={12} className="shrink-0 text-accent" />
                        <span className="truncate">{interesComun}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            setTargetUserOption(est);
                            setShowReportModal(true);
                          }}
                          className="p-1.5 text-ink-muted hover:text-semantic-danger rounded-lg transition"
                          title="Reportar estudiante"
                        >
                          <ShieldAlert size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudent(est);
                            setMotivoSolicitud('');
                            setSolicitudError('');
                          }}
                          className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primaryHover active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 shrink-0"
                        >
                          <UserPlus size={13} />
                          <span>Conectar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* --- SUBTAB 2: SOLICITUDES (M09) --- */}
      {activeSubTab === 'solicitudes' && (
        <div className="space-y-3">
          <div className="flex bg-slate-100 dark:bg-surface-cardDark p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setTipoSolTab('recibidas')}
              className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-1 ${
                tipoSolTab === 'recibidas'
                  ? 'bg-white dark:bg-surface-dark text-ink dark:text-ink-light shadow-xs'
                  : 'text-ink-muted'
              }`}
            >
              <span>Recibidas</span>
              {totalPendientesRecibidas > 0 && (
                <span className="w-4 h-4 bg-accent text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {totalPendientesRecibidas}
                </span>
              )}
            </button>
            <button
              onClick={() => setTipoSolTab('enviadas')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                tipoSolTab === 'enviadas'
                  ? 'bg-white dark:bg-surface-dark text-ink dark:text-ink-light shadow-xs'
                  : 'text-ink-muted'
              }`}
            >
              Enviadas ({solicitudesEnviadas.length})
            </button>
          </div>

          {isLoadingSolicitudes ? (
            <div className="flex flex-col items-center justify-center py-10 text-ink-muted">
              <Loader2 size={22} className="animate-spin text-accent" />
              <p className="text-xs font-semibold mt-1">Cargando solicitudes...</p>
            </div>
          ) : tipoSolTab === 'recibidas' ? (
            solicitudesRecibidas.length === 0 ? (
              <div className="text-center py-10 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6">
                <p className="text-xs text-ink-muted font-medium">No tienes solicitudes de conexión recibidas.</p>
              </div>
            ) : (
              solicitudesRecibidas.map((sol) => (
                <div
                  key={sol.id}
                  className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {sol.otroUsuario?.foto_url ? (
                        <img
                          src={sol.otroUsuario.foto_url}
                          alt={sol.otroUsuario.nombre}
                          className="w-11 h-11 rounded-xl object-cover border border-line shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-brand-primary text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {(sol.otroUsuario?.nombre?.[0] || 'U').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-black text-ink dark:text-ink-light">
                          {sol.otroUsuario?.nombre} {sol.otroUsuario?.apellido}
                        </h4>
                        <p className="text-[11px] text-ink-muted font-medium">
                          {sol.otroUsuario?.carrera} · Ciclo {sol.otroUsuario?.ciclo}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl text-xs text-ink-soft dark:text-ink-muted italic border border-line dark:border-line-dark leading-relaxed">
                    "{sol.motivo}"
                  </div>

                  {sol.estado === 'pendiente' ? (
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        onClick={() => handleResponderSolicitud(sol, 'rechazada')}
                        className="px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink"
                      >
                        Ignorar
                      </button>
                      <button
                        onClick={() => handleResponderSolicitud(sol, 'aceptada')}
                        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-black rounded-xl shadow-sm transition"
                      >
                        Aceptar Conexión
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1.5 flex items-center justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                        <Check size={14} />
                        <span>Conexión aceptada en campus</span>
                      </span>
                      <button
                        onClick={() => handleAbrirChatConEstudiante(sol.otroUsuario)}
                        className="px-3.5 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm"
                      >
                        <MessageCircle size={14} />
                        <span>Abrir Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            /* Solicitudes enviadas */
            solicitudesEnviadas.length === 0 ? (
              <div className="text-center py-10 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6">
                <p className="text-xs text-ink-muted font-medium">No has enviado ninguna solicitud aún.</p>
              </div>
            ) : (
              solicitudesEnviadas.map((sol) => (
                <div
                  key={sol.id}
                  className="k-card p-4 space-y-2 border border-line dark:border-line-dark rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {sol.otroUsuario?.foto_url ? (
                        <img
                          src={sol.otroUsuario.foto_url}
                          alt={sol.otroUsuario.nombre}
                          className="w-10 h-10 rounded-xl object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {(sol.otroUsuario?.nombre?.[0] || 'U').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-black text-ink dark:text-ink-light">
                          {sol.otroUsuario?.nombre} {sol.otroUsuario?.apellido}
                        </h4>
                        <p className="text-[11px] text-ink-muted">
                          {sol.otroUsuario?.carrera} · Ciclo {sol.otroUsuario?.ciclo}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        sol.estado === 'aceptada'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : sol.estado === 'rechazada'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {sol.estado === 'aceptada'
                        ? 'Aceptada'
                        : sol.estado === 'rechazada'
                        ? 'Ignorada'
                        : 'Pendiente'}
                    </span>
                  </div>

                  <p className="text-xs text-ink-muted italic bg-surface dark:bg-surface-dark p-2.5 rounded-xl">
                    "{sol.motivo}"
                  </p>

                  {sol.estado === 'aceptada' && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleAbrirChatConEstudiante(sol.otroUsuario)}
                        className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center space-x-1"
                      >
                        <MessageCircle size={13} />
                        <span>Chatear</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* --- SUBTAB 3: CHATS DIRECTOS 1 A 1 (M10) --- */}
      {activeSubTab === 'chats' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-black text-ink dark:text-ink-light uppercase tracking-wider">
              Conversaciones Privadas
            </h3>
            <button
              onClick={cargarConversaciones}
              className="text-xs text-brand-primary flex items-center space-x-1 font-bold"
            >
              <RefreshCw size={12} className={isLoadingChats ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>
          </div>

          {isLoadingChats ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando tus conversaciones...</p>
            </div>
          ) : conversaciones.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6 space-y-2">
              <MessageSquare size={32} className="mx-auto text-ink-muted/50" />
              <h4 className="text-sm font-black text-ink dark:text-ink-light">Aún no tienes chats directos</h4>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                Explora compañeros y envía una solicitud con motivo académico. Al ser aceptada, el chat aparecerá aquí.
              </p>
              <button
                onClick={() => setActiveSubTab('personas')}
                className="mt-2 px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl shadow-sm"
              >
                Explorar compañeros
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {conversaciones.map((conv) => {
                const other = conv.otherUser;
                const nombreOther = `${other?.nombre || 'Compañero'} ${other?.apellido || ''}`.trim();

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveChat({ conversacionId: conv.id, otherUser: other })}
                    className="k-card p-3.5 flex items-center space-x-3.5 border border-line dark:border-line-dark rounded-2xl hover:border-brand-primary/60 cursor-pointer transition bg-white dark:bg-surface-cardDark shadow-xs"
                  >
                    <div className="relative shrink-0">
                      {other?.foto_url ? (
                        <img
                          src={other.foto_url}
                          alt={nombreOther}
                          className="w-12 h-12 rounded-2xl object-cover border border-line dark:border-line-dark"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white font-black text-sm flex items-center justify-center">
                          {(other?.nombre?.[0] || 'C').toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-cardDark" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-xs font-black text-ink dark:text-ink-light truncate">
                          {nombreOther}
                        </h4>
                        <span className="text-[10px] text-ink-muted">
                          {conv.ultimoMensajeHora
                            ? new Date(conv.ultimoMensajeHora).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-[11px] text-brand-primary font-semibold truncate">
                        {other?.carrera} · {other?.ciclo}.° Ciclo
                      </p>

                      <p className="text-xs text-ink-muted truncate font-medium mt-0.5">
                        {conv.ultimoMensaje}
                      </p>
                    </div>

                    {conv.noLeidos > 0 && (
                      <span className="w-5 h-5 bg-emerald-500 text-white text-[11px] font-black rounded-full flex items-center justify-center shrink-0 shadow-sm">
                        {conv.noLeidos}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- MODAL: PERFIL DE OTRO ALUMNO Y ENVIAR SOLICITUD (M08) --- */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase text-ink dark:text-ink-light tracking-wider">
                Perfil de Compañero
              </span>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1 text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center space-x-3.5">
              {selectedStudent.foto_url ? (
                <img
                  src={selectedStudent.foto_url}
                  alt={selectedStudent.nombre}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-primary/20 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-brand-primary text-white font-black text-lg flex items-center justify-center shrink-0">
                  {(selectedStudent.nombre?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base font-black text-ink dark:text-ink-light truncate">
                  {selectedStudent.nombre} {selectedStudent.apellido}
                </h3>
                <p className="text-xs text-brand-primary dark:text-accent font-bold truncate">
                  {selectedStudent.carrera} · Ciclo {selectedStudent.ciclo}
                </p>
                <p className="text-[11px] text-ink-muted">
                  Sede {selectedStudent.sede || 'Lima Sur'}
                </p>
              </div>
            </div>

            {selectedStudent.bio && (
              <p className="text-xs text-ink-soft dark:text-ink-muted bg-surface dark:bg-surface-dark p-2.5 rounded-xl italic">
                "{selectedStudent.bio}"
              </p>
            )}

            {solicitudEnviadaSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-center space-y-1.5 border border-emerald-300">
                <Check size={26} className="text-emerald-600 mx-auto" />
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  Solicitud enviada a {selectedStudent.nombre}
                </p>
                <p className="text-[11px] text-ink-muted">
                  Podrán chatear una vez que acepte tu solicitud.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-ink dark:text-ink-light">
                      Motivo académico de contacto (Spec 6.4):
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Hola, me gustaría coordinar sobre cursos o proyectos afines..."
                    value={motivoSolicitud}
                    onChange={(e) => setMotivoSolicitud(e.target.value)}
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary resize-none font-medium"
                  />
                  {solicitudError && (
                    <p className="text-xs text-semantic-danger font-semibold mt-1">
                      {solicitudError}
                    </p>
                  )}
                  <p className="text-[10px] text-ink-muted mt-1">
                    🔒 No hay mensajes directos libres. La otra persona debe aceptar tu motivo para abrir el chat.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setTargetUserOption(selectedStudent);
                        setShowBlockModal(true);
                      }}
                      className="text-[11px] text-ink-muted hover:text-semantic-danger font-bold flex items-center space-x-1 py-1 px-2 rounded-lg"
                    >
                      <UserX size={13} />
                      <span>Bloquear</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleEnviarSolicitud}
                      disabled={!motivoSolicitud.trim() || isSendingSolicitud}
                      className="px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white text-xs font-extrabold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                    >
                      {isSendingSolicitud ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <span>Enviar Solicitud</span>
                          <Send size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: CHAT DIRECTO EN TIEMPO REAL (M10) --- */}
      {activeChat && (
        <ChatDirectoModal
          conversacionId={activeChat.conversacionId}
          otherUser={activeChat.otherUser}
          currentUser={user}
          onClose={() => {
            setActiveChat(null);
            cargarConversaciones();
          }}
          onUserBlocked={() => {
            setActiveChat(null);
            cargarPerfiles();
            cargarConversaciones();
          }}
        />
      )}

      {/* --- MODAL: REPORTAR USUARIO / CONTENIDO --- */}
      {showReportModal && targetUserOption && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase text-semantic-danger tracking-wider flex items-center space-x-1.5">
                <ShieldAlert size={16} />
                <span>Reportar a moderación</span>
              </span>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setTargetUserOption(null);
                }}
                className="p-1 text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-center space-y-1 text-emerald-800 dark:text-emerald-300">
                <Check size={24} className="mx-auto text-emerald-600" />
                <p className="text-xs font-extrabold">Reporte enviado con éxito.</p>
                <p className="text-[11px] text-ink-muted">El equipo de moderación revisará este caso.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-soft dark:text-ink-muted">
                  Reportarás a <strong className="text-ink dark:text-ink-light">{targetUserOption.nombre} {targetUserOption.apellido}</strong>.
                </p>

                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">
                    Motivo principal:
                  </label>
                  <select
                    value={reportMotivo}
                    onChange={(e) => setReportMotivo(e.target.value)}
                    className="w-full p-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-bold text-ink dark:text-ink-light focus:outline-none"
                  >
                    <option value="Acoso o mensaje no deseado">Acoso o mensaje no deseado</option>
                    <option value="Suplantación de identidad">Suplantación de identidad</option>
                    <option value="Contenido inapropiado / spam">Contenido inapropiado / spam</option>
                    <option value="Comportamiento antideportivo o violento">Comportamiento antideportivo o violento</option>
                    <option value="Otro motivo de seguridad">Otro motivo de seguridad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">
                    Detalle de lo ocurrido:
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetalle}
                    onChange={(e) => setReportDetalle(e.target.value)}
                    placeholder="Describe brevemente la infracción..."
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs text-ink dark:text-ink-light focus:outline-none resize-none font-medium"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setTargetUserOption(null);
                    }}
                    className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReportarUsuario}
                    disabled={!reportDetalle.trim() || isSubmittingReport}
                    className="px-4 py-2 bg-semantic-danger hover:opacity-90 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-sm transition"
                  >
                    {isSubmittingReport ? 'Enviando...' : 'Enviar Reporte'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMAR BLOQUEO --- */}
      {showBlockModal && targetUserOption && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-semantic-danger flex items-center justify-center mx-auto">
              <UserX size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-ink dark:text-ink-light">
                ¿Bloquear a {targetUserOption.nombre}?
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Este estudiante no podrá enviarte mensajes, solicitudes ni ver tu perfil en Explorar.
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setTargetUserOption(null);
                }}
                className="flex-1 py-2.5 text-xs font-bold text-ink-muted hover:text-ink bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleBloquearUsuario}
                disabled={isSubmittingBlock}
                className="flex-1 py-2.5 bg-semantic-danger hover:opacity-90 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-sm transition"
              >
                {isSubmittingBlock ? 'Bloqueando...' : 'Sí, Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
