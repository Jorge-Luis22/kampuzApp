import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Check,
  CheckCheck,
  ShieldAlert,
  UserX,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import {
  fetchMensajesDirectos,
  enviarMensajeDirecto,
  marcarMensajesComoLeidos,
  subscribeToConversacion,
  fusionarMensaje
} from '../lib/chat';
import { reportarContenido, bloquearUsuario } from '../lib/explore';
import ErrorConReintento from './ErrorConReintento';

const nuevoTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ChatDirectoModal({
  conversacionId,
  otherUser,
  currentUser,
  onClose,
  onUserBlocked
}) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  // Menú de opciones (Reportar / Bloquear)
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMotivo, setReportMotivo] = useState('Acoso o mensaje no deseado');
  const [reportDetalle, setReportDetalle] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState('');

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);
  const [blockError, setBlockError] = useState('');

  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const miId = currentUser?.id;

  const formatHora = (isoDate) => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const marcarLeidos = () => {
    marcarMensajesComoLeidos(conversacionId).catch((err) =>
      console.warn('[Kampuz] No se pudo marcar como leído:', err.message)
    );
  };

  const cargarHistorial = async () => {
    setIsLoading(true);
    setErrorCarga('');
    try {
      const historial = await fetchMensajesDirectos(conversacionId);
      // Conserva los optimistas que aún no tienen respuesta del servidor
      setMensajes((prev) => historial.reduce((lista, m) => fusionarMensaje(lista, m, { miId }), prev.filter((m) => m.optimista)));
      setTimeout(() => scrollToBottom(false), 50);
      marcarLeidos();
    } catch (err) {
      setErrorCarga(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Historial + Realtime (Supabase). Sin BroadcastChannel ni localStorage.
  useEffect(() => {
    if (!conversacionId) return undefined;
    setMensajes([]);
    cargarHistorial();

    const unsubscribe = subscribeToConversacion(conversacionId, {
      onInsert: (nuevoMsg) => {
        setMensajes((prev) => fusionarMensaje(prev, nuevoMsg, { miId }));
        if (nuevoMsg.autor_id !== miId) marcarLeidos();
        setTimeout(() => scrollToBottom(true), 80);
      },
      onUpdate: (actualizado) => {
        setMensajes((prev) => prev.map((m) => (m.id === actualizado.id ? { ...m, ...actualizado } : m)));
      }
    });

    return () => unsubscribe();
  }, [conversacionId, miId]);

  // Envío optimista: aparece al instante con id temporal y se reemplaza por el del servidor.
  const enviar = async (texto, tempId) => {
    setMensajes((prev) => prev.map((m) => (m.id === tempId ? { ...m, error: false, enviando: true } : m)));
    try {
      const guardado = await enviarMensajeDirecto({ conversacionId, texto });
      setMensajes((prev) => fusionarMensaje(prev, guardado, { tempId, miId }));
    } catch (err) {
      setMensajes((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, enviando: false, error: true, errorMsg: err.message } : m))
      );
    }
  };

  const handleEnviar = (e) => {
    if (e) e.preventDefault();
    const texto = nuevoTexto.trim();
    if (!texto) return;

    const tempId = nuevoTempId();
    setMensajes((prev) => [
      ...prev,
      {
        id: tempId,
        conversacion_id: conversacionId,
        autor_id: miId,
        texto,
        leido: false,
        creado_en: new Date().toISOString(),
        optimista: true,
        enviando: true
      }
    ]);
    setNuevoTexto('');
    setTimeout(() => scrollToBottom(true), 50);
    enviar(texto, tempId);
  };

  const descartarMensaje = (tempId) => setMensajes((prev) => prev.filter((m) => m.id !== tempId));

  const handleConfirmReport = async () => {
    if (!reportDetalle.trim()) return;
    setIsSubmittingReport(true);
    setReportError('');
    try {
      await reportarContenido({
        tipo: 'mensaje_directo',
        objetoId: conversacionId,
        motivo: `${reportMotivo}: ${reportDetalle.trim()}`
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
        setShowMenu(false);
        setReportDetalle('');
      }, 1500);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleConfirmBlock = async () => {
    setIsSubmittingBlock(true);
    setBlockError('');
    try {
      await bloquearUsuario({ bloqueadoId: otherUser.id });
      setShowBlockModal(false);
      setShowMenu(false);
      if (onUserBlocked) onUserBlocked(otherUser.id);
      onClose();
    } catch (err) {
      setBlockError(err.message);
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const nombreMostrar = `${otherUser?.nombre || 'Compañero'} ${otherUser?.apellido || ''}`.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end sm:items-center sm:justify-center p-0 select-none animate-fadeIn">
      {/* Ventana de chat tipo WhatsApp / Telegram */}
      <div className="w-full sm:max-w-md h-full sm:h-[650px] bg-slate-50 dark:bg-surface-dark flex flex-col sm:rounded-3xl shadow-modal overflow-hidden border border-line dark:border-line-dark">
        {/* Top Header Bar */}
        <div className="bg-white dark:bg-surface-cardDark px-4 py-3 border-b border-line dark:border-line-dark flex items-center justify-between shadow-xs shrink-0 z-10">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1 -ml-1 text-ink-muted hover:text-ink dark:hover:text-ink-light rounded-xl transition"
              title="Volver"
            >
              <ArrowLeft size={20} />
            </button>

            {/* Avatar */}
            <div className="relative shrink-0">
              {otherUser?.foto_url ? (
                <img
                  src={otherUser.foto_url}
                  alt={nombreMostrar}
                  className="w-10 h-10 rounded-full object-cover border border-line dark:border-line-dark"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-primary text-white font-black text-sm flex items-center justify-center">
                  {(otherUser?.nombre?.[0] || 'C').toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-cardDark" />
            </div>

            {/* Info usuario */}
            <div className="min-w-0">
              <h3 className="text-sm font-black text-ink dark:text-ink-light truncate leading-tight">
                {nombreMostrar}
              </h3>
              <p className="text-[11px] text-brand-primary dark:text-accent font-semibold truncate">
                {otherUser?.carrera || 'Estudiante'} · {otherUser?.ciclo || 1}.° Ciclo
              </p>
            </div>
          </div>

          {/* Menú de opciones */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-ink-muted hover:text-ink dark:hover:text-ink-light rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Opciones"
            >
              <MoreVertical size={18} />
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-9 w-44 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-modal py-1.5 z-30 animate-fadeIn"
              >
                <button
                  onClick={() => {
                    setShowReportModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center space-x-2 transition"
                >
                  <ShieldAlert size={15} />
                  <span>Reportar chat</span>
                </button>
                <button
                  onClick={() => {
                    setShowBlockModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-semantic-danger hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center space-x-2 transition"
                >
                  <UserX size={15} />
                  <span>Bloquear usuario</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mensaje de aviso de convivencia */}
        <div className="bg-brand-primary/5 dark:bg-accent-dark/20 px-3 py-1.5 border-b border-brand-primary/10 text-[11px] text-center text-ink-muted dark:text-teal-200/80 font-medium shrink-0">
          🔒 Conversación directa institucional para fines académicos y de campus.
        </div>

        {/* Lista de Mensajes (Área de Scroll) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 dark:bg-surface-dark/70">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 text-ink-muted">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-xs font-semibold">Cargando mensajes directos...</p>
            </div>
          ) : errorCarga ? (
            <ErrorConReintento mensaje={errorCarga} onReintentar={cargarHistorial} />
          ) : mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <h4 className="text-sm font-black text-ink dark:text-ink-light">
                ¡Conexión aceptada!
              </h4>
              <p className="text-xs text-ink-muted max-w-xs">
                Inicia la conversación para coordinar sobre cursos, proyectos o estudio conjunto en campus.
              </p>
            </div>
          ) : (
            mensajes.map((m) => {
              const esPropio = m.autor_id === currentUser?.id;
              const hora = formatHora(m.creado_en);

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${esPropio ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                      esPropio
                        ? 'bg-brand-primary text-white rounded-br-xs'
                        : 'bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light border border-line/80 dark:border-line-dark rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words font-medium">{m.texto}</p>
                    <div
                      className={`flex items-center justify-end space-x-1 mt-1 text-[10px] ${
                        esPropio ? 'text-white/80' : 'text-ink-muted'
                      }`}
                    >
                      <span>{hora}</span>
                      {esPropio && (
                        <span title={m.enviando ? 'Enviando' : m.leido ? 'Leído' : 'Enviado'}>
                          {m.enviando ? (
                            <Loader2 size={12} className="animate-spin text-white/70" />
                          ) : m.error ? (
                            <AlertCircle size={13} className="text-rose-200" />
                          ) : m.leido ? (
                            <CheckCheck size={13} className="text-sky-300" />
                          ) : (
                            <Check size={13} className="text-white/70" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {m.error && (
                    <div className="flex items-center space-x-2 mt-1 text-[11px] text-semantic-danger font-semibold">
                      <span>No se envió.</span>
                      <button onClick={() => enviar(m.texto, m.id)} className="underline font-bold flex items-center space-x-0.5">
                        <RefreshCw size={11} />
                        <span>Reintentar</span>
                      </button>
                      <button onClick={() => descartarMensaje(m.id)} className="text-ink-muted underline">
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar (WhatsApp style) */}
        <form
          onSubmit={handleEnviar}
          className="bg-white dark:bg-surface-cardDark p-2.5 sm:p-3 border-t border-line dark:border-line-dark flex items-center space-x-2 shrink-0"
        >
          <input
            type="text"
            value={nuevoTexto}
            onChange={(e) => setNuevoTexto(e.target.value)}
            placeholder="Escribe un mensaje académico..."
            className="flex-1 bg-surface dark:bg-surface-dark px-4 py-2.5 text-sm font-medium text-ink dark:text-ink-light border border-line dark:border-line-dark rounded-2xl focus:outline-none focus:border-brand-primary"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!nuevoTexto.trim()}
            className="w-10 h-10 rounded-2xl bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-sm transition active:scale-95"
            title="Enviar mensaje"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Modal: Reportar Conversación / Usuario */}
      {showReportModal && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase text-semantic-danger tracking-wider flex items-center space-x-1.5">
                <ShieldAlert size={16} />
                <span>Reportar a moderación</span>
              </span>
              <button
                onClick={() => setShowReportModal(false)}
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
                    placeholder="Describe brevemente la falta o mensaje..."
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs text-ink dark:text-ink-light focus:outline-none resize-none font-medium"
                  />
                </div>

                {reportError && <ErrorConReintento compacto mensaje={reportError} />}

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmReport}
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

      {/* Modal: Confirmar Bloqueo */}
      {showBlockModal && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-semantic-danger flex items-center justify-center mx-auto">
              <UserX size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-ink dark:text-ink-light">
                ¿Bloquear a {nombreMostrar}?
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Este estudiante no podrá enviarte mensajes, solicitudes ni ver tu perfil en Explorar.
              </p>
            </div>

            {blockError && <ErrorConReintento compacto mensaje={blockError} />}

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setShowBlockModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-ink-muted hover:text-ink bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBlock}
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
