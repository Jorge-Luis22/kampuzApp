import React, { useState } from 'react';
import { useStore } from '../data/store';
import { CARRERAS_UTP, INTERESES_DISPONIBLES } from '../data/mockData';
import {
  Search,
  Filter,
  UserPlus,
  Check,
  Clock,
  ShieldCheck,
  Send,
  MessageCircle,
  X,
  Sparkles,
  Users
} from 'lucide-react';

export default function ExplorarView() {
  const { user } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('personas'); // 'personas' | 'solicitudes'
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCarrera, setFiltroCarrera] = useState('');
  const [filtroCiclo, setFiltroCiclo] = useState('');
  const [filtroInteres, setFiltroInteres] = useState('');

  // Selected student modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [solicitudEnviadaSuccess, setSolicitudEnviadaSuccess] = useState(false);

  // Solicitudes simuladas
  const [solicitudes, setSolicitudes] = useState([
    {
      id: 'sol_1',
      de: {
        nombre: 'Camila Ríos',
        carrera: 'Administración de Empresas',
        ciclo: 1,
        sede: 'Lima Sur',
        foto: '/fotos/camila.jpg',
        interesComun: 'Investigación y Tesis'
      },
      mensaje: 'Hola Luz, me gustaría consultarte sobre métodos de estudio y fichas bibliográficas para salud.',
      fecha: 'Hace 2 horas',
      estado: 'pendiente'
    },
    {
      id: 'sol_2',
      de: {
        nombre: 'Marcos Villanueva',
        carrera: 'Ingeniería Industrial',
        ciclo: 7,
        sede: 'Lima Sur',
        foto: '/fotos/marcos.jpg',
        interesComun: 'Investigación y Tesis'
      },
      mensaje: 'Hola Luz, si necesitas apoyo validando muestras estadísticas con Excel o SPSS para tu tesis me avisas.',
      fecha: 'Ayer',
      estado: 'aceptada'
    }
  ]);

  // Lista de estudiantes simulados en campus
  const ESTUDIANTES_EXPLORAR = [
    {
      id: 'est_1',
      nombre: 'Camila Ríos',
      carrera: 'Administración de Empresas',
      ciclo: 1,
      sede: 'Lima Sur',
      foto: '/fotos/camila.jpg',
      intereses: ['Startups y Emprendimiento', 'Investigación y Tesis'],
      rol: 'Cachimba',
      hechoDestacado: 'Participa en semilleros de oratoria'
    },
    {
      id: 'est_2',
      nombre: 'Marcos Villanueva',
      carrera: 'Ingeniería Industrial',
      ciclo: 7,
      sede: 'Lima Sur',
      foto: '/fotos/marcos.jpg',
      intereses: ['Investigación y Tesis', 'Startups y Emprendimiento'],
      rol: 'Ciclos superiores',
      hechoDestacado: 'Fundador de Startups UTP Lima Sur'
    },
    {
      id: 'est_3',
      nombre: 'Valeria Palacios',
      carrera: 'Psicología',
      ciclo: 8,
      sede: 'Lima Sur',
      foto: '/fotos/valeria.jpg',
      intereses: ['Salud Comunitaria', 'Investigación y Tesis'],
      rol: 'Ciclos superiores',
      hechoDestacado: '14 encuestas de tesis respondidas'
    },
    {
      id: 'est_4',
      nombre: 'Diego Alarcón',
      carrera: 'Ingeniería de Sistemas',
      ciclo: 5,
      sede: 'Lima Sur',
      foto: '/fotos/diego.jpg',
      intereses: ['Inteligencia Artificial', 'Fútbol y Futsal'],
      rol: 'Ciclo medio',
      hechoDestacado: 'Organizador de torneos esports sede'
    },
    {
      id: 'est_5',
      nombre: 'Andrea Morales',
      carrera: 'Enfermería',
      ciclo: 5,
      sede: 'Lima Sur',
      foto: '/fotos/andrea.jpg',
      intereses: ['Primeros Auxilios', 'Salud Comunitaria'],
      rol: 'Tu salón',
      hechoDestacado: 'Delegada de Farmacología Clínica'
    }
  ];

  const estudiantesFiltrados = ESTUDIANTES_EXPLORAR.filter(e => {
    if (searchTerm && !e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) && !e.carrera.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filtroCarrera && e.carrera !== filtroCarrera) return false;
    if (filtroCiclo && e.ciclo !== Number(filtroCiclo)) return false;
    if (filtroInteres && !e.intereses.includes(filtroInteres)) return false;
    return true;
  });

  const enviarSolicitudConexion = () => {
    if (!motivoSolicitud.trim()) return;
    setSolicitudEnviadaSuccess(true);
    setTimeout(() => {
      setSelectedStudent(null);
      setSolicitudEnviadaSuccess(false);
      setMotivoSolicitud('');
    }, 1200);
  };

  const responderSolicitud = (id, accion) => {
    setSolicitudes(prev =>
      prev.map(s => (s.id === id ? { ...s, estado: accion } : s))
    );
  };

  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Sub Tabs */}
      <div className="flex bg-white dark:bg-surface-cardDark p-1.5 rounded-2xl border border-line dark:border-line-dark shadow-sm">
        <button
          onClick={() => setActiveSubTab('personas')}
          className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${
            activeSubTab === 'personas'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          Explorar Compañeros
        </button>
        <button
          onClick={() => setActiveSubTab('solicitudes')}
          className={`flex-1 py-2 text-sm font-bold rounded-xl transition flex items-center justify-center space-x-2 ${
            activeSubTab === 'solicitudes'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <span>Solicitudes</span>
          <span className="w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center font-black">
            {solicitudes.filter(s => s.estado === 'pendiente').length}
          </span>
        </button>
      </div>

      {activeSubTab === 'personas' ? (
        <>
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar compañeros por nombre o carrera..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-xl text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary shadow-sm"
            />
            <Search className="absolute left-3.5 top-3 text-ink-muted" size={16} />
          </div>

          {/* Quick Filters Row */}
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

          {/* Student Cards List — Boxes Modernos Rediseñados sin Solapamiento */}
          <div className="space-y-3.5">
            {estudiantesFiltrados.map((est) => {
              const interesComun = est.intereses.find(i => user.intereses.includes(i)) || est.intereses[0];

              return (
                <div
                  key={est.id}
                  className="k-card p-4 space-y-3 border-2 border-line/90 dark:border-line-dark rounded-2xl shadow-sm hover:border-brand-primary/60 transition group bg-white dark:bg-surface-cardDark"
                >
                  {/* Top Row: Avatar Compacto y Elegante + Datos Completos */}
                  <div className="flex items-start space-x-3.5">
                    <div className="relative shrink-0">
                      <img
                        src={est.foto}
                        alt={est.nombre}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-primary/20 dark:border-line-dark shadow-sm group-hover:scale-105 transition duration-200"
                      />
                      <div
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-cardDark shadow-sm"
                        title="Estudiante de campus verificado"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="text-base font-black text-ink dark:text-ink-light truncate group-hover:text-brand-primary transition">
                          {est.nombre}
                        </h3>
                        {est.rol && (
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                            est.rol === 'Tu salón'
                              ? 'bg-brand-primary/10 text-brand-primary dark:text-teal-300 border border-brand-primary/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-ink-muted'
                          }`}>
                            {est.rol}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-brand-primary dark:text-teal-300 truncate">
                        {est.carrera} · {est.ciclo}.° Ciclo
                      </p>

                      <p className="text-xs text-ink-muted truncate font-medium mt-0.5">
                        Sede {est.sede} · {est.hechoDestacado}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Separador Fino + Interés Afín + Botón Conectar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-line/80 dark:border-line-dark">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-accent dark:text-teal-200 bg-accent-soft/70 dark:bg-accent-dark/40 px-3 py-1 rounded-full border border-accent/20 truncate max-w-[58%] shadow-xs">
                      <Sparkles size={13} className="shrink-0 text-accent" />
                      <span className="truncate">{interesComun}</span>
                    </div>

                    <button
                      onClick={() => setSelectedStudent(est)}
                      className="px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 shrink-0"
                    >
                      <UserPlus size={14} />
                      <span>Conectar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Solicitudes de Conexión */
        <div className="space-y-3">
          {solicitudes.length === 0 ? (
            <p className="text-center text-xs text-ink-muted py-10">
              No tienes solicitudes de conexión pendientes.
            </p>
          ) : (
            solicitudes.map((sol) => (
              <div key={sol.id} className="k-card p-4 space-y-2.5 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={sol.de.foto}
                      alt={sol.de.nombre}
                      className="w-12 h-12 rounded-2xl object-cover border border-line shadow-sm shrink-0"
                    />
                    <div>
                      <h4 className="text-sm font-black text-ink dark:text-ink-light">
                        {sol.de.nombre}
                      </h4>
                      <p className="text-xs text-ink-muted font-medium">
                        {sol.de.carrera} · Ciclo {sol.de.ciclo}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-ink-muted font-medium">{sol.fecha}</span>
                </div>

                <div className="p-3 bg-surface dark:bg-surface-dark rounded-xl text-xs text-ink-soft dark:text-ink-muted italic border border-line dark:border-line-dark leading-relaxed">
                  "{sol.mensaje}"
                </div>

                {sol.estado === 'pendiente' ? (
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={() => responderSolicitud(sol.id, 'rechazada')}
                      className="px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink"
                    >
                      Ignorar
                    </button>
                    <button
                      onClick={() => responderSolicitud(sol.id, 'aceptada')}
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
                    <button className="px-3.5 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm">
                      <MessageCircle size={14} />
                      <span>Abrir Chat</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Enviar Solicitud */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-line dark:border-line-dark">
              <span className="text-xs font-black uppercase text-ink dark:text-ink-light tracking-wider">
                Solicitud de conexión en campus
              </span>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1 text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center space-x-3.5">
              <img
                src={selectedStudent.foto}
                alt={selectedStudent.nombre}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-primary/20 shadow-sm shrink-0"
              />
              <div>
                <h3 className="text-base font-black text-ink dark:text-ink-light">
                  {selectedStudent.nombre}
                </h3>
                <p className="text-xs text-ink-soft dark:text-ink-muted font-medium">
                  {selectedStudent.carrera} · Ciclo {selectedStudent.ciclo}
                </p>
              </div>
            </div>

            {solicitudEnviadaSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-center space-y-1.5 border border-emerald-300">
                <Check size={26} className="text-emerald-600 mx-auto" />
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  Solicitud enviada a {selectedStudent.nombre}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">
                    Motivo académico o de proyecto:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Hola, me gustaría coordinar sobre cursos o proyectos afines..."
                    value={motivoSolicitud}
                    onChange={(e) => setMotivoSolicitud(e.target.value)}
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm text-ink dark:text-ink-light focus:outline-none focus:border-accent resize-none font-medium"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={enviarSolicitudConexion}
                    disabled={!motivoSolicitud.trim()}
                    className="px-4 py-2 bg-brand-primary disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                  >
                    <span>Enviar Solicitud</span>
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
