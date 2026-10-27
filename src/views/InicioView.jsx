import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../data/store';
import { fetchBandejaEncuestas } from '../lib/surveys';
import { fetchEspacios } from '../lib/spaces';
import { fetchConsultasCarrera } from '../lib/consultas';
import { fetchTablon, subscribeToTablon } from '../lib/tablon';
import { fetchRecienLlegados, enviarSolicitudMensaje } from '../lib/explore';
import { fetchProyectos, tipoProyecto } from '../lib/proyectos';
import { textoVence, textoFecha } from '../data/tablon';
import { ESTADOS_EN_VIVO } from '../data/estados';
import { CONTACTO } from '../data/textos';
import ErrorConReintento from '../components/ErrorConReintento';
import PanelInferior from '../components/PanelInferior';
import { EtiquetaTipo } from './TablonView';
import { Search, ChevronRight, ClipboardList, MapPin, Clock, CalendarDays, Users, UserPlus, Loader2, Plus, Check, Send } from 'lucide-react';

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const sinTildes = (t = '') => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// ¿El horario de un taller ("Martes y Jueves 17:00 - 19:00") incluye hoy?
const esHoy = (horario) => {
  const hoy = DIAS[new Date().getDay()];
  return new RegExp(`\\b${hoy}s?\\b`).test(sinTildes(horario));
};

function Seccion({ titulo, subtitulo, accion, onAccion, children }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-ink dark:text-ink-light">{titulo}</h2>
          {subtitulo && <p className="text-[11px] text-ink-muted font-medium">{subtitulo}</p>}
        </div>
        {accion && (
          <button onClick={onAccion} className="text-xs font-bold text-accent flex items-center shrink-0">
            <span>{accion}</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Avatar({ persona, tam = 'w-12 h-12', texto = 'text-base' }) {
  return persona?.foto_url ? (
    <img src={persona.foto_url} alt={persona.nombre || ''} className={`${tam} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${tam} rounded-full bg-brand-primary text-white font-black ${texto} flex items-center justify-center shrink-0`}>
      {(persona?.nombre?.[0] || 'K').toUpperCase()}
    </div>
  );
}

export default function InicioView() {
  const { user, setActiveTab, setActiveEspacioId, setActiveConsultaId, setTablonFiltro, setTablonPublicar } = useStore();

  const [encuestasBandeja, setEncuestasBandeja] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [recien, setRecien] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  // Agregar contacto desde "Recién llegados"
  const [agregar, setAgregar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState('');
  const [enviadas, setEnviadas] = useState([]);

  const cargarTablon = useCallback(async () => {
    try {
      setPublicaciones(await fetchTablon(null));
    } catch (err) {
      // El tablón muestra su propio error; aquí la sección queda vacía
    }
  }, []);

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    const resultados = await Promise.allSettled([
      fetchBandejaEncuestas(),
      fetchEspacios(),
      fetchConsultasCarrera(user?.id),
      fetchTablon(null),
      fetchRecienLlegados(5),
      fetchProyectos()
    ]);
    const [b, e, c, t, r, pr] = resultados;
    if (b.status === 'fulfilled') setEncuestasBandeja(b.value);
    if (e.status === 'fulfilled') setEspacios(e.value);
    if (c.status === 'fulfilled') setConsultas(c.value);
    if (t.status === 'fulfilled') setPublicaciones(t.value);
    if (r.status === 'fulfilled') setRecien(r.value);
    if (pr.status === 'fulfilled') setProyectos(pr.value);
    const fallo = resultados.find((x) => x.status === 'rejected');
    if (fallo) setErrorCarga(fallo.reason?.message || 'No pudimos cargar tu inicio.');
    setCargando(false);
  }, [user?.id]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  // "Ahora mismo" se actualiza en vivo
  useEffect(() => {
    let timer;
    const unsub = subscribeToTablon(() => {
      clearTimeout(timer);
      timer = setTimeout(cargarTablon, 500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [cargarTablon]);

  const ahora = new Date();
  const vigentes = publicaciones.filter((p) => new Date(p.venceEn) > ahora);
  const ahoraMismo = vigentes.filter((p) => p.tipo === 'plan' || p.tipo === 'ayuda');
  const eventos = vigentes
    .filter((p) => p.tipo === 'evento')
    .sort((a, b) => new Date(a.empiezaEn) - new Date(b.empiezaEn))
    .slice(0, 3);
  const talleresHoy = espacios.filter((e) => e.tipo === 'taller' && e.oficial && e.horario && esHoy(e.horario));
  const encuestaPendiente = encuestasBandeja.find((e) => e.estado === 'pendiente');
  const salon = espacios.find((e) => e.tipo === 'carrera_ciclo');
  const carreraEspacio = espacios.find((e) => e.tipo === 'carrera');
  const consultasAbiertas = consultas.filter((c) => c.estado === 'abierto');
  const proyectosAbiertos = proyectos.filter((p) => p.estado === 'abierto' && !p.soyAutor && !p.miPostulacion).slice(0, 4);
  const estado = ESTADOS_EN_VIVO.find((s) => s.id === user?.estadoEnVivo) || null;

  const irAlTablon = (filtro = null) => {
    setTablonFiltro(filtro);
    setActiveTab('tablon');
  };
  const publicarEnTablon = (tipo) => {
    setTablonPublicar(tipo || true);
    setActiveTab('tablon');
  };
  const goToEspacio = (id) => {
    setActiveEspacioId(id);
    setActiveTab('grupos');
  };
  const goToConsulta = (id) => {
    if (carreraEspacio) setActiveEspacioId(carreraEspacio.id);
    setActiveConsultaId(id);
    setActiveTab('grupos');
  };

  const abrirAgregar = (persona) => {
    setMotivo(`Hola, ${persona.nombre}. Soy ${user?.nombre || ''} de ${user?.carrera || 'la UTP'}. Me gustaría conocer gente de otras carreras.`.slice(0, 300));
    setErrorSolicitud('');
    setAgregar(persona);
  };

  const enviarAgregar = async () => {
    setEnviando(true);
    setErrorSolicitud('');
    try {
      await enviarSolicitudMensaje({ aId: agregar.id, motivo: motivo.trim() });
      setEnviadas((l) => [...l, agregar.id]);
      setAgregar(null);
    } catch (err) {
      setErrorSolicitud(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex-1 p-4 pb-6 space-y-5 animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      {/* 1. Saludo con el estado del alumno */}
      <header className="flex items-center gap-3">
        <button onClick={() => setActiveTab('perfil')} className="shrink-0" aria-label="Ir a mi perfil">
          <Avatar persona={{ nombre: user?.nombre, foto_url: user?.fotoUrl }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight truncate">Hola, {user?.nombre || 'compañero'}</h1>
          <button onClick={() => setActiveTab('perfil')} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estado?.color || '#94A3B8' }} />
            <span>{estado ? estado.label : 'Sin estado'}</span>
            <span>· Sede {user?.sede || 'UTP'}</span>
          </button>
        </div>
        <button
          onClick={() => setActiveTab('explorar')}
          className="w-11 h-11 rounded-full bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark flex items-center justify-center text-ink dark:text-ink-light shadow-sm shrink-0"
          aria-label="Buscar compañeros"
          title="Buscar compañeros"
        >
          <Search size={19} />
        </button>
      </header>

      {errorCarga && <ErrorConReintento compacto mensaje={errorCarga} onReintentar={cargarResumen} />}

      {encuestaPendiente && (
        <button
          onClick={() => setActiveTab('encuestas')}
          className="w-full text-left p-3 rounded-2xl bg-brand-primary text-white flex items-center gap-3 shadow-sm"
        >
          <ClipboardList size={20} className="text-teal-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black">Tienes una encuesta por responder</p>
            <p className="text-[11px] text-indigo-200 truncate">{encuestaPendiente.titulo}</p>
          </div>
          <ChevronRight size={18} className="shrink-0" />
        </button>
      )}

      {/* 2. Ahora mismo: planes y ayudas de la sede */}
      <Seccion titulo="Ahora mismo" subtitulo="Planes y pedidos de ayuda en tu sede" accion="Ver todo" onAccion={() => irAlTablon(null)}>
        {cargando && publicaciones.length === 0 ? (
          <div className="h-28 rounded-2xl bg-white/60 dark:bg-surface-cardDark/60 animate-pulse" />
        ) : ahoraMismo.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark flex items-center justify-between gap-3">
            <p className="text-xs text-ink-soft dark:text-ink-muted font-medium">Todavía no hay planes en tu sede. Sé el primero en proponer uno.</p>
            <button
              onClick={() => publicarEnTablon('plan')}
              className="px-3 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl flex items-center gap-1 shrink-0"
            >
              <Plus size={14} />
              <span>Publicar plan</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 scroll-px-4 snap-x snap-mandatory pb-1">
            {ahoraMismo.map((p) => (
              <button
                key={p.id}
                onClick={() => irAlTablon(p.tipo)}
                className="snap-start shrink-0 w-64 text-left p-3.5 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <EtiquetaTipo tipo={p.tipo} />
                  <span className="text-[10px] font-bold text-ink-muted flex items-center gap-1">
                    <Clock size={11} />
                    {textoVence(p.venceEn)}
                  </span>
                </div>
                <p className="text-sm font-black text-ink dark:text-ink-light leading-snug line-clamp-2 min-h-[2.5rem]">{p.titulo}</p>
                <div className="flex items-center justify-between text-[11px] text-ink-muted font-semibold gap-2">
                  <span className="flex items-center gap-1 min-w-0">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{p.lugar || 'Sin lugar'}</span>
                  </span>
                  {p.tipo === 'plan' && (
                    <span className="flex items-center gap-1 shrink-0">
                      <Users size={11} />
                      {p.totalRespuestas}
                      {p.cupo ? `/${p.cupo}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted truncate">
                  {p.esMia ? 'Tu publicación' : `${p.autor.nombre} · ${p.autor.carrera || ''}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </Seccion>

      {/* 3. Próximos eventos y talleres oficiales de hoy */}
      <Seccion titulo="Próximos eventos" accion={eventos.length ? 'Ver eventos' : null} onAccion={() => irAlTablon('evento')}>
        {eventos.length === 0 && talleresHoy.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark flex items-center justify-between gap-3">
            <p className="text-xs text-ink-soft dark:text-ink-muted font-medium">No hay eventos próximos. Comparte uno para que otros se sumen.</p>
            <button onClick={() => publicarEnTablon('evento')} className="px-3 py-2 border border-line dark:border-line-dark text-xs font-bold rounded-xl text-ink dark:text-ink-light shrink-0">
              Publicar evento
            </button>
          </div>
        ) : (
          <div className="k-card rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark divide-y divide-line/70 dark:divide-line-dark">
            {eventos.map((ev) => (
              <button key={ev.id} onClick={() => irAlTablon('evento')} className="w-full text-left flex items-center gap-3 p-3">
                <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex flex-col items-center justify-center shrink-0 leading-none">
                  <span className="text-[10px] font-bold uppercase">{new Date(ev.empiezaEn).toLocaleDateString('es-PE', { month: 'short' }).replace('.', '')}</span>
                  <span className="text-base font-black">{new Date(ev.empiezaEn).getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-ink dark:text-ink-light truncate">{ev.titulo}</p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {textoFecha(ev.empiezaEn)}
                    {ev.lugar ? ` · ${ev.lugar}` : ''}
                  </p>
                </div>
                {ev.totalRespuestas > 0 && <span className="text-[10px] font-bold text-ink-muted shrink-0">{ev.totalRespuestas} asistirán</span>}
              </button>
            ))}
            {talleresHoy.map((t) => (
              <button key={t.id} onClick={() => goToEspacio(t.id)} className="w-full text-left flex items-center gap-3 p-3">
                <div className="w-11 h-11 rounded-xl bg-accent-soft dark:bg-accent-dark/40 text-accent flex items-center justify-center shrink-0">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-ink dark:text-ink-light truncate">{t.nombre}</p>
                  <p className="text-[11px] text-ink-muted truncate">Hoy · {t.horario}</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">Oficial</span>
              </button>
            ))}
          </div>
        )}
      </Seccion>

      {/* 4. Proyectos reales buscando equipo */}
      <Seccion titulo="Proyectos buscando equipo" subtitulo="Hackatones, startups y tesis de tu universidad" accion="Ver todos" onAccion={() => setActiveTab('proyectos')}>
        {proyectosAbiertos.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark flex items-center justify-between gap-3">
            <p className="text-xs text-ink-soft dark:text-ink-muted font-medium">¿Vas a una hackatón o armas una startup? Cuenta qué buscas y te encuentran.</p>
            <button
              onClick={() => setActiveTab('proyectos')}
              className="px-3 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl flex items-center gap-1 shrink-0"
            >
              <Plus size={14} />
              <span>Publicar</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 scroll-px-4 snap-x snap-mandatory pb-1">
            {proyectosAbiertos.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveTab('proyectos')}
                className="snap-start shrink-0 w-64 text-left p-3.5 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark shadow-sm space-y-2"
              >
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary dark:text-teal-300">
                  {tipoProyecto(p.tipo).emoji} {tipoProyecto(p.tipo).label}
                </span>
                <p className="text-sm font-black text-ink dark:text-ink-light leading-snug line-clamp-2">{p.titulo}</p>
                <p className="text-[11px] text-ink-muted line-clamp-2">{p.roles.length ? `Buscan: ${p.roles.join(', ')}` : p.descripcion}</p>
                <p className="text-[11px] font-bold text-accent">
                  {p.cuposLibres} lugar{p.cuposLibres === 1 ? '' : 'es'} libre{p.cuposLibres === 1 ? '' : 's'} · {p.autorNombre}
                </p>
              </button>
            ))}
          </div>
        )}
      </Seccion>

      {/* 5. Dudas de tu carrera */}
      <Seccion titulo={`Dudas de ${user?.carrera || 'tu carrera'}`} subtitulo="Responden alumnos de 5.° ciclo en adelante" accion="Ver dudas" onAccion={() => (carreraEspacio ? goToEspacio(carreraEspacio.id) : setActiveTab('grupos'))}>
        {consultasAbiertas.length === 0 ? (
          <p className="text-xs text-ink-muted bg-white dark:bg-surface-cardDark rounded-2xl p-3.5 border border-line dark:border-line-dark">
            No hay dudas abiertas en tu carrera. Si tienes una sobre un curso, publícala en el espacio de tu carrera.
          </p>
        ) : (
          <div className="space-y-2">
            {consultasAbiertas.slice(0, 2).map((c) => (
              <button
                key={c.id}
                onClick={() => goToConsulta(c.id)}
                className="w-full text-left k-card p-3.5 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-brand-primary dark:text-teal-300 truncate">{c.curso}</span>
                  <span className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                    {c.nAlumnos} {c.nAlumnos === 1 ? 'alumno' : 'alumnos'}
                  </span>
                </div>
                <p className="text-xs font-bold text-ink dark:text-ink-light">{c.tema}</p>
                <p className="text-[11px] text-ink-muted line-clamp-1">"{c.textoResumen}"</p>
              </button>
            ))}
          </div>
        )}
      </Seccion>

      {/* 6. Recién llegados de otras carreras */}
      {recien.length > 0 && (
        <Seccion titulo="Recién llegados" subtitulo="Alumnos nuevos de otras carreras de tu sede" accion="Buscar más" onAccion={() => setActiveTab('explorar')}>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {recien.map((p) => {
              const enviada = enviadas.includes(p.id);
              return (
                <div key={p.id} className="shrink-0 w-36 p-3 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark text-center space-y-1.5">
                  <div className="flex justify-center">
                    <Avatar persona={p} tam="w-14 h-14" texto="text-lg" />
                  </div>
                  <p className="text-xs font-black text-ink dark:text-ink-light truncate">
                    {p.nombre} {p.apellido}
                  </p>
                  <p className="text-[10px] text-ink-muted truncate">
                    {p.carrera}
                    {p.ciclo ? ` · ${p.ciclo}.°` : ''}
                  </p>
                  <button
                    onClick={() => !enviada && abrirAgregar(p)}
                    disabled={enviada}
                    className={`w-full py-1.5 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 ${
                      enviada ? 'bg-slate-100 dark:bg-slate-800 text-ink-muted' : 'bg-brand-primary text-white'
                    }`}
                  >
                    {enviada ? <Check size={12} /> : <UserPlus size={12} />}
                    <span>{enviada ? CONTACTO.solicitudEnviada : CONTACTO.agregar}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </Seccion>
      )}

      {/* 7. Tus grupos */}
      {(salon || carreraEspacio) && (
        <Seccion titulo="Tus grupos" accion="Ver todos" onAccion={() => setActiveTab('grupos')}>
          <div className="grid grid-cols-2 gap-2.5">
            {[salon && { e: salon, etiqueta: 'Tu salón' }, carreraEspacio && { e: carreraEspacio, etiqueta: 'Tu carrera' }]
              .filter(Boolean)
              .map(({ e, etiqueta }) => (
                <button
                  key={e.id}
                  onClick={() => goToEspacio(e.id)}
                  className="text-left p-3 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark flex items-center gap-2.5"
                >
                  {e.portadaUrl ? (
                    <img src={e.portadaUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-brand-primary text-white flex items-center justify-center text-xs font-black shrink-0">
                      {(e.nombre || 'G')[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-ink-muted uppercase">{etiqueta}</p>
                    <p className="text-xs font-black text-ink dark:text-ink-light truncate">{e.nombre}</p>
                  </div>
                </button>
              ))}
          </div>
        </Seccion>
      )}

      {/* PANEL: AGREGAR CONTACTO */}
      <PanelInferior
        abierto={Boolean(agregar)}
        onCerrar={() => setAgregar(null)}
        titulo={agregar ? `${CONTACTO.agregar}: ${agregar.nombre}` : ''}
        subtitulo={CONTACTO.motivoAyuda}
      >
        <div className="space-y-3">
          <label className="text-xs font-bold text-ink dark:text-ink-light block">{CONTACTO.motivoEtiqueta}</label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary resize-none"
          />
          {errorSolicitud && <p className="text-xs text-semantic-danger font-semibold">{errorSolicitud}</p>}
          <button
            onClick={enviarAgregar}
            disabled={enviando || motivo.trim().length < 5}
            className="w-full py-3 bg-brand-primary disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2"
          >
            {enviando ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                <span>{CONTACTO.enviarSolicitud}</span>
                <Send size={14} />
              </>
            )}
          </button>
        </div>
      </PanelInferior>
    </div>
  );
}
