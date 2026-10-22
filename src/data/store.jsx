// Estado de interfaz de Kampuz.
// La sesión y los datos compartidos viven SOLO en Supabase. Aquí solo hay estado
// de UI (pestaña activa, modo oscuro, pantalla) y el perfil del usuario con sesión.
import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
// METRICAS_PANEL_UTP: el panel de la universidad (W01–W06) sigue con datos de ejemplo
// por decisión del MVP (docs/DECISIONES.md). HABILIDADES_BASE_NUEVO_ALUMNO es el estado
// en cero mientras llega el cálculo real del servidor.
import { METRICAS_PANEL_UTP, HABILIDADES_BASE_NUEVO_ALUMNO } from './mockData';
import { supabase, isSupabaseConfigured, mensajeError } from '../lib/supabase';
import { obtenerPerfil, cerrarSesion as cerrarSesionAuth } from '../lib/auth';
import { calcularHabilidadesReales, fetchCertificados, fetchConsentimientos } from '../lib/profile';

const StoreContext = createContext(null);

// Claves que versiones anteriores guardaban en el dispositivo: usuarios con
// contraseñas en texto plano, OTP generados en el cliente, chats y solicitudes
// "locales". Se borran al abrir la app.
const CLAVES_LOCALES_OBSOLETAS = [
  'kampus_usuarios_registrados_v1',
  'kampus_solicitudes_conexion_v1',
  'kampus_conversaciones_v1',
  'kampus_mensajes_directos_v1',
  'kampus_active_otp_v1',
  'kampus_last_event'
];

function limpiarDatosLocalesObsoletos() {
  try {
    CLAVES_LOCALES_OBSOLETAS.forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage)
      .filter((k) => k.startsWith('kampus_state_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    // Almacenamiento no disponible: nada que limpiar
  }
}

// Preferencias de interfaz (lo único que se guarda en el dispositivo además de la sesión de Supabase)
const PREF_MODO_OSCURO = 'kampuz_pref_modo_oscuro';

function leerPreferencia(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch (e) {
    return porDefecto;
  }
}

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'cargando' | 'sin_sesion' | 'onboarding' | 'consentimientos' | 'lista' | 'error'
  const [estadoSesion, setEstadoSesion] = useState('cargando');
  const [errorSesion, setErrorSesion] = useState('');
  // Evita recargar el perfil si Supabase repite SIGNED_IN para el mismo usuario (p. ej. al volver a la pestaña)
  const uidCargadoRef = useRef(null);
  const consentimientosCompletosRef = useRef(true);

  const [activeTab, setActiveTab] = useState('inicio'); // 'inicio' | 'explorar' | 'grupos' | 'encuestas' | 'perfil'
  const [currentScreen, setCurrentScreen] = useState('m01_bienvenida'); // 'app' | 'm01_bienvenida' | 'm02_otp' | 'm03_onboarding' | 'm04_intereses' | 'm05_consentimientos' | 'panel_utp'
  const [activeEspacioId, setActiveEspacioId] = useState(null);
  const [activeConsultaId, setActiveConsultaId] = useState(null);
  // Pedidos al tablón desde otras pantallas: abrir con un filtro o con el panel de publicar
  const [tablonFiltro, setTablonFiltro] = useState(null);
  const [tablonPublicar, setTablonPublicar] = useState(null);

  const [deviceFrame, setDeviceFrame] = useState(true);
  const [darkMode, setDarkMode] = useState(() => leerPreferencia(PREF_MODO_OSCURO, false));

  useEffect(() => {
    limpiarDatosLocalesObsoletos();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(PREF_MODO_OSCURO, JSON.stringify(darkMode));
    } catch (e) {}
  }, [darkMode]);

  /**
   * Carga el perfil del usuario con sesión real. Sin perfil → onboarding.
   * Si el servidor no responde, se muestra el error con opción de reintentar.
   */
  const cargarSesion = useCallback(async (session) => {
    if (!session?.user) {
      uidCargadoRef.current = null;
      setUser(null);
      setEstadoSesion('sin_sesion');
      setCurrentScreen('m01_bienvenida');
      return;
    }

    setEstadoSesion('cargando');
    setErrorSesion('');
    try {
      const perfil = await obtenerPerfil(session.user.id);
      if (perfil) {
        // Los 4 consentimientos se leen de la tabla (antes estaban fijos en el código)
        const consentimientos = await fetchConsentimientos();
        uidCargadoRef.current = session.user.id;
        consentimientosCompletosRef.current = consentimientos.completos;
        setUser({
          ...perfil,
          consentimientos: consentimientos.valores,
          habilidades: HABILIDADES_BASE_NUEVO_ALUMNO,
          certificados: []
        });
        if (!perfil.usuario) {
          // Cuentas creadas antes del @usuario: lo eligen antes de entrar a la app
          setEstadoSesion('elegir_usuario');
          setCurrentScreen('m_elegir_usuario');
          return;
        }
        if (!consentimientos.completos) {
          // Cuentas creadas antes de los 4 consentimientos: deben decidir antes de entrar (M05)
          setEstadoSesion('consentimientos');
          setCurrentScreen('m05_consentimientos');
          return;
        }
        setEstadoSesion('lista');
        setCurrentScreen((pantalla) => (pantalla === 'panel_utp' ? pantalla : 'app'));
      } else {
        const meta = session.user.user_metadata || {};
        setUser({
          id: session.user.id,
          correoInstitucional: session.user.email,
          nombre: meta.nombre || '',
          apellido: meta.apellido || '',
          usuario: meta.usuario || ''
        });
        setEstadoSesion('onboarding');
        setCurrentScreen('m03_onboarding');
      }
    } catch (err) {
      setErrorSesion(mensajeError(err));
      setEstadoSesion('error');
    }
  }, []);

  // Habilidades (calculadas en el servidor a partir de los hechos) y certificados
  const refrescarHabilidades = useCallback(async () => {
    const uid = uidCargadoRef.current;
    if (!uid) return;
    try {
      const [habilidades, certificados] = await Promise.all([
        calcularHabilidadesReales(uid),
        fetchCertificados(uid)
      ]);
      setUser((prev) => (prev?.id === uid ? { ...prev, habilidades, certificados } : prev));
    } catch (err) {
      console.warn('[Kampuz] No se pudieron actualizar las habilidades:', err.message);
    }
  }, []);

  useEffect(() => {
    if (estadoSesion === 'lista') refrescarHabilidades();
  }, [estadoSesion, refrescarHabilidades]);

  const reintentarSesion = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await cargarSesion(data?.session);
  }, [cargarSesion]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEstadoSesion('sin_sesion');
      return;
    }

    supabase.auth.getSession().then(({ data }) => cargarSesion(data?.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        uidCargadoRef.current = null;
        setUser(null);
        setEstadoSesion('sin_sesion');
        setActiveTab('inicio');
        setCurrentScreen('m01_bienvenida');
      } else if (event === 'SIGNED_IN' && session?.user?.id !== uidCargadoRef.current) {
        // Diferido: no llamar a Supabase dentro del callback de auth (evita bloqueos del SDK)
        setTimeout(() => cargarSesion(session), 0);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, [cargarSesion]);

  // Alcance semanal según nivel de Apoyo a la investigación (spec 5.2). Solo para mostrar;
  // el servidor vuelve a calcularlo al enviar la encuesta.
  const getAlcanceSemanal = (usuario = user) => {
    const nivel = usuario?.habilidades?.apoyo_investigacion?.nivel || 0;
    return [0, 30, 80, 200][Math.min(nivel, 3)];
  };

  // Al guardar el @usuario que faltaba: sigue a los consentimientos (si faltan) o a la app
  const completarUsuario = (perfil) => {
    setUser((prev) => ({ ...prev, usuario: perfil.usuario }));
    if (!consentimientosCompletosRef.current) {
      setEstadoSesion('consentimientos');
      setCurrentScreen('m05_consentimientos');
      return;
    }
    setEstadoSesion('lista');
    setActiveTab('inicio');
    setCurrentScreen('app');
  };

  // Al terminar el onboarding, con el perfil ya guardado en Supabase
  const completarOnboarding = (perfil, consentimientos) => {
    uidCargadoRef.current = perfil.id;
    setUser({
      ...perfil,
      consentimientos: consentimientos.valores,
      habilidades: HABILIDADES_BASE_NUEVO_ALUMNO,
      certificados: []
    });
    setEstadoSesion('lista');
    setActiveTab('inicio');
    setCurrentScreen('app');
  };

  const cerrarSesion = async () => {
    await cerrarSesionAuth();
    setUser(null);
    setEstadoSesion('sin_sesion');
    setActiveTab('inicio');
    setCurrentScreen('m01_bienvenida');
  };

  return (
    <StoreContext.Provider
      value={{
        user,
        setUser,
        estadoSesion,
        errorSesion,
        reintentarSesion,
        completarOnboarding,
        completarUsuario,
        tablonFiltro,
        setTablonFiltro,
        tablonPublicar,
        setTablonPublicar,
        refrescarHabilidades,
        activeTab,
        setActiveTab,
        currentScreen,
        setCurrentScreen,
        activeEspacioId,
        setActiveEspacioId,
        activeConsultaId,
        setActiveConsultaId,
        deviceFrame,
        setDeviceFrame,
        darkMode,
        setDarkMode,
        getAlcanceSemanal,
        cerrarSesion,
        metricasPanel: METRICAS_PANEL_UTP
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
