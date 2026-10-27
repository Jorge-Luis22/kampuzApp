import React from 'react';

// Renderizador de Medallas Universitarias Vectoriales (SVG) para Kampus
// Niveles según KAMPUS-spec-antigravity.md:
// Nivel 1: "La he usado" (Bronce / Turquesa)
// Nivel 2: "La he aplicado con otros" (Plata / Índigo)
// Nivel 3: "La he enseñado" (Oro Radiante)
// Nivel 0: "Por desbloquear"

export default function SkillMedal({
  skillKey,
  nombre,
  nivel = 0,
  estrellas = 0,
  progresoActual = 0,
  siguienteNivelMeta = 1,
  onClick
}) {
  // Paletas de color por nivel para la medalla
  const configPorNivel = {
    0: {
      tituloNivel: "Nivel 0",
      subtitulo: "Sin iniciar",
      gradienteMoneda: ["#94A3B8", "#64748B"],
      colorBorde: "#CBD5E1",
      colorCinta: "#94A3B8",
      colorBrillo: "#E2E8F0",
      estrellasStr: "☆☆☆",
      badgeColor: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
    },
    1: {
      tituloNivel: "NIVEL 1",
      subtitulo: "La he usado",
      gradienteMoneda: ["#00BFA5", "#008777"],
      colorBorde: "#A7F3D0",
      colorCinta: "#047857",
      colorBrillo: "#6EE7B7",
      estrellasStr: "★",
      badgeColor: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-200"
    },
    2: {
      tituloNivel: "NIVEL 2",
      subtitulo: "La he aplicado",
      gradienteMoneda: ["#383082", "#241E5C"],
      colorBorde: "#C7D2FE",
      colorCinta: "#4338CA",
      colorBrillo: "#818CF8",
      estrellasStr: "★★",
      badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200"
    },
    3: {
      tituloNivel: "NIVEL 3",
      subtitulo: "La he enseñado",
      gradienteMoneda: ["#F59E0B", "#B45309"],
      colorBorde: "#FDE68A",
      colorCinta: "#D97706",
      colorBrillo: "#FCD34D",
      estrellasStr: "★★★",
      badgeColor: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200"
    }
  };

  const cfg = configPorNivel[Math.min(nivel, 3)] || configPorNivel[0];

  // Iconos temáticos según la habilidad
  const renderIconoCentro = () => {
    switch (skillKey) {
      case 'apoyo_investigacion':
        return (
          // Microscopio / Matraz de Investigación
          <path
            d="M10 2v5l-3 5a1 1 0 001 1h8a1 1 0 001-1l-3-5V2h-4zm1 1h2v4h-2V3zm-2 7l1.5-2.5h3L15 10H9z"
            fill="white"
            transform="scale(2) translate(1, 1)"
          />
        );
      case 'predisposicion_ayudar':
        return (
          // Manos / Corazón de Orientación y Asesoría
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="white"
            transform="scale(1.7) translate(3, 3)"
          />
        );
      case 'constancia':
        return (
          // Llama de Constancia / Rayo de Energía
          <path
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            fill="white"
            transform="scale(1.8) translate(2, 2)"
          />
        );
      case 'liderazgo':
        return (
          // Corona / Trofeo de Liderazgo Estudiantil
          <path
            d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"
            fill="white"
            transform="scale(1.7) translate(3, 3)"
          />
        );
      default:
        if (typeof skillKey === 'string' && skillKey.startsWith('taller_')) {
          return (
            // Birrete: habilidad ganada al terminar un taller de la UTP
            <path
              d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"
              fill="white"
              transform="scale(1.7) translate(3, 3)"
            />
          );
        }
        return (
          // Estrella genérica
          <path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            fill="white"
            transform="scale(1.8) translate(2, 2)"
          />
        );
    }
  };

  const porcentaje = nivel === 3 ? 100 : Math.round((progresoActual / siguienteNivelMeta) * 100);

  return (
    <div
      onClick={onClick}
      className="k-card p-3.5 flex flex-col items-center text-center cursor-pointer hover:border-brand-primary transition-all duration-200 group relative overflow-hidden select-none"
    >
      {/* Visual Medal SVG */}
      <div className="relative w-20 h-24 mb-1 flex items-center justify-center">
        <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-md">
          <defs>
            {/* Gradiente de la moneda metálica */}
            <linearGradient id={`grad-${skillKey}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cfg.gradienteMoneda[0]} />
              <stop offset="100%" stopColor={cfg.gradienteMoneda[1]} />
            </linearGradient>

            {/* Gradiente de cinta de honor */}
            <linearGradient id={`cinta-${skillKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={cfg.colorCinta} />
              <stop offset="100%" stopColor="#1E174D" />
            </linearGradient>

            {/* Sombra de relieve */}
            <filter id={`shadow-${skillKey}`} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Cinta Ribbon Superior */}
          <path
            d="M26 0 L38 45 L50 25 L62 45 L74 0 Z"
            fill={`url(#cinta-${skillKey})`}
            opacity="0.9"
          />
          <path
            d="M34 0 L42 35 L50 20 L58 35 L66 0 Z"
            fill={cfg.colorBrillo}
            opacity="0.4"
          />

          {/* Anillo exterior de la Medalla */}
          <circle
            cx="50"
            cy="70"
            r="38"
            fill="#FFFFFF"
            stroke={cfg.colorBorde}
            strokeWidth="3.5"
            filter={`url(#shadow-${skillKey})`}
          />

          {/* Laurel decorativo grabado (arcos circulares) */}
          <circle
            cx="50"
            cy="70"
            r="34"
            fill="none"
            stroke={cfg.colorBorde}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.8"
          />

          {/* Moneda central con gradiente de nivel */}
          <circle
            cx="50"
            cy="70"
            r="30"
            fill={`url(#grad-${skillKey})`}
          />

          {/* Reflejo de bisel superior */}
          <path
            d="M23 60 A 30 30 0 0 1 77 60 A 28 20 0 0 0 23 60 Z"
            fill="white"
            opacity="0.25"
          />

          {/* Icono central de habilidad */}
          <g>{renderIconoCentro()}</g>

          {/* Sello de estrellas en la base de la medalla */}
          <rect
            x="30"
            y="95"
            width="40"
            height="16"
            rx="8"
            fill="#1E174D"
            stroke={cfg.colorBorde}
            strokeWidth="1.5"
          />
          <text
            x="50"
            y="107"
            textAnchor="middle"
            fill="#FDE68A"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="1"
          >
            {cfg.estrellasStr}
          </text>
        </svg>
      </div>

      {/* Nombre de la Habilidad */}
      <h4 className="text-xs font-bold text-ink dark:text-ink-light tracking-tight mt-1 line-clamp-1">
        {nombre}
      </h4>

      {/* Badge de Nivel */}
      <span className={`mt-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${cfg.badgeColor}`}>
        {cfg.tituloNivel} · {cfg.subtitulo}
      </span>

      {/* Barra de progreso visual hacia el siguiente nivel */}
      {nivel < 3 ? (
        <div className="w-full mt-2 space-y-1">
          <div className="flex justify-between text-[9px] text-ink-muted font-semibold">
            <span>Avance</span>
            <span>{progresoActual}/{siguienteNivelMeta}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, porcentaje)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
          🏆 Nivel Máximo
        </div>
      )}
    </div>
  );
}
