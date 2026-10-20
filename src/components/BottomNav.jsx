import React from 'react';
import { useStore } from '../data/store';
import { Home, Compass, MessageSquare, ClipboardList, User } from 'lucide-react';

export default function BottomNav() {
  const { activeTab, setActiveTab, encuestasBandeja } = useStore();

  const pendientesCount = encuestasBandeja.filter(e => e.estado === 'pendiente').length;

  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'explorar', label: 'Explorar', icon: Compass },
    { id: 'grupos', label: 'Grupos', icon: MessageSquare },
    {
      id: 'encuestas',
      label: 'Encuestas',
      icon: ClipboardList,
      badge: pendientesCount > 0 ? pendientesCount : null
    },
    { id: 'perfil', label: 'Perfil', icon: User }
  ];

  return (
    <nav className="w-full bg-white dark:bg-surface-cardDark border-t border-line dark:border-line-dark flex items-center justify-around pt-2 pb-3.5 md:pb-2 px-2 shrink-0 select-none z-20 shadow-md">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 ${
              isActive
                ? 'text-brand-primary dark:text-accent font-black scale-105'
                : 'text-ink-muted hover:text-ink dark:hover:text-ink-light font-bold'
            }`}
          >
            <div className="relative">
              <Icon size={23} strokeWidth={isActive ? 2.5 : 2} />
              {tab.badge && (
                <span className="absolute -top-1.5 -right-2.5 bg-accent text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-surface-cardDark">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-xs mt-1 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
