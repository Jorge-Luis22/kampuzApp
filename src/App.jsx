import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './data/store';
import { App as CapacitorApp } from '@capacitor/app';
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

function AppContent() {
  const {
    currentScreen,
    setCurrentScreen,
    activeTab,
    setActiveTab,
    activeEspacioId,
    setActiveEspacioId,
    activeConsultaId,
    setActiveConsultaId
  } = useStore();

  // Control del botón atrás de Android (Fase 8)
  // Navega hacia atrás dentro de la app; en Inicio, sale.
  useEffect(() => {
    let backListener;
    const initBackButton = async () => {
      try {
        backListener = await CapacitorApp.addListener('backButton', () => {
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

  // If in University Web Panel mode (W01-W06)
  if (currentScreen === 'panel_utp') {
    return <PanelUniversidadView />;
  }

  // If in Onboarding / Registration screens (M01-M05)
  if (
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
      <PhoneShell>
        <AppContent />
      </PhoneShell>
    </StoreProvider>
  );
}
