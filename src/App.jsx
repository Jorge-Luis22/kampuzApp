import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './data/store';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { manejarAtras } from './lib/atras';
import { Loader2 } from 'lucide-react';
import PhoneShell from './components/PhoneShell';
import BottomNav from './components/BottomNav';
import OfflineBanner from './components/OfflineBanner';
import OnboardingFlow from './views/OnboardingFlow';
import InicioView from './views/InicioView';
import ExplorarView from './views/ExplorarView';
import GruposView from './views/GruposView';
import EncuestasView from './views/EncuestasView';
import PerfilView from './views/PerfilView';
import PanelUniversidadView from './views/PanelUniversidadView';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-surface-cardDark min-h-[300px]">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-black text-ink dark:text-ink-light mb-1">
            Algo no cargó correctamente
          </h2>
          <p className="text-xs text-ink-muted mb-4 max-w-xs">
            {this.state.error?.message || 'Ocurrió un error inesperado al renderizar esta sección.'}
          </p>
          <button
            onClick={() => {
              try { localStorage.clear(); } catch(e) {}
              window.location.reload();
            }}
            className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-xl shadow-sm hover:bg-accent-hover transition"
          >
            Reiniciar y limpiar sesión
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const {
    user,
    estadoSesion,
    errorSesion,
    reintentarSesion,
    cerrarSesion,
    currentScreen,
    setCurrentScreen,
    activeTab,
    setActiveTab,
    activeEspacioId,
    setActiveEspacioId,
    activeConsultaId,
    setActiveConsultaId,
    darkMode
  } = useStore();

  // Íconos de la barra de estado y de navegación según el tema de la app (no el del
  // teléfono): claros sobre fondo oscuro, oscuros sobre fondo claro.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SystemBars.setStyle({ style: darkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }, [darkMode]);

  // Control del botón atrás de Android (Fase 8)
  // Navega hacia atrás dentro de la app; en Inicio, sale.
  useEffect(() => {
    let backListener;
    const initBackButton = async () => {
      try {
        backListener = await CapacitorApp.addListener('backButton', () => {
          // Primero se cierra lo que esté abierto encima (chat, panel, modal)
          if (manejarAtras()) return;
          if (activeConsultaId) {
            setActiveConsultaId(null);
            return;
          }
          if (activeEspacioId) {
            setActiveEspacioId(null);
            return;
          }
          if (currentScreen === 'm05_consentimientos') {
            setCurrentScreen('m04_intereses');
            return;
          }
          if (currentScreen === 'm04_intereses') {
            setCurrentScreen('m03_onboarding');
            return;
          }
          if (currentScreen === 'm02_otp') {
            setCurrentScreen('m01_bienvenida');
            return;
          }
          if (activeTab !== 'inicio') {
            setActiveTab('inicio');
            return;
          }
          // En Inicio, sale de la app
          CapacitorApp.exitApp();
        });
      } catch (e) {
        // En entorno web puro se ignora
      }
    };

    initBackButton();

    return () => {
      if (backListener && backListener.remove) {
        backListener.remove();
      }
    };
  }, [currentScreen, activeTab, activeEspacioId, activeConsultaId]);

  // If in University Web Panel mode
  if (currentScreen === 'panel_utp') {
    return <PanelUniversidadView />;
  }

  // Leyendo la sesión de Supabase
  if (estadoSesion === 'cargando') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-ink-muted space-y-2">
        <Loader2 size={26} className="animate-spin text-accent" />
        <p className="text-xs font-semibold">Conectando con Kampuz...</p>
      </div>
    );
  }

  // Hay sesión pero el servidor no respondió: nunca se entra con datos inventados
  if (estadoSesion === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <OfflineBanner />
        <p className="text-sm font-black text-ink dark:text-ink-light">No pudimos cargar tu perfil</p>
        <p className="text-xs text-ink-muted max-w-xs">{errorSesion}</p>
        <div className="flex items-center space-x-2">
          <button
            onClick={reintentarSesion}
            className="px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-xl shadow-sm"
          >
            Reintentar
          </button>
          <button
            onClick={cerrarSesion}
            className="px-4 py-2 text-xs font-bold text-ink-muted hover:text-ink"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado o está en flujo de acceso / registro
  if (
    !user ||
    estadoSesion !== 'lista' ||
    currentScreen === 'm01_bienvenida' ||
    currentScreen === 'm02_otp' ||
    currentScreen === 'm03_onboarding' ||
    currentScreen === 'm04_intereses' ||
    currentScreen === 'm05_consentimientos'
  ) {
    return <OnboardingFlow />;
  }

  // Main Mobile App with 5-tab Bottom Navigation
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <OfflineBanner />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'inicio' && <InicioView />}
        {activeTab === 'explorar' && <ExplorarView />}
        {activeTab === 'grupos' && <GruposView />}
        {activeTab === 'encuestas' && <EncuestasView />}
        {activeTab === 'perfil' && <PerfilView />}
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ErrorBoundary>
        <PhoneShell>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </PhoneShell>
      </ErrorBoundary>
    </StoreProvider>
  );
}
