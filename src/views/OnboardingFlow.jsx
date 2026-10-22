import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../data/store';
import {
  SEDES_UTP,
  CARRERAS_UTP,
  INTERESES_DISPONIBLES
} from '../data/mockData';
import {
  FORMATO_USUARIO,
  limpiarUsuario,
  usuarioDisponible,
  registrar,
  verificarCodigoRegistro,
  reenviarCodigoRegistro,
  iniciarSesion,
  solicitarRecuperacion,
  confirmarRecuperacion,
  guardarPerfilInicial,
  obtenerEdadMinima,
  EDAD_MINIMA_POR_DEFECTO
} from '../lib/auth';
import { subirAvatar, guardarConsentimientosIniciales } from '../lib/profile';
import { CONSENTIMIENTOS, valoresPorDefecto } from '../data/consentimientos';
import ConsentimientoItem from '../components/ConsentimientoItem';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Loader2,
  Camera,
  KeyRound,
  Inbox
} from 'lucide-react';

// Fecha de nacimiento más reciente permitida para la edad mínima de registro
// (config edad_minima_registro, 14 por defecto; la decide el servidor)
const fechaMaximaNacimiento = (edadMinima) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - edadMinima);
  return d.toISOString().slice(0, 10);
};

const cumpleEdadMinima = (fecha, edadMinima) => Boolean(fecha) && fecha <= fechaMaximaNacimiento(edadMinima);

const MIN_PASSWORD = 8;

export default function OnboardingFlow() {
  const {
    currentScreen,
    setCurrentScreen,
    user,
    estadoSesion,
    completarOnboarding
  } = useStore();

  // Cuenta que ya tenía perfil pero no los 4 consentimientos (creada antes de esta versión)
  const soloConsentimientos = estadoSesion === 'consentimientos';

  // Modo: 'login' | 'registro' | 'recuperar'
  const [authMode, setAuthMode] = useState('login');

  // Campos de Login
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Usuario o correo
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos de Registro
  const [regNombre, setRegNombre] = useState('');
  const [regApellido, setRegApellido] = useState('');
  const [regUsuario, setRegUsuario] = useState('');
  const [usernameStatus, setUsernameStatus] = useState({ state: 'idle' }); // 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAceptaTerminos, setRegAceptaTerminos] = useState(false);

  // Recuperación de contraseña
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResetFlow, setIsResetFlow] = useState(false);

  // Código de 6 dígitos (llega SOLO por correo)
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState(Array(6).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback y carga
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validador en vivo del @usuario (lo decide el servidor)
  useEffect(() => {
    const clean = limpiarUsuario(regUsuario);
    if (!clean) {
      setUsernameStatus({ state: 'idle' });
      return;
    }
    if (!FORMATO_USUARIO.test(clean)) {
      setUsernameStatus({
        state: 'invalid',
        message: clean.length < 3 ? 'Mínimo 3 caracteres' : 'Solo letras, números, . o _'
      });
      return;
    }

    setUsernameStatus({ state: 'checking' });
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const libre = await usuarioDisponible(clean);
        if (!vigente) return;
        setUsernameStatus(
          libre
            ? { state: 'available', message: `@${clean} está disponible` }
            : { state: 'taken', message: 'Ya está en uso' }
        );
      } catch (err) {
        if (vigente) setUsernameStatus({ state: 'error', message: 'No pudimos verificarlo' });
      }
    }, 350);

    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [regUsuario]);

  // Temporizador de reenvío del código
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Formulario de Perfil Académico (M03 + M04)
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    usuario: user?.usuario || '',
    sede: user?.sede || 'Lima Sur',
    carrera: user?.carrera || CARRERAS_UTP[0]?.nombre || '',
    ciclo: user?.ciclo || 1,
    fechaNacimiento: user?.fechaNacimiento || ''
  });

  // Si la sesión trae nombre/@usuario de la metadata del registro, se precargan
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      nombre: prev.nombre || user.nombre || '',
      apellido: prev.apellido || user.apellido || '',
      usuario: prev.usuario || user.usuario || ''
    }));
  }, [user?.id]);

  const [selectedIntereses, setSelectedIntereses] = useState(user?.intereses || []);

  // Edad mínima de registro leída del servidor (solo hay sesión desde M03)
  const [edadMinima, setEdadMinima] = useState(EDAD_MINIMA_POR_DEFECTO);
  useEffect(() => {
    if (currentScreen !== 'm03_onboarding' || !user?.id) return;
    obtenerEdadMinima()
      .then(setEdadMinima)
      .catch(() => {}); // si falla, se usa el valor por defecto; el servidor valida igual
  }, [currentScreen, user?.id]);

  // M05: los 4 consentimientos separados. El 1 es necesario; el 4 empieza apagado.
  const [consentValores, setConsentValores] = useState(valoresPorDefecto);

  const [avatarUrl, setAvatarUrl] = useState(user?.fotoUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef(null);

  const limpiarMensajes = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const irACodigo = (correo, { reset = false } = {}) => {
    setOtpEmail(correo);
    setOtpCode(Array(6).fill(''));
    setIsResetFlow(reset);
    setResendCooldown(60);
    setCurrentScreen('m02_otp');
  };

  // --- SUBIR FOTO (solo Supabase Storage; si falla, se muestra el error y se puede reintentar) ---
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingAvatar(true);
    setAvatarError('');
    try {
      const publicUrl = await subirAvatar(file);
      setAvatarUrl(publicUrl);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // --- 1. INICIAR SESIÓN ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Ingresa tu usuario/correo y tu contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      await iniciarSesion(loginIdentifier.trim(), loginPassword);
      // El store detecta la sesión (SIGNED_IN) y carga el perfil o el onboarding.
    } catch (err) {
      if (err.codigo === 'EMAIL_NO_CONFIRMADO') {
        setSuccessMsg(err.message);
        irACodigo(err.causa?.correo || loginIdentifier.trim().toLowerCase());
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. CREAR CUENTA ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    const cleanEmail = regEmail.trim().toLowerCase();

    if (!regNombre.trim() || !regApellido.trim()) {
      setErrorMsg('Ingresa tu nombre y apellido reales.');
      return;
    }
    if (!FORMATO_USUARIO.test(limpiarUsuario(regUsuario))) {
      setErrorMsg('Elige un @usuario de 3 a 30 caracteres (letras, números, . o _).');
      return;
    }
    if (usernameStatus.state === 'taken') {
      setErrorMsg('Ese @usuario ya está en uso. Elige otro.');
      return;
    }
    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo institucional (@utp.edu.pe).');
      return;
    }
    if (regPassword.length < MIN_PASSWORD) {
      setErrorMsg(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (!regAceptaTerminos) {
      setErrorMsg('Debes aceptar los Términos y la Política de Privacidad.');
      return;
    }

    setIsLoading(true);
    try {
      const { correo, sesion } = await registrar({
        nombre: regNombre,
        apellido: regApellido,
        usuario: regUsuario,
        email: cleanEmail,
        password: regPassword
      });
      if (sesion) {
        // El proyecto de Supabase tiene "Confirm email" apagado: no hay código que verificar.
        return;
      }
      setSuccessMsg(`Te enviamos un código de 6 dígitos a ${correo}.`);
      irACodigo(correo);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. SOLICITAR RECUPERACIÓN DE CONTRASEÑA ---
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    if (!resetIdentifier.trim()) {
      setErrorMsg('Ingresa tu correo institucional.');
      return;
    }

    setIsLoading(true);
    try {
      const correo = await solicitarRecuperacion(resetIdentifier.trim());
      setResetNewPassword('');
      setResetConfirmPassword('');
      setSuccessMsg(`Si ${correo} tiene una cuenta, te llegará un código de 6 dígitos.`);
      irACodigo(correo, { reset: true });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 4. CÓDIGO: PEGAR Y REENVIAR ---
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
    limpiarMensajes();
    try {
      if (isResetFlow) {
        await solicitarRecuperacion(otpEmail);
      } else {
        await reenviarCodigoRegistro(otpEmail);
      }
      setResendCooldown(60);
      setSuccessMsg('Te enviamos un código nuevo. Revisa también "Correo no deseado".');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // --- 5. VERIFICAR CÓDIGO (REGISTRO O RECUPERACIÓN) ---
  const handleOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    const entered = otpCode.join('');
    if (entered.length < 6) {
      setErrorMsg('Ingresa el código completo de 6 dígitos.');
      return;
    }

    limpiarMensajes();

    if (isResetFlow) {
      if (resetNewPassword.length < MIN_PASSWORD) {
        setErrorMsg(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
        return;
      }
      if (resetNewPassword !== resetConfirmPassword) {
        setErrorMsg('Las contraseñas no coinciden.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isResetFlow) {
        await confirmarRecuperacion(otpEmail, entered, resetNewPassword);
        setAuthMode('login');
        setLoginIdentifier(otpEmail);
        setLoginPassword('');
        setCurrentScreen('m01_bienvenida');
        setSuccessMsg('¡Contraseña cambiada! Inicia sesión con tu nueva clave.');
      } else {
        await verificarCodigoRegistro(otpEmail, entered);
        // Sesión real abierta: el store pasa al onboarding (M03) con los datos del registro.
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 6. FINALIZAR PERFIL ACADÉMICO ---
  const handleFinalizarPerfil = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      setErrorMsg('Ingresa tu nombre y apellido reales.');
      return;
    }
    if (!FORMATO_USUARIO.test(limpiarUsuario(formData.usuario))) {
      setErrorMsg('Elige un @usuario de 3 a 30 caracteres (letras, números, . o _).');
      return;
    }
    if (!cumpleEdadMinima(formData.fechaNacimiento, edadMinima)) {
      setErrorMsg(`Ingresa tu fecha de nacimiento. Para usar Kampuz debes tener al menos ${edadMinima} años.`);
      return;
    }
    if (selectedIntereses.length < 2) {
      setErrorMsg('Selecciona al menos 2 intereses.');
      return;
    }

    setCurrentScreen('m05_consentimientos');
  };

  // --- 7. M05: GUARDAR PERFIL (si falta) Y LOS 4 CONSENTIMIENTOS ---
  const handleGuardarConsentimientos = async (e) => {
    e.preventDefault();
    limpiarMensajes();
    setIsLoading(true);
    try {
      // upsert: si un intento anterior ya guardó el perfil, solo se actualiza
      const perfil = soloConsentimientos ? user : await guardarPerfilInicial({
        correoInstitucional: user?.correoInstitucional,
        nombre: formData.nombre,
        apellido: formData.apellido,
        usuario: formData.usuario,
        fotoUrl: avatarUrl,
        sede: formData.sede,
        carrera: formData.carrera,
        ciclo: formData.ciclo,
        fechaNacimiento: formData.fechaNacimiento,
        intereses: selectedIntereses
      });
      const consentimientos = await guardarConsentimientosIniciales(consentValores);
      completarOnboarding(perfil, consentimientos);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // SUBPANTALLA: VERIFICACIÓN CON EL CÓDIGO DE 6 DÍGITOS DEL CORREO
  // =========================================================================
  if (currentScreen === 'm02_otp') {
    return (
      <div className="flex-1 px-5 pt-5 pb-[calc(var(--sab)+1.25rem)] flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <div>
          <button
            onClick={() => {
              setCurrentScreen('m01_bienvenida');
              limpiarMensajes();
            }}
            className="p-1 rounded-full text-ink-muted hover:text-ink dark:hover:text-ink-light mb-3 inline-flex items-center space-x-1"
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-bold">Volver</span>
          </button>

          <h2 className="text-xl font-black text-ink dark:text-ink-light tracking-tight mb-1">
            {isResetFlow ? 'Nueva Contraseña' : 'Verifica tu Correo'}
          </h2>
          <p className="text-xs text-ink-soft dark:text-ink-muted mb-3 leading-relaxed">
            Ingresa el código de 6 dígitos que enviamos a{' '}
            <strong className="text-accent">{otpEmail || 'tu correo'}</strong>.
          </p>

          {/* Ayuda si el correo demora: SMTP real, nunca un atajo */}
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-line dark:border-line-dark rounded-2xl flex items-start space-x-2">
            <Inbox size={16} className="text-accent shrink-0 mt-0.5" />
            <p className="text-[11px] text-ink-soft dark:text-ink-muted leading-snug">
              ¿No llega? Puede tardar unos minutos. Revisa <strong>Correo no deseado</strong> y, en Outlook de la UTP,
              la carpeta <strong>Cuarentena</strong>. El remitente es Kampuz.
            </p>
          </div>

          {successMsg && (
            <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Dígitos del código */}
          <div className="flex justify-between gap-1.5 py-2" onPaste={handleOtpPaste}>
            {otpCode.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                aria-label={`Dígito ${index + 1} del código`}
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

          {/* En recuperación se pide la nueva contraseña */}
          {isResetFlow && (
            <div className="space-y-3 mt-4 pt-3 border-t border-line dark:border-line-dark">
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
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
                  autoComplete="new-password"
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
  // SUBPANTALLA: CONFIGURAR PERFIL ACADÉMICO (DATOS E INTERESES)
  // =========================================================================
  if (currentScreen === 'm05_consentimientos' || soloConsentimientos) {
    return (
      <div className="flex-1 px-5 pt-5 pb-[calc(var(--sab)+1.25rem)] flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
        <form onSubmit={handleGuardarConsentimientos} className="space-y-3">
          {!soloConsentimientos && (
            <button
              type="button"
              onClick={() => {
                setCurrentScreen('m03_onboarding');
                limpiarMensajes();
              }}
              className="p-1 rounded-full text-ink-muted hover:text-ink dark:hover:text-ink-light inline-flex items-center space-x-1"
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-bold">Volver a mi perfil</span>
            </button>
          )}

          <div>
            <span className="text-[11px] font-black text-accent uppercase tracking-wider">Tu privacidad</span>
            <h2 className="text-xl font-black text-ink dark:text-ink-light tracking-tight mt-0.5">
              Tú decides para qué usamos tus datos
            </h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              Son cuatro decisiones separadas. Puedes cambiar las tres últimas cuando quieras en Perfil → Privacidad.
              No pedimos DNI, dirección ni teléfono.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {CONSENTIMIENTOS.map((c) => (
            <ConsentimientoItem
              key={c.finalidad}
              consentimiento={c}
              valor={c.necesario ? true : consentValores[c.finalidad]}
              onCambiar={(finalidad, valor) => setConsentValores((prev) => ({ ...prev, [finalidad]: valor }))}
              deshabilitado={isLoading}
            />
          ))}

          <p className="text-[11px] text-ink-muted text-center">
            Detalle en la{' '}
            <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">
              Política de Privacidad
            </a>
            .
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Guardar y entrar a Kampuz</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  if (currentScreen === 'm03_onboarding' || currentScreen === 'm04_intereses') {
    return (
      <div className="flex-1 px-5 pt-5 pb-[calc(var(--sab)+1.25rem)] flex flex-col justify-between bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
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
                {avatarError && (
                  <p className="text-[11px] text-semantic-danger font-semibold mt-1">
                    {avatarError}{' '}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="underline font-bold"
                    >
                      Reintentar
                    </button>
                  </p>
                )}
              </div>
            </div>

            {/* Nombre y apellido reales (spec 6.1) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Nombres</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Apellidos</label>
                <input
                  type="text"
                  required
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* @usuario y fecha de nacimiento */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Tu @usuario</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">@</span>
                  <input
                    type="text"
                    required
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') })}
                    className="w-full text-xs font-semibold pl-7 pr-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent lowercase"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-ink dark:text-ink-light mb-1 block">Fecha de nacimiento</label>
                <input
                  type="date"
                  required
                  min="1940-01-01"
                  max={fechaMaximaNacimiento(edadMinima)}
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark text-ink dark:text-ink-light focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <p className="text-[10px] text-ink-muted -mt-2">
              Debes tener al menos {edadMinima} años. Tu fecha de nacimiento no se muestra en tu perfil.
            </p>

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
                  <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>
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
                  <span>Continuar</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA PRINCIPAL POR DEFECTO: ACCESO (LOGIN / REGISTRO / RECUPERAR)
  // Siempre visible si el usuario no tiene sesión activa (nunca queda en blanco)
  // =========================================================================
  return (
    <div className="flex-1 px-5 pt-5 pb-[calc(var(--sab)+1.25rem)] flex flex-col bg-surface dark:bg-surface-dark select-none animate-fadeIn overflow-y-auto">
      {/* my-auto: el formulario queda centrado en la pantalla y, si no entra (registro), se desplaza */}
      <div className="my-auto w-full max-w-sm mx-auto py-2">
        {/* Logo y Marca */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-primary flex items-center justify-center font-black text-white text-3xl tracking-tight shadow-md mb-3">
            Z
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-black text-2xl tracking-wide text-brand-primary dark:text-teal-300">KAMPUZ</span>
            <span className="text-[11px] bg-accent/15 text-accent font-extrabold px-2 py-0.5 rounded-md">UTP</span>
          </div>
          <p className="text-xs text-ink-soft dark:text-ink-muted font-medium mt-1">
            Comunidad Universitaria de Aprendizaje
          </p>
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
                Usuario o correo institucional
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3.5 text-ink-muted" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Tu usuario o correo institucional"
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
                  placeholder="Tu contraseña"
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
                  placeholder="Tus nombres"
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
                  placeholder="Tus apellidos"
                  value={regApellido}
                  onChange={(e) => setRegApellido(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black text-ink dark:text-ink-light block">
                  Nombre de usuario único
                </label>
                {usernameStatus.state === 'checking' && (
                  <span className="text-[10px] text-ink-muted flex items-center space-x-1 font-semibold">
                    <Loader2 size={10} className="animate-spin" />
                    <span>Verificando...</span>
                  </span>
                )}
                {usernameStatus.state === 'available' && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                    <Check size={11} className="stroke-[3]" />
                    <span>Disponible</span>
                  </span>
                )}
                {usernameStatus.state === 'taken' && (
                  <span className="text-[10px] text-semantic-danger font-bold flex items-center space-x-1">
                    <AlertCircle size={11} />
                    <span>No disponible</span>
                  </span>
                )}
                {(usernameStatus.state === 'invalid' || usernameStatus.state === 'error') && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    {usernameStatus.message}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">@</span>
                <input
                  type="text"
                  required
                  placeholder="ej. ana.torres"
                  value={regUsuario}
                  onChange={(e) => setRegUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  className={`w-full text-xs pl-7 pr-8 py-2.5 rounded-xl border ${
                    usernameStatus.state === 'available'
                      ? 'border-emerald-500 focus:ring-emerald-500/30'
                      : usernameStatus.state === 'taken'
                      ? 'border-red-500 focus:ring-red-500/30'
                      : 'border-line dark:border-line-dark focus:ring-accent'
                  } bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 font-medium text-ink dark:text-ink-light lowercase`}
                />
                <div className="absolute right-2.5 top-2.5">
                  {usernameStatus.state === 'available' && (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  )}
                  {usernameStatus.state === 'taken' && (
                    <AlertCircle size={16} className="text-red-500" />
                  )}
                </div>
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
                  placeholder="tucodigo@utp.edu.pe"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-line dark:border-line-dark bg-white dark:bg-surface-cardDark focus:outline-none focus:ring-2 focus:ring-accent font-medium text-ink dark:text-ink-light"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-ink dark:text-ink-light mb-1 block">
                Crear Contraseña (mínimo 8 caracteres)
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-3 text-ink-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Tu contraseña"
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
                Escribe tu correo institucional. Te enviaremos un código de 6 dígitos para que elijas una nueva contraseña.
              </p>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-ink-muted" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="tucodigo@utp.edu.pe"
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

      </div>

      {/* Pie de pantalla */}
      <div className="pt-3 text-center shrink-0">
        <p className="text-[11px] text-ink-muted font-medium">
          Comunidad exclusiva para estudiantes de la Universidad Tecnológica del Perú.
        </p>
      </div>
    </div>
  );
}
