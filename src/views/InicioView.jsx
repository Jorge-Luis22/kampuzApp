import React from 'react';
import { useStore } from '../data/store';
import {
  ClipboardList,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Calendar,
  Users,
  Clock,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  Trophy
} from 'lucide-react';

export default function InicioView() {
  const {
    user,
    setActiveTab,
    encuestasBandeja,
    consultas,
    espacios,
    setActiveEspacioId,
    setActiveConsultaId
  } = useStore();

  const encuestaPendiente = encuestasBandeja.find(e => e.estado === 'pendiente');
  const cohorteGrupo = espacios.find(e => e.tipo === 'carrera_ciclo');
  const carreraEspacio = espacios.find(e => e.tipo === 'carrera');
  const tallerActivo = espacios.find(e => e.tipo === 'taller' && e.esMiembro);
  const consultasAbiertas = consultas.filter(c => c.estado === 'abierto');

  const goToEspacio = (id) => {
    setActiveEspacioId(id);
    setActiveTab('grupos');
  };

  const goToConsulta = (id) => {
    setActiveConsultaId(id);
    setActiveTab('grupos');
  };

  return (
    <div className="flex-1 p-4 pb-24 space-y-4 overflow-y-auto animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* Profile Header — Estudiante Estrella */}
      <div className="flex items-center justify-between pt-1 gap-3">
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
            <span className="text-xs font-semibold text-ink-muted">Bienvenida,</span>
            <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 shrink-0">
              UTP Sede {user.sede}
            </span>
          </div>
          <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight truncate leading-tight">
            {user.nombre} {user.apellido}
          </h1>
          <p className="text-xs font-bold text-brand-primary dark:text-teal-300 mt-0.5 truncate">
            {user.carrera} · {user.ciclo}.° Ciclo
          </p>
        </div>

        <button
          onClick={() => setActiveTab('perfil')}
          className="relative shrink-0 cursor-pointer ring-2 ring-brand-primary/20 dark:ring-accent/40 rounded-2xl p-0.5 hover:scale-105 transition"
          title="Ver mi perfil"
        >
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm bg-slate-200 dark:bg-slate-800">
            <img
              src={user.fotoUrl}
              alt={user.nombre}
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-accent text-white p-1 rounded-full shadow-md border-2 border-white dark:border-surface-cardDark">
            <ShieldCheck size={13} />
          </div>
        </button>
      </div>

      {/* Banner Encuesta Pendiente de Tesis */}
      {encuestaPendiente && (
        <div className="bg-gradient-to-r from-brand-primary via-[#2E2675] to-[#3B3294] text-white p-4 rounded-2xl shadow-md relative overflow-hidden border border-brand-primary/50">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-wider uppercase text-teal-300 flex items-center space-x-1.5">
                <ClipboardList size={15} />
                <span>Encuesta de Tesis Pendiente</span>
              </span>
              <span className="text-xs bg-white/20 font-black px-2.5 py-0.5 rounded-full text-white">
                +1 Apoyo a Investigación
              </span>
            </div>

            <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">
              {encuestaPendiente.titulo}
            </h2>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-indigo-200 font-medium">
                Por {encuestaPendiente.autorNombre} (~{encuestaPendiente.tiempoEstimado})
              </span>
              <button
                onClick={() => setActiveTab('encuestas')}
                className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-black rounded-xl flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>Responder</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Los Tres Espacios Principales de la Alumna */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-ink dark:text-ink-light">
              Tus Espacios Activos
            </h2>
            <p className="text-xs text-ink-muted">Comunidades clave de tu vida universitaria</p>
          </div>
          <button
            onClick={() => setActiveTab('grupos')}
            className="text-xs font-bold text-accent hover:underline flex items-center space-x-0.5"
          >
            <span>Ver todos</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* 1. Cohorte Cerrada (Enfermería C5) */}
          {cohorteGrupo && (
            <div
              onClick={() => goToEspacio(cohorteGrupo.id)}
              className="k-card p-3 flex items-center justify-between hover:border-brand-primary cursor-pointer transition-all duration-200 border-2 border-line/80 dark:border-line-dark rounded-2xl group shadow-sm"
            >
              <div className="flex items-center space-x-3.5">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-line dark:border-line-dark shadow-sm">
                  {cohorteGrupo.portadaUrl ? (
                    <img
                      src={cohorteGrupo.portadaUrl}
                      alt={cohorteGrupo.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs">C5</div>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-brand-primary/95 text-white text-xs font-black text-center py-0.5">
                    SALÓN
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-ink dark:text-ink-light group-hover:text-brand-primary transition">
                      {cohorteGrupo.nombre}
                    </h3>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-ink-muted font-bold px-2 py-0.2 rounded-md">
                      Cerrado
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-1 font-medium">
                    {cohorteGrupo.ultimoMensaje}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-muted shrink-0 group-hover:translate-x-0.5 transition" />
            </div>
          )}

          {/* 2. Espacio de Carrera (Ciclos 1 al 10 - Consultas Agrupadas) */}
          {carreraEspacio && (
            <div
              onClick={() => goToEspacio(carreraEspacio.id)}
              className="k-card p-3 flex items-center justify-between hover:border-brand-primary cursor-pointer transition-all duration-200 border-2 border-line/80 dark:border-line-dark rounded-2xl group shadow-sm"
            >
              <div className="flex items-center space-x-3.5">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-line dark:border-line-dark shadow-sm">
                  {carreraEspacio.portadaUrl ? (
                    <img
                      src={carreraEspacio.portadaUrl}
                      alt={carreraEspacio.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-full bg-accent text-white flex items-center justify-center font-bold text-xs">ENF</div>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-teal-800/95 text-white text-xs font-black text-center py-0.5">
                    CARRERA
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-ink dark:text-ink-light group-hover:text-brand-primary transition">
                      {carreraEspacio.nombre}
                    </h3>
                    <span className="text-xs bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-bold px-2 py-0.2 rounded-md">
                      Ciclos 1-10
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-1 font-medium">
                    Consultas académicas y bancos de preguntas
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-muted shrink-0 group-hover:translate-x-0.5 transition" />
            </div>
          )}

          {/* 3. Taller Oficial con Horario Real */}
          {tallerActivo && (
            <div
              onClick={() => goToEspacio(tallerActivo.id)}
              className="k-card p-3 flex items-center justify-between hover:border-brand-primary cursor-pointer transition-all duration-200 border-2 border-line/80 dark:border-line-dark rounded-2xl group shadow-sm"
            >
              <div className="flex items-center space-x-3.5">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-line dark:border-line-dark shadow-sm">
                  {tallerActivo.portadaUrl ? (
                    <img
                      src={tallerActivo.portadaUrl}
                      alt={tallerActivo.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">🎨</div>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-amber-700/95 text-white text-xs font-black text-center py-0.5">
                    TALLER
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-ink dark:text-ink-light group-hover:text-brand-primary transition">
                      {tallerActivo.nombre}
                    </h3>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded-md">
                      Oficial
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-bold flex items-center mt-0.5">
                    <Clock size={12} className="inline mr-1 text-amber-600" />
                    <span>{tallerActivo.horario}</span>
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-muted shrink-0 group-hover:translate-x-0.5 transition" />
            </div>
          )}
        </div>
      </div>

      {/* Consultas Agrupadas de tu Carrera (Flujo 1) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-ink dark:text-ink-light">
              Dudas en {user.carrera}
            </h2>
            <span className="text-xs bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 font-black px-2 py-0.5 rounded-md">
              Ciclo ≥ 5 orienta
            </span>
          </div>
          <button
            onClick={() => setActiveTab('grupos')}
            className="text-xs font-bold text-accent hover:underline"
          >
            Ver dudas
          </button>
        </div>

        <div className="space-y-2.5">
          {consultasAbiertas.slice(0, 2).map((c) => (
            <div
              key={c.id}
              onClick={() => goToConsulta(c.id)}
              className="k-card p-3.5 cursor-pointer hover:border-accent transition space-y-2 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-brand-primary dark:text-teal-300 text-sm">
                  {c.curso}
                </span>
                <span className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                  {c.nAlumnos} alumnos
                </span>
              </div>
              <h4 className="text-xs font-bold text-ink dark:text-ink-light">
                {c.tema}
              </h4>
              <p className="text-xs text-ink-soft dark:text-ink-muted line-clamp-1 italic">
                "{c.textoResumen}"
              </p>

              <div className="pt-2 border-t border-line dark:border-line-dark flex items-center justify-between text-xs text-ink-muted font-medium">
                <span>{c.autores[0]}</span>
                <span className="text-accent font-bold flex items-center space-x-1">
                  <span>{c.respuestas.length > 0 ? `${c.respuestas.length} respuesta` : 'Orientar ahora'}</span>
                  <ChevronRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actividades del Campus UTP */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-black uppercase tracking-wider text-ink dark:text-ink-light">
          Agenda Campus UTP Lima Sur
        </h2>
        <div className="k-card p-3.5 space-y-3 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent flex flex-col items-center justify-center shrink-0 border border-accent/20">
              <span className="text-xs font-black uppercase leading-none">SÁB</span>
              <span className="text-base font-black leading-none mt-1">11</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-ink dark:text-ink-light">
                Torneo Relámpago Interfacultades
              </h3>
              <p className="text-xs text-ink-soft dark:text-ink-muted mt-0.5">
                Cancha Central Lima Sur · Vóley & Futsal Oficial
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5 pt-2.5 border-t border-line dark:border-line-dark">
            <div className="w-12 h-12 rounded-xl bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 flex flex-col items-center justify-center shrink-0 border border-brand-primary/20">
              <span className="text-xs font-black uppercase leading-none">VIE</span>
              <span className="text-base font-black leading-none mt-1">17</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-ink dark:text-ink-light">
                Workshop: Búsqueda con IA para Tesis
              </h3>
              <p className="text-xs text-ink-soft dark:text-ink-muted mt-0.5">
                Auditorio 1 y Lab 401 · Abierto a Ciencias de la Salud
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
