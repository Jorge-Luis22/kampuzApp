import React, { useState, useEffect, useRef } from 'react';
import { CARRERAS_UTP } from '../data/mockData';
import { calcularAlcanceEnVivo, enviarEncuestaSegura } from '../lib/surveys';
import { useAtras } from '../lib/atras';
import ErrorConReintento from './ErrorConReintento';
import { ArrowLeft, ArrowRight, Plus, X, Users, CheckCircle2, AlertTriangle, Loader2, Send, Lock, Trash2 } from 'lucide-react';

// =============================================================================
// Crear encuesta en 3 pasos: A quién va → Preguntas → Revisar y enviar.
// El servidor vuelve a validar todo al enviar (enviar_encuesta_segura).
// =============================================================================

const PASOS = ['A quién va', 'Preguntas', 'Revisar y enviar'];
const MAX_PREGUNTAS = 15;
const MAX_OPCIONES = 6;
const CICLOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const EDADES = Array.from({ length: 22 }, (_, i) => 14 + i); // 14 a 35

let siguienteId = 1;
const preguntaVacia = () => ({ id: siguienteId++, texto: '', opciones: ['', ''] });

const opcionesLimpias = (p) => p.opciones.map((o) => o.trim()).filter(Boolean);
const preguntaCompleta = (p) => p.texto.trim().length > 0 && new Set(opcionesLimpias(p)).size >= 2;

function BarraProgreso({ paso }) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {PASOS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition ${i <= paso ? 'bg-brand-primary dark:bg-accent' : 'bg-line dark:bg-line-dark'}`} />
        ))}
      </div>
      <div className="flex justify-between text-[11px] font-bold">
        {PASOS.map((nombre, i) => (
          <span key={nombre} className={i === paso ? 'text-brand-primary dark:text-accent' : 'text-ink-muted'}>
            {i + 1}. {nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

function Selector({ valor, onCambiar, opciones, sufijo = '' }) {
  return (
    <select
      value={valor}
      onChange={(e) => onCambiar(Number(e.target.value))}
      className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-semibold text-ink dark:text-ink-light"
    >
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
          {sufijo}
        </option>
      ))}
    </select>
  );
}

export default function CrearEncuesta({ user, umbralMinimo, alcanceSemanal, onEnviada, onIrABandeja }) {
  const [paso, setPaso] = useState(0);
  const inicioRef = useRef(null);

  // Cada paso empieza arriba
  useEffect(() => {
    inicioRef.current?.scrollIntoView({ block: 'start' });
  }, [paso]);

  // Paso 1: a quién va
  const [filtro, setFiltro] = useState({
    carreras: [user?.carrera || CARRERAS_UTP[0]?.nombre].filter(Boolean),
    cicloMin: 1,
    cicloMax: 10,
    edadMin: 18,
    edadMax: 30,
    intereses: []
  });
  const [alcance, setAlcance] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [errorAlcance, setErrorAlcance] = useState('');

  // Paso 2: preguntas
  const [titulo, setTitulo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [preguntas, setPreguntas] = useState(() => [preguntaVacia()]);
  const [intentoSeguir, setIntentoSeguir] = useState(false);

  // Paso 3: enviar
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [resultado, setResultado] = useState(null);

  // Botón atrás de Android: vuelve al paso anterior
  useAtras(paso > 0 && !resultado, () => setPaso((p) => p - 1));

  // Conteo en vivo (el servidor solo devuelve un número, nunca la lista)
  useEffect(() => {
    const t = setTimeout(async () => {
      setCalculando(true);
      setErrorAlcance('');
      try {
        setAlcance(await calcularAlcanceEnVivo(filtro));
      } catch (err) {
        setErrorAlcance(err.message);
      } finally {
        setCalculando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [filtro]);

  const cambiarFiltro = (cambios) =>
    setFiltro((f) => {
      const n = { ...f, ...cambios };
      if (n.cicloMin > n.cicloMax) n.cicloMax = n.cicloMin;
      if (n.edadMin > n.edadMax) n.edadMax = n.edadMin;
      return n;
    });

  const alternarCarrera = (nombre) =>
    setFiltro((f) => {
      const ya = f.carreras.includes(nombre);
      if (ya && f.carreras.length === 1) return f; // al menos una carrera
      return { ...f, carreras: ya ? f.carreras.filter((c) => c !== nombre) : [...f.carreras, nombre] };
    });

  const suficientes = alcance !== null && alcance >= umbralMinimo;
  const destinatarios = alcance === null ? 0 : Math.min(alcance, alcanceSemanal);
  const puedeEnviar = alcanceSemanal > 0;

  // --- Preguntas ---
  const cambiarPregunta = (id, cambios) => setPreguntas((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  const cambiarOpcion = (id, i, valor) =>
    setPreguntas((ps) => ps.map((p) => (p.id === id ? { ...p, opciones: p.opciones.map((o, j) => (j === i ? valor : o)) } : p)));
  const agregarOpcion = (id) =>
    setPreguntas((ps) => ps.map((p) => (p.id === id && p.opciones.length < MAX_OPCIONES ? { ...p, opciones: [...p.opciones, ''] } : p)));
  const quitarOpcion = (id, i) =>
    setPreguntas((ps) => ps.map((p) => (p.id === id && p.opciones.length > 2 ? { ...p, opciones: p.opciones.filter((_, j) => j !== i) } : p)));

  const tituloOk = titulo.trim().length >= 5;
  const preguntasOk = preguntas.every(preguntaCompleta);

  const seguirAPreguntas = () => setPaso(1);
  const seguirARevisar = () => {
    setIntentoSeguir(true);
    if (tituloOk && preguntasOk) {
      setErrorEnvio('');
      setPaso(2);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErrorEnvio('');
    try {
      const res = await enviarEncuestaSegura({
        titulo,
        descripcion: objetivo,
        filtro,
        preguntas: preguntas.map((p) => ({ texto: p.texto.trim(), tipo: 'unica', opciones: opcionesLimpias(p) }))
      });
      setResultado(res);
    } catch (err) {
      setErrorEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // --- Enviada ---
  if (resultado) {
    return (
      <div className="k-card p-6 text-center space-y-3 rounded-3xl border-2 border-emerald-300 bg-white dark:bg-surface-cardDark">
        <CheckCircle2 size={44} className="text-semantic-success mx-auto" />
        <h3 className="text-base font-black text-ink dark:text-ink-light">¡Tu encuesta fue enviada!</h3>
        <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
          Llegó a {resultado.enviados} {resultado.enviados === 1 ? 'compañero' : 'compañeros'}
          {resultado.encolados ? `. Otros ${resultado.encolados} la recibirán cuando tengan espacio en su bandeja (máximo 3 encuestas por semana)` : ''}. Las respuestas
          son anónimas: solo verás los resultados juntos.
        </p>
        <button onClick={() => onEnviada?.(resultado)} className="w-full py-3 bg-brand-primary text-white font-extrabold text-sm rounded-xl">
          Ver mis resultados
        </button>
      </div>
    );
  }

  const tarjetaAlcance = (
    <div
      className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 ${
        errorAlcance
          ? 'border-line dark:border-line-dark bg-white dark:bg-surface-cardDark'
          : suficientes
          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800'
          : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800'
      }`}
    >
      <div className="w-11 h-11 rounded-xl bg-white/80 dark:bg-surface-cardDark flex items-center justify-center shrink-0">
        {calculando ? <Loader2 size={20} className="animate-spin text-accent" /> : <Users size={20} className={suficientes ? 'text-emerald-600' : 'text-amber-600'} />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-ink dark:text-ink-light">
          {alcance === null ? 'Calculando...' : `${alcance} ${alcance === 1 ? 'compañero cumple' : 'compañeros cumplen'} con lo que elegiste`}
        </p>
        <p className="text-[11px] font-semibold text-ink-soft dark:text-ink-muted leading-snug">
          {suficientes
            ? puedeEnviar && alcance > alcanceSemanal
              ? `Esta semana puedes enviarla a ${alcanceSemanal}. Responder encuestas de otros te deja llegar a más.`
              : 'Suficientes para cuidar el anonimato de quienes respondan.'
            : `Para cuidar el anonimato, tu encuesta necesita llegar al menos a ${umbralMinimo}. Agrega carreras o más ciclos.`}
        </p>
      </div>
    </div>
  );

  return (
    <div ref={inicioRef} className="space-y-4 scroll-mt-4">
      <BarraProgreso paso={paso} />

      {/* ------------------ PASO 1: A QUIÉN VA ------------------ */}
      {paso === 0 && (
        <>
          {!puedeEnviar && (
            <div className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark flex items-start gap-3">
              <Lock size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-soft dark:text-ink-muted">
                  Para enviar encuestas, primero responde una de tu bandeja. Puedes ir preparando la tuya.
                </p>
                <button onClick={onIrABandeja} className="text-xs font-black text-accent">
                  Ir a mi bandeja
                </button>
              </div>
            </div>
          )}

          <div className="k-card p-4 space-y-4 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark">
            <div>
              <p className="text-xs font-black text-ink dark:text-ink-light mb-0.5">¿De qué carreras?</p>
              <p className="text-[11px] text-ink-muted mb-2">Toca para elegir una o varias.</p>
              <div className="flex flex-wrap gap-1.5">
                {CARRERAS_UTP.map((c) => {
                  const sel = filtro.carreras.includes(c.nombre);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => alternarCarrera(c.nombre)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold transition ${
                        sel ? 'bg-brand-primary text-white border-brand-primary' : 'bg-surface dark:bg-surface-dark text-ink dark:text-ink-light border-line dark:border-line-dark'
                      }`}
                    >
                      {sel && '✓ '}
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-ink dark:text-ink-light mb-2">¿De qué ciclos?</p>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-[11px] text-ink-muted font-semibold">Desde el</span>
                  <Selector valor={filtro.cicloMin} onCambiar={(v) => cambiarFiltro({ cicloMin: v })} opciones={CICLOS} sufijo=".° ciclo" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-ink-muted font-semibold">Hasta el</span>
                  <Selector valor={filtro.cicloMax} onCambiar={(v) => cambiarFiltro({ cicloMax: v })} opciones={CICLOS.filter((c) => c >= filtro.cicloMin)} sufijo=".° ciclo" />
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-ink dark:text-ink-light mb-2">¿Qué edades?</p>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-[11px] text-ink-muted font-semibold">Desde los</span>
                  <Selector valor={filtro.edadMin} onCambiar={(v) => cambiarFiltro({ edadMin: v })} opciones={EDADES} sufijo=" años" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-ink-muted font-semibold">Hasta los</span>
                  <Selector valor={filtro.edadMax} onCambiar={(v) => cambiarFiltro({ edadMax: v })} opciones={EDADES.filter((e) => e >= filtro.edadMin)} sufijo=" años" />
                </label>
              </div>
              {filtro.edadMin < 18 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5">
                  Incluye menores de edad. Si tu investigación lo requiere, consulta con tu docente si necesitas autorización de los padres.
                </p>
              )}
            </div>
          </div>

          {errorAlcance ? <ErrorConReintento compacto mensaje={errorAlcance} onReintentar={() => setFiltro({ ...filtro })} /> : tarjetaAlcance}

          <button
            onClick={seguirAPreguntas}
            disabled={!suficientes || calculando || Boolean(errorAlcance)}
            className="w-full py-3.5 bg-brand-primary disabled:opacity-40 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2"
          >
            <span>Siguiente: preguntas</span>
            <ArrowRight size={16} />
          </button>
        </>
      )}

      {/* ------------------ PASO 2: PREGUNTAS ------------------ */}
      {paso === 1 && (
        <>
          <div className="k-card p-4 space-y-3 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark">
            <label className="block">
              <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Título de la encuesta</span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={120}
                placeholder="Ej.: Hábitos de estudio en primeros ciclos"
                className={`w-full px-3 py-2.5 rounded-xl border bg-surface dark:bg-surface-dark text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary ${
                  intentoSeguir && !tituloOk ? 'border-rose-400' : 'border-line dark:border-line-dark'
                }`}
              />
              {intentoSeguir && !tituloOk && <span className="text-[11px] text-semantic-danger font-semibold">Escribe al menos 5 caracteres.</span>}
            </label>
            <label className="block">
              <span className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                ¿Para qué es? <span className="font-medium text-ink-muted">(opcional)</span>
              </span>
              <input
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                maxLength={200}
                placeholder="Ej.: Trabajo final del curso de Estadística"
                className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
              />
            </label>
          </div>

          {preguntas.map((p, idx) => {
            const incompleta = intentoSeguir && !preguntaCompleta(p);
            return (
              <div
                key={p.id}
                className={`k-card p-4 space-y-2.5 rounded-2xl bg-white dark:bg-surface-cardDark border ${incompleta ? 'border-rose-400' : 'border-line dark:border-line-dark'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-ink dark:text-ink-light">Pregunta {idx + 1}</span>
                  {preguntas.length > 1 && (
                    <button
                      onClick={() => setPreguntas((ps) => ps.filter((x) => x.id !== p.id))}
                      className="p-1 text-ink-muted hover:text-semantic-danger"
                      aria-label={`Quitar la pregunta ${idx + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <input
                  value={p.texto}
                  onChange={(e) => cambiarPregunta(p.id, { texto: e.target.value })}
                  maxLength={200}
                  placeholder={idx === 0 ? 'Ej.: ¿Cuántas horas estudias por semana fuera de clase?' : 'Escribe la pregunta'}
                  className="w-full px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm font-medium text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
                />
                <p className="text-[11px] text-ink-muted">Respuestas posibles (se elige una):</p>
                <div className="space-y-1.5">
                  {p.opciones.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-line dark:border-line-dark shrink-0" />
                      <input
                        value={o}
                        onChange={(e) => cambiarOpcion(p.id, i, e.target.value)}
                        maxLength={100}
                        placeholder={`Opción ${i + 1}`}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-sm text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary"
                      />
                      {p.opciones.length > 2 && (
                        <button onClick={() => quitarOpcion(p.id, i)} className="p-1 text-ink-muted hover:text-semantic-danger" aria-label={`Quitar la opción ${i + 1}`}>
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {p.opciones.length < MAX_OPCIONES && (
                  <button onClick={() => agregarOpcion(p.id)} className="text-xs font-bold text-accent flex items-center gap-1">
                    <Plus size={14} />
                    <span>Agregar opción</span>
                  </button>
                )}
                {incompleta && (
                  <p className="text-[11px] text-semantic-danger font-semibold">Escribe la pregunta y al menos 2 opciones distintas.</p>
                )}
              </div>
            );
          })}

          {preguntas.length < MAX_PREGUNTAS && (
            <button
              onClick={() => setPreguntas((ps) => [...ps, preguntaVacia()])}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-line dark:border-line-dark text-xs font-bold text-ink-muted flex items-center justify-center gap-1.5"
            >
              <Plus size={15} />
              <span>Agregar otra pregunta</span>
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => setPaso(0)} className="px-4 py-3.5 rounded-2xl border border-line dark:border-line-dark text-sm font-bold text-ink-muted flex items-center gap-1">
              <ArrowLeft size={16} />
              <span>Atrás</span>
            </button>
            <button onClick={seguirARevisar} className="flex-1 py-3.5 bg-brand-primary text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2">
              <span>Siguiente: revisar</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ------------------ PASO 3: REVISAR Y ENVIAR ------------------ */}
      {paso === 2 && (
        <>
          <div className="k-card p-4 space-y-2 rounded-2xl bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark">
            <p className="text-xs font-black text-ink dark:text-ink-light">A quién va</p>
            <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
              {filtro.carreras.join(', ')} · del {filtro.cicloMin}.° al {filtro.cicloMax}.° ciclo · de {filtro.edadMin} a {filtro.edadMax} años
            </p>
            <p className="text-xs font-bold text-brand-primary dark:text-teal-300">
              Llegará a {destinatarios} {destinatarios === 1 ? 'compañero' : 'compañeros'}. Las respuestas son anónimas.
            </p>
            <button onClick={() => setPaso(0)} className="text-[11px] font-bold text-accent">
              Cambiar
            </button>
          </div>

          <div>
            <p className="text-xs font-black text-ink dark:text-ink-light mb-2">Así la verán tus compañeros</p>
            <div className="k-card rounded-2xl bg-white dark:bg-surface-cardDark border-2 border-brand-primary/30 overflow-hidden">
              <div className="p-4 bg-brand-primary text-white">
                <p className="text-[10px] font-black uppercase tracking-wider text-teal-300">Encuesta anónima</p>
                <h3 className="text-base font-black leading-snug">{titulo.trim()}</h3>
                {objetivo.trim() && <p className="text-xs text-indigo-200 mt-0.5">{objetivo.trim()}</p>}
                <p className="text-[11px] text-indigo-200 mt-1">
                  {preguntas.length} {preguntas.length === 1 ? 'pregunta' : 'preguntas'} · ~{Math.max(1, Math.round(preguntas.length * 0.6))} min
                </p>
              </div>
              <div className="p-4 space-y-4">
                {preguntas.map((p, idx) => (
                  <div key={p.id} className="space-y-1.5">
                    <p className="text-sm font-bold text-ink dark:text-ink-light">
                      {idx + 1}. {p.texto.trim()}
                    </p>
                    {opcionesLimpias(p).map((o) => (
                      <div key={o} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line dark:border-line-dark text-xs text-ink-soft dark:text-ink-muted">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-line dark:border-line-dark shrink-0" />
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!puedeEnviar && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                Para enviarla, primero responde una encuesta de tu bandeja.{' '}
                <button onClick={onIrABandeja} className="underline font-black">
                  Ir a mi bandeja
                </button>
              </span>
            </div>
          )}

          {errorEnvio && <ErrorConReintento compacto mensaje={errorEnvio} />}

          <div className="flex gap-2">
            <button onClick={() => setPaso(1)} className="px-4 py-3.5 rounded-2xl border border-line dark:border-line-dark text-sm font-bold text-ink-muted flex items-center gap-1">
              <ArrowLeft size={16} />
              <span>Atrás</span>
            </button>
            <button
              onClick={enviar}
              disabled={enviando || !puedeEnviar}
              className="flex-1 py-3.5 bg-brand-primary disabled:opacity-40 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2"
            >
              {enviando ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>Enviar encuesta</span>
                  <Send size={15} />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
