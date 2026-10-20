import React, { useState } from 'react';
import { useStore } from '../data/store';
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
  Sparkles,
  Mail,
  Calendar,
  X,
  LogOut,
  Medal,
  Share2,
  Trophy,
  Star
} from 'lucide-react';

export default function PerfilView() {
  const {
    user,
    setUser,
    toggleConsentimiento,
    agregarCertificado,
    cerrarSesion
  } = useStore();

  const [activeTabSub, setActiveTabSub] = useState('medallas'); // 'medallas' | 'certificados' | 'privacidad'
  const [selectedMedalla, setSelectedMedalla] = useState(null);
  const [selectedHabilidadKey, setSelectedHabilidadKey] = useState(null);

  // Modal Agregar Certificado (M31)
  const [showAddCertModal, setShowAddCertModal] = useState(false);
  const [certHabilidad, setCertHabilidad] = useState('Primeros Auxilios y Triage Clínico');
  const [certEmisor, setCertEmisor] = useState('Organización Panamericana de la Salud (OPS)');
  const [certHoras, setCertHoras] = useState(30);
  const [certUrl, setCertUrl] = useState('https://campus.paho.org/cert/OPS-2026-9921');
  const [certEvaluacion, setCertEvaluacion] = useState(true);

  const selectedHab = selectedHabilidadKey ? user.habilidades?.[selectedHabilidadKey] : null;

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

  const medallasLista = user.medallas || [
    {
      id: "med_auxilios",
      nombre: "Primeros Auxilios Destacado",
      categoria: "Salud y Emergencias",
      emisor: "Cruz Roja Peruana & MINSA",
      año: "2026",
      imagenUrl: "/medallas/primeros_auxilios.jpg",
      descripcion: "Distinción de honor por rendimiento sobresaliente en soporte vital básico, control de hemorragias y triage hospitalario en emergencias.",
      nivel: "Distinción de Honor",
      fecha: "18 Ene 2026",
      verificado: true
    },
    {
      id: "med_voley",
      nombre: "Subcampeona Vóley 2026",
      categoria: "Deportes UTP",
      emisor: "Dirección de Deportes UTP Lima Sur",
      año: "2026",
      imagenUrl: "/medallas/voley_2026.jpg",
      descripcion: "Medalla de plata en el Torneo Apertura Interfacultades de Voleibol Femenino UTP Lima Sur, capitana del equipo de Ciencias de la Salud.",
      nivel: "Medalla de Plata",
      fecha: "12 Feb 2026",
      verificado: true
    },
    {
      id: "med_excel",
      nombre: "Excel Intermedio Certificado",
      categoria: "Competencias Digitales",
      emisor: "Centro de Certificación UTP & Microsoft",
      año: "2026",
      imagenUrl: "/medallas/excel_intermedio.jpg",
      descripcion: "Acreditación práctica en tablas dinámicas, dashboards analíticos, modelado de bases de datos clínicas y formulación avanzada para bioestadística.",
      nivel: "Certificación Oro",
      fecha: "28 Feb 2026",
      verificado: true
    },
    {
      id: "med_investigacion",
      nombre: "Investigación Académica & Tesis",
      categoria: "Mérito Científico",
      emisor: "Vicerrectorado de Investigación UTP",
      año: "2026",
      imagenUrl: "/medallas/investigacion_academica.jpg",
      descripcion: "Reconocimiento por contribución activa en semilleros de investigación formativa y publicación de estudio de campo en salud comunitaria.",
      nivel: "Sello Académico",
      fecha: "05 Mar 2026",
      verificado: true
    }
  ];

  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Header Profile Card — Estudiante Estrella con Foto de Portada y Avatar Destacado */}
      <div className="k-card overflow-hidden border-2 border-line/80 dark:border-line-dark shadow-sm">
        {/* Cover Photo */}
        <div className="relative h-28 w-full bg-gradient-to-r from-brand-primary via-[#2E2675] to-[#3B3294] overflow-hidden">
          {user.portadaUrl && (
            <img
              src={user.portadaUrl}
              alt="Campus Universitario"
              className="w-full h-full object-cover opacity-75 mix-blend-overlay"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold border border-white/30 shadow-sm flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-accent inline-block animate-pulse" />
            <span>UTP Sede {user.sede}</span>
          </div>
        </div>

        {/* Profile Info with Overlapping Avatar */}
        <div className="p-4 pt-0 relative">
          <div className="flex justify-between items-end -mt-12 mb-3">
            <div className="relative">
              <img
                src={user.fotoUrl}
                alt={user.nombre}
                className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-surface-cardDark shadow-elevated"
              />
              <div
                className="absolute -bottom-1 -right-1 bg-accent text-white p-1.5 rounded-full shadow-md border-2 border-white dark:border-surface-cardDark"
                title="Identidad y Correo Verificado"
              >
                <ShieldCheck size={16} />
              </div>
            </div>

            <div className="flex flex-col items-end space-y-1">
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-3 py-1 rounded-full border border-emerald-300/60 shadow-sm flex items-center space-x-1">
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Alumna Verificada</span>
              </span>
              <span className="text-xs font-semibold text-ink-muted">
                {user.facultad}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-black text-ink dark:text-ink-light leading-snug">
              {user.nombre} {user.apellido}
            </h1>
            <p className="text-sm font-bold text-brand-primary dark:text-teal-300 mt-0.5">
              {user.carrera} · {user.ciclo}.° Ciclo
            </p>
            <div className="flex items-center space-x-1.5 mt-1.5 text-xs text-ink-soft dark:text-ink-muted font-medium">
              <Mail size={14} className="text-brand-primary shrink-0" />
              <span className="font-semibold text-ink dark:text-ink-light">{user.correoInstitucional}</span>
            </div>
          </div>

          {/* Quick Stats Grid — Botones Interactivos de Perfil */}
          <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-line dark:border-line-dark text-center">
            <button
              type="button"
              onClick={() => setActiveTabSub('medallas')}
              className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col items-center justify-center ${
                activeTabSub === 'medallas'
                  ? 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-500 shadow-sm ring-1 ring-amber-400'
                  : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100/50'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Trophy size={14} className="text-amber-600 dark:text-amber-400" />
                <span className="block text-base font-black text-amber-700 dark:text-amber-300">
                  {medallasLista.length}
                </span>
              </div>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 mt-0.5">
                Medallas
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabSub('certificados')}
              className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col items-center justify-center ${
                activeTabSub === 'certificados'
                  ? 'bg-indigo-100/90 dark:bg-indigo-950/60 border-brand-primary shadow-sm ring-1 ring-brand-primary'
                  : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200/60 dark:border-indigo-900/40 hover:bg-indigo-100/50'
              }`}
            >
              <div className="flex items-center space-x-1">
                <FileCheck size={14} className="text-brand-primary dark:text-indigo-300" />
                <span className="block text-base font-black text-brand-primary dark:text-indigo-300">
                  {user.certificados?.length || 2}
                </span>
              </div>
              <span className="text-xs font-bold text-brand-primary dark:text-indigo-300 mt-0.5">
                Certificados
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabSub('privacidad')}
              className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col items-center justify-center ${
                activeTabSub === 'privacidad'
                  ? 'bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-500 shadow-sm ring-1 ring-emerald-400'
                  : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100/50'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Shield size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="block text-xs font-black text-emerald-700 dark:text-emerald-300">
                  Ley 29733
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                Privacidad
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs — Barra Segmentada con Perfecto Encaje Responsive */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-line dark:border-line-dark shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTabSub('medallas')}
          className={`py-2 px-1 rounded-xl transition-all duration-150 flex items-center justify-center space-x-1.5 text-xs font-black ${
            activeTabSub === 'medallas'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light bg-transparent hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Trophy size={14} className={activeTabSub === 'medallas' ? 'text-white' : 'text-amber-500'} />
          <span className="truncate">Medallero</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabSub('certificados')}
          className={`py-2 px-1 rounded-xl transition-all duration-150 flex items-center justify-center space-x-1.5 text-xs font-black ${
            activeTabSub === 'certificados'
              ? 'bg-brand-primary text-white shadow-md'
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light bg-transparent hover:bg-white/50 dark:hover:bg-slate-700/50'
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
              : 'text-ink-muted hover:text-ink dark:hover:text-ink-light bg-transparent hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Shield size={14} className={activeTabSub === 'privacidad' ? 'text-white' : 'text-emerald-600'} />
          <span className="truncate">Privacidad</span>
        </button>
      </div>

      {/* SUBTAB 1: MEDALLERO ESTUDIANTIL CON IMÁGENES REALES */}
      {activeTabSub === 'medallas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-ink dark:text-ink-light flex items-center space-x-1.5">
                <Trophy size={16} className="text-amber-500" />
                <span>Medallero y Reconocimientos</span>
              </h2>
              <p className="text-xs font-medium text-ink-muted">
                Logros universitarios y distinciones oficiales obtenidas por Luz
              </p>
            </div>
            <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold px-2.5 py-1 rounded-full border border-amber-300">
              4 Ganadas
            </span>
          </div>

          {/* 2x2 Grid de Medallas con Imágenes Reales */}
          <div className="grid grid-cols-2 gap-3">
            {medallasLista.map((med) => (
              <div
                key={med.id}
                onClick={() => setSelectedMedalla(med)}
                className="k-card p-3 flex flex-col items-center text-center cursor-pointer hover:border-brand-primary hover:shadow-elevated transition-all duration-200 group relative border-2 border-line/90 dark:border-line-dark"
              >
                {/* Visual Real Badge Image */}
                <div className="relative w-24 h-24 mb-2 flex items-center justify-center transition-transform group-hover:scale-105">
                  <img
                    src={med.imagenUrl}
                    alt={med.nombre}
                    className="w-full h-full object-contain drop-shadow-md rounded-xl"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-full shadow-sm">
                    <Star size={12} fill="white" />
                  </div>
                </div>

                <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-300/80 px-2 py-0.5 rounded-full mb-1">
                  {med.nivel}
                </span>

                <h3 className="text-xs font-black text-ink dark:text-ink-light leading-tight line-clamp-2 mt-0.5">
                  {med.nombre}
                </h3>

                <p className="text-xs text-ink-muted font-medium line-clamp-1 mt-1">
                  {med.emisor}
                </p>

                <div className="mt-2 pt-1.5 border-t border-line dark:border-line-dark w-full flex items-center justify-center space-x-1 text-xs font-bold text-accent">
                  <span>Ver detalle</span>
                  <ChevronRight size={13} />
                </div>
              </div>
            ))}
          </div>

          {/* Competencias y Nivel en Kampuz (0 a 3 según Especificación) */}
          <div className="k-card p-4 space-y-3 border-2 border-line/80 dark:border-line-dark">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-ink dark:text-ink-light flex items-center space-x-1.5">
                  <Sparkles size={14} className="text-brand-primary" />
                  <span>Escala de Habilidades (0 a 3)</span>
                </h3>
                <p className="text-xs text-ink-muted">
                  Validado por acciones reales en el campus (Sin monedas ficticias)
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
                      style={{ width: `${Math.min(100, Math.round((hab.progresoActual / Math.max(1, hab.siguienteNivelMeta)) * 100))}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-ink-muted font-medium">
                    <span>{hab.progresoActual} de {hab.siguienteNivelMeta} acciones logradas</span>
                    <span className="text-accent font-bold">Ver evidencias →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hechos Observados en Campus (Hechos Reales de Luz) */}
          <div className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark">
            <h3 className="text-xs font-black text-ink dark:text-ink-light uppercase tracking-wider flex items-center space-x-1.5">
              <CheckCircle2 size={14} className="text-accent" />
              <span>Evidencias Observadas en Campus (Hechos Objetivos)</span>
            </h3>

            <div className="space-y-2 text-xs text-ink-soft dark:text-ink-muted">
              {user.habilidades?.apoyo_investigacion?.hechos?.map((h, i) => (
                <div key={`inv_${i}`} className="p-2.5 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark flex items-start space-x-2">
                  <span className="text-accent font-black text-sm">✓</span>
                  <span className="leading-snug">{h}</span>
                </div>
              ))}
              {user.habilidades?.predisposicion_ayudar?.hechos?.map((h, i) => (
                <div key={`ayu_${i}`} className="p-2.5 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark flex items-start space-x-2">
                  <span className="text-accent font-black text-sm">✓</span>
                  <span className="leading-snug">{h}</span>
                </div>
              ))}
              {user.habilidades?.constancia?.hechos?.map((h, i) => (
                <div key={`con_${i}`} className="p-2.5 bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark flex items-start space-x-2">
                  <span className="text-accent font-black text-sm">✓</span>
                  <span className="leading-snug">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: CERTIFICADOS */}
      {activeTabSub === 'certificados' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-ink dark:text-ink-light">
                Certificados y Acreditaciones
              </h2>
              <p className="text-xs text-ink-muted">
                Documentación verificada con carga horaria y evaluación
              </p>
            </div>
            <button
              onClick={() => setShowAddCertModal(true)}
              className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm"
            >
              <Plus size={14} />
              <span>Añadir</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {user.certificados?.map((cert) => (
              <div key={cert.id} className="k-card p-4 space-y-2 border-2 border-line/80 dark:border-line-dark">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        cert.nivel === 'Avanzado'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : cert.nivel === 'Intermedio'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-slate-100 text-slate-900 border border-slate-300'
                      }`}>
                        Nivel {cert.nivel} ({cert.horas}h lectivas)
                      </span>
                      {cert.tieneEvaluacion && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md flex items-center space-x-1 border border-emerald-300">
                          <CheckCircle2 size={12} />
                          <span>Con Evaluación</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-ink dark:text-ink-light mt-1.5">
                      {cert.habilidad}
                    </h4>
                    <p className="text-xs text-ink-muted font-medium mt-0.5">
                      Emisor: <strong className="text-ink dark:text-ink-light">{cert.emisor}</strong> · {cert.fecha}
                    </p>
                  </div>
                </div>

                {cert.url && (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent font-bold hover:underline flex items-center space-x-1 pt-2 border-t border-line dark:border-line-dark"
                  >
                    <span>Verificar enlace de acreditación oficial</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: PRIVACIDAD Y LEY 29733 */}
      {activeTabSub === 'privacidad' && (
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-brand-primary-soft/50 dark:bg-brand-primary-dark/30 rounded-2xl border border-brand-primary/20">
            <h3 className="text-xs font-black uppercase text-brand-primary dark:text-teal-300 flex items-center space-x-1.5">
              <ShieldCheck size={16} />
              <span>Protección de Datos Personales (Ley 29733)</span>
            </h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              En Kampuz tienes control absoluto de tu información. Ningún dato sensible se comparte sin tu consentimiento explícito.
            </p>
          </div>

          <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark">
            <div>
              <span className="font-extrabold text-ink dark:text-ink-light block text-sm">1. Cuenta y Perfil Académico</span>
              <span className="text-xs text-ink-muted">Identificación por carrera, ciclo y sede</span>
            </div>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-ink-muted font-bold px-2.5 py-1 rounded-lg">
              Requerido
            </span>
          </div>

          <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark">
            <div>
              <span className="font-extrabold text-ink dark:text-ink-light block text-sm">2. Recibir encuestas de tesis</span>
              <span className="text-xs text-ink-muted">Máx 3 invitaciones por semana en tu bandeja</span>
            </div>
            <input
              type="checkbox"
              checked={user.consentimientos?.encuestas ?? true}
              onChange={() => toggleConsentimiento('encuestas')}
              className="w-5 h-5 accent-accent rounded cursor-pointer"
            />
          </div>

          <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark">
            <div>
              <span className="font-extrabold text-ink dark:text-ink-light block text-sm">3. Métricas agregadas para la UTP</span>
              <span className="text-xs text-ink-muted">Solo estadísticas anónimas (umbral mínimo ≥ 30)</span>
            </div>
            <input
              type="checkbox"
              checked={user.consentimientos?.metricas ?? true}
              onChange={() => toggleConsentimiento('metricas')}
              className="w-5 h-5 accent-accent rounded cursor-pointer"
            />
          </div>

          {/* Consentimiento 4: Convocatorias UTP */}
          <div className={`p-4 rounded-2xl border-2 transition ${
            user.consentimientos?.perfil_universidad
              ? 'bg-accent-soft/40 dark:bg-accent-dark/30 border-accent shadow-sm'
              : 'bg-white dark:bg-surface-cardDark border-line dark:border-line-dark'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-sm text-brand-primary dark:text-teal-300">
                4. Compartir medallas con bolsa de trabajo UTP
              </span>
              <input
                type="checkbox"
                checked={user.consentimientos?.perfil_universidad ?? false}
                onChange={() => toggleConsentimiento('perfil_universidad')}
                className="w-5 h-5 accent-accent rounded cursor-pointer"
              />
            </div>
            <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
              Permite a los coordinadores de empleabilidad de la UTP visualizar tus reconocimientos para pasantías e internados. Apagado por defecto según normativa.
            </p>
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
          <span>Cerrar sesión (Volver a bienvenida / registro)</span>
        </button>
      </div>

      {/* MODAL: DETALLE DE MEDALLA (Visual Hero Presentation) */}
      {selectedMedalla && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border-2 border-line dark:border-line-dark space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
                <Trophy size={16} />
                <span>Distinción Universitaria Oficial</span>
              </span>
              <button
                onClick={() => setSelectedMedalla(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* Medal Image Hero */}
            <div className="flex flex-col items-center text-center">
              <div className="w-36 h-36 relative mb-3">
                <img
                  src={selectedMedalla.imagenUrl}
                  alt={selectedMedalla.nombre}
                  className="w-full h-full object-contain drop-shadow-xl"
                />
              </div>

              <span className="text-xs font-black px-3 py-1 bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                {selectedMedalla.nivel} · {selectedMedalla.año}
              </span>

              <h2 className="text-base font-black text-ink dark:text-ink-light mt-2 leading-snug">
                {selectedMedalla.nombre}
              </h2>

              <p className="text-xs font-semibold text-brand-primary dark:text-teal-300 mt-0.5">
                {selectedMedalla.categoria}
              </p>
            </div>

            <div className="p-3.5 bg-surface dark:bg-surface-dark rounded-2xl space-y-2 border border-line dark:border-line-dark text-xs">
              <div className="flex justify-between items-center text-ink-muted">
                <span>Entidad emisora:</span>
                <strong className="text-ink dark:text-ink-light">{selectedMedalla.emisor}</strong>
              </div>
              <div className="flex justify-between items-center text-ink-muted">
                <span>Fecha de expedición:</span>
                <strong className="text-ink dark:text-ink-light">{selectedMedalla.fecha}</strong>
              </div>
              <p className="text-xs text-ink-soft dark:text-ink-muted pt-2 border-t border-line dark:border-line-dark leading-relaxed">
                {selectedMedalla.descripcion}
              </p>
            </div>

            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-300/60 flex items-center space-x-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Acreditado en el legajo estudiantil Kampuz UTP</span>
            </div>

            <button
              onClick={() => setSelectedMedalla(null)}
              className="w-full py-2.5 bg-brand-primary text-white font-extrabold text-sm rounded-xl shadow-sm transition"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Habilidad (M30) */}
      {selectedHab && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-2xl p-4 shadow-modal border border-line dark:border-line-dark space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-sm font-black text-ink dark:text-ink-light">
                {selectedHab.nombre}
              </span>
              <button
                onClick={() => setSelectedHabilidadKey(null)}
                className="p-1 text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-ink dark:text-ink-light">Nivel alcanzado:</span>
                <span className="font-black text-accent text-sm">Nivel {selectedHab.nivel} de 3</span>
              </div>

              <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl space-y-1.5 text-xs border border-line dark:border-line-dark">
                <div className={selectedHab.nivel >= 1 ? 'font-bold text-accent' : 'text-ink-muted'}>
                  • Nivel 1: La he usado ({selectedHab.nivel >= 1 ? '✓ Logrado' : 'Pendiente'})
                </div>
                <div className={selectedHab.nivel >= 2 ? 'font-bold text-accent' : 'text-ink-muted'}>
                  • Nivel 2: La he aplicado con otros ({selectedHab.nivel >= 2 ? '✓ Logrado' : 'Pendiente'})
                </div>
                <div className={selectedHab.nivel >= 3 ? 'font-bold text-accent' : 'text-ink-muted'}>
                  • Nivel 3: La he enseñado ({selectedHab.nivel >= 3 ? '✓ Logrado' : 'Pendiente'})
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-ink dark:text-ink-light block mb-1">
                  Evidencias registradas por Kampuz:
                </span>
                {selectedHab.hechos?.length === 0 ? (
                  <p className="text-xs text-ink-muted italic">Aún sin hechos registrados.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedHab.hechos?.map((h, i) => (
                      <p key={i} className="text-xs text-ink-soft dark:text-ink-muted bg-surface dark:bg-surface-dark p-2 rounded-lg border border-line dark:border-line-dark">
                        ✓ {h}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedHabilidadKey(null)}
              className="w-full py-2 bg-surface dark:bg-line-dark text-ink dark:text-ink-light font-bold text-xs rounded-xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Subir Certificado (M31) */}
      {showAddCertModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-2xl p-4 shadow-modal border border-line dark:border-line-dark space-y-3">
            <h3 className="text-sm font-black text-ink dark:text-ink-light">
              Agregar Certificado
            </h3>

            <form onSubmit={handleSubirCertificadoSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Curso o habilidad
                </label>
                <input
                  type="text"
                  value={certHabilidad}
                  onChange={(e) => setCertHabilidad(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  Institución emisora
                </label>
                <input
                  type="text"
                  value={certEmisor}
                  onChange={(e) => setCertEmisor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                    Horas
                  </label>
                  <input
                    type="number"
                    value={certHoras}
                    onChange={(e) => setCertHoras(e.target.value)}
                    className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    checked={certEvaluacion}
                    onChange={(e) => setCertEvaluacion(e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <label className="text-xs font-medium text-ink-soft">¿Tuvo examen?</label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">
                  URL de Verificación
                </label>
                <input
                  type="url"
                  placeholder="https://credencial.ejemplo.org/..."
                  value={certUrl}
                  onChange={(e) => setCertUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCertModal(false)}
                  className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Guardar Certificado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
