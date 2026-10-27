import React, { useState, useEffect } from 'react';
import { useStore } from '../data/store';
import { fetchBandejaEncuestas } from '../lib/surveys';
import { fetchSolicitudes } from '../lib/explore';
import { fetchConversaciones } from '../lib/chat';
import { Home, Flame, Users, MessageCircle, User } from 'lucide-react';

// Pantallas fuera de la barra: se marca la pestaña desde la que se abren
const PESTANA_DE = { explorar: 'inicio', proyectos: 'inicio', encuestas: 'perfil' };

export default function BottomNav() {
  const { activeTab, setActiveTab, user } = useStore();
  const [pendientesEncuestas, setPendientesEncuestas] = useState(0);
  const [pendientesChats, setPendientesChats] = useState(0);

  // Contadores reales; se actualizan al cambiar de pestaña (cada vista muestra su propio error)
  useEffect(() => {
    let vigente = true;
    fetchBandejaEncuestas()
      .then((bandeja) => vigente && setPendientesEncuestas(bandeja.filter((e) => e.estado === 'pendiente').length))
      .catch(() => {});
    Promise.all([fetchSolicitudes(), fetchConversaciones()])
      .then(([{ recibidas }, conversaciones]) => {
        if (!vigente) return;
        const solicitudes = recibidas.filter((s) => s.estado === 'pendiente').length;
        const noLeidos = conversaciones.reduce((n, c) => n + (c.noLeidos || 0), 0);
        setPendientesChats(solicitudes + noLeidos);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [activeTab, user?.id]);

  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'tablon', label: 'Tablón', icon: Flame },
    { id: 'grupos', label: 'Grupos', icon: Users },
    { id: 'chats', label: 'Chats', icon: MessageCircle, badge: pendientesChats || null },
    { id: 'perfil', label: 'Perfil', icon: User, badge: pendientesEncuestas || null }
  ];
  const marcada = PESTANA_DE[activeTab] || activeTab;

  return (
    // El relleno inferior incluye el área de los botones o gestos de Android: la barra
    // queda encima de ellos y su fondo blanco se extiende por debajo.
    <nav className="w-full bg-white dark:bg-surface-cardDark border-t border-line dark:border-line-dark flex items-center justify-around pt-2 pb-[calc(var(--sab)+0.5rem)] px-1 shrink-0 select-none z-20 shadow-md">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = marcada === tab.id;

        return (
          <button
            key={tab.id}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 ${
              isActive ? 'text-brand-primary dark:text-accent font-black' : 'text-ink-muted hover:text-ink dark:hover:text-ink-light font-bold'
            }`}
          >
            <div className="relative">
              <Icon size={23} strokeWidth={isActive ? 2.5 : 2} />
              {tab.badge && (
                <span className="absolute -top-1.5 -right-2.5 bg-accent text-white text-[10px] font-black min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-surface-cardDark">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span className={`text-xs mt-1 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
