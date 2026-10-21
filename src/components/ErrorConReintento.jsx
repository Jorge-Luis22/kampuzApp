import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Error de carga con opción de reintentar. Nunca se muestran datos inventados en su lugar.
export default function ErrorConReintento({ mensaje, onReintentar, compacto = false }) {
  if (!mensaje) return null;
  return (
    <div
      role="alert"
      className={`flex ${compacto ? 'items-center' : 'flex-col items-center text-center py-8'} gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-800 dark:text-rose-300`}
    >
      <AlertCircle size={compacto ? 16 : 22} className="shrink-0" />
      <span className="font-semibold flex-1">{mensaje}</span>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="px-3 py-1.5 bg-white dark:bg-surface-cardDark border border-rose-300 dark:border-rose-800 rounded-xl font-bold flex items-center gap-1 shrink-0"
        >
          <RefreshCw size={12} />
          <span>Reintentar</span>
        </button>
      )}
    </div>
  );
}
