import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchHabilidadesDeAlumno } from '../lib/profile';

// Etiquetas de nivel (spec 5.4) y colores de la insignia de cada habilidad
const NIVEL_HABILIDAD = {
  1: { etiqueta: 'La he usado', estilo: 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800' },
  2: { etiqueta: 'La he aplicado con otros', estilo: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800' },
  3: { etiqueta: 'La he enseñado', estilo: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800' }
};

// Habilidades verificadas de otro alumno (M08), con estados de carga, vacío y error
export default function HabilidadesDeAlumno({ alumnoId }) {
  const [estado, setEstado] = useState({ cargando: true, error: '', lista: [] });

  const cargar = useCallback(() => {
    let vigente = true;
    setEstado({ cargando: true, error: '', lista: [] });
    fetchHabilidadesDeAlumno(alumnoId)
      .then((lista) => vigente && setEstado({ cargando: false, error: '', lista }))
      .catch((err) => vigente && setEstado({ cargando: false, error: err.message || 'No pudimos cargar sus habilidades.', lista: [] }));
    return () => {
      vigente = false;
    };
  }, [alumnoId]);

  useEffect(() => cargar(), [cargar]);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-black text-ink dark:text-ink-light">Habilidades</p>
      {estado.cargando ? (
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          <span>Cargando habilidades...</span>
        </div>
      ) : estado.error ? (
        <p className="text-[11px] text-ink-muted">
          No pudimos cargar sus habilidades.{' '}
          <button onClick={cargar} className="font-bold text-accent underline">
            Reintentar
          </button>
        </p>
      ) : estado.lista.length === 0 ? (
        <p className="text-[11px] text-ink-muted">Todavía no tiene habilidades verificadas. Se ganan con hechos reales dentro de Kampuz.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {estado.lista.map((h) => {
            const nivel = NIVEL_HABILIDAD[Math.min(h.nivel, 3)];
            return (
              <li
                key={h.id}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold leading-tight ${nivel.estilo}`}
                title={`${h.nombre}: ${nivel.etiqueta}`}
              >
                {h.nombre} · Nivel {h.nivel}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
