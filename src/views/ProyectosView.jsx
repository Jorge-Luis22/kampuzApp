import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../data/store';
import {
  TIPOS_PROYECTO,
  tipoProyecto,
  fetchProyectos,
  publicarProyecto,
  postularAProyecto,
  fetchPostulaciones,
  responderPostulacion,
  cerrarProyecto
} from '../lib/proyectos';
import ErrorConReintento from '../components/ErrorConReintento';
import PanelInferior from '../components/PanelInferior';
import { ArrowLeft, Plus, Users, CalendarDays, ExternalLink, Loader2, Check, X, MessageCircle, Rocket } from 'lucide-react';

const campo =
  'w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary';
const etiqueta = 'block text-xs font-bold text-ink dark:text-ink-light mb-1';

const ESTADO_POSTULACION = {
  pendiente: { texto: 'Postulación enviada', clase: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200' },
  aceptada: { texto: 'Te aceptaron', clase: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' },
  rechazada: { texto: 'No fue esta vez', clase: 'bg-slate-200 dark:bg-slate-800 text-ink-muted' }
};

function Avatar({ nombre, foto, tam = 'w-8 h-8' }) {
  return foto ? (
    <img src={foto} alt={nombre} className={`${tam} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${tam} rounded-full bg-brand-primary text-white font-black text-xs flex items-center justify-center shrink-0`}>
      {(nombre?.[0] || 'K').toUpperCase()}
    </div>
  );
}

function TarjetaProyecto({ p, onPostular, onVerPostulaciones, onCerrar }) {
  const tipo = tipoProyecto(p.tipo);
  const cerrado = p.estado === 'cerrado';
  const estadoPost = p.miPostulacion ? ESTADO_POSTULACION[p.miPostulacion] : null;

  return (
    <article className={`k-card p-4 rounded-2xl bg-white dark:bg-surface-cardDark border-2 border-line/80 dark:border-line-dark space-y-3 ${cerrado ? 'opacity-75' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary dark:text-teal-300">
          {tipo.emoji} {tipo.label}
        </span>
        <div className="flex items-center gap-1.5">
          {p.soyAutor && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent-soft text-accent">Tuyo</span>}
          {cerrado && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-ink-muted">Cerrado</span>}
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-black text-ink dark:text-ink-light leading-snug">{p.titulo}</h3>
        <p className="text-xs text-ink-soft dark:text-ink-muted font-medium leading-relaxed whitespace-pre-line">{p.descripcion}</p>
      </div>

      {p.roles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.roles.map((r) => (
            <span key={r} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-light">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted font-semibold">
        <span className="flex items-center gap-1">
          <Users size={13} />
          {cerrado ? `Equipo de ${p.integrantes}` : `${p.cuposLibres} de ${p.cupos} lugar${p.cupos === 1 ? '' : 'es'} libre${p.cuposLibres === 1 ? '' : 's'}`}
        </span>
        {p.fechaLimiteTexto && (
          <span className="flex items-center gap-1">
            <CalendarDays size={13} />
            Hasta el {p.fechaLimiteTexto}
          </span>
        )}
        {p.enlace && (
          <a href={p.enlace} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent font-bold">
            <ExternalLink size={13} />
            Más información
          </a>
        )}
      </div>

      <div className="pt-3 border-t border-line dark:border-line-dark flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar nombre={p.autorNombre} foto={p.autorFoto} />
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-ink dark:text-ink-light truncate">{p.autorNombre}</p>
            <p className="text-[11px] text-ink-muted truncate">
              {p.autorCarrera} · Ciclo {p.autorCiclo}
            </p>
          </div>
        </div>

        {p.soyAutor ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onVerPostulaciones(p)}
              className="px-3 py-1.5 bg-brand-primary text-white text-xs font-extrabold rounded-xl flex items-center gap-1"
            >
              <span>Postulaciones</span>
              {p.pendientes > 0 && <span className="bg-white text-brand-primary rounded-full px-1.5 text-[10px] font-black">{p.pendientes}</span>}
            </button>
          </div>
        ) : estadoPost ? (
          <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${estadoPost.clase}`}>{estadoPost.texto}</span>
        ) : !cerrado ? (
          <button
            onClick={() => onPostular(p)}
            className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-extrabold rounded-xl shadow-sm shrink-0 transition"
          >
            Quiero sumarme
          </button>
        ) : null}
      </div>

      {p.soyAutor && !cerrado && (
        <button onClick={() => onCerrar(p)} className="text-[11px] font-bold text-ink-muted hover:text-ink underline underline-offset-2">
          Ya no busco más gente (cerrar proyecto)
        </button>
      )}
    </article>
  );
}

export default function ProyectosView() {
  const { user, setActiveTab } = useStore();

  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [aviso, setAviso] = useState('');

  // Publicar
  const [publicando, setPublicando] = useState(false);
  const [form, setForm] = useState({ tipo: 'hackaton', titulo: '', descripcion: '', roles: '', cupos: 3, fechaLimite: '', enlace: '' });
  const [enviandoPub, setEnviandoPub] = useState(false);
  const [errorPub, setErrorPub] = useState('');

  // Postular
  const [postulandoA, setPostulandoA] = useState(null);
  const [rol, setRol] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviandoPost, setEnviandoPost] = useState(false);
  const [errorPost, setErrorPost] = useState('');

  // Postulaciones recibidas (autor)
  const [revisando, setRevisando] = useState(null);
  const [postulaciones, setPostulaciones] = useState([]);
  const [cargandoPost, setCargandoPost] = useState(false);
  const [errorRev, setErrorRev] = useState('');
  const [respondiendo, setRespondiendo] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setProyectos(await fetchProyectos());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, user?.id]);

  const hayMios = proyectos.some((p) => p.soyAutor || p.miPostulacion);
  const filtros = [{ id: 'todos', label: 'Todos' }, ...(hayMios ? [{ id: 'mios', label: 'Mis proyectos' }] : []), ...TIPOS_PROYECTO.map((t) => ({ id: t.id, label: t.label }))];
  const visibles = proyectos.filter((p) => {
    if (filtro === 'todos') return true;
    if (filtro === 'mios') return p.soyAutor || p.miPostulacion;
    return p.tipo === filtro;
  });

  const abrirPublicar = () => {
    setForm({ tipo: 'hackaton', titulo: '', descripcion: '', roles: '', cupos: 3, fechaLimite: '', enlace: '' });
    setErrorPub('');
    setPublicando(true);
  };

  const enviarPublicar = async (e) => {
    e.preventDefault();
    if (enviandoPub) return;
    setEnviandoPub(true);
    setErrorPub('');
    try {
      await publicarProyecto({
        ...form,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        roles: form.roles.split(',').map((r) => r.trim()).filter(Boolean)
      });
      setPublicando(false);
      setAviso('Tu proyecto ya está publicado. Te avisaremos aquí cuando alguien se postule.');
      setFiltro('todos');
      await cargar();
    } catch (err) {
      setErrorPub(err.message);
    } finally {
      setEnviandoPub(false);
    }
  };

  const abrirPostular = (p) => {
    setPostulandoA(p);
    setRol(p.roles[0] || '');
    setMensaje('');
    setErrorPost('');
  };

  const enviarPostular = async (e) => {
    e.preventDefault();
    if (enviandoPost) return;
    setEnviandoPost(true);
    setErrorPost('');
    try {
      await postularAProyecto({ proyectoId: postulandoA.id, rol, mensaje: mensaje.trim() });
      setPostulandoA(null);
      setAviso('Listo. Avisamos a quien publicó el proyecto; si te acepta, se abre un chat entre ambos.');
      await cargar();
    } catch (err) {
      setErrorPost(err.message);
    } finally {
      setEnviandoPost(false);
    }
  };

  const abrirPostulaciones = async (p) => {
    setRevisando(p);
    setPostulaciones([]);
    setErrorRev('');
    setCargandoPost(true);
    try {
      setPostulaciones(await fetchPostulaciones(p.id));
    } catch (err) {
      setErrorRev(err.message);
    } finally {
      setCargandoPost(false);
    }
  };

  const responder = async (post, aceptar) => {
    setRespondiendo(post.id);
    setErrorRev('');
    try {
      await responderPostulacion(post.id, aceptar);
      setPostulaciones(await fetchPostulaciones(revisando.id));
      await cargar();
      if (aceptar) setAviso(`${post.nombre} ya es parte del equipo. Pueden hablar en Chats.`);
    } catch (err) {
      setErrorRev(err.message);
    } finally {
      setRespondiendo(null);
    }
  };

  const cerrar = async (p) => {
    setError('');
    try {
      await cerrarProyecto(p.id);
      setAviso('Proyecto cerrado. Las postulaciones pendientes quedaron respondidas.');
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const proyectoRevisado = revisando ? proyectos.find((p) => p.id === revisando.id) || revisando : null;

  return (
    <div className="flex-1 p-4 pb-24 space-y-4 animate-fadeIn select-none bg-surface dark:bg-surface-dark min-h-full">
      <button
        onClick={() => setActiveTab('inicio')}
        className="flex items-center gap-1 py-1 -ml-1 text-xs font-bold text-ink-muted hover:text-ink dark:hover:text-ink-light"
        aria-label="Volver al inicio"
      >
        <ArrowLeft size={18} />
        <span>Inicio</span>
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight">Proyectos buscando equipo</h1>
          <p className="text-xs font-semibold text-ink-muted">Hackatones, startups y tesis de alumnos de tu universidad</p>
        </div>
        <button
          onClick={abrirPublicar}
          className="px-3.5 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-sm transition shrink-0"
        >
          <Plus size={15} />
          <span>Publicar</span>
        </button>
      </div>

      {aviso && (
        <div role="status" className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-start justify-between gap-2">
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} aria-label="Cerrar aviso" className="shrink-0 text-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
              filtro === f.id
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-white dark:bg-surface-cardDark text-ink-soft dark:text-ink-muted border border-line dark:border-line-dark shadow-sm'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorConReintento mensaje={error} onReintentar={cargar} />}

      {cargando && proyectos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
          <Loader2 size={24} className="animate-spin text-accent" />
          <p className="text-xs font-semibold">Buscando proyectos...</p>
        </div>
      ) : !error && visibles.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark text-center space-y-3">
          <Rocket size={26} className="mx-auto text-accent" />
          <p className="text-sm font-black text-ink dark:text-ink-light">
            {filtro === 'todos' ? 'Todavía no hay proyectos publicados' : 'No hay proyectos de este tipo'}
          </p>
          <p className="text-xs text-ink-muted max-w-xs mx-auto">
            ¿Vas a una hackatón, armas una startup o necesitas a alguien para tu tesis? Cuenta qué buscas y deja que te encuentren.
          </p>
          <button onClick={abrirPublicar} className="px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl">
            Publicar mi proyecto
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((p) => (
            <TarjetaProyecto key={p.id} p={p} onPostular={abrirPostular} onVerPostulaciones={abrirPostulaciones} onCerrar={cerrar} />
          ))}
        </div>
      )}

      {/* Publicar */}
      <PanelInferior abierto={publicando} onCerrar={() => setPublicando(false)} titulo="Publicar un proyecto" subtitulo="Solo lo ven alumnos de tu universidad. Puedes tener hasta 3 abiertos.">
        <form onSubmit={enviarPublicar} className="space-y-3">
          <div>
            <label className={etiqueta}>Tipo de proyecto</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_PROYECTO.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo: t.id }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    form.tipo === t.id
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-surface dark:bg-surface-dark text-ink dark:text-ink-light border-line dark:border-line-dark'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={etiqueta}>Título</label>
            <input className={campo} maxLength={80} value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Equipo para la Hackatón Perú Innova" required />
          </div>
          <div>
            <label className={etiqueta}>¿De qué trata y qué necesitas?</label>
            <textarea
              rows={4}
              maxLength={800}
              className={`${campo} resize-none font-medium`}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Cuenta la idea, el reto y cómo piensan trabajar..."
              required
            />
            <p className="text-[10px] text-ink-muted mt-1">{form.descripcion.trim().length}/800 · mínimo 20 caracteres</p>
          </div>
          <div>
            <label className={etiqueta}>Perfiles que buscas (separados por coma)</label>
            <input className={campo} value={form.roles} onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))} placeholder="Diseño UX, Marketing, Programación" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={etiqueta}>¿Cuántas personas?</label>
              <input type="number" min={1} max={20} className={campo} value={form.cupos} onChange={(e) => setForm((f) => ({ ...f, cupos: e.target.value }))} required />
            </div>
            <div>
              <label className={etiqueta}>Fecha límite (opcional)</label>
              <input type="date" className={campo} value={form.fechaLimite} onChange={(e) => setForm((f) => ({ ...f, fechaLimite: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={etiqueta}>Enlace con más información (opcional)</label>
            <input className={campo} inputMode="url" value={form.enlace} onChange={(e) => setForm((f) => ({ ...f, enlace: e.target.value }))} placeholder="https://..." />
          </div>
          {errorPub && <ErrorConReintento compacto mensaje={errorPub} />}
          <button
            type="submit"
            disabled={enviandoPub || form.titulo.trim().length < 4 || form.descripcion.trim().length < 20}
            className="w-full py-3 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-40 text-white text-sm font-extrabold rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {enviandoPub && <Loader2 size={15} className="animate-spin" />}
            <span>Publicar proyecto</span>
          </button>
        </form>
      </PanelInferior>

      {/* Postular */}
      <PanelInferior abierto={Boolean(postulandoA)} onCerrar={() => setPostulandoA(null)} titulo="Quiero sumarme" subtitulo={postulandoA?.titulo}>
        <form onSubmit={enviarPostular} className="space-y-3">
          {postulandoA?.roles.length > 0 ? (
            <div>
              <label className={etiqueta}>¿Con qué perfil te sumarías?</label>
              <div className="flex flex-wrap gap-1.5">
                {postulandoA.roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRol(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      rol === r ? 'bg-brand-primary text-white border-brand-primary' : 'bg-surface dark:bg-surface-dark text-ink dark:text-ink-light border-line dark:border-line-dark'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className={etiqueta}>¿Qué aportarías? (opcional)</label>
              <input className={campo} maxLength={40} value={rol} onChange={(e) => setRol(e.target.value)} placeholder="Ej: Análisis de datos" />
            </div>
          )}
          <div>
            <label className={etiqueta}>Cuéntale por qué quieres sumarte</label>
            <textarea
              rows={4}
              maxLength={400}
              className={`${campo} resize-none font-medium`}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Qué sabes hacer, qué has hecho antes y cuánto tiempo tienes..."
              required
            />
            <p className="text-[10px] text-ink-muted mt-1">Solo ve esto quien publicó el proyecto. Puedes tener hasta 5 postulaciones esperando respuesta.</p>
          </div>
          {errorPost && <ErrorConReintento compacto mensaje={errorPost} />}
          <button
            type="submit"
            disabled={enviandoPost || mensaje.trim().length < 10}
            className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-extrabold rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {enviandoPost && <Loader2 size={15} className="animate-spin" />}
            <span>Enviar postulación</span>
          </button>
        </form>
      </PanelInferior>

      {/* Postulaciones recibidas */}
      <PanelInferior
        abierto={Boolean(revisando)}
        onCerrar={() => setRevisando(null)}
        titulo="Postulaciones"
        subtitulo={proyectoRevisado ? `${proyectoRevisado.titulo} · ${proyectoRevisado.integrantes} de ${proyectoRevisado.cupos} en el equipo` : ''}
      >
        {errorRev && <ErrorConReintento compacto mensaje={errorRev} />}
        {cargandoPost ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted py-3">
            <Loader2 size={14} className="animate-spin text-accent" />
            <span>Cargando postulaciones...</span>
          </div>
        ) : postulaciones.length === 0 && !errorRev ? (
          <p className="text-xs text-ink-muted bg-surface dark:bg-surface-dark rounded-xl p-3 border border-line dark:border-line-dark">
            Todavía nadie se postuló. Cuando alguien lo haga, lo verás aquí.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {postulaciones.map((x) => (
              <li key={x.id} className="p-3 rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar nombre={x.nombre} foto={x.foto} tam="w-9 h-9" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-ink dark:text-ink-light truncate">{x.nombre}</p>
                    <p className="text-[11px] text-ink-muted truncate">
                      {x.carrera} · Ciclo {x.ciclo}
                      {x.rol ? ` · ${x.rol}` : ''}
                    </p>
                  </div>
                  {x.estado !== 'pendiente' && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${x.estado === 'aceptada' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-ink-muted'}`}>
                      {x.estado === 'aceptada' ? 'En el equipo' : 'Rechazada'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">"{x.mensaje}"</p>
                {x.estado === 'pendiente' && (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => responder(x, false)}
                      disabled={respondiendo === x.id}
                      className="px-3 py-1.5 text-xs font-bold text-ink-muted rounded-xl border border-line dark:border-line-dark disabled:opacity-50 flex items-center gap-1"
                    >
                      <X size={13} />
                      <span>No por ahora</span>
                    </button>
                    <button
                      onClick={() => responder(x, true)}
                      disabled={respondiendo === x.id}
                      className="px-3 py-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 flex items-center gap-1"
                    >
                      {respondiendo === x.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      <span>Aceptar</span>
                    </button>
                  </div>
                )}
                {x.estado === 'aceptada' && (
                  <button onClick={() => setActiveTab('chats')} className="text-[11px] font-bold text-accent flex items-center gap-1">
                    <MessageCircle size={12} />
                    <span>Hablar en Chats</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelInferior>
    </div>
  );
}
