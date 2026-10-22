import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../data/store';
import { CARRERAS_UTP, INTERESES_DISPONIBLES } from '../data/mockData';
import { CONTACTO } from '../data/textos';
import {
  fetchPerfilesExplorar,
  fetchSolicitudes,
  enviarSolicitudMensaje,
  responderSolicitud,
  reportarContenido,
  bloquearUsuario,
  subscribeToSolicitudes
} from '../lib/explore';
import { fetchConversaciones, conversacionCon, subscribeToMisMensajes } from '../lib/chat';
import { useAtras } from '../lib/atras';
import ChatDirectoModal from '../components/ChatDirectoModal';
import ErrorConReintento from '../components/ErrorConReintento';
import PanelInferior, { OpcionPanel } from '../components/PanelInferior';
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
  Send,
  MoreVertical,
  SlidersHorizontal,
  Clock,
  Inbox,
  UserCheck,
  User
} from 'lucide-react';

// Avatar cuadrado con la foto o la inicial
function Avatar({ persona, tam = 'w-14 h-14', texto = 'text-base' }) {
  const nombre = `${persona?.nombre || ''} ${persona?.apellido || ''}`.trim();
  return persona?.foto_url ? (
    <img
      src={persona.foto_url}
      alt={nombre}
      className={`${tam} rounded-2xl object-cover border border-line dark:border-line-dark shadow-sm shrink-0`}
    />
  ) : (
    <div className={`${tam} rounded-2xl bg-brand-primary text-white font-black ${texto} flex items-center justify-center shadow-sm shrink-0`}>
      {(persona?.nombre?.[0] || 'U').toUpperCase()}
    </div>
  );
}

function MarcaContacto() {
  return (
    <span className="inline-flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-accent-soft dark:bg-accent-dark/50 text-accent dark:text-teal-200 shrink-0">
      <UserCheck size={11} />
      <span>{CONTACTO.marca}</span>
    </span>
  );
}

const lineaCarrera = (p) => [p?.carrera, p?.ciclo ? `${p.ciclo}.° ciclo` : null].filter(Boolean).join(' · ');

export default function ExplorarView() {
  const { user } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('personas'); // 'personas' | 'solicitudes' | 'chats'
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCarrera, setFiltroCarrera] = useState('');
  const [filtroCiclo, setFiltroCiclo] = useState('');
  const [filtroInteres, setFiltroInteres] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);

  // Perfiles de estudiantes
  const [perfiles, setPerfiles] = useState([]);
  const [isLoadingPerfiles, setIsLoadingPerfiles] = useState(true);
  const [errorPerfiles, setErrorPerfiles] = useState('');

  // Solicitudes recibidas y enviadas
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState([]);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState([]);
  const [tipoSolTab, setTipoSolTab] = useState('recibidas'); // 'recibidas' | 'enviadas'
  const [isLoadingSolicitudes, setIsLoadingSolicitudes] = useState(false);
  const [errorSolicitudes, setErrorSolicitudes] = useState('');
  const [respondiendoId, setRespondiendoId] = useState(null);
  const [solicitudResaltada, setSolicitudResaltada] = useState(null);

  // Conversaciones (cada contacto tiene una)
  const [conversaciones, setConversaciones] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [errorChats, setErrorChats] = useState('');
  const [vistaChats, setVistaChats] = useState('conversaciones'); // 'conversaciones' | 'contactos'

  // Estado de la relación con cada alumno: hasta tener solicitudes y conversaciones
  // del servidor no se muestra ningún botón (nunca "Agregar" a alguien que ya es contacto).
  const [relacionesListas, setRelacionesListas] = useState({ solicitudes: false, chats: false });
  const [errorRelaciones, setErrorRelaciones] = useState('');

  // Perfil de otro alumno (M08)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [isSendingSolicitud, setIsSendingSolicitud] = useState(false);
  const [solicitudEnviadaSuccess, setSolicitudEnviadaSuccess] = useState(false);
  const [solicitudError, setSolicitudError] = useState('');

  // Chat directo 1 a 1 en tiempo real (M10)
  const [activeChat, setActiveChat] = useState(null); // { conversacionId, otherUser }
  const [errorChatAbrir, setErrorChatAbrir] = useState('');

  // Menú ⋮ de una tarjeta, reportar y bloquear (M33)
  const [menuPersona, setMenuPersona] = useState(null);
  const [targetUserOption, setTargetUserOption] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMotivo, setReportMotivo] = useState('Acoso o mensaje no deseado');
  const [reportDetalle, setReportDetalle] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState('');

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);
  const [blockError, setBlockError] = useState('');

  // Botón atrás de Android
  useAtras(Boolean(selectedStudent), () => setSelectedStudent(null));
  useAtras(showReportModal, () => {
    setShowReportModal(false);
    setTargetUserOption(null);
  });
  useAtras(showBlockModal, () => {
    setShowBlockModal(false);
    setTargetUserOption(null);
  });

  // Cargar perfiles reales (Supabase)
  const cargarPerfiles = useCallback(async () => {
    setIsLoadingPerfiles(true);
    setErrorPerfiles('');
    try {
      const data = await fetchPerfilesExplorar({
        searchTerm,
        carrera: filtroCarrera,
        ciclo: filtroCiclo,
        interes: filtroInteres
      });
      setPerfiles(data);
    } catch (err) {
      setErrorPerfiles(err.message);
    } finally {
      setIsLoadingPerfiles(false);
    }
  }, [searchTerm, filtroCarrera, filtroCiclo, filtroInteres]);

  const cargarSolicitudes = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setIsLoadingSolicitudes(true);
    setErrorSolicitudes('');
    try {
      const { recibidas, enviadas } = await fetchSolicitudes();
      setSolicitudesRecibidas(recibidas);
      setSolicitudesEnviadas(enviadas);
      setRelacionesListas((r) => ({ ...r, solicitudes: true }));
      setErrorRelaciones('');
    } catch (err) {
      setErrorSolicitudes(err.message);
      setErrorRelaciones(err.message);
    } finally {
      setIsLoadingSolicitudes(false);
    }
  }, []);

  const cargarConversaciones = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setIsLoadingChats(true);
    setErrorChats('');
    try {
      setConversaciones(await fetchConversaciones());
      setRelacionesListas((r) => ({ ...r, chats: true }));
      setErrorRelaciones('');
    } catch (err) {
      setErrorChats(err.message);
      setErrorRelaciones(err.message);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  const cargarRelaciones = useCallback(() => {
    cargarSolicitudes({ silencioso: true });
    cargarConversaciones({ silencioso: true });
  }, [cargarSolicitudes, cargarConversaciones]);

  // Búsqueda con pequeña espera para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(cargarPerfiles, searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [cargarPerfiles, user?.id]);

  // Solicitudes y conversaciones desde el inicio: definen el botón de cada tarjeta
  useEffect(() => {
    cargarRelaciones();
  }, [cargarRelaciones, user?.id]);

  // Avisos en vivo (Supabase Realtime): solicitudes nuevas/aceptadas y mensajes nuevos
  useEffect(() => {
    const unsubSol = subscribeToSolicitudes(cargarRelaciones);
    const unsubChats = subscribeToMisMensajes(() => cargarConversaciones({ silencioso: true }));
    return () => {
      unsubSol();
      unsubChats();
    };
  }, [cargarRelaciones, cargarConversaciones, user?.id]);

  useEffect(() => {
    if (activeSubTab === 'solicitudes') {
      cargarSolicitudes();
    } else if (activeSubTab === 'chats') {
      cargarConversaciones();
    }
  }, [activeSubTab, cargarSolicitudes, cargarConversaciones]);

  // Relación con cada alumno, calculada con lo que devolvió el servidor
  const relaciones = useMemo(() => {
    const mapa = new Map();
    for (const s of solicitudesEnviadas) {
      // Una solicitud no aceptada se sigue mostrando como enviada (el servidor no deja reenviarla)
      mapa.set(s.a_id, s.estado === 'aceptada' ? { tipo: 'contacto' } : { tipo: 'enviada', solicitud: s });
    }
    for (const s of solicitudesRecibidas) {
      if (s.estado === 'pendiente') mapa.set(s.de_id, { tipo: 'recibida', solicitud: s });
      else if (s.estado === 'aceptada') mapa.set(s.de_id, { tipo: 'contacto' });
    }
    // Un chat abierto por "Yo te ayudo" (origen 'ayuda') no los convierte en contactos
    for (const c of conversaciones) {
      if (c.otherUser?.id && c.origen === 'solicitud') mapa.set(c.otherUser.id, { tipo: 'contacto', conversacionId: c.id });
    }
    return mapa;
  }, [solicitudesEnviadas, solicitudesRecibidas, conversaciones]);

  const relacionesCargadas = relacionesListas.solicitudes && relacionesListas.chats;
  const relacionCon = (id) => relaciones.get(id) || { tipo: 'ninguna' };

  // Contactos ordenados por nombre (salen de las conversaciones)
  const contactos = useMemo(
    () =>
      conversaciones
        .filter((c) => c.origen === 'solicitud')
        .map((c) => ({ ...c.otherUser, conversacionId: c.id }))
        .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es')),
    [conversaciones]
  );

  // Enviar solicitud con motivo (el servidor valida duplicados, bloqueos y si ya son contactos)
  const handleEnviarSolicitud = async () => {
    if (!motivoSolicitud.trim() || !selectedStudent) return;
    setIsSendingSolicitud(true);
    setSolicitudError('');

    try {
      await enviarSolicitudMensaje({ aId: selectedStudent.id, motivo: motivoSolicitud.trim() });
      setSolicitudEnviadaSuccess(true);
      cargarSolicitudes({ silencioso: true });
      setTimeout(() => {
        setSelectedStudent(null);
        setSolicitudEnviadaSuccess(false);
        setMotivoSolicitud('');
      }, 1300);
    } catch (err) {
      setSolicitudError(err.message);
      cargarRelaciones(); // por si el estado cambió en otro celular
    } finally {
      setIsSendingSolicitud(false);
    }
  };

  // Aceptar o ignorar solicitud
  const handleResponderSolicitud = async (solicitud, accion) => {
    setRespondiendoId(solicitud.id);
    setErrorSolicitudes('');
    try {
      const conversacionId = await responderSolicitud({
        solicitudId: solicitud.id,
        aceptar: accion === 'aceptada'
      });
      if (accion === 'aceptada' && conversacionId) {
        setActiveChat({ conversacionId, otherUser: solicitud.otroUsuario });
      }
      await Promise.all([cargarSolicitudes({ silencioso: true }), cargarConversaciones({ silencioso: true })]);
    } catch (err) {
      setErrorSolicitudes(err.message);
    } finally {
      setRespondiendoId(null);
    }
  };

  // Abrir el chat con un contacto
  const abrirChat = async (persona, conversacionId = null) => {
    if (!persona?.id) return;
    setErrorChatAbrir('');
    try {
      const id = conversacionId || relacionCon(persona.id).conversacionId || (await conversacionCon(persona.id));
      if (id) {
        setSelectedStudent(null);
        setActiveChat({ conversacionId: id, otherUser: persona });
      } else {
        setErrorChatAbrir('Todavía no tienen un chat abierto.');
      }
    } catch (err) {
      setErrorChatAbrir(err.message);
    }
  };

  // "Responder": lleva a la solicitud recibida
  const irASolicitud = (solicitud) => {
    setSelectedStudent(null);
    setTipoSolTab('recibidas');
    setSolicitudResaltada(solicitud?.id || null);
    setActiveSubTab('solicitudes');
  };

  const abrirPerfil = (est) => {
    setSelectedStudent(est);
    setMotivoSolicitud('');
    setSolicitudError('');
    setSolicitudEnviadaSuccess(false);
  };

  // Confirmar reporte
  const handleReportarUsuario = async () => {
    if (!reportDetalle.trim() || !targetUserOption) return;
    setIsSubmittingReport(true);
    setReportError('');
    try {
      await reportarContenido({
        tipo: 'perfil',
        objetoId: targetUserOption.id,
        motivo: `${reportMotivo}: ${reportDetalle.trim()}`
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
        setReportDetalle('');
        setTargetUserOption(null);
      }, 1400);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Confirmar bloqueo
  const handleBloquearUsuario = async () => {
    if (!targetUserOption) return;
    setIsSubmittingBlock(true);
    setBlockError('');
    try {
      await bloquearUsuario({ bloqueadoId: targetUserOption.id });
      setShowBlockModal(false);
      setTargetUserOption(null);
      setSelectedStudent(null);
      cargarPerfiles();
      cargarRelaciones();
    } catch (err) {
      setBlockError(err.message);
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const pedirReporte = (persona) => {
    setMenuPersona(null);
    setTargetUserOption(persona);
    setReportError('');
    setShowReportModal(true);
  };

  const pedirBloqueo = (persona) => {
    setMenuPersona(null);
    setTargetUserOption(persona);
    setBlockError('');
    setShowBlockModal(true);
  };

  // En Solicitudes solo se ven las pendientes: las aceptadas viven en "Mis contactos" y las
  // ignoradas no se muestran. Las listas completas siguen sirviendo para el estado de cada tarjeta.
  const recibidasPendientes = solicitudesRecibidas.filter((s) => s.estado === 'pendiente');
  const enviadasPendientes = solicitudesEnviadas.filter((s) => s.estado === 'pendiente');
  const totalPendientesRecibidas = recibidasPendientes.length;
  const totalMensajesNoLeidos = conversaciones.reduce((acc, c) => acc + (c.noLeidos || 0), 0);
  const filtrosActivos = [
    filtroCarrera && { id: 'carrera', texto: filtroCarrera, quitar: () => setFiltroCarrera('') },
    filtroCiclo && { id: 'ciclo', texto: `${filtroCiclo}.° ciclo`, quitar: () => setFiltroCiclo('') },
    filtroInteres && { id: 'interes', texto: filtroInteres, quitar: () => setFiltroInteres('') }
  ].filter(Boolean);
  const quitarFiltros = () => {
    setSearchTerm('');
    setFiltroCarrera('');
    setFiltroCiclo('');
    setFiltroInteres('');
  };

  // Botón principal de una tarjeta o del perfil, según la relación real
  const botonRelacion = (persona, { ancho = false } = {}) => {
    const base = `px-3.5 py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center space-x-1.5 shrink-0 ${ancho ? 'w-full' : ''}`;
    if (!relacionesCargadas) {
      return (
        <span className={`${base} bg-slate-100 dark:bg-slate-800 text-ink-muted`} aria-label="Cargando">
          <Loader2 size={13} className="animate-spin" />
        </span>
      );
    }
    const rel = relacionCon(persona.id);
    if (rel.tipo === 'contacto') {
      return (
        <button onClick={() => abrirChat(persona, rel.conversacionId)} className={`${base} bg-accent hover:bg-accent-hover text-white shadow-sm active:scale-95`}>
          <MessageCircle size={13} />
          <span>{CONTACTO.chatear}</span>
        </button>
      );
    }
    if (rel.tipo === 'enviada') {
      return (
        <button disabled className={`${base} bg-slate-100 dark:bg-slate-800 text-ink-muted cursor-default`}>
          <Clock size={13} />
          <span>{CONTACTO.solicitudEnviada}</span>
        </button>
      );
    }
    if (rel.tipo === 'recibida') {
      return (
        <button onClick={() => irASolicitud(rel.solicitud)} className={`${base} bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95`}>
          <Inbox size={13} />
          <span>{CONTACTO.responder}</span>
        </button>
      );
    }
    return (
      <button onClick={() => abrirPerfil(persona)} className={`${base} bg-brand-primary hover:bg-brand-primaryHover text-white shadow-sm active:scale-95`}>
        <UserPlus size={13} />
        <span>{CONTACTO.agregar}</span>
      </button>
    );
  };

  const relSeleccionado = selectedStudent && relacionesCargadas ? relacionCon(selectedStudent.id) : null;

  return (
    <div className="flex-1 p-4 pb-6 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* 3 sub-pestañas: Explorar · Solicitudes · Chats */}
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
          <span>Chats</span>
          {totalMensajesNoLeidos > 0 && (
            <span className="w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-black">
              {totalMensajesNoLeidos}
            </span>
          )}
        </button>
      </div>

      {errorChatAbrir && <ErrorConReintento compacto mensaje={errorChatAbrir} />}

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

          {/* Filtros: un botón que abre el panel y los activos como chips (scroll sin barra) */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            <button
              onClick={() => setShowFiltros(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center space-x-1.5 shrink-0 shadow-sm transition ${
                filtrosActivos.length
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light border-line dark:border-line-dark'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Filtros{filtrosActivos.length ? ` (${filtrosActivos.length})` : ''}</span>
            </button>
            {filtrosActivos.map((f) => (
              <button
                key={f.id}
                onClick={f.quitar}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 border border-brand-primary/20 flex items-center space-x-1 shrink-0"
                aria-label={`Quitar filtro ${f.texto}`}
              >
                <span className="whitespace-nowrap">{f.texto}</span>
                <X size={12} />
              </button>
            ))}
          </div>

          {errorRelaciones && !relacionesCargadas && (
            <ErrorConReintento compacto mensaje={errorRelaciones} onReintentar={cargarRelaciones} />
          )}

          {/* Lista de estudiantes */}
          {isLoadingPerfiles ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-medium">Buscando compañeros...</p>
            </div>
          ) : errorPerfiles ? (
            <ErrorConReintento mensaje={errorPerfiles} onReintentar={cargarPerfiles} />
          ) : perfiles.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark space-y-2">
              {searchTerm || filtrosActivos.length ? (
                <>
                  <p className="text-sm font-bold text-ink dark:text-ink-light">No encontramos compañeros con estos filtros</p>
                  <p className="text-xs text-ink-muted">Prueba con otra carrera o ciclo.</p>
                  <button
                    onClick={quitarFiltros}
                    className="mt-1 px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl shadow-sm"
                  >
                    Quitar filtros
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-ink dark:text-ink-light">Aún no hay más compañeros en Kampuz</p>
                  <p className="text-xs text-ink-muted">
                    Invita a alguien de tu salón a registrarse con su correo @utp.edu.pe. Apenas cree su cuenta, aparecerá aquí.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {perfiles.map((est) => {
                const userIntereses = user?.intereses || [];
                const estIntereses = est.intereses || [];
                const interesComun = estIntereses.find((i) => userIntereses.includes(i)) || estIntereses[0] || null;
                const nombreEst = `${est.nombre} ${est.apellido || ''}`.trim();
                const esContacto = relacionesCargadas && relacionCon(est.id).tipo === 'contacto';

                return (
                  <div
                    key={est.id}
                    className="k-card p-4 space-y-3 border-2 border-line/90 dark:border-line-dark rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark"
                  >
                    <div className="flex items-start space-x-3">
                      <button onClick={() => abrirPerfil(est)} className="shrink-0" aria-label={`Ver perfil de ${nombreEst}`}>
                        <Avatar persona={est} />
                      </button>

                      <button onClick={() => abrirPerfil(est)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-sm font-black text-ink dark:text-ink-light truncate">{nombreEst}</h3>
                          {esContacto && <MarcaContacto />}
                        </div>
                        {est.usuario && <p className="text-[11px] font-medium text-ink-muted truncate">@{est.usuario}</p>}
                        <p className="text-xs font-bold text-brand-primary dark:text-teal-300 truncate mt-0.5">{lineaCarrera(est)}</p>
                        <p className="text-[11px] text-ink-muted truncate font-medium mt-0.5">
                          {est.sede ? `Sede ${est.sede}` : ''}
                          {est.bio ? ` · ${est.bio}` : ''}
                        </p>
                      </button>

                      <button
                        onClick={() => setMenuPersona(est)}
                        className="p-1.5 -mr-1.5 -mt-1 text-ink-muted hover:text-ink dark:hover:text-ink-light rounded-lg shrink-0"
                        aria-label="Más opciones"
                        title="Más opciones"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-line/80 dark:border-line-dark">
                      {interesComun ? (
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-accent dark:text-teal-200 bg-accent-soft/70 dark:bg-accent-dark/40 px-3 py-1 rounded-full border border-accent/20 min-w-0">
                          <Sparkles size={12} className="shrink-0 text-accent" />
                          <span className="truncate">{interesComun}</span>
                        </div>
                      ) : (
                        <span />
                      )}
                      {botonRelacion(est)}
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
                tipoSolTab === 'recibidas' ? 'bg-white dark:bg-surface-dark text-ink dark:text-ink-light shadow-xs' : 'text-ink-muted'
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
                tipoSolTab === 'enviadas' ? 'bg-white dark:bg-surface-dark text-ink dark:text-ink-light shadow-xs' : 'text-ink-muted'
              }`}
            >
              Enviadas ({enviadasPendientes.length})
            </button>
          </div>

          {errorSolicitudes && (
            <ErrorConReintento compacto mensaje={errorSolicitudes} onReintentar={() => cargarSolicitudes()} />
          )}

          {isLoadingSolicitudes ? (
            <div className="flex flex-col items-center justify-center py-10 text-ink-muted">
              <Loader2 size={22} className="animate-spin text-accent" />
              <p className="text-xs font-semibold mt-1">Cargando solicitudes...</p>
            </div>
          ) : tipoSolTab === 'recibidas' ? (
            recibidasPendientes.length === 0 ? (
              <div className="text-center py-10 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6">
                <p className="text-xs text-ink-muted font-medium">{CONTACTO.sinSolicitudesRecibidas}</p>
              </div>
            ) : (
              recibidasPendientes.map((sol) => (
                <div
                  key={sol.id}
                  className={`k-card p-4 space-y-2.5 border-2 rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark ${
                    solicitudResaltada === sol.id ? 'border-amber-400 dark:border-amber-500' : 'border-line/80 dark:border-line-dark'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar persona={sol.otroUsuario} tam="w-11 h-11" texto="text-xs" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-ink dark:text-ink-light truncate">
                        {sol.otroUsuario?.nombre} {sol.otroUsuario?.apellido}
                      </h4>
                      <p className="text-[11px] text-ink-muted font-medium truncate">{lineaCarrera(sol.otroUsuario)}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl text-xs text-ink-soft dark:text-ink-muted italic border border-line dark:border-line-dark leading-relaxed">
                    "{sol.motivo}"
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleResponderSolicitud(sol, 'rechazada')}
                      disabled={respondiendoId === sol.id}
                      className="px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink disabled:opacity-50"
                    >
                      {CONTACTO.ignorar}
                    </button>
                    <button
                      onClick={() => handleResponderSolicitud(sol, 'aceptada')}
                      disabled={respondiendoId === sol.id}
                      className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center space-x-1"
                    >
                      {respondiendoId === sol.id && <Loader2 size={13} className="animate-spin" />}
                      <span>{CONTACTO.aceptar}</span>
                    </button>
                  </div>
                </div>
              ))
            )
          ) : enviadasPendientes.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6">
              <p className="text-xs text-ink-muted font-medium">No tienes solicitudes enviadas pendientes.</p>
            </div>
          ) : (
            enviadasPendientes.map((sol) => (
              <div
                key={sol.id}
                className="k-card p-4 space-y-2 border border-line dark:border-line-dark rounded-2xl shadow-sm bg-white dark:bg-surface-cardDark"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    <Avatar persona={sol.otroUsuario} tam="w-10 h-10" texto="text-xs" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-ink dark:text-ink-light truncate">
                        {sol.otroUsuario?.nombre} {sol.otroUsuario?.apellido}
                      </h4>
                      <p className="text-[11px] text-ink-muted truncate">{lineaCarrera(sol.otroUsuario)}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    Pendiente
                  </span>
                </div>

                <p className="text-xs text-ink-muted italic bg-surface dark:bg-surface-dark p-2.5 rounded-xl">"{sol.motivo}"</p>

              </div>
            ))
          )}
        </div>
      )}

      {/* --- SUBTAB 3: CHATS Y MIS CONTACTOS (M10) --- */}
      {activeSubTab === 'chats' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex bg-slate-100 dark:bg-surface-cardDark p-1 rounded-xl text-xs font-bold flex-1">
              <button
                onClick={() => setVistaChats('conversaciones')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  vistaChats === 'conversaciones' ? 'bg-white dark:bg-surface-dark text-ink dark:text-ink-light shadow-xs' : 'text-ink-muted'
                }`}
              >
                Conversaciones
              </button>
              <button
                onClick={() => setVistaChats('contactos')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  vistaChats === 'contactos' ? 'bg-white dark:bg-surface-dark text-ink dark:text-ink-light shadow-xs' : 'text-ink-muted'
                }`}
              >
                {CONTACTO.misContactos} ({contactos.length})
              </button>
            </div>
            <button
              onClick={() => cargarConversaciones()}
              className="p-2 text-brand-primary dark:text-accent rounded-lg"
              aria-label="Actualizar"
              title="Actualizar"
            >
              <RefreshCw size={14} className={isLoadingChats ? 'animate-spin' : ''} />
            </button>
          </div>

          {isLoadingChats ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando tus chats...</p>
            </div>
          ) : errorChats ? (
            <ErrorConReintento mensaje={errorChats} onReintentar={() => cargarConversaciones()} />
          ) : conversaciones.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6 space-y-2">
              <MessageSquare size={32} className="mx-auto text-ink-muted/50" />
              <h4 className="text-sm font-black text-ink dark:text-ink-light">{CONTACTO.sinContactos}</h4>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">{CONTACTO.sinContactosDetalle}</p>
              <button
                onClick={() => setActiveSubTab('personas')}
                className="mt-2 px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl shadow-sm"
              >
                Explorar compañeros
              </button>
            </div>
          ) : vistaChats === 'contactos' && contactos.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark p-6 space-y-1">
              <h4 className="text-sm font-black text-ink dark:text-ink-light">{CONTACTO.sinContactos}</h4>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">{CONTACTO.sinContactosDetalle}</p>
            </div>
          ) : vistaChats === 'contactos' ? (
            <div className="k-card bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl divide-y divide-line/70 dark:divide-line-dark">
              {contactos.map((c) => (
                <div key={c.id} className="flex items-center space-x-3 p-3">
                  <Avatar persona={c} tam="w-11 h-11" texto="text-sm" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-ink dark:text-ink-light truncate">
                      {c.nombre} {c.apellido}
                    </h4>
                    <p className="text-[11px] text-ink-muted truncate">{lineaCarrera(c)}</p>
                  </div>
                  <button
                    onClick={() => abrirChat(c, c.conversacionId)}
                    className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center space-x-1 shrink-0"
                  >
                    <MessageCircle size={13} />
                    <span>{CONTACTO.chatear}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {conversaciones.map((conv) => {
                const other = conv.otherUser;
                const nombreOther = `${other?.nombre || 'Compañero'} ${other?.apellido || ''}`.trim();

                return (
                  <button
                    key={conv.id}
                    onClick={() =>
                      setActiveChat({
                        conversacionId: conv.id,
                        otherUser: other,
                        origen: conv.origen,
                        publicacionTitulo: conv.publicacionTitulo,
                        puedeEscribir: conv.puedeEscribir
                      })
                    }
                    className="k-card w-full text-left p-3.5 flex items-center space-x-3 border border-line dark:border-line-dark rounded-2xl hover:border-brand-primary/60 transition bg-white dark:bg-surface-cardDark shadow-xs"
                  >
                    <Avatar persona={other} tam="w-12 h-12" texto="text-sm" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5 gap-2">
                        <h4 className="text-xs font-black text-ink dark:text-ink-light truncate">{nombreOther}</h4>
                        <span className="text-[10px] text-ink-muted shrink-0">
                          {conv.ultimoMensajeHora
                            ? new Date(conv.ultimoMensajeHora).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-[11px] text-brand-primary dark:text-teal-300 font-semibold truncate">{lineaCarrera(other)}</p>

                      {conv.origen === 'ayuda' && (
                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 truncate">
                          Por la publicación «{conv.publicacionTitulo || 'del tablón'}»
                        </p>
                      )}
                      <p className="text-xs text-ink-muted truncate font-medium mt-0.5">{conv.ultimoMensaje}</p>
                    </div>

                    {conv.noLeidos > 0 && (
                      <span className="w-5 h-5 bg-emerald-500 text-white text-[11px] font-black rounded-full flex items-center justify-center shrink-0 shadow-sm">
                        {conv.noLeidos}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- PANEL: FILTROS --- */}
      <PanelInferior abierto={showFiltros} onCerrar={() => setShowFiltros(false)} titulo="Filtros">
        <div className="space-y-3">
          {[
            {
              etiqueta: 'Carrera',
              valor: filtroCarrera,
              cambiar: setFiltroCarrera,
              opciones: [{ v: '', t: 'Todas las carreras' }, ...CARRERAS_UTP.map((c) => ({ v: c.nombre, t: c.nombre }))]
            },
            {
              etiqueta: 'Ciclo',
              valor: filtroCiclo,
              cambiar: setFiltroCiclo,
              opciones: [{ v: '', t: 'Todos los ciclos' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => ({ v: String(c), t: `${c}.° ciclo` }))]
            },
            {
              etiqueta: 'Interés',
              valor: filtroInteres,
              cambiar: setFiltroInteres,
              opciones: [{ v: '', t: 'Todos los intereses' }, ...INTERESES_DISPONIBLES.map((i) => ({ v: i, t: i }))]
            }
          ].map((f) => (
            <label key={f.etiqueta} className="block">
              <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">{f.etiqueta}</span>
              <select
                value={f.valor}
                onChange={(e) => f.cambiar(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
              >
                {f.opciones.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.t}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="flex items-center space-x-2 pt-1">
            <button
              onClick={() => {
                setFiltroCarrera('');
                setFiltroCiclo('');
                setFiltroInteres('');
              }}
              className="flex-1 py-2.5 text-xs font-bold text-ink-muted bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              Quitar filtros
            </button>
            <button onClick={() => setShowFiltros(false)} className="flex-1 py-2.5 text-xs font-extrabold text-white bg-brand-primary rounded-xl">
              Ver resultados
            </button>
          </div>
        </div>
      </PanelInferior>

      {/* --- MODAL: PERFIL DE OTRO ALUMNO (M08) --- */}
      {selectedStudent && (
        <div className="fixed inset-0 !m-0 bg-black/60 z-50 flex items-center justify-center px-4 safe-overlay" onClick={() => setSelectedStudent(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-full overflow-y-auto bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase text-ink dark:text-ink-light tracking-wider">Perfil</span>
              <div className="flex items-center">
                <button
                  onClick={() => setMenuPersona(selectedStudent)}
                  className="p-1 text-ink-muted hover:text-ink dark:hover:text-ink-light"
                  aria-label="Más opciones"
                >
                  <MoreVertical size={18} />
                </button>
                <button onClick={() => setSelectedStudent(null)} className="p-1 text-ink-muted hover:text-ink" aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <Avatar persona={selectedStudent} tam="w-14 h-14" texto="text-lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="text-base font-black text-ink dark:text-ink-light truncate">
                    {selectedStudent.nombre} {selectedStudent.apellido}
                  </h3>
                  {relSeleccionado?.tipo === 'contacto' && <MarcaContacto />}
                </div>
                {selectedStudent.usuario && (
                  <p className="text-[11px] font-medium text-ink-muted truncate">@{selectedStudent.usuario}</p>
                )}
                <p className="text-xs text-brand-primary dark:text-accent font-bold truncate">{lineaCarrera(selectedStudent)}</p>
                {selectedStudent.sede && <p className="text-[11px] text-ink-muted">Sede {selectedStudent.sede}</p>}
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
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">{CONTACTO.enviadaA(selectedStudent.nombre)}</p>
                <p className="text-[11px] text-ink-muted">{CONTACTO.enviadaDetalle}</p>
              </div>
            ) : !relSeleccionado ? (
              <div className="flex justify-center py-3 text-ink-muted">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : relSeleccionado.tipo !== 'ninguna' ? (
              // Ya son contactos, hay una solicitud enviada o una por responder: sin campo de motivo
              botonRelacion(selectedStudent, { ancho: true })
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-ink dark:text-ink-light mb-1.5 block">{CONTACTO.motivoEtiqueta}</label>
                  <textarea
                    rows={2}
                    placeholder={CONTACTO.motivoPlaceholder}
                    value={motivoSolicitud}
                    onChange={(e) => setMotivoSolicitud(e.target.value)}
                    maxLength={300}
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary resize-none font-medium"
                  />
                  {solicitudError && <p className="text-xs text-semantic-danger font-semibold mt-1">{solicitudError}</p>}
                  <p className="text-[10px] text-ink-muted mt-1">🔒 {CONTACTO.motivoAyuda}</p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button onClick={() => setSelectedStudent(null)} className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink">
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
                        <span>{CONTACTO.enviarSolicitud}</span>
                        <Send size={13} />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- PANEL: MENÚ ⋮ (después del perfil, para quedar encima si se abre desde ahí) --- */}
      <PanelInferior
        abierto={Boolean(menuPersona)}
        onCerrar={() => setMenuPersona(null)}
        titulo={menuPersona ? `${menuPersona.nombre} ${menuPersona.apellido || ''}`.trim() : ''}
      >
        {menuPersona && (
          <div className="space-y-1">
            {selectedStudent?.id !== menuPersona.id && (
              <OpcionPanel
                icono={User}
                texto="Ver perfil"
                onClick={() => {
                  const p = menuPersona;
                  setMenuPersona(null);
                  abrirPerfil(p);
                }}
              />
            )}
            <OpcionPanel icono={ShieldAlert} texto="Reportar" detalle="Avisar a moderación" onClick={() => pedirReporte(menuPersona)} />
            <OpcionPanel
              icono={UserX}
              texto="Bloquear"
              detalle="Dejará de verte y no podrá escribirte"
              peligro
              onClick={() => pedirBloqueo(menuPersona)}
            />
          </div>
        )}
      </PanelInferior>

      {/* --- CHAT DIRECTO EN TIEMPO REAL (M10), pantalla completa --- */}
      {activeChat && (
        <ChatDirectoModal
          conversacionId={activeChat.conversacionId}
          otherUser={activeChat.otherUser}
          origen={activeChat.origen}
          publicacionTitulo={activeChat.publicacionTitulo}
          puedeEscribir={activeChat.puedeEscribir !== false}
          currentUser={user}
          onClose={() => {
            setActiveChat(null);
            cargarConversaciones({ silencioso: true });
          }}
          onUserBlocked={() => {
            setActiveChat(null);
            cargarPerfiles();
            cargarRelaciones();
          }}
        />
      )}

      {/* --- MODAL: REPORTAR --- */}
      {showReportModal && targetUserOption && (
        <div className="fixed inset-0 !m-0 z-60 bg-black/60 flex items-center justify-center px-4 safe-overlay">
          <div className="w-full max-w-sm max-h-full overflow-y-auto bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
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
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-center space-y-1 text-emerald-800 dark:text-emerald-300">
                <Check size={24} className="mx-auto text-emerald-600" />
                <p className="text-xs font-extrabold">Reporte enviado.</p>
                <p className="text-[11px] text-ink-muted">El equipo de moderación revisará este caso.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-soft dark:text-ink-muted">
                  Reportarás a{' '}
                  <strong className="text-ink dark:text-ink-light">
                    {targetUserOption.nombre} {targetUserOption.apellido}
                  </strong>
                  .
                </p>

                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">Motivo principal:</label>
                  <select
                    value={reportMotivo}
                    onChange={(e) => setReportMotivo(e.target.value)}
                    className="w-full p-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-bold text-ink dark:text-ink-light focus:outline-none"
                  >
                    <option value="Acoso o mensaje no deseado">Acoso o mensaje no deseado</option>
                    <option value="Suplantación de identidad">Suplantación de identidad</option>
                    <option value="Contenido inapropiado / spam">Contenido inapropiado o spam</option>
                    <option value="Comportamiento antideportivo o violento">Comportamiento violento</option>
                    <option value="Otro motivo de seguridad">Otro motivo de seguridad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">Detalle de lo ocurrido:</label>
                  <textarea
                    rows={3}
                    value={reportDetalle}
                    onChange={(e) => setReportDetalle(e.target.value)}
                    placeholder="Describe brevemente lo que pasó..."
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs text-ink dark:text-ink-light focus:outline-none resize-none font-medium"
                  />
                </div>

                {reportError && <ErrorConReintento compacto mensaje={reportError} />}

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setTargetUserOption(null);
                      setReportError('');
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
                    {isSubmittingReport ? 'Enviando...' : 'Enviar reporte'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMAR BLOQUEO --- */}
      {showBlockModal && targetUserOption && (
        <div className="fixed inset-0 !m-0 z-60 bg-black/60 flex items-center justify-center px-4 safe-overlay">
          <div className="w-full max-w-sm max-h-full overflow-y-auto bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-semantic-danger flex items-center justify-center mx-auto">
              <UserX size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-ink dark:text-ink-light">¿Bloquear a {targetUserOption.nombre}?</h3>
              <p className="text-xs text-ink-muted leading-relaxed">No podrá enviarte mensajes ni solicitudes, y dejará de verte en Explorar.</p>
            </div>

            {blockError && <ErrorConReintento compacto mensaje={blockError} />}

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setTargetUserOption(null);
                  setBlockError('');
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
                {isSubmittingBlock ? 'Bloqueando...' : 'Sí, bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
