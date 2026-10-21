import React from 'react';
import { Lock } from 'lucide-react';

// Un consentimiento con su propio interruptor (M05 y M32). El 1 va bloqueado ("Necesario").
export default function ConsentimientoItem({ consentimiento, valor, onCambiar, deshabilitado = false, pie = null }) {
  const { finalidad, numero, titulo, texto, necesario, comparte, noComparte, consecuencia } = consentimiento;
  const id = `consentimiento-${finalidad}`;

  return (
    <div className="p-3.5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark rounded-2xl space-y-2">
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={id} className="flex-1 cursor-pointer">
          <span className="text-[10px] font-black text-accent uppercase tracking-wider">Consentimiento {numero}</span>
          <span className="block text-xs font-black text-ink dark:text-ink-light leading-snug">{titulo}</span>
        </label>
        {necesario ? (
          <span className="shrink-0 text-[10px] font-black px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-ink-muted flex items-center gap-1">
            <Lock size={10} />
            Necesario
          </span>
        ) : (
          <input
            id={id}
            type="checkbox"
            role="switch"
            aria-checked={valor}
            checked={valor}
            disabled={deshabilitado}
            onChange={(e) => onCambiar(finalidad, e.target.checked)}
            className="w-5 h-5 accent-accent rounded cursor-pointer shrink-0 mt-1 disabled:opacity-50"
          />
        )}
      </div>

      <p className="text-[11px] text-ink-soft dark:text-ink-muted leading-relaxed">{texto}</p>

      {comparte && (
        <div className="text-[11px] text-ink-soft dark:text-ink-muted leading-relaxed space-y-0.5">
          <p><strong className="text-ink dark:text-ink-light">Qué compartimos:</strong> {comparte}</p>
          <p><strong className="text-ink dark:text-ink-light">Qué no:</strong> {noComparte}</p>
          <p>{consecuencia}</p>
        </div>
      )}

      {pie}
    </div>
  );
}
