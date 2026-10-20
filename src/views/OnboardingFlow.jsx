import React, { useState, useEffect } from 'react';
import { useStore } from '../data/store';
import {
  SEDES_UTP,
  CARRERAS_UTP,
  INTERESES_DISPONIBLES,
  HABILIDADES_BASE_NUEVO_ALUMNO
} from '../data/mockData';
import {
  isEmailAllowed,
  signInWithOtp,
  verifyOtp,
  getProfile,
  saveProfile
} from '../lib/auth';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Building,
  GraduationCap,
  Calendar,
  Sparkles,
  Info,
  AlertCircle,
  Zap,
  Check,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function OnboardingFlow() {
  const {
    currentScreen,
    setCurrentScreen,
    user,
    setUser,
    toggleConsentimiento,
    loginDirectoDemo
  } = useStore();

  const isModoDemo = import.meta.env.VITE_MODO_DEMO === 'true';

  // Mode: 'login' | 'registro'
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reenviar OTP timer
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Form profile state (M03)
  const [formData, setFormData] = useState({
    nombre: user?.nombre && user?.id !== 'usr_luz' ? user.nombre : '',
    apellido: user?.apellido && user?.id !== 'usr_luz' ? user.apellido : '',
    sede: user?.sede || 'Lima Sur',
    carrera: user?.carrera || 'Enfermería',
    ciclo: user?.ciclo || 1,
    fechaNacimiento: user?.fechaNacimiento || '2005-01-01'
  });

  const [selectedIntereses, setSelectedIntereses] = useState(
    user?.intereses && user?.id !== 'usr_luz' ? user.intereses : []
  );

  // Consentimientos locales (M05): 4 apagado por defecto (Ley 29733)
  const [localConsentimientos, setLocalConsentimientos] = useState({
    cuenta: true,
    encuestas: true,
    metricas: true,
    perfil_universidad: false
  });

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo institucional.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Validar si el correo es @utp.edu.pe o invitado
      const allowed = await isEmailAllowed(cleanEmail);
      if (!allowed) {
        setErrorMsg('Solo se aceptan correos institucionales (@utp.edu.pe) o invitados registrados.');
        setIsLoading(false);
        return;
      }

      // 2. Solicitar OTP a Supabase
      const res = await signInWithOtp(cleanEmail);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al enviar código de verificación.');
        setIsLoading(false);
        return;
      }

      // Éxito: pasar a pantalla de OTP e iniciar cooldown de 30s
      setResendCooldown(30);
      setOtpCode(['', '', '', '', '', '']);
      setCurrentScreen('m02_otp');
    } catch (err) {
      setErrorMsg('No se pudo conectar con el servidor de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMsg('');
    const res = await signInWithOtp(email);
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Error al reenviar el código.');
    } else {
      setResendCooldown(30);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const entered = otpCode.join('');
    if (entered.length < 6) {
      setErrorMsg('Ingresa el código completo de 6 dígitos.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await verifyOtp(email, entered);
      if (!res.success) {
        setErrorMsg(res.error || 'Código incorrecto o vencido.');
        setIsLoading(false);
        return;
      }

      const authUser = res.user;

      // Consultar si ya tiene perfil registrado en Supabase
      const existingProfile = await getProfile(authUser.id);

      if (existingProfile && existingProfile.nombre) {
        // Usuario recurrente con perfil completo: entrar a la app
        setUser({
          ...existingProfile,
          correoInstitucional: authUser.email,
          habilidades: existingProfile.habilidades || HABILIDADES_BASE_NUEVO_ALUMNO,
          certificados: existingProfile.certificados || [],
          medallas: []
        });
        setCurrentScreen('app');
      } else {
        // Alumno nuevo: continuar al onboarding de datos académicos
        setUser(prev => ({
          ...(prev || {}),
          id: authUser.id,
          correoInstitucional: authUser.email
        }));
        setCurrentScreen('m03_onboarding');
      }
    } catch (err) {
      setErrorMsg('Ocurrió un error al verificar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      setErrorMsg('Completa tu nombre y apellido.');
      return;
    }
    setErrorMsg('');
    setCurrentScreen('m04_intereses');
  };

  const toggleInteres = (interes) => {
    if (selectedIntereses.includes(interes)) {
      setSelectedIntereses(selectedIntereses.filter(i => i !== interes));
    } else {
      setSelectedIntereses([...selectedIntereses, interes]);
    }
  };

  const handleInteresesSubmit = () => {
    if (selectedIntereses.length < 2) {
      setErrorMsg('Elige al menos 2 intereses para calibrar tu red.');
      return;
    }
    setErrorMsg('');
    setCurrentScreen('m05_consentimientos');
  };

  const handleConsentimientosFinalize = async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const userId = user?.id;
      if (!userId) {
        setErrorMsg('Error de sesión: vuelve a ingresar tu código.');
        setIsLoading(false);
        return;
      }

      const profilePayload = {
        correoInstitucional: email || user.correoInstitucional,
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        sede: formData.sede,
        carrera: formData.carrera,
        ciclo: Number(formData.ciclo),
        fechaNacimiento: formData.fechaNacimiento,
        intereses: selectedIntereses,
        rol: 'alumno'
      };

      const res = await saveProfile(userId, profilePayload, localConsentimientos);
      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo guardar el perfil.');
        setIsLoading(false);
        return;
      }

      // Actualizar el estado global con el perfil real
      setUser({
        id: userId,
        ...profilePayload,
        consentimientos: localConsentimientos,
        habilidades: HABILIDADES_BASE_NUEVO_ALUMNO,
        certificados: [],
        medallas: []
      });

      setCurrentScreen('app');
    } catch (err) {
      setErrorMsg('Error al finalizar el registro.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- M01: BIENVENIDA Y ACCESO (LOGIN / REGISTRO) ---
  if (currentScreen === 'm01_bienvenida') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div className="pt-2">
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-black text-2xl shadow-md">
                Z
              </div>
              <div>
                <span className="font-black text-lg tracking-tight text-ink dark:text-ink-light block leading-none">
                  KAMPUZ
                </span>
                <span className="text-xs text-accent font-bold">UTP Sede Lima Sur</span>
              </div>
            </div>

            <span className="text-xs bg-brand-primary-soft dark:bg-brand-dark text-brand-primary dark:text-teal-300 font-extrabold px-3 py-1 rounded-full border border-brand-primary/20">
              Red Cerrada
            </span>
          </div>

          {/* Quick Demo Access Bar (Solo visible si VITE_MODO_DEMO=true) */}
          {isModoDemo && (
            <button
              onClick={loginDirectoDemo}
              className="w-full mb-4 p-3 bg-gradient-to-r from-accent to-teal-700 text-white rounded-2xl shadow-md hover:opacity-95 transition flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5 text-left">
                <Zap size={18} className="text-amber-300 fill-amber-300 shrink-0" />
                <div>
                  <span className="text-xs font-black block leading-tight">Acceso Rápido Presentación Demo</span>
                  <span className="text-xs text-teal-100 font-medium">Entrar directo como Luz Martínez (Enfermería C5)</span>
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0" />
            </button>
          )}

          {/* Main Title & Value Prop */}
          <h1 className="text-xl font-black text-ink dark:text-ink-light tracking-tight mt-2 mb-1">
            Conecta con tu comunidad universitaria
          </h1>
          <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed mb-4 font-medium">
            Identidad real verificada con tu correo UTP. Sin anónimos ni personas ajenas a tu campus.
          </p>

          {/* Auth Mode Toggle (Login vs Registro) */}
          <div className="flex bg-white dark:bg-surface-cardDark p-1.5 rounded-2xl border border-line dark:border-line-dark shadow-sm mb-4">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition ${
                authMode === 'login'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('registro'); setErrorMsg(''); }}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition ${
                authMode === 'registro'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Form Card */}
          <div className="k-card p-4 space-y-4 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1.5">
                  Correo Institucional UTP
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alumno@utp.edu.pe"
                    className="w-full pl-10 pr-4 py-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light focus:outline-none focus:border-brand-primary dark:focus:border-accent"
                    required
                    disabled={isLoading}
                  />
                  <Mail className="absolute left-3.5 top-3.5 text-ink-muted" size={17} />
                </div>
                {errorMsg && (
                  <p className="text-xs text-semantic-danger mt-1.5 flex items-center space-x-1 font-semibold">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>{authMode === 'login' ? 'Continuar con código' : 'Iniciar registro'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2.5 border-t border-line dark:border-line-dark flex items-center justify-between text-xs text-ink-muted">
              <span>Piloto Sede Lima Sur</span>
              <span className="font-bold text-accent">Ley 29733 Perú</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-ink-muted pt-3 pb-1 font-medium">
          Al continuar confirmas ser estudiante activo de la Universidad Tecnológica del Perú.
        </p>
      </div>
    );
  }

  // --- M02: CÓDIGO OTP 6 DÍGITOS ---
  if (currentScreen === 'm02_otp') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn">
        <div>
          <button
            onClick={() => setCurrentScreen('m01_bienvenida')}
            className="p-1 -ml-1 text-ink-muted hover:text-ink mb-4 flex items-center space-x-1 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>

          <div className="k-card p-5 space-y-4 border-2 border-line/80 dark:border-line-dark rounded-3xl shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              <Lock size={22} />
            </div>

            <div>
              <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight">
                Código de Verificación
              </h1>
              <p className="text-xs text-ink-soft dark:text-ink-muted mt-1 font-medium">
                Enviamos un código de 6 dígitos a <strong className="text-ink dark:text-ink-light">{email}</strong>
              </p>
            </div>

            {/* OTP Digits (Sin código precargado fijo) */}
            <div className="flex justify-between gap-1.5 py-1">
              {otpCode.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={isLoading}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newOtp = [...otpCode];
                    newOtp[index] = val;
                    setOtpCode(newOtp);
                    if (val && index < 5) {
                      document.getElementById(`otp-${index + 1}`)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
                      document.getElementById(`otp-${index - 1}`)?.focus();
                    }
                  }}
                  className="w-11 h-14 text-center text-xl font-black bg-white dark:bg-surface-dark border-2 border-line dark:border-line-dark rounded-2xl text-ink dark:text-ink-light focus:outline-none focus:border-accent"
                />
              ))}
            </div>

            {errorMsg && (
              <p className="text-xs text-semantic-danger text-center font-semibold">{errorMsg}</p>
            )}

            <button
              onClick={handleOtpSubmit}
              disabled={isLoading}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>Verificar código</span>
                  <CheckCircle2 size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resendCooldown > 0 || isLoading}
          className="text-center text-xs text-ink-muted hover:text-ink py-2 font-medium disabled:opacity-50 flex items-center justify-center space-x-1 mx-auto"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          <span>
            {resendCooldown > 0
              ? `¿No recibiste el correo? Reenviar en ${resendCooldown}s`
              : 'Reenviar código de 6 dígitos'}
          </span>
        </button>
      </div>
    );
  }

  // --- M03: PERFIL DECLARADO ---
  if (currentScreen === 'm03_onboarding') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div>
          <span className="text-xs font-black text-accent uppercase tracking-wider">Paso 1 de 3</span>
          <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-0.5 mb-1">
            Datos Académicos
          </h1>
          <p className="text-xs text-ink-soft dark:text-ink-muted mb-3 font-medium">
            Identidad real para interactuar con tus compañeros de sede.
          </p>

          <form id="profile-form" onSubmit={handleProfileSubmit} className="k-card p-4 space-y-3.5 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Tu nombre real"
                  className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Apellido</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  placeholder="Tu apellido"
                  className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Sede UTP</label>
              <select
                value={formData.sede}
                onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
              >
                {SEDES_UTP.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Carrera</label>
              <select
                value={formData.carrera}
                onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
              >
                {CARRERAS_UTP.map(c => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Ciclo</label>
                <select
                  value={formData.ciclo}
                  onChange={(e) => setFormData({ ...formData, ciclo: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                    <option key={c} value={c}>{c}.° Ciclo</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink dark:text-ink-light mb-1">Fec. Nacimiento</label>
                <input
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl text-sm font-semibold text-ink dark:text-ink-light"
                  required
                />
              </div>
            </div>

            <div className="p-2.5 bg-slate-100 dark:bg-surface-dark rounded-xl text-xs text-ink-muted">
              Datos declarados bajo declaración jurada. Verificados al validar con base institucional UTP.
            </div>

            {errorMsg && (
              <p className="text-xs text-semantic-danger font-semibold">{errorMsg}</p>
            )}
          </form>
        </div>

        <div className="pt-3 pb-1">
          <button
            type="submit"
            form="profile-form"
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
          >
            <span>Continuar a Intereses</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // --- M04: SELECCIÓN DE INTERESES ---
  if (currentScreen === 'm04_intereses') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div>
          <button
            onClick={() => setCurrentScreen('m03_onboarding')}
            className="p-1 -ml-1 text-ink-muted hover:text-ink mb-3 flex items-center space-x-1 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span>Atrás</span>
          </button>

          <span className="text-xs font-black text-accent uppercase tracking-wider">Paso 2 de 3</span>
          <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-0.5 mb-1">
            Tus Intereses Académicos
          </h1>
          <p className="text-xs text-ink-soft dark:text-ink-muted mb-3 font-medium">
            Elige temas para recibir encuestas afines y recomendarte talleres oficiales.
          </p>

          <div className="k-card p-4 mb-3 border-2 border-line/80 dark:border-line-dark rounded-2xl shadow-sm">
            <div className="flex flex-wrap gap-2">
              {INTERESES_DISPONIBLES.map((interes) => {
                const selected = selectedIntereses.includes(interes);
                return (
                  <button
                    key={interes}
                    type="button"
                    onClick={() => toggleInteres(interes)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                      selected
                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                        : 'bg-surface dark:bg-surface-dark text-ink dark:text-ink-light border-line dark:border-line-dark hover:border-brand-primary/40'
                    }`}
                  >
                    {selected && <Check size={13} className="inline mr-1 stroke-[3]" />}
                    <span>{interes}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-surface-cardDark rounded-xl border border-line dark:border-line-dark text-xs text-ink-muted">
            <strong className="text-ink dark:text-ink-light">Privacidad:</strong> Los intereses se registran en tu perfil para filtrar encuestas, no dependen de los grupos en los que participes.
          </div>

          {errorMsg && (
            <p className="text-xs text-semantic-danger mt-2 font-bold">{errorMsg}</p>
          )}
        </div>

        <div className="pt-3 pb-1">
          <button
            onClick={handleInteresesSubmit}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
          >
            <span>Continuar a Consentimientos</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // --- M05: CONSENTIMIENTOS LEGALES (LEY 29733) ---
  if (currentScreen === 'm05_consentimientos') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div>
          <button
            onClick={() => setCurrentScreen('m04_intereses')}
            className="p-1 -ml-1 text-ink-muted hover:text-ink mb-2 flex items-center space-x-1 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span>Atrás</span>
          </button>

          <span className="text-xs font-black text-accent uppercase tracking-wider">Paso 3 de 3 — Legal Perú</span>
          <h1 className="text-lg font-black text-ink dark:text-ink-light tracking-tight mt-0.5 mb-1">
            Consentimientos Separados (Ley 29733)
          </h1>
          <p className="text-xs text-ink-soft dark:text-ink-muted mb-3 font-medium">
            Cada finalidad requiere tu autorización explícita e independiente.
          </p>

          <div className="space-y-3">
            {/* Consentimiento 1: Cuenta (Obligatorio, bloqueado) */}
            <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark rounded-xl">
              <div>
                <span className="text-xs font-black text-ink dark:text-ink-light block">1. Crear y operar tu cuenta</span>
                <span className="text-xs text-ink-muted">Identificación con carrera y ciclo institucional</span>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-ink-muted font-bold px-2.5 py-1 rounded-lg">
                Necesario
              </span>
            </div>

            {/* Consentimiento 2: Encuestas (Activo por defecto) */}
            <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark rounded-xl">
              <div>
                <span className="text-xs font-black text-ink dark:text-ink-light block">2. Recibir encuestas de alumnos</span>
                <span className="text-xs text-ink-muted">Máx 3 por semana en bandeja (anónimo)</span>
              </div>
              <input
                type="checkbox"
                checked={localConsentimientos.encuestas}
                onChange={(e) => setLocalConsentimientos({
                  ...localConsentimientos,
                  encuestas: e.target.checked
                })}
                className="w-5 h-5 accent-accent rounded cursor-pointer"
              />
            </div>

            {/* Consentimiento 3: Métricas (Activo por defecto) */}
            <div className="k-card p-3.5 flex items-center justify-between border border-line dark:border-line-dark rounded-xl">
              <div>
                <span className="text-xs font-black text-ink dark:text-ink-light block">3. Métricas agregadas para UTP</span>
                <span className="text-xs text-ink-muted">Estadísticas anónimas con umbral ≥ 30 personas</span>
              </div>
              <input
                type="checkbox"
                checked={localConsentimientos.metricas}
                onChange={(e) => setLocalConsentimientos({
                  ...localConsentimientos,
                  metricas: e.target.checked
                })}
                className="w-5 h-5 accent-accent rounded cursor-pointer"
              />
            </div>

            {/* Consentimiento 4: Compartir perfil con UTP (APAGADO por defecto) */}
            <div className={`p-4 rounded-2xl border-2 transition ${
              localConsentimientos.perfil_universidad
                ? 'bg-accent-soft/40 dark:bg-accent-dark/30 border-accent shadow-sm'
                : 'bg-white dark:bg-surface-cardDark border-line dark:border-line-dark'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-brand-primary dark:text-teal-300">
                  4. Que tu universidad vea lo que haces aquí
                </span>
                <input
                  type="checkbox"
                  checked={localConsentimientos.perfil_universidad}
                  onChange={(e) => setLocalConsentimientos({
                    ...localConsentimientos,
                    perfil_universidad: e.target.checked
                  })}
                  className="w-5 h-5 accent-accent rounded cursor-pointer"
                />
              </div>

              <p className="text-xs text-ink-soft dark:text-ink-muted leading-relaxed">
                La UTP tiene programas como <strong>Impulsa</strong> y <strong>Generación Top</strong>, y hoy solo puede encontrarte por tu promedio. Si activas esto, cuando tu universidad se sume a Kampuz también va a ver lo que construiste aquí: a cuántos compañeros asesoraste, qué grupos creaste, en qué te has venido formando.
              </p>

              <div className="mt-2.5 pt-2 border-t border-line dark:border-line-dark text-xs text-ink-muted space-y-1">
                <p><strong>Qué se comparte:</strong> tu nombre, tu carrera, tu ciclo y tu perfil de habilidades con su evidencia.</p>
                <p><strong>Qué no:</strong> tus mensajes, tus chats, ni qué respondiste en las encuestas.</p>
                <p className="italic text-accent font-bold">Apagado por defecto. Puedes apagarlo cuando quieras.</p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-semantic-danger mt-2 font-bold">{errorMsg}</p>
          )}
        </div>

        <div className="pt-3 pb-1">
          <button
            onClick={handleConsentimientosFinalize}
            disabled={isLoading}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Finalizar y entrar a Kampuz</span>
                <CheckCircle2 size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
