import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../data/store';
import {
  SEDES_UTP,
  CARRERAS_UTP,
  INTERESES_DISPONIBLES
} from '../data/mockData';
import {
  uploadAvatar,
  updateProfile,
  updateConsentimiento,
  calcularHabilidadesReales,
  eliminarCuentaUsuario
} from '../lib/profile';
import CentroSeguridadModal from '../components/CentroSeguridadModal';
import {
  ShieldCheck,
  CheckCircle2,
  Award,
  BookOpen,
  FileCheck,
  ExternalLink,
  Plus,
  Lock,
  ChevronRight,
  Shield,
  HelpCircle,
  Eye,
  FileText,
  AlertTriangle,
  AlertOctagon,
  Trash2,
  Sparkles,
  Mail,
  Calendar,
  X,
  LogOut,
  Medal,
  Share2,
  Trophy,
  Star,
  Edit3,
  Camera,
  Loader2,
  Check,
  Info
} from 'lucide-react';

export default function PerfilView() {
  const {
    user,
    setUser,
    toggleConsentimiento,
    agregarCertificado,
    cerrarSesion,
    setActiveTab,
    setCurrentScreen
  } = useStore();

  const [activeTabSub, setActiveTabSub] = useState('habilidades'); // 'habilidades' | 'certificados' | 'privacidad'
  const [selectedMedalla, setSelectedMedalla] = useState(null);
  const [selectedHabilidadKey, setSelectedHabilidadKey] = useState(null);

  // Centro de Seguridad (M33) y Borrado de Cuenta (Google Play Store compliance)
  const [showCentroSeguridad, setShowCentroSeguridad] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (confirmDeleteInput.trim().toUpperCase() !== 'ELIMINAR') {
      setDeleteError('Escribe la palabra ELIMINAR para confirmar.');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError('');

    try {
      const res = await eliminarCuentaUsuario();
      if (!res.success) {
        setDeleteError(res.error || 'Error al procesar la eliminación de cuenta.');
        setIsDeletingAccount(false);
        return;
      }

      setShowDeleteAccountModal(false);
      setUser(null);
      setCurrentScreen('m01_bienvenida');
    } catch (err) {
      setDeleteError(err.message || 'Error inesperado al eliminar la cuenta.');
      setIsDeletingAccount(false);
    }
  };

  // Modal Editar Perfil (Fase 3 - M29)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    bio: user?.bio || '',
    sede: user?.sede || 'Lima Sur',
    carrera: user?.carrera || 'Enfermería',
    ciclo: user?.ciclo || 1,
    intereses: user?.intereses || []
  });
  const [avatarPreview, setAvatarPreview] = useState(user?.fotoUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // Modal Agregar Certificado (M31)
  const [showAddCertModal, setShowAddCertModal] = useState(false);
  const [certHabilidad, setCertHabilidad] = useState('Primeros Auxilios y Triage Clínico');
  const [certEmisor, setCertEmisor] = useState('Cruz Roja / IFRC');
  const [certHoras, setCertHoras] = useState(25);
  const [certUrl, setCertUrl] = useState('https://campus.salud.pe/cert/2026-9921');
  const [certEvaluacion, setCertEvaluacion] = useState(true);

  // Registro de fechas de consentimientos (M32)
  const [consentTimestamps, setConsentTimestamps] = useState({
    cuenta: 'Otorgado al registrar la cuenta',
    encuestas: 'Otorgado en registro',
    metricas: 'Otorgado en registro',
    perfil_universidad: user?.consentimientos?.perfil_universidad ? 'Otorgado' : 'Revocado / Inactivo'
  });

  // Calcular habilidades reales desde la base de datos (Spec 5.1 & 5.3)
  useEffect(() => {
    if (user?.id && user.id !== 'usr_luz') {
      calcularHabilidadesReales(user.id).then(habilidadesCalc => {
        if (habilidadesCalc) {
          setUser(prev => ({
            ...prev,
            habilidades: habilidadesCalc
          }));
        }
      });
    }
  }, [user?.id]);

  // Sincronizar estado al abrir modal de edición
  const handleOpenEditModal = () => {
    setEditFormData({
      nombre: user?.nombre || '',
      apellido: user?.apellido || '',
      bio: user?.bio || '',
      sede: user?.sede || 'Lima Sur',
      carrera: user?.carrera || 'Enfermería',
      ciclo: user?.ciclo || 1,
      intereses: user?.intereses || []
    });
    setAvatarPreview(user?.fotoUrl || null);
    setEditErrorMsg('');
    setShowEditProfileModal(true);
  };

  // Manejo de subida y compresión de foto (< 300 KB)
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setEditErrorMsg('');
    try {
      const publicUrl = await uploadAvatar(user.id, file);
      setAvatarPreview(publicUrl);
      setUser(prev => ({ ...prev, fotoUrl: publicUrl }));
    } catch (err) {
      console.error(err);
      setEditErrorMsg('No se pudo subir la foto: ' + (err.message || 'error de red.'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const toggleInteresEdit = (interes) => {
    const current = editFormData.intereses || [];
    if (current.includes(interes)) {
      setEditFormData({ ...editFormData, intereses: current.filter(i => i !== interes) });
    } else {
      setEditFormData({ ...editFormData, intereses: [...current, interes] });
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setEditErrorMsg('');

    try {
      const res = await updateProfile(user.id, {
        nombre: editFormData.nombre,
        apellido: editFormData.apellido,
        bio: editFormData.bio,
        sede: editFormData.sede,
        carrera: editFormData.carrera,
        ciclo: editFormData.ciclo,
        intereses: editFormData.intereses,
        fotoUrl: avatarPreview
      });

      if (!res.success) {
        setEditErrorMsg(res.error || 'Error al guardar los cambios.');
        setIsSavingProfile(false);
        return;
      }

      setUser(prev => ({
        ...prev,
        ...editFormData,
        fotoUrl: avatarPreview
      }));

      setShowEditProfileModal(false);
    } catch (err) {
      setEditErrorMsg('Ocurrió un error al guardar.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Manejo de consentimiento con registro de fecha (M32)
  const handleToggleConsentimientoReal = async (finalidad) => {
    if (finalidad === 'cuenta') return;
    const nuevoValor = !user.consentimientos?.[finalidad];

    toggleConsentimiento(finalidad);

    const res = await updateConsentimiento(user.id, finalidad, nuevoValor);
    if (res.success) {
      const fechaTexto = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      setConsentTimestamps(prev => ({
        ...prev,
        [finalidad]: nuevoValor ? `Otorgado el ${fechaTexto}` : `Revocado el ${fechaTexto}`
      }));
    }
  };

  const handleSubirCertificadoSubmit = (e) => {
    e.preventDefault();
    agregarCertificado({
      habilidad: certHabilidad,
      emisor: certEmisor,
      horas: certHoras,
      url: certUrl,
      tieneEvaluacion: certEvaluacion
    });
    setShowAddCertModal(false);
  };

  const selectedHab = selectedHabilidadKey ? user.habilidades?.[selectedHabilidadKey] : null;

  // Comprobar si es un alumno nuevo (todos los niveles en 0 - Spec 6.7)
  const isNuevoAlumno = Object.values(user?.habilidades || {}).every(h => (h?.nivel || 0) === 0);

  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Header Profile Card (M29) */}
      <div className="k-card overflow-hidden border-2 border-line/80 dark:border-line-dark shadow-sm">
        {/* Cover Photo */}
        <div className="relative h-28 w-full bg-gradient-to-r from-brand-primary via-[#2E2675] to-[#3B3294] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold border border-white/30 shadow-sm flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-accent inline-block animate-pulse" />
            <span>UTP Sede {user.sede}</span>
          </div>
        </div>

        {/* Profile Info with Overlapping Avatar */}
        <div className="p-4 pt-0 relative">
          <div className="flex justify-between items-end -mt-12 mb-3">
            <div className="relative group cursor-pointer" onClick={handleOpenEditModal}>
              {user.fotoUrl ? (
                <img
                  src={user.fotoUrl}
                  alt={user.nombre}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                  }}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-surface-cardDark shadow-elevated"
                />
              ) : null}
              <div
                style={{ display: user.fotoUrl ? 'none' : 'flex' }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-primary to-accent text-white font-black text-2xl items-center justify-center border-4 border-white dark:border-surface-cardDark shadow-elevated"
              >
                {(user.nombre || 'U').charAt(0).toUpperCase()}
              </div>
              <div
                className="absolute -bottom-1 -right-1 bg-brand-primary text-white p-1.5 rounded-full shadow-md border-2 border-white dark:border-surface-cardDark group-hover:scale-110 transition"
                title="Editar foto"
              >
                <Camera size={14} />
              </div>
            </div>

            <div className="flex flex-col items-end space-y-1">
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-3 py-1 rounded-full border border-emerald-300/60 shadow-sm flex items-center space-x-1">
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Identidad Verificada</span>
              </span>
              <span className="text-xs font-semibold text-ink-muted">
                {user.rol === 'alumno' ? 'Estudiante UTP' : user.rol}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black text-ink dark:text-ink-light leading-snug">
                {user.nombre} {user.apellido}
              </h1>
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-ink dark:text-ink-light text-xs font-bold rounded-xl border border-line dark:border-line-dark flex items-center space-x-1.5 shadow-xs transition"
              >
                <Edit3 size={13} className="text-brand-primary" />
                <span>Editar perfil</span>
              </button>
            </div>

            <p className="text-sm font-bold text-brand-primary dark:text-teal-300 mt-0.5">
              {user.carrera} · {user.ciclo}.° Ciclo
            </p>

            {user.bio ? (
              <p className="text-xs text-ink-soft dark:text-ink-muted mt-2 font-medium leading-relaxed italic bg-surface dark:bg-surface-dark p-2.5 rounded-xl border border-line dark:border-line-dark">
                "{user.bio}"
              </p>
            ) : null}

            <div className="flex items-center space-x-1.5 mt-2 text-xs text-ink-soft dark:text-ink-muted font-medium">
              <Mail size={14} className="text-brand-primary shrink-0" />
              <span className="font-semibold text-ink dark:text-ink-light">{user.correoInstitucional}</span>
            </div>

            {/* Intereses seleccionados */}
            {user.intereses && user.intereses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {user.intereses.map(i => (
                  <span
                    key={i}
                    className="text-[11px] font-bold px-2.5 py-0.5 bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 rounded-lg border border-brand-primary/10"
                  >
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ESTADO VACÍO PARA ALUMNO NUEVO: PRIMER OBJETIVO ALCANZABLE (Spec 6.7) */}
      {isNuevoAlumno && (
        <div className="p-4 bg-gradient-to-br from-brand-primary-soft via-accent-soft to-teal-50 dark:from-brand-dark dark:to-surface-cardDark border-2 border-accent/40 rounded-2xl space-y-2 shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2 text-accent">
            <Sparkles size={18} className="shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider">Tu Primer Logro en Kampus</span>
          </div>
          <p className="text-xs text-ink dark:text-ink-light font-bold leading-relaxed">
            Responde una encuesta académica en tu bandeja para desbloquear tu <strong className="text-accent">Nivel 1 en Apoyo a la investigación</strong> y ganar 30 destinatarios semanales para encuestar a otros compañeros.
          </p>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted font-semibold">Progreso: 0 / 1 encuesta</span>
            <button
              onClick={() => setActiveTab('encuestas')}
              className="px-3 py-1.5 bg-brand-primary text-white text-xs font-extrabold rounded-xl shadow-sm hover:opacity-95 transition flex items-center space-x-1"
            >
              <span>Ir a Encuestas</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Sub Tabs: Habilidades / Certificados / Privacidad */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-line dark:border-line-dark shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTabSub('habilidades')}
          className={`py-2 px-1 rounded-xl transition-all duration-150 flex items-center justify-center space-x-1.5 text-xs font-black ${
            activeTabSub === 'habilidades'
              ? 'bg-brand-primary text-white shadow-md'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
          }`}
        >
          <Sparkles size={14} className={activeTabSub === 'habilidades' ? 'text-white' : 'text-brand-primary'} />
          <span className="truncate">Habilidades</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabSub('certificados')}
          className={`py-2 px-1 rounded-xl transition-all duration-150 flex items-center justify-center space-x-1.5 text-xs font-black ${
            activeTabSub === 'certificados'
              ? 'bg-brand-primary text-white shadow-md'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
          }`}
        >
          <FileCheck size={14} className={activeTabSub === 'certificados' ? 'text-white' : 'text-brand-primary'} />
          <span className="truncate">Certificados</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabSub('privacidad')}
          className={`py-2 px-1 rounded-xl transition-all duration-150 flex items-center justify-center space-x-1.5 text-xs font-black ${
            activeTabSub === 'privacidad'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
          }`}
        >
          <Shield size={14} className={activeTabSub === 'privacidad' ? 'text-white' : 'text-emerald-600'} />
          <span className="truncate">Privacidad</span>
        </button>
      </div>

      {/* SUBTAB 1: HABILIDADES CALCULADAS DESDE HECHOS REALES (M29 & Spec 5.1, 5.3) */}
      {activeTabSub === 'habilidades' && (
        <div className="space-y-4">
          <div className="k-card p-4 space-y-3 border-2 border-line/80 dark:border-line-dark">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-ink dark:text-ink-light flex items-center space-x-1.5">
                  <Sparkles size={14} className="text-brand-primary" />
                  <span>Nivel de Habilidades (0 a 3)</span>
                </h3>
                <p className="text-xs text-ink-muted">
                  Derivadas de acciones observadas en el campus (Sin monedas ficticias)
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {user.habilidades && Object.entries(user.habilidades).map(([key, hab]) => (
                <div
                  key={key}
                  onClick={() => setSelectedHabilidadKey(key)}
                  className="p-3 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark hover:border-brand-primary/60 cursor-pointer transition"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-extrabold text-ink dark:text-ink-light">
                      {hab.nombre}
                    </span>
                    <span className="text-xs font-black bg-brand-primary/10 text-brand-primary dark:text-teal-300 px-2 py-0.5 rounded-md">
                      Nivel {hab.nivel} de 3
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="bg-brand-primary h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((hab.progresoActual || 0) / Math.max(1, hab.siguienteNivelMeta || 1)) * 100)
                        )}%`
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-ink-muted font-medium">
                    <span>
                      {hab.progresoActual || 0} de {hab.siguienteNivelMeta || 1} para Nivel {(hab.nivel || 0) + 1}
                    </span>
                    <span className="text-accent font-bold">Ver evidencias →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hechos Observados en Campus */}
          <div className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark">
            <h3 className="text-xs font-black text-ink dark:text-ink-light uppercase tracking-wider flex items-center space-x-1.5">
              <CheckCircle2 size={14} className="text-accent" />
              <span>Evidencias Objetivas Observadas</span>
            </h3>

            {isNuevoAlumno ? (
              <p className="text-xs text-ink-muted py-2 italic text-center">
                Aún no registras actividades académicas en el campus. Responde una encuesta o resuelve una consulta para generar tu primera evidencia verificada.
              </p>
            ) : (
              <div className="space-y-2 text-xs text-ink-soft dark:text-ink-muted">
                {Object.values(user.habilidades || {}).flatMap(h => h.hechos || []).map((hecho, i) => (
                  <div key={`hecho_${i}`} className="p-2.5 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark flex items-start space-x-2">
                    <span className="text-accent font-black text-sm">✓</span>
                    <span className="leading-snug">{hecho}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: CERTIFICADOS (M31) */}
      {activeTabSub === 'certificados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-ink dark:text-ink-light flex items-center space-x-1.5">
                <FileCheck size={16} className="text-brand-primary" />
                <span>Certificados Académicos</span>
              </h2>
              <p className="text-xs font-medium text-ink-muted">
                Clasificados por horas y evaluación verificable (Anti-farmeo)
              </p>
            </div>
            <button
              onClick={() => setShowAddCertModal(true)}
              className="px-3 py-1.5 bg-brand-primary text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-sm hover:bg-brand-primaryHover transition"
            >
              <Plus size={14} />
              <span>Agregar</span>
            </button>
          </div>

          <div className="space-y-3">
            {(user.certificados || []).length === 0 ? (
              <div className="k-card p-6 text-center space-y-2 border-2 border-line/80 dark:border-line-dark rounded-2xl">
                <FileCheck size={28} className="mx-auto text-ink-muted opacity-50" />
                <p className="text-xs font-bold text-ink dark:text-ink-light">Sin certificados agregados</p>
                <p className="text-xs text-ink-muted">Sube certificados con enlace de verificación (Coursera, Google, Microsoft, OPS).</p>
                <button
                  onClick={() => setShowAddCertModal(true)}
                  className="mt-2 px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl"
                >
                  Agregar primer certificado
                </button>
              </div>
            ) : (
              (user.certificados || []).map((cert) => (
                <div key={cert.id} className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                          cert.nivel === 'Avanzado'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : cert.nivel === 'Intermedio'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : 'bg-slate-100 text-slate-800 border border-slate-300'
                        }`}>
                          {cert.nivel}
                        </span>
                        <span className="text-[11px] text-accent font-bold">Verificable</span>
                      </div>
                      <h3 className="text-sm font-black text-ink dark:text-ink-light mt-1">{cert.habilidad}</h3>
                      <p className="text-xs text-ink-muted">{cert.emisor} · {cert.horas} hrs</p>
                    </div>
                  </div>

                  {cert.url && (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent font-bold hover:underline flex items-center space-x-1 pt-2 border-t border-line dark:border-line-dark"
                    >
                      <span>Ver enlace de verificación oficial</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: CONFIGURACIÓN Y PRIVACIDAD */}
      {activeTabSub === 'privacidad' && (
        <div className="space-y-3.5 text-sm">
          {/* ACCESO A CENTRO DE SEGURIDAD */}
          <button
            onClick={() => setShowCentroSeguridad(true)}
            className="w-full p-3.5 bg-gradient-to-r from-accent/10 to-primary-light/10 dark:from-accent/20 dark:to-primary-dark/20 border-2 border-accent/40 rounded-2xl flex items-center justify-between text-left hover:border-accent transition group shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center font-bold shadow-sm">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black text-ink dark:text-ink-light">Centro de Seguridad y Convivencia</h4>
                <p className="text-[11px] text-ink-muted">Normas de la comunidad, moderación y compañeros bloqueados</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-accent group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>

          {/* Preferencias de cuenta */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-ink dark:text-ink-light px-1">
              Preferencias y Privacidad
            </h4>

            {/* Preferencia 1: Encuestas */}
            <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark rounded-xl">
              <div className="pr-2">
                <span className="font-extrabold text-ink dark:text-ink-light block text-xs">
                  Invitaciones a encuestas estudiantiles
                </span>
                <span className="text-[11px] text-ink-muted block">
                  Recibe hasta 3 encuestas semanales de compañeros de tu sede
                </span>
              </div>
              <input
                type="checkbox"
                checked={user?.consentimientos?.encuestas ?? true}
                onChange={() => handleToggleConsentimientoReal('encuestas')}
                className="w-5 h-5 accent-accent rounded cursor-pointer shrink-0"
              />
            </div>

            {/* Preferencia 2: Métricas */}
            <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark rounded-xl">
              <div className="pr-2">
                <span className="font-extrabold text-ink dark:text-ink-light block text-xs">
                  Colaborar con estadísticas anónimas de sede
                </span>
                <span className="text-[11px] text-ink-muted block">
                  Aporta a métricas grupales protegidas para mejorar la universidad
                </span>
              </div>
              <input
                type="checkbox"
                checked={user?.consentimientos?.metricas ?? true}
                onChange={() => handleToggleConsentimientoReal('metricas')}
                className="w-5 h-5 accent-accent rounded cursor-pointer shrink-0"
              />
            </div>

            {/* Preferencia 3: Convocatorias UTP */}
            <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark rounded-xl">
              <div className="pr-2">
                <span className="font-extrabold text-ink dark:text-ink-light block text-xs">
                  Visible para programas de mérito UTP
                </span>
                <span className="text-[11px] text-ink-muted block">
                  Permite conocer tus asesorías y talleres para Impulsa o Generación Top
                </span>
              </div>
              <input
                type="checkbox"
                checked={user?.consentimientos?.perfil_universidad ?? false}
                onChange={() => handleToggleConsentimientoReal('perfil_universidad')}
                className="w-5 h-5 accent-accent rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          <div className="pt-1 text-center">
            <a
              href="/privacidad.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent font-bold hover:underline inline-flex items-center space-x-1"
            >
              <span>Ver Términos y Política de Privacidad</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* ZONA DE PELIGRO: ELIMINAR MI CUENTA */}
          <div className="p-4 bg-rose-50/70 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-2.5">
            <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-400">
              <AlertOctagon size={18} className="shrink-0" />
              <h4 className="text-xs font-black">Zona de eliminación de cuenta</h4>
            </div>
            <p className="text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
              Puedes solicitar la eliminación permanente de tu cuenta, perfil, fotos, mensajes y credenciales en cualquier momento.
            </p>
            <button
              onClick={() => {
                setConfirmDeleteInput('');
                setDeleteError('');
                setShowDeleteAccountModal(true);
              }}
              className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <Trash2 size={14} />
              <span>Eliminar mi cuenta definitivamente</span>
            </button>
          </div>
        </div>
      )}

      {/* Botón de Cerrar Sesión */}
      <div className="pt-2">
        <button
          onClick={cerrarSesion}
          className="w-full py-3 bg-white dark:bg-surface-cardDark hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-extrabold text-sm rounded-2xl border border-line dark:border-line-dark flex items-center justify-center space-x-2 shadow-sm transition"
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* MODAL: EDITAR PERFIL (Fase 3 - M29) */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border-2 border-line dark:border-line-dark space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase tracking-wider text-brand-primary dark:text-teal-300 flex items-center space-x-1.5">
                <Edit3 size={16} />
                <span>Editar Perfil Académico</span>
              </span>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-1 rounded-full text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              {/* Foto de Perfil con Recorte y Compresión < 300 KB */}
              <div className="flex flex-col items-center space-y-2 py-2">
                <div className="relative">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-primary shadow-sm"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-primary to-accent text-white font-black text-2xl flex items-center justify-center border-2 border-brand-primary shadow-sm">
                      {(editFormData.nombre || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="px-3 py-1.5 bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 text-xs font-bold rounded-xl border border-brand-primary/20 flex items-center space-x-1.5 hover:opacity-90 transition"
                >
                  <Camera size={13} />
                  <span>{isUploadingPhoto ? 'Comprimiendo...' : 'Cambiar foto (< 300 KB)'}</span>
                </button>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Presentación corta (Bio)
                </label>
                <textarea
                  value={editFormData.bio}
                  onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                  placeholder="Cuéntale a tus compañeros qué te apasiona o en qué estás trabajando..."
                  rows={2}
                  maxLength={150}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                />
              </div>

              {/* Sede y Carrera */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Sede UTP</label>
                  <select
                    value={editFormData.sede}
                    onChange={(e) => setEditFormData({ ...editFormData, sede: e.target.value })}
                    className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                  >
                    {SEDES_UTP.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Carrera</label>
                  <select
                    value={editFormData.carrera}
                    onChange={(e) => setEditFormData({ ...editFormData, carrera: e.target.value })}
                    className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                  >
                    {CARRERAS_UTP.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Ciclo</label>
                  <select
                    value={editFormData.ciclo}
                    onChange={(e) => setEditFormData({ ...editFormData, ciclo: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                      <option key={c} value={c}>{c}.° Ciclo</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Intereses */}
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">
                  Tus Intereses
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 border border-line dark:border-line-dark rounded-xl bg-surface dark:bg-surface-dark">
                  {INTERESES_DISPONIBLES.map(interes => {
                    const sel = (editFormData.intereses || []).includes(interes);
                    return (
                      <button
                        key={interes}
                        type="button"
                        onClick={() => toggleInteresEdit(interes)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                          sel
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white dark:bg-surface-cardDark text-ink-muted border-line dark:border-line-dark'
                        }`}
                      >
                        {interes}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editErrorMsg && (
                <p className="text-xs text-semantic-danger font-semibold">{editErrorMsg}</p>
              )}

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-ink-muted font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile || isUploadingPhoto}
                  className="flex-1 py-2.5 bg-brand-primary text-white font-black text-xs rounded-xl shadow-sm hover:opacity-95 transition flex items-center justify-center space-x-1"
                >
                  {isSavingProfile ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR CERTIFICADO (M31) */}
      {showAddCertModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border-2 border-line dark:border-line-dark space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase tracking-wider text-brand-primary dark:text-teal-300 flex items-center space-x-1.5">
                <FileCheck size={16} />
                <span>Agregar Certificado Verificable</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddCertModal(false)}
                className="p-1 rounded-full text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubirCertificadoSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Nombre del Curso / Habilidad</label>
                <input
                  type="text"
                  value={certHabilidad}
                  onChange={(e) => setCertHabilidad(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Institución Emisora</label>
                <input
                  type="text"
                  value={certEmisor}
                  onChange={(e) => setCertEmisor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Horas Totales</label>
                  <input
                    type="number"
                    value={certHoras}
                    onChange={(e) => setCertHoras(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                    required
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center space-x-2 text-xs font-bold text-ink dark:text-ink-light cursor-pointer">
                    <input
                      type="checkbox"
                      checked={certEvaluacion}
                      onChange={(e) => setCertEvaluacion(e.target.checked)}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span>Evaluación formal</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Enlace de Acreditación Oficial</label>
                <input
                  type="url"
                  value={certUrl}
                  onChange={(e) => setCertUrl(e.target.value)}
                  placeholder="https://coursera.org/verify/..."
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-semibold text-ink dark:text-ink-light"
                />
              </div>

              <div className="p-2.5 bg-slate-100 dark:bg-surface-dark rounded-xl text-[11px] text-ink-muted">
                <strong>Clasificación:</strong> &gt; 60 hrs → Avanzado; ≥ 20 hrs o con evaluación → Intermedio; otros → Básico.
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-brand-primary hover:bg-brand-primaryHover text-white font-black text-xs rounded-xl shadow-sm transition"
              >
                Guardar Certificado
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE HABILIDAD (M30) */}
      {selectedHab && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border-2 border-line dark:border-line-dark space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase tracking-wider text-brand-primary dark:text-teal-300">
                Detalle de Habilidad (M30)
              </span>
              <button
                type="button"
                onClick={() => setSelectedHabilidadKey(null)}
                className="p-1 rounded-full text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-ink dark:text-ink-light">{selectedHab.nombre}</h3>
                <span className="text-xs font-black bg-brand-primary/10 text-brand-primary dark:text-teal-300 px-2 py-0.5 rounded-md">
                  Nivel {selectedHab.nivel} de 3
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Origen del dato: <strong className="text-accent uppercase">{selectedHab.origen}</strong> (observado en campus)
              </p>
            </div>

            <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark space-y-1.5">
              <span className="text-xs font-bold text-ink dark:text-ink-light block">Meta siguiente nivel:</span>
              <p className="text-xs text-ink-muted">
                Te faltan {Math.max(0, (selectedHab.siguienteNivelMeta || 1) - (selectedHab.progresoActual || 0))} acciones para alcanzar el <strong>Nivel {(selectedHab.nivel || 0) + 1}</strong>.
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-ink dark:text-ink-light block mb-1">Evidencias registradas:</span>
              {(selectedHab.hechos || []).length === 0 ? (
                <p className="text-xs text-ink-muted italic">Sin hechos registrados aún.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedHab.hechos.map((h, i) => (
                    <div key={i} className="p-2 bg-slate-50 dark:bg-surface-dark rounded-lg text-xs text-ink-soft dark:text-ink-muted flex items-start space-x-1.5 border border-line/60">
                      <span className="text-accent font-black">✓</span>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN DE BORRADO DE CUENTA (Google Play Store compliance) */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-ink/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-2xl border-2 border-rose-300 dark:border-rose-900 space-y-4">
            <div className="flex items-center space-x-2.5 text-rose-600 dark:text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center font-bold">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-ink dark:text-ink-light">Eliminar mi cuenta</h3>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">Acción destructiva e irreversible</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/50 space-y-2 text-xs text-rose-900 dark:text-rose-200">
              <p className="font-extrabold">Esta acción eliminará de forma definitiva:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Tu perfil, sede, ciclo e intereses.</li>
                <li>Tu foto de perfil en el almacenamiento.</li>
                <li>Tus mensajes directos y publicaciones en grupos.</li>
                <li>Tus consentimientos y usuario de acceso en el sistema.</li>
              </ul>
            </div>

            {deleteError && (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/50 p-2 rounded-xl">
                {deleteError}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-muted block">
                Para confirmar, escribe <strong className="text-rose-600 uppercase">ELIMINAR</strong>:
              </label>
              <input
                type="text"
                value={confirmDeleteInput}
                onChange={(e) => setConfirmDeleteInput(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setConfirmDeleteInput('');
                  setDeleteError('');
                }}
                disabled={isDeletingAccount}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-ink dark:text-ink-light text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || confirmDeleteInput.trim().toUpperCase() !== 'ELIMINAR'}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-extrabold rounded-xl transition flex items-center justify-center space-x-1 shadow-sm"
              >
                {isDeletingAccount ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span>Confirmar borrado</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CENTRO DE SEGURIDAD (M33) */}
      <CentroSeguridadModal
        isOpen={showCentroSeguridad}
        onClose={() => setShowCentroSeguridad(false)}
        currentUser={user}
      />
    </div>
  );
}
