import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../data/store';
import {
  SEDES_UTP,
  CARRERAS_UTP,
  INTERESES_DISPONIBLES,
  HABILIDADES_BASE_NUEVO_ALUMNO
} from '../data/mockData';
import {
  isEmailAllowed,
  signInWithPassword,
  signUpWithPassword,
  signInWithOtp,
  verifyOtp,
  requestPasswordReset,
  confirmPasswordReset,
  getProfile,
  saveProfile
} from '../lib/auth';
import { uploadAvatar } from '../lib/profile';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Building,
  GraduationCap,
  Calendar,
  Sparkles,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Camera,
  KeyRound,
  ExternalLink
} from 'lucide-react';

export default function OnboardingFlow() {
  const {
    currentScreen,
    setCurrentScreen,
    user,
    setUser,
    loginDirectoDemo
  } = useStore();

  const isModoDemo = import.meta.env.VITE_MODO_DEMO === 'true';

  // Modo: 'login' | 'registro' | 'recuperar'
  const [authMode, setAuthMode] = useState('login');

  // Campos de Login / Registro
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Usuario o correo
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos exclusivos de Registro
  const [regNombre, setRegNombre] = useState('');
  const [regApellido, setRegApellido] = useState('');
  const [regUsuario, setRegUsuario] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAceptaTerminos, setRegAceptaTerminos] = useState(true);

  // Campos de Recuperación de Contraseña
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetEmailTarget, setResetEmailTarget] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResetFlow, setIsResetFlow] = useState(false);

  // OTP
  const [otpCode, setOtpCode] = useState(Array(6).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback y carga
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Temporizador de reenvío OTP
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Formulario de Perfil Académico (M03)
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    sede: user?.sede || 'Lima Sur',
    carrera: user?.carrera || 'Ingeniería de Sistemas e Informática',
    ciclo: user?.ciclo || 1,
    fechaNacimiento: user?.fechaNacimiento || '2005-01-01'
  });

  const [selectedIntereses, setSelectedIntereses] = useState(
    user?.intereses && user?.id !== 'usr_luz' ? user.intereses : ['Programación', 'Inteligencia Artificial']
  );

  const [avatarUrl, setAvatarUrl] = useState(user?.fotoUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // --- SUBIR FOTO ---
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      setErrorMsg('Inicia sesión para subir tu foto.');
      return;
    }
    setIsUploadingAvatar(true);
    setErrorMsg('');
    try {
      const publicUrl = await uploadAvatar(user.id, file);
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al procesar la foto: ' + (err.message || ''));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // --- 1. ACCIÓN: INICIAR SESIÓN CON USUARIO Y CONTRASEÑA ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Ingresa tu usuario/correo y tu contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInWithPassword(loginIdentifier.trim(), loginPassword);

      if (!res.success) {
        if (res.emailNeedsConfirm) {
          setErrorMsg(res.error);
          setRegEmail(res.emailNeedsConfirm);
          setOtpCode(Array(6).fill(''));
          setIsResetFlow(false);
          setCurrentScreen('m02_otp');
          return;
        }
        setErrorMsg(res.error || 'Credenciales no válidas.');
        setIsLoading(false);
        return;
      }

      const authUser = res.user;
      const perfil = await getProfile(authUser.id);

      if (perfil && perfil.nombre) {
        setUser({
          ...perfil,
          correoInstitucional: authUser.email
        });
        setCurrentScreen('app');
      } else {
        // Usuario autenticado pero sin perfil completado
        setUser({
          id: authUser.id,
          correoInstitucional: authUser.email,
          nombre: authUser.user_metadata?.nombre || '',
          apellido: authUser.user_metadata?.apellido || '',
          usuario: authUser.user_metadata?.usuario || '',
          habilidades: HABILIDADES_BASE_NUEVO_ALUMNO
        });
        setCurrentScreen('m03_onboarding');
      }
    } catch (err) {
      setErrorMsg('Error de conexión al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. ACCIÓN: CREAR CUENTA ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanNombre = regNombre.trim();
    const cleanApellido = regApellido.trim();
    const cleanUsuario = regUsuario.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanNombre || !cleanApellido) {
      setErrorMsg('Ingresa tu nombre y apellido completo.');
      return;
    }
    if (!cleanUsuario || cleanUsuario.length < 3) {
      setErrorMsg('Elige un nombre de usuario de al menos 3 caracteres.');
      return;
    }
    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo institucional (@utp.edu.pe).');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!regAceptaTerminos) {
      setErrorMsg('Debes aceptar los Términos y la Política de Privacidad.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signUpWithPassword({
        nombre: cleanNombre,
        apellido: cleanApellido,
        usuario: cleanUsuario,
        email: cleanEmail,
        password: regPassword
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Error al crear la cuenta.');
        setIsLoading(false);
        return;
      }

      // Si requiere verificar con código enviado al correo
      setResendCooldown(30);
      setOtpCode(Array(6).fill(''));
      setIsResetFlow(false);
      setSuccessMsg('¡Código enviado! Revisa tu bandeja de correo.');
      setCurrentScreen('m02_otp');
    } catch (err) {
      setErrorMsg('Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. ACCIÓN: SOLICITAR RECUPERACIÓN DE CONTRASEÑA ---
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!resetIdentifier.trim()) {
      setErrorMsg('Ingresa tu usuario o correo institucional.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset(resetIdentifier.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo enviar el correo de recuperación.');
        setIsLoading(false);
        return;
      }

      setResetEmailTarget(res.email);
      setResendCooldown(30);
      setOtpCode(Array(6).fill(''));
      setIsResetFlow(true);
      setCurrentScreen('m02_otp');
    } catch (err) {
      setErrorMsg('Error al solicitar recuperación.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 4. MANEJO DE OTP: PEGAR Y ESCRIBIR ---
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const arr = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) {
      arr[i] = pasted[i];
    }
    setOtpCode(arr);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMsg('');
    const targetEmail = isResetFlow ? resetEmailTarget : regEmail;

    const res = isResetFlow
      ? await requestPasswordReset(targetEmail)
      : await signInWithOtp(targetEmail);

    if (res.success) {
      setResendCooldown(30);
      setSuccessMsg('Código reenviado a tu correo.');
    } else {
      setErrorMsg(res.error || 'Error al reenviar código.');
    }
  };

  // --- 5. ACCIÓN: VERIFICAR OTP (REGISTRO O RECUPERACIÓN) ---
  const handleOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    const entered = otpCode.join('');
    if (entered.length < 6) {
      setErrorMsg('Ingresa el código completo de 6 dígitos.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      // Flujo A: Recuperación de contraseña
      if (isResetFlow) {
        if (!resetNewPassword || resetNewPassword.length < 6) {
          setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
          setIsLoading(false);
          return;
        }
        if (resetNewPassword !== resetConfirmPassword) {
          setErrorMsg('Las contraseñas no coinciden.');
          setIsLoading(false);
          return;
        }

        const res = await confirmPasswordReset(resetEmailTarget, entered, resetNewPassword);
        if (!res.success) {
          setErrorMsg(res.error || 'Código incorrecto o vencido.');
          setIsLoading(false);
          return;
        }

        setSuccessMsg('¡Contraseña cambiada con éxito! Inicia sesión con tu nueva clave.');
        setAuthMode('login');
        setLoginIdentifier(resetEmailTarget);
        setLoginPassword('');
        setCurrentScreen('m01_bienvenida');
        setIsLoading(false);
        return;
      }

      // Flujo B: Verificación de cuenta nueva
      const res = await verifyOtp(regEmail, entered, 'signup');
      if (!res.success) {
        setErrorMsg(res.error || 'Código no válido o expirado.');
        setIsLoading(false);
        return;
      }

      const authUser = res.user;
      setUser({
        id: authUser.id,
        correoInstitucional: authUser.email,
        nombre: regNombre || authUser.user_metadata?.nombre || '',
        apellido: regApellido || authUser.user_metadata?.apellido || '',
        usuario: regUsuario || authUser.user_metadata?.usuario || '',
        habilidades: HABILIDADES_BASE_NUEVO_ALUMNO
      });

      setFormData(prev => ({
        ...prev,
        nombre: regNombre || prev.nombre,
        apellido: regApellido || prev.apellido
      }));

      setCurrentScreen('m03_onboarding');
    } catch (err) {
      setErrorMsg('Error al procesar la verificación.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 6. ACCIÓN: FINALIZAR PERFIL ACADÉMICO ---
  const handleFinalizarPerfil = async (e) => {
    e.preventDefault();
    if (selectedIntereses.length < 2) {
      setErrorMsg('Selecciona al menos 2 intereses.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        correoInstitucional: user?.correoInstitucional || regEmail,
        nombre: formData.nombre || user?.nombre || 'Estudiante',
        apellido: formData.apellido || user?.apellido || '',
        usuario: user?.usuario || regUsuario || (user?.correoInstitucional || '').split('@')[0],
        fotoUrl: avatarUrl,
        sede: formData.sede,
        carrera: formData.carrera,
        ciclo: Number(formData.ciclo),
        fechaNacimiento: formData.fechaNacimiento,
        intereses: selectedIntereses
      };

      if (user?.id) {
        const res = await saveProfile(user.id, payload, { perfil_universidad: false });
        if (!res.success) {
          setErrorMsg(res.error || 'Error al guardar perfil.');
          setIsLoading(false);
          return;
        }
      }

      setUser(prev => ({
        ...prev,
        ...payload,
        habilidades: prev?.habilidades || HABILIDADES_BASE_NUEVO_ALUMNO
      }));

      setCurrentScreen('app');
    } catch (err) {
      setErrorMsg('Error al finalizar el registro.');
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // PANTALLA 1: ACCESO (LOGIN / REGISTRO / RECUPERAR)
  // =========================================================================
  if (currentScreen === 'm01_bienvenida') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div className="pt-2">
          {/* Logo y Marca */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center font-black text-white text-2xl tracking-tight shadow-md">
              Z
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-xl tracking-wide text-brand-primary dark:text-teal-300">KAMPUZ</span>
                <span className="text-[11px] bg-accent/15 text-accent font-extrabold px-2 py-0.5 rounded-md">UTP</span>
              </div>
              <p className="text-xs text-ink-soft dark:text-ink-muted font-medium">
                Comunidad Universitaria de Aprendizaje
              </p>
            </div>
          </div>

          {/* Selector de Pestañas: Iniciar Sesión vs Crear Cuenta */}
          {authMode !== 'recuperar' ? (
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-4 border border-line dark:border-line-dark">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light shadow-sm'
                    : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('registro');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition ${
                  authMode === 'registro'
                    ? 'bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light shadow-sm'
                    : 'text-ink-muted hover:text-ink dark:hover:text-ink-light'
                }`}
              >
                Crear Cuenta
              </button>
            </div>
          ) : (
            <div className="mb-3">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setErrorMsg('');
                }}
                className="inline-flex items-center space-x-1.5 text-xs text-ink-muted hover:text-ink dark:hover:text-ink-light font-bold"
              >
                <ArrowLeft size={14} />
                <span>Volver a Iniciar Sesión</span>
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start space-x-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start space-x-2 text-xs text-emerald-800 dark:text-emerald-200">
              <Check size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORMULARIO: INICIAR SESIÓN */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Usuario o Correo Institucional
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-ink-muted" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ej. jorge_utp o u2320732@utp.edu.pe"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-ink dark:text-ink-light">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('recuperar');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-accent hover:underline font-bold"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-ink-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tu contraseña secreta"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-3 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-ink-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition mt-2"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Entrar a Kampuz</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORMULARIO: CREAR CUENTA */}
          {authMode === 'registro' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-black text-ink dark:text-ink-light mb-1 block">
                    Nombres
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jorge"
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-ink dark:text-ink-light mb-1 block">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Zegarra"
                    value={regApellido}
                    onChange={(e) => setRegApellido(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-ink dark:text-ink-light mb-1 block">
                  Nombre de usuario único
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">@</span>
                  <input
                    type="text"
                    required
                    placeholder="jorge_utp"
                    value={regUsuario}
                    onChange={(e) => setRegUsuario(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light lowercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-ink dark:text-ink-light mb-1 block">
                  Correo Institucional (@utp.edu.pe)
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-3 text-ink-muted" />
                  <input
                    type="email"
                    required
                    placeholder="u2320732@utp.edu.pe"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-ink dark:text-ink-light mb-1 block">
                  Crear Contraseña (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-3 text-ink-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-ink-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="terminos"
                  checked={regAceptaTerminos}
                  onChange={(e) => setRegAceptaTerminos(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-accent rounded cursor-pointer shrink-0"
                />
                <label htmlFor="terminos" className="text-[11px] text-ink-soft dark:text-ink-muted leading-tight cursor-pointer">
                  Acepto los Términos de Servicio y la{' '}
                  <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">
                    Política de Privacidad
                  </a>.
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !regAceptaTerminos}
                className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Crear cuenta y verificar</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORMULARIO: RECUPERAR CONTRASEÑA */}
          {authMode === 'recuperar' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
              <div>
                <h3 className="text-sm font-black text-ink dark:text-ink-light mb-1">
                  Recuperar tu contraseña
                </h3>
                <p className="text-xs text-ink-muted mb-3">
                  Te enviaremos un código de seguridad de 6 dígitos a tu correo institucional para que elijas una nueva contraseña.
                </p>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-ink-muted" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Tu usuario o correo @utp.edu.pe"
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Enviar código de recuperación</span>
                    <KeyRound size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Acceso Rápido Demo (solo si modo demo está encendido) */}
          {isModoDemo && (
            <div className="pt-4 border-t border-line dark:border-line-dark mt-4">
              <button
                type="button"
                onClick={loginDirectoDemo}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-ink-muted hover:text-ink text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1"
              >
                <Sparkles size={14} className="text-amber-500" />
                <span>Acceder con alumno de prueba (Demo)</span>
              </button>
            </div>
          )}
        </div>

        {/* Pie de pantalla */}
        <div className="pt-3 text-center">
          <p className="text-[11px] text-ink-muted font-medium">
            Comunidad exclusiva para estudiantes de la Universidad Tecnológica del Perú.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 2: VERIFICACIÓN OTP 6 DÍGITOS
  // =========================================================================
  if (currentScreen === 'm02_otp') {
    const targetEmail = isResetFlow ? resetEmailTarget : regEmail;

    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div>
          <button
            onClick={() => {
              setCurrentScreen('m01_bienvenida');
              setErrorMsg('');
            }}
            className="p-1 rounded-full text-ink-muted hover:text-ink dark:hover:text-ink-light mb-3 inline-flex items-center space-x-1"
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-bold">Volver</span>
          </button>

          <h2 className="text-xl font-black text-ink dark:text-ink-light tracking-tight mb-1">
            {isResetFlow ? 'Nueva Contraseña' : 'Verifica tu Correo'}
          </h2>
          <p className="text-xs text-ink-soft dark:text-ink-muted mb-4 leading-relaxed">
            Ingresa el código de 6 dígitos que enviamos a{' '}
            <strong className="text-accent">{targetEmail || 'tu correo'}</strong>:
          </p>

          {errorMsg && (
            <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* OTP Digits */}
          <div className="flex justify-between gap-1.5 py-2" onPaste={handleOtpPaste}>
            {otpCode.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
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
                className="w-12 h-14 text-center text-xl font-black rounded-xl border-2 border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:border-accent focus:outline-none text-ink dark:text-ink-light shadow-sm"
              />
            ))}
          </div>

          {/* Si es flujo de recuperación, solicitar la nueva contraseña */}
          {isResetFlow && (
            <div className="space-y-3 mt-4 pt-3 border-t border-line dark:border-line-dark">
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                />
              </div>
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repite la contraseña"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                />
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              onClick={handleOtpSubmit}
              disabled={isLoading || otpCode.join('').length < 6}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{isResetFlow ? 'Actualizar Contraseña' : 'Verificar y Continuar'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          <div className="pt-3 text-center">
            <button
              onClick={handleResendOtp}
              disabled={resendCooldown > 0}
              className="text-xs font-bold text-accent disabled:text-ink-muted hover:underline"
            >
              {resendCooldown > 0 ? `Reenviar código en ${resendCooldown}s` : '¿No recibiste el código? Reenviar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 3: CONFIGURAR PERFIL ACADÉMICO (DATOS E INTERESES)
  // =========================================================================
  if (currentScreen === 'm03_onboarding' || currentScreen === 'm04_intereses' || currentScreen === 'm05_consentimientos') {
    return (
      <div className="flex-1 p-5 flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div>
          <div className="mb-4">
            <span className="text-[11px] font-black text-accent uppercase tracking-wider">Paso Final</span>
            <h2 className="text-xl font-black text-ink dark:text-ink-light tracking-tight mt-0.5">
              Tu Perfil en el Campus
            </h2>
            <p className="text-xs text-ink-muted">
              Conéctate con compañeros de tu carrera, ciclo y sede.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleFinalizarPerfil} className="space-y-4">
            {/* Foto de Perfil Opcional */}
            <div className="flex items-center space-x-3.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-line dark:border-line-dark">
              <div className="relative w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-ink-muted" />
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white dark:bg-surface-cardDark border border-line dark:border-line-dark hover:border-accent text-xs font-bold text-ink dark:text-ink-light rounded-xl transition shadow-sm inline-flex items-center space-x-1.5"
                >
                  <Camera size={14} className="text-accent" />
                  <span>{avatarUrl ? 'Cambiar foto' : 'Subir foto (opcional)'}</span>
                </button>
                <p className="text-[10px] text-ink-muted mt-1">Se optimiza automáticamente para el campus.</p>
              </div>
            </div>

            {/* Carrera */}
            <div>
              <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                Carrera Universitaria
              </label>
              <select
                value={formData.carrera}
                onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {CARRERAS_UTP.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Ciclo y Sede */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Ciclo Actual
                </label>
                <select
                  value={formData.ciclo}
                  onChange={(e) => setFormData({ ...formData, ciclo: Number(e.target.value) })}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => (
                    <option key={c} value={c}>Ciclo {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Sede UTP
                </label>
                <select
                  value={formData.sede}
                  onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {SEDES_UTP.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Intereses Estudiantiles */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-ink dark:text-ink-light">
                  Tus Intereses (mínimo 2)
                </label>
                <span className="text-[11px] font-bold text-accent">
                  {selectedIntereses.length} seleccionados
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-line dark:border-line-dark">
                {INTERESES_DISPONIBLES.map((int) => {
                  const isSelected = selectedIntereses.includes(int);
                  return (
                    <button
                      key={int}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedIntereses(selectedIntereses.filter(i => i !== int));
                        } else {
                          setSelectedIntereses([...selectedIntereses, int]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-white dark:bg-surface-cardDark text-ink-soft dark:text-ink-muted border border-line dark:border-line-dark hover:border-accent'
                      }`}
                    >
                      <span>{int}</span>
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || selectedIntereses.length < 2}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition mt-3"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>¡Todo listo! Entrar a Kampuz</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
