import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="bg-rose-600 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-center space-x-2 shrink-0 z-40 animate-fadeIn">
        <WifiOff size={14} className="shrink-0" />
        <span>Sin conexión a internet. Mostrando datos locales.</span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className="bg-emerald-600 text-white px-3 py-1 text-xs font-bold flex items-center justify-center space-x-1.5 shrink-0 z-40 animate-fadeIn">
        <Wifi size={13} className="shrink-0" />
        <span>Conexión restablecida</span>
      </div>
    );
  }

  return null;
}
