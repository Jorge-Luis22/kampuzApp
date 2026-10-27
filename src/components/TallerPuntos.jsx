import React, { useState, useEffect, useCallback } from 'react';
import { Award, CheckCircle2, GraduationCap, Loader2, Plus, X } from 'lucide-react';
import ErrorConReintento from './ErrorConReintento';
import { fetchMiembrosTaller, entregarConstancias, crearTallerOficial } from '../lib/spaces';

const fechaLarga = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Etiqueta corta para las tarjetas de la lista: "+20 pts · Inteligencia artificial"
export function EtiquetaPuntosTaller({ info }) {
  if (!info?.habilidad) return null;
  return (
    <div className="flex items-center space-x-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
      <GraduationCap size={12} className="shrink-0" />
      <span className="truncate">
        {info.constanciaEn ? `Constancia · ${info.habilidad}` : `+${info.puntos} pts · ${info.habilidad}`}
      </span>
    </div>
  );
}

// Franja dentro del taller: qué gana el alumno y, para quien gestiona, el botón de constancias.
export function BannerPuntosTaller({ espacio, info, esMiembro, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  if (!info?.habilidad && !info?.puedoGestionar) return null;

  return (
    <>
      <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between gap-3">
        <div className="flex items-start space-x-2 text-xs text-emerald-900 dark:text-emerald-200 font-semibold min-w-0">
          {info.constanciaEn ? (
            <>
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>
                Constancia entregada el {fechaLarga(info.constanciaEn)}. Sumaste {info.puntos} puntos en {info.habilidad}.
              </span>
            </>
          ) : info.habilidad ? (
            <>
              <Award size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>
                {esMiembro
                  ? `Al terminar el taller recibes tu constancia y ${info.puntos} puntos en ${info.habilidad}.`
                  : `Únete y, al terminar, recibes tu constancia y ${info.puntos} puntos en ${info.habilidad}.`}
              </span>
            </>
          ) : (
            <span>Este taller todavía no otorga puntos de habilidad.</span>
          )}
        </div>
        {info.puedoGestionar && info.habilidad && (
          <button
            onClick={() => setAbierto(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm shrink-0 transition"
          >
            Entregar constancias
          </button>
        )}
      </div>
      {abierto && (
        <ModalConstancias
          espacio={espacio}
          info={info}
          onClose={() => setAbierto(false)}
          onEntregadas={() => {
            onCambio?.();
          }}
        />
      )}
    </>
  );
}

function ModalConstancias({ espacio, info, onClose, onEntregadas }) {
  const [miembros, setMiembros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [elegidos, setElegidos] = useState(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setMiembros(await fetchMiembrosTaller(espacio.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [espacio.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = miembros.filter((m) => !m.constanciaEn);
  const alternar = (id) =>
    setElegidos((prev) => {
      const copia = new Set(prev);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });

  const entregar = async () => {
    if (!elegidos.size || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const n = await entregarConstancias(espacio.id, [...elegidos]);
      setResultado(n);
      setElegidos(new Set());
      onEntregadas?.();
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 !m-0 bg-black/60 z-50 flex items-center justify-center px-4 safe-overlay">
      <div className="w-full max-w-sm max-h-full overflow-y-auto bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5 animate-fadeIn">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-black text-ink dark:text-ink-light">Constancias · {espacio.nombre}</h3>
            <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed mt-1">
              Marca a quienes terminaron el taller. Cada uno recibe su constancia y {info.puntos} puntos en {info.habilidad}. Se entrega una sola vez por alumno.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink p-1">
            <X size={18} />
          </button>
        </div>

        {error && <ErrorConReintento compacto mensaje={error} onReintentar={cargar} />}

        {cargando ? (
          <div className="flex items-center space-x-2 text-xs text-ink-muted py-3">
            <Loader2 size={14} className="animate-spin text-accent" />
            <span>Cargando inscritos...</span>
          </div>
        ) : miembros.length === 0 ? (
          <p className="text-xs text-ink-muted bg-surface dark:bg-surface-dark rounded-xl p-3 border border-line dark:border-line-dark">
            Todavía no hay alumnos inscritos en este taller.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs font-bold text-ink-muted">
              <span>{pendientes.length} sin constancia</span>
              {pendientes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setElegidos(elegidos.size === pendientes.length ? new Set() : new Set(pendientes.map((m) => m.id)))}
                  className="text-brand-primary"
                >
                  {elegidos.size === pendientes.length ? 'Quitar todos' : 'Marcar todos'}
                </button>
              )}
            </div>
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {miembros.map((m) => (
                <li key={m.id}>
                  <label
                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs ${
                      m.constanciaEn
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={Boolean(m.constanciaEn)}
                      checked={Boolean(m.constanciaEn) || elegidos.has(m.id)}
                      onChange={() => alternar(m.id)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-extrabold text-ink dark:text-ink-light truncate">{m.nombre}</span>
                      <span className="block text-ink-muted font-medium truncate">
                        {m.carrera} · Ciclo {m.ciclo} · {m.mensajes} mensaje{m.mensajes === 1 ? '' : 's'}
                      </span>
                    </span>
                    {m.constanciaEn && <span className="text-emerald-700 dark:text-emerald-300 font-bold shrink-0">Entregada</span>}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {resultado !== null && (
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {resultado === 0 ? 'No había nuevas constancias que entregar.' : `Se entregaron ${resultado} constancia${resultado === 1 ? '' : 's'}.`}
          </p>
        )}

        <div className="flex items-center justify-end space-x-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink">
            Cerrar
          </button>
          <button
            type="button"
            onClick={entregar}
            disabled={!elegidos.size || enviando}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
          >
            {enviando && <Loader2 size={13} className="animate-spin" />}
            <span>{elegidos.size ? `Entregar a ${elegidos.size}` : 'Entregar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Botón + formulario para que el personal de la UTP cree un taller que da puntos.
export function CrearTallerBoton({ onCreado }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
      >
        <Plus size={15} />
        <span>Crear taller</span>
      </button>
      {abierto && (
        <ModalCrearTaller
          onClose={() => setAbierto(false)}
          onCreado={(id) => {
            setAbierto(false);
            onCreado?.(id);
          }}
        />
      )}
    </>
  );
}

function ModalCrearTaller({ onClose, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [horario, setHorario] = useState('');
  const [link, setLink] = useState('');
  const [habilidad, setHabilidad] = useState('');
  const [puntos, setPuntos] = useState(20);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    try {
      const id = await crearTallerOficial({ nombre, descripcion, horario, link, habilidad, puntos });
      onCreado?.(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const campo = 'w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary';
  const etiqueta = 'block text-xs font-bold text-ink dark:text-ink-light mb-1';

  return (
    <div className="fixed inset-0 !m-0 bg-black/60 z-50 flex items-center justify-center px-4 safe-overlay">
      <div className="w-full max-w-sm max-h-full overflow-y-auto bg-white dark:bg-surface-cardDark rounded-3xl p-5 shadow-modal border border-line dark:border-line-dark space-y-3.5 animate-fadeIn">
        <h3 className="text-sm font-black text-ink dark:text-ink-light">Crear un taller oficial</h3>
        <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
          Los alumnos que lo terminen reciben una constancia y puntos en la habilidad que elijas. Tú decides a quién se la entregas.
        </p>
        <form onSubmit={enviar} className="space-y-3">
          <div>
            <label className={etiqueta}>Nombre del taller</label>
            <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Taller de Liderazgo" required />
          </div>
          <div>
            <label className={etiqueta}>Descripción</label>
            <textarea
              rows={2}
              className={`${campo} resize-none font-medium`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="De qué trata y a quién va dirigido..."
            />
          </div>
          <div>
            <label className={etiqueta}>Horario</label>
            <input className={campo} value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ej: Miércoles 18:00 (Aula 301)" />
          </div>
          <div>
            <label className={etiqueta}>Enlace de inscripción (opcional)</label>
            <input className={campo} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." inputMode="url" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={etiqueta}>Habilidad que da</label>
              <input className={campo} value={habilidad} onChange={(e) => setHabilidad(e.target.value)} placeholder="Liderazgo, IA, Datos..." required />
            </div>
            <div>
              <label className={etiqueta}>Puntos</label>
              <input
                type="number"
                min={1}
                max={60}
                className={campo}
                value={puntos}
                onChange={(e) => setPuntos(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="text-[10px] text-ink-muted">20 puntos suben la habilidad a nivel 1, 40 a nivel 2 y 60 a nivel 3.</p>

          {error && <ErrorConReintento compacto mensaje={error} />}

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nombre.trim() || !habilidad.trim() || enviando}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
            >
              {enviando && <Loader2 size={13} className="animate-spin" />}
              <span>Crear taller</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
