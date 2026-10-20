import React, { useState } from 'react';
import { useStore } from '../data/store';
import {
  Smartphone,
  Maximize2,
  Moon,
  Sun,
  Layers,
  RotateCcw,
  Building2,
  UserCheck,
  ShieldCheck,
  Sparkles,
  Wifi,
  Battery,
  ExternalLink,
  LogOut
} from 'lucide-react';

export default function PhoneShell({ children }) {
  const {
    deviceFrame,
    setDeviceFrame,
    darkMode,
    setDarkMode,
    currentScreen,
    setCurrentScreen,
    setActiveTab,
    resetDemoState,
    cerrarSesion,
    user
  } = useStore();

  const [menuOpen, setMenuOpen] = useState(false);

  const jumpTo = (screen, tab = null) => {
    if (tab) setActiveTab(tab);
    setCurrentScreen(screen);
    setMenuOpen(false);
  };

  return (
    <div className={`min-h-[100dvh] h-[100dvh] md:h-auto md:min-h-screen flex flex-col ${darkMode ? 'dark bg-surface-dark md:bg-[#06080F]' : 'bg-surface md:bg-[#E3E8F0]'}`}>
      {/* Top Presentation Toolbar (Desktop / Laptop / Projector Only) */}
      <header className="hidden md:flex bg-brand-primary text-white px-4 py-2 items-center justify-between shadow-clean z-50 select-none border-b border-indigo-900/60">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center font-black text-white text-lg tracking-tight shadow-clean">
            Z
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm tracking-wide">KAMPUZ</span>
              <span className="text-[10px] bg-white/20 text-white font-bold px-1.5 py-0.2 rounded">UTP Lima Sur</span>
              <span className="text-[10px] bg-teal-500/30 text-teal-200 font-bold px-1.5 py-0.2 rounded">MVP</span>
            </div>
            <p className="text-[11px] text-indigo-200 font-medium">
              Demo: <strong className="text-white">{user.nombre} {user.apellido}</strong> ({user.carrera})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          {/* Quick Jump Navigator */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition"
              title="Atajos de pantallas para sustentación"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Pantallas (M01-M33)</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light rounded-2xl shadow-modal border border-line dark:border-line-dark p-2 text-xs z-50 max-h-[80vh] overflow-y-auto">
                <div className="px-2 py-1.5 font-bold text-ink-muted border-b border-line dark:border-line-dark flex justify-between items-center">
                  <span>ATAJOS DEL MVP</span>
                  <span className="text-[10px] bg-accent-soft text-accent font-bold px-1.5 py-0.2 rounded">Piloto</span>
                </div>

                <div className="py-1">
                  <div className="text-[10px] font-bold text-accent uppercase tracking-wider px-2 pt-2">Flujo de Entrada</div>
                  <button onClick={() => jumpTo('m01_bienvenida')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M01 Bienvenida e inicio de sesión</span>
                    <span className="text-ink-muted">@utp.edu.pe</span>
                  </button>
                  <button onClick={() => jumpTo('m02_otp')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M02 Verificación OTP 6 dígitos</span>
                    <span className="text-ink-muted">Código</span>
                  </button>
                  <button onClick={() => jumpTo('m03_onboarding')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M03 Perfil académico declarado</span>
                    <span className="text-ink-muted">Datos</span>
                  </button>
                  <button onClick={() => jumpTo('m04_intereses')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M04 Intereses de campus</span>
                    <span className="text-ink-muted">Chips</span>
                  </button>
                  <button onClick={() => jumpTo('m05_consentimientos')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M05 Consentimientos Legales (4)</span>
                    <span className="text-ink-muted">Ley 29733</span>
                  </button>
                </div>

                <div className="py-1 border-t border-line dark:border-line-dark">
                  <div className="text-[10px] font-bold text-accent uppercase tracking-wider px-2 pt-1">Núcleo y Espacios</div>
                  <button onClick={() => jumpTo('app', 'inicio')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M06 Inicio (Feed & recordatorios)</span>
                    <span className="text-ink-muted">Tab 1</span>
                  </button>
                  <button onClick={() => jumpTo('app', 'grupos')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M11-M15 Los 3 Espacios Distintos</span>
                    <span className="text-ink-muted">Tab 3</span>
                  </button>
                  <button onClick={() => jumpTo('app', 'explorar')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M07-M10 Explorar compañeros & solicitud</span>
                    <span className="text-ink-muted">Tab 2</span>
                  </button>
                </div>

                <div className="py-1 border-t border-line dark:border-line-dark">
                  <div className="text-[10px] font-bold text-accent uppercase tracking-wider px-2 pt-1">Flujos Clave</div>
                  <button onClick={() => jumpTo('app', 'grupos')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M19-M22 Consultas Agrupadas & Moderación</span>
                    <span className="text-ink-muted">Flujo 1</span>
                  </button>
                  <button onClick={() => jumpTo('app', 'encuestas')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M23-M28 Encuestas & Bloqueo &lt;30</span>
                    <span className="text-ink-muted">Flujo 3</span>
                  </button>
                  <button onClick={() => jumpTo('app', 'perfil')} className="w-full text-left px-2 py-1.5 hover:bg-surface dark:hover:bg-line-dark rounded-lg flex justify-between font-medium">
                    <span>M29-M33 Perfil Habilidades 0-3</span>
                    <span className="text-ink-muted">Flujo 4</span>
                  </button>
                </div>

                <div className="py-1 border-t border-line dark:border-line-dark">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider px-2 pt-1">Universidad</div>
                  <button onClick={() => jumpTo('panel_utp')} className="w-full text-left px-2 py-1.5 hover:bg-brand-primary-soft dark:hover:bg-brand-dark rounded-lg flex justify-between font-bold text-brand-primary dark:text-teal-300">
                    <span>W01-W06 Panel Web UTP (Dashboard)</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Panel UTP vs Student App */}
          <button
            onClick={() => setCurrentScreen(currentScreen === 'panel_utp' ? 'app' : 'panel_utp')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
              currentScreen === 'panel_utp'
                ? 'bg-accent text-white shadow-clean'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Ver Panel Institucional UTP (W01-W06)"
          >
            <Building2 size={14} />
            <span className="hidden md:inline">{currentScreen === 'panel_utp' ? 'Ver App Alumno' : 'Panel UTP'}</span>
          </button>

          {/* Cerrar Sesión / Ir al inicio */}
          {currentScreen !== 'm01_bienvenida' && currentScreen !== 'panel_utp' && (
            <button
              onClick={cerrarSesion}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              title="Volver a la pantalla de bienvenida / inicio de sesión"
            >
              <LogOut size={14} />
            </button>
          )}

          {/* Toggle Bezel vs Responsive */}
          <button
            onClick={() => setDeviceFrame(!deviceFrame)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title={deviceFrame ? "Pantalla completa" : "Marco de smartphone"}
          >
            {deviceFrame ? <Maximize2 size={14} /> : <Smartphone size={14} />}
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title={darkMode ? "Modo Claro" : "Modo Oscuro"}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Reset Demo State */}
          <button
            onClick={resetDemoState}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title="Reiniciar datos de demo a bienvenida"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-0 md:p-6 overflow-hidden w-full h-full">
        {currentScreen === 'panel_utp' ? (
          // Full-width University Web Dashboard
          <div className="w-full max-w-6xl h-full md:h-[calc(100vh-76px)] bg-white dark:bg-surface-cardDark md:rounded-2xl shadow-modal border border-line dark:border-line-dark overflow-y-auto">
            {children}
          </div>
        ) : deviceFrame ? (
          // Smartphone Bezel: Desktop gets realistic iPhone bezel frame; Mobile gets edge-to-edge native app feel
          <div className="relative w-full max-w-full md:max-w-[405px] h-[100dvh] md:h-[844px] md:max-h-[92vh] bg-surface dark:bg-surface-dark md:bg-slate-950 rounded-none md:rounded-[52px] shadow-none md:shadow-[0_25px_60px_-15px_rgba(15,23,42,0.4)] p-0 md:p-3 md:ring-1 md:ring-slate-800 md:border-4 md:border-slate-800/80 flex flex-col overflow-hidden">
            {/* Phone Speaker Slit (Desktop bezel only) */}
            <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-slate-800 rounded-full z-40"></div>

            {/* Internal Screen Container */}
            <div className="relative flex-1 w-full h-full bg-surface dark:bg-surface-dark rounded-none md:rounded-[42px] overflow-hidden flex flex-col">
              {/* iOS Status Bar (Desktop bezel only - real mobile devices have native status bar) */}
              <div className="hidden md:flex w-full h-10 px-7 items-center justify-between text-ink dark:text-ink-light text-xs font-bold select-none z-30 pt-1 shrink-0">
                <span className="tracking-tight text-[13px]">9:41</span>
                {/* Dynamic Island Pill */}
                <div className="w-24 h-5 bg-black rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></div>
                  <span className="text-[9px] text-white/90 font-mono tracking-wider font-normal">KAMPUZ</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-extrabold">5G</span>
                  <Wifi size={13} />
                  <Battery size={15} className="fill-current" />
                </div>
              </div>

              {/* Viewport Content */}
              <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col relative">
                {children}
              </div>

              {/* iOS Home Indicator Bar (Desktop bezel only - real phones have native gesture bar) */}
              <div className="hidden md:flex w-full h-5 items-center justify-center shrink-0 z-30 pb-1">
                <div className="w-32 h-1 bg-ink/25 dark:bg-ink-light/25 rounded-full"></div>
              </div>
            </div>
          </div>
        ) : (
          // Responsive Full Width Mode
          <div className="w-full max-w-md h-full md:h-[calc(100vh-76px)] bg-surface dark:bg-surface-dark md:rounded-2xl shadow-modal border border-line dark:border-line-dark flex flex-col overflow-hidden">
            <div className="flex-1 w-full overflow-y-auto flex flex-col">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
