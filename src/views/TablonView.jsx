import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../data/store';
import {
  TIPOS_PUBLICACION,
  ORDEN_TIPOS,
  FILTROS_TABLON,
  VACIO_TODO,
  LUGARES_SUGERIDOS,
  textoVence,
  textoFecha,
  textoParticipantes,
  formatoPrecio
} from '../data/tablon';
import {
  fetchTablon,
  crearPublicacion,
  cerrarPublicacion,
  sumarme,
  quitarme,
  ofrecerAyuda,
  meInteresa,
  fetchRespuestas,
  reportarPublicacion,
  subirFotoPublicacion,
  subscribeToTablon
} from '../lib/tablon';
import { conversacionCon } from '../lib/chat';
import ChatDirectoModal from '../components/ChatDirectoModal';
import ErrorConReintento from '../components/ErrorConReintento';
import PanelInferior, { OpcionPanel } from '../components/PanelInferior';
import {
  Plus,
  MapPin,
  Clock,
  CalendarDays,
  Loader2,
  MoreVertical,
  ShieldAlert,
  Check,
  ArrowLeft,
  ImagePlus,
  X,
  Users,
  Lock,
  MessageCircle,
  Ban
} from 'lucide-react';

const linea = (p) => [p?.carrera, p?.ciclo ? `${p.ciclo}.°` : null].filter(Boolean).join(' · ');

function AvatarCirculo({ persona, tam = 'w-10 h-10', texto = 'text-sm', borde = '' }) {
  return persona?.foto_url ? (
    <img src={persona.foto_url} alt={persona.nombre || ''} className={`${tam} rounded-full object-cover shrink-0 ${borde}`} />
  ) : (
    <div className={`${tam} rounded-full bg-brand-primary text-white font-black ${texto} flex items-center justify-center shrink-0 ${borde}`}>
      {(persona?.nombre?.[0] || 'K').toUpperCase()}
    </div>
  );
}

export function EtiquetaTipo({ tipo }) {
  const t = TIPOS_PUBLICACION[tipo];
  if (!t) return null;
  const Icono = t.icono;
  return (
    <span className={`inline-flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${t.color}`}>
      <Icono size={11} />
      <span>{t.etiqueta}</span>
    </span>
  );
}

// Hora "HH:MM" de la siguiente media hora (para el plan)
const proximaMediaHora = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (d.getDate() !== new Date().getDate()) return '23:30';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const ahoraLocal = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const FORM_VACIO = {
  titulo: '',
  descripcion: '',
  lugar: '',
  hora: '',
  duracion: '3',
  horasAyuda: '2',
  fechaEvento: '',
  cupo: '',
  precio: '',
  fotoUrl: ''
};

// =============================================================================
// Tarjeta de una publicación
// =============================================================================
function TarjetaPublicacion({ pub, ocupado, onSumarme, onQuitarme, onAyudar, onInteres, onCerrar, onRespuestas, onMenu }) {
  const t = TIPOS_PUBLICACION[pub.tipo];
  const lleno = pub.cupo !== null && pub.totalRespuestas >= pub.cupo;
  const textoGente = textoParticipantes(pub.tipo, pub.participantes, pub.totalRespuestas);

  let accion = null;
  if (!pub.esMia) {
    const base = 'px-4 py-2 text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5 shrink-0 disabled:opacity-60';
    if (pub.tipo === 'plan' || pub.tipo === 'evento') {
      accion = pub.miRespuesta ? (
        <button onClick={() => onQuitarme(pub)} disabled={ocupado} className={`${base} bg-accent-soft dark:bg-accent-dark/50 text-accent dark:text-teal-200 border border-accent/30`} title="Toca para quitarte">
          {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          <span>{t.hecho}</span>
        </button>
      ) : lleno ? (
        <button disabled className={`${base} bg-slate-100 dark:bg-slate-800 text-ink-muted`}>
          <Ban size={13} />
          <span>Sin cupos</span>
        </button>
      ) : (
        <button onClick={() => onSumarme(pub)} disabled={ocupado} className={`${base} bg-brand-primary hover:bg-brand-primaryHover text-white shadow-sm active:scale-95`}>
          {ocupado && <Loader2 size={13} className="animate-spin" />}
          <span>{t.accion}</span>
        </button>
      );
    } else if (pub.tipo === 'ayuda') {
      accion = (
        <button onClick={() => onAyudar(pub)} disabled={ocupado} className={`${base} ${pub.miRespuesta ? 'bg-accent-soft dark:bg-accent-dark/50 text-accent dark:text-teal-200 border border-accent/30' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95'}`}>
          {ocupado ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
          <span>{pub.miRespuesta ? t.hecho : t.accion}</span>
        </button>
      );
    } else {
      accion = pub.miRespuesta ? (
        <button disabled className={`${base} bg-accent-soft dark:bg-accent-dark/50 text-accent dark:text-teal-200 border border-accent/30`}>
          <Check size={13} />
          <span>{t.hecho}</span>
        </button>
      ) : (
        <button onClick={() => onInteres(pub)} disabled={ocupado} className={`${base} bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-95`}>
          <span>{t.accion}</span>
        </button>
      );
    }
  }

  return (
    <article className="k-card p-4 space-y-3 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark">
      <div className="flex items-start gap-3">
        <AvatarCirculo persona={pub.autor} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-ink dark:text-ink-light truncate">
            {pub.esMia ? 'Tú' : `${pub.autor.nombre} ${pub.autor.apellido || ''}`.trim()}
          </p>
          <p className="text-[11px] text-ink-muted truncate">{linea(pub.autor)}</p>
        </div>
        <EtiquetaTipo tipo={pub.tipo} />
        <button onClick={() => onMenu(pub)} className="p-1 -mr-1.5 -mt-0.5 text-ink-muted hover:text-ink dark:hover:text-ink-light rounded-lg" aria-label="Más opciones">
          <MoreVertical size={17} />
        </button>
      </div>

      <div>
        <h3 className="text-[15px] font-black text-ink dark:text-ink-light leading-snug break-words">{pub.titulo}</h3>
        {pub.descripcion && (
          <p className="text-xs text-ink-soft dark:text-ink-muted mt-1 leading-relaxed whitespace-pre-wrap break-words">{pub.descripcion}</p>
        )}
      </div>

      {pub.fotoUrl && (
        <img src={pub.fotoUrl} alt={pub.titulo} className="w-full aspect-[4/3] object-cover rounded-xl border border-line dark:border-line-dark" />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-ink-muted">
        {pub.lugar && (
          <span className="flex items-center space-x-1 min-w-0">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{pub.lugar}</span>
          </span>
        )}
        {pub.tipo === 'evento' ? (
          <span className="flex items-center space-x-1 text-teal-700 dark:text-teal-300">
            <CalendarDays size={12} />
            <span>{textoFecha(pub.empiezaEn)}</span>
          </span>
        ) : (
          <span className="flex items-center space-x-1">
            <Clock size={12} />
            <span>
              {pub.tipo === 'plan' && pub.empiezaEn && new Date(pub.empiezaEn) > new Date() ? `${textoFecha(pub.empiezaEn)} · ` : ''}
              {textoVence(pub.venceEn)}
            </span>
          </span>
        )}
        {pub.tipo === 'mercadito' && pub.precio !== null && (
          <span className="text-rose-700 dark:text-rose-300 font-black">{formatoPrecio(pub.precio)}</span>
        )}
        {pub.cupo !== null && (
          <span className="flex items-center space-x-1">
            <Users size={12} />
            <span>
              {pub.totalRespuestas}/{pub.cupo} cupos
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-line/70 dark:border-line-dark">
        <div className="flex items-center min-w-0 gap-2">
          {pub.participantes.length > 0 && (
            <div className="flex -space-x-2 shrink-0">
              {pub.participantes.slice(0, 3).map((p) => (
                <AvatarCirculo key={p.id} persona={p} tam="w-6 h-6" texto="text-[10px]" borde="border-2 border-white dark:border-surface-cardDark" />
              ))}
            </div>
          )}
          <span className="text-[11px] font-semibold text-ink-muted truncate">
            {textoGente ||
              (pub.esMia && pub.totalRespuestas
                ? `${pub.totalRespuestas} ${pub.totalRespuestas === 1 ? 'respuesta' : 'respuestas'}`
                : pub.tipo === 'plan' || pub.tipo === 'evento'
                ? 'Sé el primero en sumarte'
                : '')}
          </span>
        </div>
        {pub.esMia ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onRespuestas(pub)} className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-ink dark:text-ink-light">
              Ver respuestas{pub.totalRespuestas ? ` (${pub.totalRespuestas})` : ''}
            </button>
            <button onClick={() => onCerrar(pub)} className="px-3 py-2 text-xs font-bold rounded-xl border border-line dark:border-line-dark text-ink-muted">
              Cerrar
            </button>
          </div>
        ) : (
          accion
        )}
      </div>
    </article>
  );
}

// =============================================================================
// Vista
// =============================================================================
export default function TablonView() {
  const { user, tablonFiltro, setTablonFiltro, tablonPublicar, setTablonPublicar } = useStore();

  const [filtro, setFiltro] = useState(tablonFiltro ?? null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null); // { texto, tipo: 'ok' | 'error', accion? }
  const [ocupadoId, setOcupadoId] = useState(null);
  const [, setReloj] = useState(0);

  // Publicar
  const [publicar, setPublicar] = useState({ abierto: false, tipo: null });
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoRef = useRef(null);

  // Paneles
  const [menuPub, setMenuPub] = useState(null);
  const [interesPub, setInteresPub] = useState(null);
  const [motivoInteres, setMotivoInteres] = useState('');
  const [respuestasPub, setRespuestasPub] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [cargandoRespuestas, setCargandoRespuestas] = useState(false);
  const [cerrarPub, setCerrarPub] = useState(null);
  const [reportePub, setReportePub] = useState(null);
  const [reporteMotivo, setReporteMotivo] = useState('Contenido inapropiado o spam');
  const [reporteDetalle, setReporteDetalle] = useState('');
  const [chat, setChat] = useState(null);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!silencioso) setCargando(true);
      setError('');
      try {
        setPublicaciones(await fetchTablon(filtro));
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    },
    [filtro]
  );

  useEffect(() => {
    cargar();
  }, [cargar, user?.id]);

  // En vivo: publicaciones nuevas y "¡Voy!" de otros (se agrupan los avisos seguidos)
  useEffect(() => {
    let timer;
    const unsub = subscribeToTablon(() => {
      clearTimeout(timer);
      timer = setTimeout(() => cargar({ silencioso: true }), 400);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [cargar]);

  // Cada minuto se actualiza "vence en..." y desaparecen las vencidas
  useEffect(() => {
    const t = setInterval(() => setReloj((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Pedidos desde el Inicio: abrir con un filtro o con el panel de publicar
  useEffect(() => {
    if (tablonFiltro !== undefined && tablonFiltro !== null) {
      setFiltro(tablonFiltro);
      setTablonFiltro?.(null);
    }
  }, [tablonFiltro, setTablonFiltro]);
  useEffect(() => {
    if (tablonPublicar) {
      abrirPublicar(tablonPublicar === true ? null : tablonPublicar);
      setTablonPublicar?.(null);
    }
  }, [tablonPublicar, setTablonPublicar]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), aviso.accion ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  const visibles = publicaciones.filter((p) => new Date(p.venceEn) > new Date());

  // --- Acciones ---
  const conAccion = async (pub, fn) => {
    setOcupadoId(pub.id);
    try {
      await fn();
      await cargar({ silencioso: true });
    } catch (err) {
      setAviso({ texto: err.message, tipo: 'error' });
      cargar({ silencioso: true });
    } finally {
      setOcupadoId(null);
    }
  };

  const handleSumarme = (pub) => conAccion(pub, () => sumarme(pub.id));
  const handleQuitarme = (pub) => conAccion(pub, () => quitarme(pub.id));

  const handleAyudar = (pub) =>
    conAccion(pub, async () => {
      const conversacionId = await ofrecerAyuda(pub.id);
      setChat({ conversacionId, otherUser: pub.autor, origen: 'ayuda', publicacionTitulo: pub.titulo });
    });

  const abrirInteres = (pub) => {
    setMotivoInteres(`Hola, me interesa tu publicación "${pub.titulo}". ¿Sigue disponible?`.slice(0, 300));
    setInteresPub(pub);
  };

  const enviarInteres = async () => {
    const pub = interesPub;
    setInteresPub(null);
    await conAccion(pub, async () => {
      const r = await meInteresa(pub.id, motivoInteres.trim());
      const nombre = pub.autor.nombre;
      if (r === 'solicitud_enviada') {
        setAviso({ texto: `Le enviamos tu solicitud a ${nombre}. Podrán chatear cuando la acepte.`, tipo: 'ok' });
      } else if (r === 'contacto') {
        setAviso({
          texto: `${nombre} ya es tu contacto. Escríbele por el chat.`,
          tipo: 'ok',
          accion: { texto: 'Chatear', fn: () => abrirChatContacto(pub.autor) }
        });
      } else if (r === 'solicitud_pendiente') {
        setAviso({ texto: `Ya hay una solicitud pendiente entre tú y ${nombre}. Revisa Chats → Solicitudes.`, tipo: 'ok' });
      } else {
        setAviso({ texto: 'Registramos tu interés.', tipo: 'ok' });
      }
    });
  };

  const abrirChatContacto = async (persona) => {
    try {
      const id = await conversacionCon(persona.id);
      if (id) setChat({ conversacionId: id, otherUser: persona });
    } catch (err) {
      setAviso({ texto: err.message, tipo: 'error' });
    }
  };

  const verRespuestas = async (pub) => {
    setRespuestasPub(pub);
    setRespuestas([]);
    setCargandoRespuestas(true);
    try {
      setRespuestas(await fetchRespuestas(pub.id));
    } catch (err) {
      setAviso({ texto: err.message, tipo: 'error' });
      setRespuestasPub(null);
    } finally {
      setCargandoRespuestas(false);
    }
  };

  const confirmarCerrar = async () => {
    const pub = cerrarPub;
    setCerrarPub(null);
    await conAccion(pub, () => cerrarPublicacion(pub.id));
    setAviso({ texto: 'Cerraste la publicación. Ya no aparece en el tablón.', tipo: 'ok' });
  };

  const enviarReporte = async () => {
    const pub = reportePub;
    if (!reporteDetalle.trim()) return;
    setReportePub(null);
    try {
      await reportarPublicacion(pub.id, `${reporteMotivo}: ${reporteDetalle.trim()}`);
      setReporteDetalle('');
      setAviso({ texto: 'Reporte enviado. El equipo de moderación lo revisará.', tipo: 'ok' });
    } catch (err) {
      setAviso({ texto: err.message, tipo: 'error' });
    }
  };

  // --- Publicar ---
  function abrirPublicar(tipo = null) {
    setForm({ ...FORM_VACIO, hora: proximaMediaHora() });
    setErrorForm('');
    setPublicar({ abierto: true, tipo });
  }

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendoFoto(true);
    setErrorForm('');
    try {
      const url = await subirFotoPublicacion(file);
      setForm((f) => ({ ...f, fotoUrl: url }));
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handlePublicar = async (e) => {
    e.preventDefault();
    const tipo = publicar.tipo;
    if (form.titulo.trim().length < 3) {
      setErrorForm('Escribe un título de al menos 3 caracteres.');
      return;
    }
    const ahora = new Date();
    let empiezaEn = null;
    let venceEn = null;
    if (tipo === 'plan') {
      const [h, m] = (form.hora || proximaMediaHora()).split(':').map(Number);
      const inicio = new Date();
      inicio.setHours(h, m, 0, 0);
      empiezaEn = (inicio < ahora ? ahora : inicio).toISOString();
      let fin;
      if (form.duracion === 'fin') {
        fin = new Date();
        fin.setHours(23, 59, 0, 0);
      } else {
        fin = new Date(ahora.getTime() + Number(form.duracion) * 3600000);
      }
      if (inicio > fin) fin = new Date(inicio.getTime() + 3600000);
      venceEn = fin.toISOString();
    } else if (tipo === 'ayuda') {
      venceEn = new Date(ahora.getTime() + Number(form.horasAyuda) * 3600000).toISOString();
    } else if (tipo === 'evento') {
      if (!form.fechaEvento) {
        setErrorForm('Indica la fecha y hora del evento.');
        return;
      }
      empiezaEn = new Date(form.fechaEvento).toISOString();
    }

    setEnviando(true);
    setErrorForm('');
    try {
      await crearPublicacion({
        tipo,
        titulo: form.titulo,
        descripcion: form.descripcion,
        lugar: form.lugar,
        empiezaEn,
        venceEn,
        cupo: tipo === 'plan' || tipo === 'evento' ? form.cupo : null,
        precio: tipo === 'mercadito' ? form.precio : null,
        fotoUrl: tipo === 'evento' || tipo === 'mercadito' ? form.fotoUrl : null
      });
      setPublicar({ abierto: false, tipo: null });
      if (filtro && filtro !== tipo) setFiltro(null);
      else cargar({ silencioso: true });
      setAviso({ texto: '¡Publicado! Ya aparece en el tablón de tu sede.', tipo: 'ok' });
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const tipoForm = publicar.tipo ? TIPOS_PUBLICACION[publicar.tipo] : null;
  const vacioTexto = filtro ? TIPOS_PUBLICACION[filtro].vacio : VACIO_TODO;
  const vacioBoton = filtro ? TIPOS_PUBLICACION[filtro].publicar : 'Publicar';

  return (
    <div className="min-h-full flex flex-col p-4 pb-4 space-y-4 animate-fadeIn select-none bg-surface dark:bg-surface-dark">
      <header>
        <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight">Pasando hoy</h1>
        <p className="text-xs text-ink-muted font-medium">
          Planes, ayuda, eventos y mercadito de {user?.sede ? `la sede ${user.sede}` : 'tu sede'}.
        </p>
      </header>

      {/* Filtros en chips (scroll horizontal sin barra) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {FILTROS_TABLON.map((f) => (
          <button
            key={f.etiqueta}
            onClick={() => setFiltro(f.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border shrink-0 transition ${
              filtro === f.id
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light border-line dark:border-line-dark'
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {aviso && (
        <div
          role="status"
          className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 border ${
            aviso.tipo === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <span className="flex-1">{aviso.texto}</span>
          {aviso.accion && (
            <button onClick={() => { aviso.accion.fn(); setAviso(null); }} className="font-black underline shrink-0">
              {aviso.accion.texto}
            </button>
          )}
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0 opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-2">
          <Loader2 size={24} className="animate-spin text-accent" />
          <p className="text-xs font-medium">Cargando lo que pasa en tu sede...</p>
        </div>
      ) : error ? (
        <ErrorConReintento mensaje={error} onReintentar={() => cargar()} />
      ) : visibles.length === 0 ? (
        <div className="text-center py-10 px-5 bg-white dark:bg-surface-cardDark rounded-2xl border border-line dark:border-line-dark space-y-3">
          <p className="text-sm font-bold text-ink dark:text-ink-light">{vacioTexto}</p>
          <button
            onClick={() => abrirPublicar(filtro)}
            className="px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>{vacioBoton}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((pub) => (
            <TarjetaPublicacion
              key={pub.id}
              pub={pub}
              ocupado={ocupadoId === pub.id}
              onSumarme={handleSumarme}
              onQuitarme={handleQuitarme}
              onAyudar={handleAyudar}
              onInteres={abrirInteres}
              onCerrar={setCerrarPub}
              onRespuestas={verRespuestas}
              onMenu={setMenuPub}
            />
          ))}
        </div>
      )}

      {/* Botón flotante: queda pegado abajo mientras se desplaza la lista */}
      <div className="mt-auto sticky bottom-4 flex justify-end pointer-events-none !mb-0">
        <button
          onClick={() => abrirPublicar(null)}
          className="pointer-events-auto px-5 py-3 bg-accent hover:bg-accent-hover text-white text-sm font-black rounded-full shadow-elevated flex items-center gap-1.5 active:scale-95 transition"
        >
          <Plus size={18} />
          <span>Publicar</span>
        </button>
      </div>

      {/* --- PANEL: PUBLICAR --- */}
      <PanelInferior
        abierto={publicar.abierto}
        onCerrar={() => setPublicar({ abierto: false, tipo: null })}
        titulo={tipoForm ? tipoForm.publicar : '¿Qué quieres publicar?'}
        subtitulo={tipoForm ? null : 'Se verá en el tablón de tu sede.'}
      >
        {!tipoForm ? (
          <div className="grid grid-cols-2 gap-2.5">
            {ORDEN_TIPOS.map((id) => {
              const t = TIPOS_PUBLICACION[id];
              const Icono = t.icono;
              return (
                <button
                  key={id}
                  onClick={() => setPublicar({ abierto: true, tipo: id })}
                  className={`text-left p-4 rounded-2xl border-2 ${t.color} active:scale-[0.98] transition`}
                >
                  <Icono size={26} />
                  <p className="text-sm font-black mt-2">{t.etiqueta}</p>
                  <p className="text-[11px] font-medium opacity-80 leading-snug">{t.descripcion}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handlePublicar} className="space-y-3.5">
            <button type="button" onClick={() => setPublicar({ abierto: true, tipo: null })} className="text-xs font-bold text-ink-muted flex items-center gap-1">
              <ArrowLeft size={14} />
              <span>Cambiar tipo</span>
            </button>

            <label className="block">
              <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Título</span>
              <input
                value={form.titulo}
                onChange={cambiar('titulo')}
                maxLength={80}
                placeholder={tipoForm.placeholder}
                className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
              />
              <span className="text-[10px] text-ink-muted">{form.titulo.length}/80</span>
            </label>

            {publicar.tipo !== 'plan' && (
              <label className="block">
                <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Descripción <span className="font-medium text-ink-muted">(opcional)</span>
                </span>
                <textarea
                  rows={2}
                  value={form.descripcion}
                  onChange={cambiar('descripcion')}
                  maxLength={500}
                  placeholder={publicar.tipo === 'mercadito' ? 'Estado, talla, cómo coordinar la entrega...' : 'Agrega detalles si hace falta'}
                  className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary resize-none"
                />
              </label>
            )}

            <div>
              <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                {publicar.tipo === 'mercadito' ? 'Punto de entrega' : 'Lugar'} <span className="font-medium text-ink-muted">{publicar.tipo === 'mercadito' ? '(opcional)' : ''}</span>
              </span>
              <input
                value={form.lugar}
                onChange={cambiar('lugar')}
                maxLength={80}
                placeholder="Ej.: Biblioteca, 2.° piso"
                className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
              />
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1.5 -mx-4 px-4">
                {LUGARES_SUGERIDOS.map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setForm((f) => ({ ...f, lugar: l }))}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                      form.lugar === l ? 'bg-brand-primary text-white border-brand-primary' : 'border-line dark:border-line-dark text-ink-muted'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {publicar.tipo === 'plan' && (
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Hora</span>
                  <input
                    type="time"
                    value={form.hora}
                    onChange={cambiar('hora')}
                    className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                    Cupo <span className="font-medium text-ink-muted">(opcional)</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    inputMode="numeric"
                    value={form.cupo}
                    onChange={cambiar('cupo')}
                    placeholder="Sin límite"
                    className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light"
                  />
                </label>
                <div className="col-span-2">
                  <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Se oculta</span>
                  <div className="flex gap-1.5">
                    {[
                      ['1', 'En 1 h'],
                      ['3', 'En 3 h'],
                      ['fin', 'Al final del día']
                    ].map(([v, txt]) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setForm((f) => ({ ...f, duracion: v }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                          form.duracion === v ? 'bg-brand-primary text-white border-brand-primary' : 'border-line dark:border-line-dark text-ink-muted'
                        }`}
                      >
                        {txt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {publicar.tipo === 'ayuda' && (
              <div>
                <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Se oculta</span>
                <div className="flex gap-1.5">
                  {[
                    ['1', 'En 1 h'],
                    ['2', 'En 2 h'],
                    ['4', 'En 4 h']
                  ].map(([v, txt]) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setForm((f) => ({ ...f, horasAyuda: v }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                        form.horasAyuda === v ? 'bg-brand-primary text-white border-brand-primary' : 'border-line dark:border-line-dark text-ink-muted'
                      }`}
                    >
                      {txt}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-ink-muted mt-1.5">Quien toque "Yo te ayudo" podrá escribirte por chat, solo por esta publicación.</p>
              </div>
            )}

            {publicar.tipo === 'evento' && (
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block col-span-2">
                  <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={form.fechaEvento}
                    min={ahoraLocal()}
                    onChange={cambiar('fechaEvento')}
                    className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                    Cupo <span className="font-medium text-ink-muted">(opcional)</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    inputMode="numeric"
                    value={form.cupo}
                    onChange={cambiar('cupo')}
                    placeholder="Sin límite"
                    className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light"
                  />
                </label>
              </div>
            )}

            {publicar.tipo === 'mercadito' && (
              <label className="block">
                <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Precio en soles <span className="font-medium text-ink-muted">(opcional)</span>
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={form.precio}
                  onChange={cambiar('precio')}
                  placeholder="Ej.: 15"
                  className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light"
                />
                <p className="text-[11px] text-ink-muted mt-1.5">
                  Kampuz no permite ofrecer ayuda para hacer trampa en evaluaciones. Puedes ofrecer tutorías o apuntes propios.
                </p>
              </label>
            )}

            {(publicar.tipo === 'evento' || publicar.tipo === 'mercadito') && (
              <div>
                <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
                {form.fotoUrl ? (
                  <div className="relative">
                    <img src={form.fotoUrl} alt="Foto de la publicación" className="w-full aspect-[4/3] object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, fotoUrl: '' }))}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
                      aria-label="Quitar foto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fotoRef.current?.click()}
                    disabled={subiendoFoto}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-line dark:border-line-dark text-xs font-bold text-ink-muted flex items-center justify-center gap-2"
                  >
                    {subiendoFoto ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                    <span>{subiendoFoto ? 'Subiendo foto...' : 'Agregar foto (opcional)'}</span>
                  </button>
                )}
              </div>
            )}

            {errorForm && (
              <p className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {errorForm}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando || subiendoFoto}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <span>Publicar</span>}
            </button>
          </form>
        )}
      </PanelInferior>

      {/* --- PANEL: MENÚ ⋮ --- */}
      <PanelInferior abierto={Boolean(menuPub)} onCerrar={() => setMenuPub(null)} titulo={menuPub?.titulo}>
        {menuPub && (
          <div className="space-y-1">
            {menuPub.esMia ? (
              <>
                <OpcionPanel icono={Users} texto="Ver quiénes respondieron" onClick={() => { const p = menuPub; setMenuPub(null); verRespuestas(p); }} />
                <OpcionPanel icono={Lock} texto="Cerrar publicación" detalle="Deja de aparecer en el tablón" peligro onClick={() => { const p = menuPub; setMenuPub(null); setCerrarPub(p); }} />
              </>
            ) : (
              <OpcionPanel
                icono={ShieldAlert}
                texto="Reportar publicación"
                detalle="Avisar a moderación"
                peligro
                onClick={() => {
                  const p = menuPub;
                  setMenuPub(null);
                  setReporteDetalle('');
                  setReportePub(p);
                }}
              />
            )}
          </div>
        )}
      </PanelInferior>

      {/* --- PANEL: ME INTERESA --- */}
      <PanelInferior
        abierto={Boolean(interesPub)}
        onCerrar={() => setInteresPub(null)}
        titulo="Me interesa"
        subtitulo={interesPub ? `Le enviaremos una solicitud de mensaje a ${interesPub.autor.nombre} con este motivo.` : ''}
      >
        <div className="space-y-3">
          <textarea
            rows={3}
            value={motivoInteres}
            onChange={(e) => setMotivoInteres(e.target.value)}
            maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary resize-none"
          />
          <button
            onClick={enviarInteres}
            disabled={motivoInteres.trim().length < 5}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl"
          >
            Enviar solicitud
          </button>
        </div>
      </PanelInferior>

      {/* --- PANEL: QUIÉNES RESPONDIERON --- */}
      <PanelInferior
        abierto={Boolean(respuestasPub)}
        onCerrar={() => setRespuestasPub(null)}
        titulo="Quiénes respondieron"
        subtitulo={respuestasPub?.titulo}
      >
        {cargandoRespuestas ? (
          <div className="flex justify-center py-6 text-ink-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : respuestas.length === 0 ? (
          <p className="text-xs text-ink-muted text-center py-6">Todavía nadie respondió.</p>
        ) : (
          <div className="divide-y divide-line/70 dark:divide-line-dark">
            {respuestas.map((r) => (
              <div key={r.usuario_id} className="flex items-center gap-3 py-2.5">
                <AvatarCirculo persona={r} tam="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-ink dark:text-ink-light truncate">
                    {r.nombre} {r.apellido}
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">{linea(r)}</p>
                </div>
                <span className="text-[10px] text-ink-muted shrink-0">{textoFecha(r.creado_en)}</span>
              </div>
            ))}
            {respuestasPub?.tipo === 'mercadito' && (
              <p className="text-[11px] text-ink-muted pt-3">Las solicitudes de mensaje te llegan a Chats → Solicitudes.</p>
            )}
            {respuestasPub?.tipo === 'ayuda' && (
              <p className="text-[11px] text-ink-muted pt-3">Quienes ofrecieron ayuda pueden escribirte desde Chats.</p>
            )}
          </div>
        )}
      </PanelInferior>

      {/* --- PANEL: CONFIRMAR CERRAR --- */}
      <PanelInferior abierto={Boolean(cerrarPub)} onCerrar={() => setCerrarPub(null)} titulo="¿Cerrar esta publicación?" subtitulo="Dejará de aparecer en el tablón. No se puede volver a abrir.">
        <div className="flex gap-2">
          <button onClick={() => setCerrarPub(null)} className="flex-1 py-2.5 text-xs font-bold text-ink-muted bg-slate-100 dark:bg-slate-800 rounded-xl">
            Cancelar
          </button>
          <button onClick={confirmarCerrar} className="flex-1 py-2.5 text-xs font-extrabold text-white bg-semantic-danger rounded-xl">
            Sí, cerrar
          </button>
        </div>
      </PanelInferior>

      {/* --- PANEL: REPORTAR --- */}
      <PanelInferior abierto={Boolean(reportePub)} onCerrar={() => setReportePub(null)} titulo="Reportar publicación" subtitulo={reportePub?.titulo}>
        <div className="space-y-3">
          <select
            value={reporteMotivo}
            onChange={(e) => setReporteMotivo(e.target.value)}
            className="w-full p-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs font-bold text-ink dark:text-ink-light"
          >
            <option>Contenido inapropiado o spam</option>
            <option>Ofrece hacer trampa en evaluaciones</option>
            <option>Venta de algo prohibido</option>
            <option>Acoso o lenguaje ofensivo</option>
            <option>Otro motivo</option>
          </select>
          <textarea
            rows={3}
            value={reporteDetalle}
            onChange={(e) => setReporteDetalle(e.target.value)}
            placeholder="Describe brevemente el problema..."
            className="w-full p-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-xs text-ink dark:text-ink-light resize-none"
          />
          <button
            onClick={enviarReporte}
            disabled={!reporteDetalle.trim()}
            className="w-full py-2.5 bg-semantic-danger disabled:opacity-50 text-white text-xs font-extrabold rounded-xl"
          >
            Enviar reporte
          </button>
        </div>
      </PanelInferior>

      {chat && (
        <ChatDirectoModal
          conversacionId={chat.conversacionId}
          otherUser={chat.otherUser}
          origen={chat.origen}
          publicacionTitulo={chat.publicacionTitulo}
          currentUser={user}
          onClose={() => setChat(null)}
          onUserBlocked={() => {
            setChat(null);
            cargar({ silencioso: true });
          }}
        />
      )}
    </div>
  );
}
