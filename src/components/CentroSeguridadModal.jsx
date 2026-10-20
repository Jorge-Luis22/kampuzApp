import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  UserX,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  Trash2,
  Eye,
  Check,
  Send,
  Lock
} from 'lucide-react';
import {
  NORMAS_CONVIVENCIA,
  enviarReporte,
  bloquearUsuario,
  desbloquearUsuario,
  fetchUsuariosBloqueados,
  fetchReportesModeracion,
  actualizarEstadoReporte
} from '../lib/safety';

export default function CentroSeguridadModal({ isOpen, onClose, currentUser }) {
  const [subTab, setSubTab] = useState('normas'); // 'normas' | 'bloqueados' | 'reportar' | 'moderacion'
  
  // Lista de bloqueados
  const [bloqueados, setBloqueados] = useState([]);
  const [isLoadingBloqueados, setIsLoadingBloqueados] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // Formulario de reporte
  const [reportTipo, setReportTipo] = useState('mensaje');
  const [reportObjetoId, setReportObjetoId] = useState('');
  const [reportMotivo, setReportMotivo] = useState('Acoso o mensaje indebido');
  const [reportDetalle, setReportDetalle] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Moderación
  const [reportesModeracion, setReportesModeracion] = useState([]);
  const [isLoadingModeracion, setIsLoadingModeracion] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (subTab === 'bloqueados') {
      cargarBloqueados();
    } else if (subTab === 'moderacion') {
      cargarModeracion();
    }
  }, [isOpen, subTab]);

  const cargarBloqueados = async () => {
    if (!currentUser?.id) return;
    setIsLoadingBloqueados(true);
    try {
      const data = await fetchUsuariosBloqueados(currentUser.id);
      setBloqueados(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingBloqueados(false);
    }
  };

  const cargarModeracion = async () => {
    setIsLoadingModeracion(true);
    try {
      const data = await fetchReportesModeracion();
      setReportesModeracion(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingModeracion(false);
    }
  };

  const handleDesbloquear = async (bloqueadoId) => {
    if (!currentUser?.id) return;
    setUnblockingId(bloqueadoId);
    try {
      const res = await desbloquearUsuario(currentUser.id, bloqueadoId);
      if (res.success) {
        setBloqueados(prev => prev.filter(b => b.bloqueado_id !== bloqueadoId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUnblockingId(null);
    }
  };

  const handleEnviarReporteSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.id || !reportObjetoId.trim()) return;

    setIsSendingReport(true);
    try {
      const res = await enviarReporte({
        autorId: currentUser.id,
        tipo: reportTipo,
        objetoId: reportObjetoId.trim(),
        motivo: reportMotivo,
        detalle: reportDetalle.trim()
      });

      if (res.success) {
        setReportSuccess(true);
        setReportObjetoId('');
        setReportDetalle('');
        setTimeout(() => setReportSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleModerarAccion = async (reporteId, nuevoEstado) => {
    try {
      await actualizarEstadoReporte(reporteId, nuevoEstado);
      setReportesModeracion(prev =>
        prev.map(r => (r.id === reporteId ? { ...r, estado: nuevoEstado } : r))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface dark:bg-surface-dark border-2 border-line/80 dark:border-line-dark rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-line dark:border-line-dark flex items-center justify-between bg-primary-dark/5 dark:bg-primary-dark/20">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-bold">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-ink dark:text-ink-light flex items-center gap-1.5">
                <span>Centro de Seguridad</span>
                <span className="text-[10px] font-bold bg-accent/20 text-accent px-1.5 py-0.5 rounded">M33</span>
              </h3>
              <p className="text-[11px] text-ink-muted">Normas, bloqueos y reportes comunitarios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink dark:hover:text-ink-light rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de Navegación Interna */}
        <div className="flex border-b border-line dark:border-line-dark bg-slate-50/50 dark:bg-slate-900/40 px-3 pt-2 gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setSubTab('normas')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center space-x-1.5 shrink-0 ${
              subTab === 'normas'
                ? 'bg-surface dark:bg-surface-dark text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
            }`}
          >
            <FileText size={14} />
            <span>Normas</span>
          </button>
          <button
            onClick={() => setSubTab('bloqueados')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center space-x-1.5 shrink-0 ${
              subTab === 'bloqueados'
                ? 'bg-surface dark:bg-surface-dark text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
            }`}
          >
            <UserX size={14} />
            <span>Bloqueados</span>
          </button>
          <button
            onClick={() => setSubTab('reportar')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center space-x-1.5 shrink-0 ${
              subTab === 'reportar'
                ? 'bg-surface dark:bg-surface-dark text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Reportar</span>
          </button>
          <button
            onClick={() => setSubTab('moderacion')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center space-x-1.5 shrink-0 ${
              subTab === 'moderacion'
                ? 'bg-surface dark:bg-surface-dark text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Moderación</span>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. NORMAS */}
          {subTab === 'normas' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-start space-x-2.5">
                <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 dark:text-emerald-200">
                  En Kampuz fomentamos un entorno seguro y académico. Estas normas aplican a todos los espacios, consultas y mensajes directos.
                </p>
              </div>

              {NORMAS_CONVIVENCIA.map((norma, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-line dark:border-line-dark rounded-2xl">
                  <h4 className="text-xs font-extrabold text-ink dark:text-ink-light mb-1">{norma.titulo}</h4>
                  <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">{norma.descripcion}</p>
                </div>
              ))}
            </div>
          )}

          {/* 2. USUARIOS BLOQUEADOS */}
          {subTab === 'bloqueados' && (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                Los usuarios bloqueados no pueden enviarte mensajes directos, solicitudes de conexión ni ver tu estado en línea.
              </p>

              {isLoadingBloqueados ? (
                <div className="py-8 flex flex-col items-center justify-center text-ink-muted space-y-2">
                  <Loader2 size={24} className="animate-spin text-accent" />
                  <span className="text-xs">Cargando lista de bloqueados...</span>
                </div>
              ) : bloqueados.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-line dark:border-line-dark rounded-2xl">
                  <UserX size={28} className="mx-auto text-ink-muted opacity-50 mb-2" />
                  <p className="text-xs font-bold text-ink dark:text-ink-light">No tienes compañeros bloqueados</p>
                  <p className="text-[11px] text-ink-muted mt-1">Puedes bloquear a alguien desde su perfil en Explorar o en un chat 1 a 1.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bloqueados.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-line dark:border-line-dark rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-ink-muted shrink-0 overflow-hidden">
                          {b.perfil_bloqueado?.foto_url ? (
                            <img src={b.perfil_bloqueado.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            b.perfil_bloqueado?.nombre?.[0] || '?'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-ink dark:text-ink-light truncate">
                            {b.perfil_bloqueado?.nombre || 'Usuario'}
                          </p>
                          <p className="text-[11px] text-ink-muted truncate">
                            {b.perfil_bloqueado?.carrera || 'Estudiante'} • Ciclo {b.perfil_bloqueado?.ciclo || '-'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDesbloquear(b.bloqueado_id)}
                        disabled={unblockingId === b.bloqueado_id}
                        className="px-3 py-1.5 bg-white dark:bg-surface-cardDark hover:bg-slate-100 text-xs font-bold text-ink-muted hover:text-ink dark:hover:text-ink-light border border-line dark:border-line-dark rounded-xl transition shrink-0 flex items-center space-x-1"
                      >
                        {unblockingId === b.bloqueado_id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <span>Desbloquear</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. REPORTAR */}
          {subTab === 'reportar' && (
            <form onSubmit={handleEnviarReporteSubmit} className="space-y-3.5">
              <p className="text-xs text-ink-muted">
                Envía un reporte formal a los moderadores. Todo reporte es anónimo para el usuario reportado y se revisa con prioridad.
              </p>

              {reportSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <Check size={16} />
                  <span>Reporte enviado con éxito. El equipo revisará el caso.</span>
                </div>
              )}

              <div>
                <label className="text-xs font-extrabold text-ink dark:text-ink-light mb-1 block">
                  ¿Qué deseas reportar?
                </label>
                <select
                  value={reportTipo}
                  onChange={(e) => setReportTipo(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="mensaje">Mensaje en chat grupal</option>
                  <option value="mensaje_directo">Mensaje en chat 1 a 1</option>
                  <option value="perfil">Perfil de un estudiante</option>
                  <option value="espacio">Grupo o taller</option>
                  <option value="consulta">Consulta académica</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-ink dark:text-ink-light mb-1 block">
                  Identificador o nombre del elemento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Nombre del alumno, título de la consulta o mensaje"
                  value={reportObjetoId}
                  onChange={(e) => setReportObjetoId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-ink dark:text-ink-light mb-1 block">
                  Motivo principal
                </label>
                <select
                  value={reportMotivo}
                  onChange={(e) => setReportMotivo(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="Acoso o mensaje indebido">Acoso o mensaje indebido</option>
                  <option value="Falta de respeto a docente o alumno">Falta de respeto a docente o alumno</option>
                  <option value="Spam o comercialización">Spam o comercialización de tareas</option>
                  <option value="Contenido sexual o violento">Contenido inapropiado / sexual / violento</option>
                  <option value="Suplantación de identidad">Suplantación de identidad</option>
                  <option value="Otro">Otro motivo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-ink dark:text-ink-light mb-1 block">
                  Detalles adicionales (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe brevemente lo ocurrido para facilitar la revisión..."
                  value={reportDetalle}
                  onChange={(e) => setReportDetalle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingReport || !reportObjetoId.trim()}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center space-x-2 transition shadow-sm"
              >
                {isSendingReport ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Send size={14} />
                    <span>Enviar reporte confidencial</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 4. VISTA DE MODERACIÓN */}
          {subTab === 'moderacion' && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                <p className="text-xs text-indigo-900 dark:text-indigo-200">
                  Panel de revisión para moderadores del campus. Permite auditar y gestionar las infracciones reportadas.
                </p>
              </div>

              {isLoadingModeracion ? (
                <div className="py-8 flex flex-col items-center justify-center text-ink-muted space-y-2">
                  <Loader2 size={24} className="animate-spin text-accent" />
                  <span className="text-xs">Cargando reportes abiertos...</span>
                </div>
              ) : reportesModeracion.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-line dark:border-line-dark rounded-2xl">
                  <CheckCircle size={28} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-ink dark:text-ink-light">Bandeja al día</p>
                  <p className="text-[11px] text-ink-muted mt-1">No hay reportes de moderación pendientes.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reportesModeracion.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3.5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-ink-soft">
                          {rep.tipo}
                        </span>
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          rep.estado === 'abierto'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : rep.estado === 'revisado'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                          {rep.estado}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-extrabold text-ink dark:text-ink-light">
                          {rep.motivo}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          Elemento: <span className="font-mono text-ink-soft dark:text-ink-light">{rep.objeto_id}</span>
                        </p>
                      </div>

                      {rep.estado === 'abierto' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleModerarAccion(rep.id, 'revisado')}
                            className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-ink dark:text-ink-light text-xs font-bold rounded-lg transition"
                          >
                            Marcar Revisado
                          </button>
                          <button
                            onClick={() => handleModerarAccion(rep.id, 'accionado')}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                          >
                            Acción Tomada
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
