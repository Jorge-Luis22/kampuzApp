import React from 'react';
import { StoreProvider, useStore } from './data/store';
import PhoneShell from './components/PhoneShell';
import BottomNav from './components/BottomNav';
import OnboardingFlow from './views/OnboardingFlow';
import InicioView from './views/InicioView';
import ExplorarView from './views/ExplorarView';
import GruposView from './views/GruposView';
import EncuestasView from './views/EncuestasView';
import PerfilView from './views/PerfilView';
import PanelUniversidadView from './views/PanelUniversidadView';

function AppContent() {
  const { currentScreen, activeTab } = useStore();

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
