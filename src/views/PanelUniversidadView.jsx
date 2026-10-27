import React, { useState } from 'react';
import { useStore } from '../data/store';
import {
  Building2,
  Users,
  Activity,
  Award,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  Eye,
  CheckCircle2,
  ChevronRight,
  Filter
} from 'lucide-react';

export default function PanelUniversidadView() {
  const {
    metricasPanel,
    setCurrentScreen,
    user
  } = useStore();

  const [activePanelTab, setActivePanelTab] = useState('resumen'); // 'resumen' | 'facultades' | 'talento' | 'talleres'

  // Alumnos en el radar: los pre-cargados + Ana Torres SI tiene el consentimiento 4 activo
  const listaAlumnosDestacados = [
    ...metricasPanel.alumnosDestacadosConsentimiento4,
    ...(user.consentimientos?.perfil_universidad ? [{
      id: 'dest_luz',
      nombre: `${user.nombre} ${user.apellido}`,
      carrera: user.carrera,
      ciclo: user.ciclo,
      hechosClave: `${user.habilidades?.predisposicion_ayudar?.hechos?.[0] || 'Orientó consultas académicas de carrera'} · Respondió ${user.habilidades?.apoyo_investigacion?.progresoActual || 2} encuestas de tesis`,
      habilidadesPrincipales: [
        `Solidaridad (Nivel ${user.habilidades?.predisposicion_ayudar?.nivel || 1})`,
        `Apoyo a la investigación (Nivel ${user.habilidades?.apoyo_investigacion?.nivel || 1})`
      ],
      consentimiento4Activo: true
    }] : [])
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
      {/* Top University Brand Bar */}
      <div className="bg-[#1E1B4B] text-white px-6 py-4 flex items-center justify-between border-b border-indigo-900/50">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-accent flex items-center justify-center font-black text-white text-xl shadow-sm">
            UTP
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black tracking-tight">Portal Institucional Kampuz</h1>
              <span className="text-xs bg-white/20 text-white font-bold px-2.5 py-0.5 rounded-full">
                Sede Lima Sur
              </span>
              <span className="text-xs bg-accent/40 text-teal-200 font-bold px-2.5 py-0.5 rounded-full">
                Consola de Autoridades y Empleabilidad
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Métricas agregadas, bienestar estudiantil y radar de competencias para Impulsa / Generación Top
            </p>
          </div>
        </div>

        <button
          onClick={() => setCurrentScreen('app')}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1.5"
        >
          <span>Regresar a la App Móvil</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Panel Navigation Tabs */}
      <div className="bg-white dark:bg-surface-cardDark border-b border-line dark:border-line-dark px-6 flex space-x-6 text-xs font-bold">
        {[
          { id: 'resumen', label: 'Resumen y Retención' },
          { id: 'facultades', label: 'Participación por Facultad' },
          { id: 'talento', label: 'Radar de Talento (Impulsa / Gen Top)' },
          { id: 'talleres', label: 'Talleres y Comunidades' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanelTab(tab.id)}
            className={`py-3.5 border-b-2 transition ${
              activePanelTab === tab.id
                ? 'border-brand-primary dark:border-accent text-brand-primary dark:text-accent font-black'
                : 'border-transparent text-ink-muted hover:text-ink dark:hover:text-ink-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content */}
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Tab W01: Resumen General */}
        {activePanelTab === 'resumen' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                  Alumnos Registrados (Sede Lima Sur)
                </span>
                <div className="text-2xl font-black text-ink dark:text-ink-light mt-1">
                  {metricasPanel.totalRegistradosSede.toLocaleString()}
                </div>
                <span className="text-xs text-accent font-bold">
                  15% del total matriculado (Meta Piloto)
                </span>
              </div>

              <div className="p-4 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                  Activos Semanales (WAU)
                </span>
                <div className="text-2xl font-black text-ink dark:text-ink-light mt-1">
                  {metricasPanel.activosSemanales.toLocaleString()}
                </div>
                <span className="text-xs text-emerald-600 font-bold">
                  49.1% tasa de recurrencia
                </span>
              </div>

              <div className="p-4 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                  Retención a 4 Semanas
                </span>
                <div className="text-2xl font-black text-brand-primary dark:text-teal-300 mt-1">
                  {metricasPanel.tasaRetencion4Semanas}%
                </div>
                <span className="text-xs text-emerald-600 font-bold">
                  Supera la meta del piloto (&gt;25%)
                </span>
              </div>

              <div className="p-4 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                  Cruce Intercarreras
                </span>
                <div className="text-2xl font-black text-accent mt-1">
                  {metricasPanel.interaccionesCruzanCarreras}%
                </div>
                <span className="text-xs text-ink-soft dark:text-ink-muted font-medium">
                  Interacciones fuera del salón
                </span>
              </div>
            </div>

            {/* Métrica Clave de Venta a la Universidad */}
            <div className="p-6 bg-gradient-to-r from-brand-primary to-indigo-900 text-white rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-teal-300 uppercase tracking-wider">
                  Métrica de Impacto para Dirección Académica
                </span>
                <h3 className="text-lg font-black mt-1">
                  {metricasPanel.participacionCiclos1a3}% de alumnos de ciclos 1 a 3 participan en actividades extracurriculares
                </h3>
                <p className="text-xs text-indigo-100/80 mt-1 max-w-2xl font-medium leading-relaxed">
                  Antes de Kampuz, los cachimbos no conocían los talleres oficiales de bienestar. Kampuz actúa como capa de descubrimiento e integración que reduce el aislamiento temprano.
                </p>
              </div>
              <div className="shrink-0 p-4 bg-white/10 rounded-2xl text-center border border-white/10">
                <span className="text-xs text-indigo-200 font-bold">Incremento vs Semestre 2025-2</span>
                <div className="text-2xl font-black text-accent mt-0.5">+34.8%</div>
              </div>
            </div>

            {/* Aviso de Privacidad y No Intrusión */}
            <div className="p-4 bg-slate-100 dark:bg-line-dark/40 border border-line dark:border-line-dark rounded-2xl text-xs text-ink-soft dark:text-ink-muted flex items-start space-x-3">
              <ShieldCheck size={20} className="text-accent shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-ink dark:text-ink-light">Garantía de neutralidad institucional:</strong> La universidad visualiza únicamente datos estadísticos agregados y anonimizados. La UTP no modera el contenido interno ni accede a conversaciones privadas de los alumnos. El umbral de 30 personas se aplica de forma estricta.
              </div>
            </div>
          </div>
        )}

        {/* Tab W02: Facultades */}
        {activePanelTab === 'facultades' && (
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm space-y-3.5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-ink dark:text-ink-light">
                    Distribución de Alumnos Activos por Facultad
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Solo se muestran grupos de 30 alumnos o más, para cuidar el anonimato
                  </p>
                </div>
                <span className="text-xs font-bold text-accent">Total: 2,895 registrados</span>
              </div>

              <div className="space-y-3.5 pt-2">
                {metricasPanel.distribucionFacultad.map((f) => (
                  <div key={f.facultad} className="space-y-1.5">
                    <div className="flex justify-between text-xs text-ink dark:text-ink-light font-bold">
                      <span>{f.facultad}</span>
                      <span>{f.alumnos} alumnos ({f.porcentaje}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-line-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-primary dark:bg-accent rounded-full"
                        style={{ width: `${f.porcentaje * 2}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab W03: Radar de Talento (Impulsa / Generación Top) */}
        {activePanelTab === 'talento' && (
          <div className="space-y-4">
            {/* Banner explicativo del Radar */}
            <div className="p-4 bg-brand-primary-soft dark:bg-brand-dark/40 border border-brand-primary/20 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-brand-primary dark:text-teal-300 font-black text-xs">
                <Sparkles size={16} />
                <span>Segundo Radar para Empleabilidad</span>
              </div>
              <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed font-medium">
                Los programas <strong>Impulsa</strong> y <strong>Generación Top</strong> filtran tradicionalmente solo por promedio ponderado de 17 a más. Kampuz le permite a la UTP detectar alumnos con alto liderazgo, predisposición a enseñar a sus compañeros y constancia extracurricular.
              </p>
              <div className="pt-1 text-xs text-accent font-bold flex items-center space-x-1.5">
                <ShieldCheck size={15} />
                <span>Solo se listan alumnos que otorgaron expresamente el Consentimiento 4 (Ley 29733).</span>
              </div>
            </div>

            {/* Listado de alumnos en el Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listaAlumnosDestacados.map((dest) => (
                <div
                  key={dest.id}
                  className="p-4 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-black text-ink dark:text-ink-light">
                          {dest.nombre}
                        </h4>
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                          Consentimiento 4 Activo
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted font-medium mt-0.5">
                        {dest.carrera} · Ciclo {dest.ciclo}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-surface dark:bg-line-dark/30 rounded-xl text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
                    <span className="font-bold block text-ink dark:text-ink-light mb-0.5">Evidencia de impacto:</span>
                    "{dest.hechosClave}"
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {dest.habilidadesPrincipales.map((h, i) => (
                      <span
                        key={i}
                        className="text-xs bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 font-bold px-2.5 py-0.5 rounded-full"
                      >
                        ★ {h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Estado de Ana Torres */}
            <div className="p-4 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-ink dark:text-ink-light text-sm block">Estado de Ana Torres en este radar:</span>
                <p className="text-ink-muted text-xs mt-0.5">
                  {user.consentimientos?.perfil_universidad
                    ? 'Consentimiento 4 otorgado en la app. Ana es visible para los reclutadores de Impulsa.'
                    : 'Consentimiento 4 apagado por defecto. Ana Torres NO aparece en el radar hasta que decida activarlo en Privacidad.'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full font-black text-xs ${
                user.consentimientos?.perfil_universidad
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {user.consentimientos?.perfil_universidad ? 'Visible en Radar' : 'No compartida'}
              </span>
            </div>
          </div>
        )}

        {/* Tab W05: Talleres Oficiales Espejados */}
        {activePanelTab === 'talleres' && (
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl shadow-sm space-y-3.5">
              <h3 className="text-base font-black text-ink dark:text-ink-light">
                Talleres Oficiales de Bienestar Estudiantil (Horarios Reales)
              </h3>
              <p className="text-xs text-ink-muted">
                Espejados desde el portal UTP para disparar interacciones recurrentes con horario fijo
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                {[
                  { nombre: 'Taller de Lettering y Caligrafía', horario: 'Sábados 10:00 - 12:00', inscritos: 64, cupo: 70 },
                  { nombre: 'Taller de Futsal UTP Lima Sur', horario: 'Martes y Jueves 17:00 - 19:00', inscritos: 112, cupo: 120 },
                  { nombre: 'Taller de Karate Básico', horario: 'Lunes y Miércoles 18:00 - 19:30', inscritos: 45, cupo: 50 },
                  { nombre: 'Taller de IA Aplicada a la Universidad', horario: 'Viernes 19:00 - 21:00', inscritos: 198, cupo: 200 }
                ].map((t) => (
                  <div key={t.nombre} className="p-3.5 bg-surface dark:bg-line-dark/20 rounded-2xl space-y-2 border border-line dark:border-line-dark">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-black text-ink dark:text-ink-light">{t.nombre}</h4>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                        Oficial
                      </span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-bold">{t.horario}</p>
                    <div className="flex justify-between text-xs text-ink-muted pt-1.5 border-t border-line dark:border-line-dark font-medium">
                      <span>Participación activa</span>
                      <span className="font-extrabold text-ink dark:text-ink-light">{t.inscritos} alumnos</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
