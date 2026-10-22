import React from 'react';
import { X } from 'lucide-react';
import { useAtras } from '../lib/atras';

// Panel que sube desde abajo (bottom sheet). Todas las opciones quedan visibles y,
// si no entran, el panel hace scroll. Respeta los botones o gestos de Android y se
// cierra con el botón atrás, tocando fuera o con la X.
export default function PanelInferior({ abierto, onCerrar, titulo, subtitulo, children }) {
  useAtras(abierto, onCerrar);
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 !m-0 z-50 bg-black/50 flex items-end justify-center pt-safe animate-fadeIn"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85%] overflow-y-auto bg-white dark:bg-surface-cardDark rounded-t-3xl shadow-modal border-t border-line dark:border-line-dark px-4 pt-2 pb-[calc(var(--sab)+1rem)] animate-slideUp"
      >
        <div className="w-10 h-1 rounded-full bg-line dark:bg-line-dark mx-auto mb-3" />
        {(titulo || subtitulo) && (
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              {titulo && <h3 className="text-sm font-black text-ink dark:text-ink-light">{titulo}</h3>}
              {subtitulo && <p className="text-xs text-ink-muted mt-0.5">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="p-1 -mr-1 text-ink-muted hover:text-ink dark:hover:text-ink-light rounded-lg shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Fila de opción dentro de un PanelInferior (menú ⋮, selector de estado)
export function OpcionPanel({ icono: Icono, emoji, texto, detalle, activa, peligro, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-2xl text-left transition ${
        activa
          ? 'bg-brand-primary/10 dark:bg-accent/15'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
      }`}
    >
      {emoji ? (
        <span className="text-base w-6 text-center shrink-0">{emoji}</span>
      ) : Icono ? (
        <Icono size={18} className={`shrink-0 ${peligro ? 'text-semantic-danger' : 'text-ink-muted'}`} />
      ) : null}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${peligro ? 'text-semantic-danger' : 'text-ink dark:text-ink-light'}`}>{texto}</div>
        {detalle && <div className="text-xs text-ink-muted">{detalle}</div>}
      </div>
      {activa && <span className="text-xs font-black text-brand-primary dark:text-accent shrink-0">Actual</span>}
    </button>
  );
}
