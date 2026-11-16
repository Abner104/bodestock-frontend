// src/pages/Register.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Mail, Lock, Loader2, Building2, User, Check, AlertCircle, Gift, X
} from "lucide-react";
import Logo from "../components/ui/Logo";
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import { SUPER_ADMIN_EMAIL, API_URL } from '../config/env';
import { getWorkerByEmail } from '../services/workers-service.js';
import { REGIONS } from '../config/regions';
import { useRegionContext } from '../contexts/RegionContext';
import { BUSINESS_TYPES, DEFAULT_BUSINESS_TYPE } from '../config/business-types';

const isEmail = (v) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(v || ""));

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Ideal para probar ProControl',
    features: ['1 usuario', '50 productos', '1 bodega'],
    color: 'from-gray-600 to-gray-700'
  },
  {
    id: 'basico',
    name: 'Básico',
    price: 19990,
    description: 'Para pequeñas empresas',
    features: ['3 usuarios', '200 productos', '2 bodegas'],
    color: 'from-blue-600 to-blue-700',
    popular: false
  },
  {
    id: 'profesional',
    name: 'Profesional',
    price: 49990,
    description: 'Para empresas en crecimiento',
    features: ['10 usuarios', '1000 productos', '5 bodegas'],
    color: 'from-orange-600 to-amber-600',
    popular: true
  },
  {
    id: 'empresa',
    name: 'Empresa',
    price: 79990,
    description: 'Sin límites',
    features: ['Usuarios ilimitados', 'Productos ilimitados', 'Bodegas ilimitadas'],
    color: 'from-purple-600 to-pink-600'
  }
];

export default function Register() {
  const { regionCode: detectedRegionCode, setRegion: setDetectedRegion } = useRegionContext();
  const [country, setCountry] = useState(detectedRegionCode);
  const [businessType, setBusinessType] = useState(DEFAULT_BUSINESS_TYPE);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Errores de validación
  const [companyNameErr, setCompanyNameErr] = useState("");
  const [adminNameErr, setAdminNameErr] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [confirmPwdErr, setConfirmPwdErr] = useState("");

  // Estados para Google signup
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState(null); // { uid, email, displayName }
  const [setupCompanyName, setSetupCompanyName] = useState("");
  const [setupAdminName, setSetupAdminName] = useState("");
  const [setupRut, setSetupRut] = useState("");
  const [rut, setRut] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupErr, setSetupErr] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-fill referral code from URL (e.g., /register?ref=STOCKLY-ABC123)
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      setShowReferral(true);
    }
  }, [searchParams]);

  // Preseleccionar el país detectado por IP (el usuario puede cambiarlo manualmente)
  const [countryTouched, setCountryTouched] = useState(false);
  useEffect(() => {
    if (!countryTouched) setCountry(detectedRegionCode);
  }, [detectedRegionCode, countryTouched]);

  const handleCountryChange = (code) => {
    setCountry(code);
    setCountryTouched(true);
    setDetectedRegion(code);
  };

  // Si el usuario ya está autenticado (ej: Google) pero sin empresa, mostrar form de setup
  useEffect(() => {
    const checkAuthUser = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || googleUser) return;
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        if (!tokenResult.claims.companyId) {
          setGoogleUser({ uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName || "" });
          setSetupAdminName(currentUser.displayName || "");
        }
      } catch { /* silencioso */ }
    };
    checkAuthUser();
  }, []);

  const handleCompanyName = (e) => {
    const v = e.target.value;
    setCompanyName(v);
    setCompanyNameErr(v.length < 3 ? "Mínimo 3 caracteres." : "");
  };

  const handleAdminName = (e) => {
    const v = e.target.value;
    setAdminName(v);
    setAdminNameErr(v.length < 3 ? "Mínimo 3 caracteres." : "");
  };

  const handleEmail = (e) => {
    const v = e.target.value;
    setEmail(v);
    setEmailErr(!isEmail(v) ? "Ingresa un correo válido." : "");
  };

  const handlePwd = (e) => {
    const v = e.target.value;
    setPassword(v);
    setPwdErr(v.length < 6 ? "Mínimo 6 caracteres." : "");
    if (confirmPassword && v !== confirmPassword) {
      setConfirmPwdErr("Las contraseñas no coinciden.");
    } else if (confirmPassword) {
      setConfirmPwdErr("");
    }
  };

  const handleConfirmPwd = (e) => {
    const v = e.target.value;
    setConfirmPassword(v);
    setConfirmPwdErr(v !== password ? "Las contraseñas no coinciden." : "");
  };

  const canRegister = () => {
    return (
      companyName.length >= 3 &&
      adminName.length >= 3 &&
      isEmail(email) &&
      password.length >= 6 &&
      password === confirmPassword &&
      !companyNameErr &&
      !adminNameErr &&
      !emailErr &&
      !pwdErr &&
      !confirmPwdErr
    );
  };

  const handleRegister = async () => {

    try {
      setLoading(true);
      setErrMsg("");
      setSuccessMsg("");

      // Llamar a Cloud Function para registrar empresa + usuario con TRIAL de 30 días
      const response = await fetch(FUNCTIONS_ENDPOINTS.REGISTER_COMPANY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          adminName,
          adminEmail: email,
          password,
          country,
          businessType,
          referralCode: referralCode.trim() || undefined,
          rut: rut.trim() || undefined,
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al registrar empresa');
      }

      console.log('✅ Registro exitoso:', data);

      // Auto-login
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Auto-login exitoso');

      // Forzar refresh del token para obtener los nuevos custom claims (companyId, role)
      // — sin esto, la app no encuentra companyId y rebota de vuelta a /register
      await userCred.user.getIdToken(true);
      console.log('✅ Token refrescado con custom claims');

      // Enviar email de verificación directo por Firebase (siempre funciona)
      await sendEmailVerification(userCred.user).catch(() => {});
      console.log('✅ Email de verificación enviado');

      setSuccessMsg(`¡Cuenta creada! Revisa tu correo ${email} para verificar tu cuenta.`);

      // Navegar a la app — App.jsx ya sabe mostrar la pantalla de verificación
      // de email si corresponde, no hace falta manejarlo acá
      navigate('/', { replace: true });

    } catch (error) {
      console.error('❌ Error en registro:', error);
      setErrMsg(error.message || 'Error al registrar empresa. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const processGoogleSignupUser = async (user) => {
    if (user.email === SUPER_ADMIN_EMAIL) {
      navigate("/super-admin", { replace: true });
      return;
    }

    // Verificar si ya tiene empresa registrada
    const worker = await getWorkerByEmail(user.email).catch(() => null);
    if (worker) {
      // Ya tiene empresa → navegar al dashboard
      if (worker.role === 'WORKER') {
        navigate("/dashboard-trabajador");
      } else {
        navigate("/dashboard");
      }
    } else {
      // Usuario nuevo → mostrar formulario de setup
      setGoogleUser({ uid: user.uid, email: user.email, displayName: user.displayName || "" });
      setSetupAdminName(user.displayName || "");
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setErrMsg("");
    const provider = new GoogleAuthProvider();
    const mobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    try {
      if (mobile) {
        // En móvil el popup falla seguido (bloqueo de popups, postMessage roto en WebViews).
        // signInWithRedirect navega fuera y vuelve; el resultado se procesa en el useEffect de abajo.
        await signInWithRedirect(auth, provider);
        return;
      }
      const result = await signInWithPopup(auth, provider);
      await processGoogleSignupUser(result.user);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setErrMsg("No se pudo iniciar sesión con Google. Intenta nuevamente.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Captura el resultado de signInWithRedirect (Google en móvil) al volver a montar la página
  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setGoogleLoading(true);
          await processGoogleSignupUser(result.user);
          setGoogleLoading(false);
        }
      } catch (err) {
        if (err.code !== "auth/popup-closed-by-user") {
          setErrMsg("No se pudo iniciar sesión con Google. Intenta nuevamente.");
        }
        setGoogleLoading(false);
      }
    })();
  }, []);

  const handleGoogleSetup = async () => {
    if (setupCompanyName.trim().length < 3) { setSetupErr("El nombre de la empresa debe tener al menos 3 caracteres."); return; }
    if (setupAdminName.trim().length < 3) { setSetupErr("Tu nombre debe tener al menos 3 caracteres."); return; }
    setSetupLoading(true);
    setSetupErr("");
    try {
      const res = await fetch(FUNCTIONS_ENDPOINTS.REGISTER_COMPANY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: setupCompanyName.trim(),
          adminName: setupAdminName.trim(),
          adminEmail: googleUser.email,
          existingUid: googleUser.uid,
          country,
          businessType,
          rut: setupRut.trim() || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al crear la empresa');
      // Forzar refresh del token para obtener los nuevos custom claims
      await auth.currentUser?.getIdToken(true);
      // Enviar verificación si no está verificado (Google ya verifica el email)
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser).catch(() => {});
      }
      navigate("/", { replace: true });
    } catch (err) {
      setSetupErr(err.message || 'Error al crear la empresa. Intenta nuevamente.');
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Fondo 100% estático — sin animaciones para máxima compatibilidad móvil */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-black">
        <div className="absolute rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #3B82F6, transparent)", width: 400, height: 400, left: '-5%', top: '-10%', opacity: 0.14 }}
        />
        <div className="absolute rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #06B6D4, transparent)", width: 350, height: 350, right: '-5%', bottom: '-10%', opacity: 0.11 }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-12 md:pt-16 pb-12 md:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-4xl"
        >
          {/* Glow decorativo (estático) */}
          <div
            className="absolute -inset-2 rounded-3xl opacity-60 blur-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(96, 165, 250, 0.2), rgba(6, 182, 212, 0.3))"
            }}
          />

          {/* Setup de empresa para usuario Google nuevo */}
          {googleUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-2xl sm:rounded-3xl border border-white/10 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl"
              style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(15,15,15,0.8) 50%, rgba(0,0,0,0.9) 100%)" }}
            >
              <div className="flex flex-col items-center text-center mb-6">
                <Logo size="lg" animated={true} />
                <h2 className="text-xl font-bold text-white mt-4 mb-1">¡Bienvenido a Bodestock!</h2>
                <p className="text-white/60 text-sm">Ingresaste con <span className="text-blue-400 font-medium">{googleUser.email}</span></p>
                <p className="text-white/50 text-xs mt-1">Solo falta crear tu empresa para empezar</p>
              </div>

              {setupErr && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm flex items-center gap-2">
                  <X className="w-4 h-4 flex-shrink-0" />
                  {setupErr}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">Nombre de tu empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={setupCompanyName}
                      onChange={e => { setSetupCompanyName(e.target.value); setSetupErr(""); }}
                      placeholder="Mi Empresa S.A."
                      className="w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 outline-none ring-1 ring-white/20 focus:ring-blue-500/70 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">Tu nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={setupAdminName}
                      onChange={e => { setSetupAdminName(e.target.value); setSetupErr(""); }}
                      placeholder="Juan Pérez"
                      className="w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 outline-none ring-1 ring-white/20 focus:ring-blue-500/70 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">País</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.values(REGIONS).map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => handleCountryChange(r.code)}
                        className={`flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-sm transition-all duration-200 ring-1
                        ${country === r.code
                          ? "bg-blue-600/90 text-white ring-blue-400"
                          : "bg-white/10 text-white/70 ring-white/20 hover:bg-white/20"}`}
                      >
                        <span className="text-lg">{r.flag}</span>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    ¿Qué tipo de negocio tenés?
                  </label>
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    className="w-full rounded-xl bg-white/90 text-black pl-4 pr-4 py-3 outline-none ring-1 ring-white/20 focus:ring-blue-500/70 transition-all"
                  >
                    <optgroup label="Venta directa">
                      {BUSINESS_TYPES.filter(t => t.group === 'directa').map(t => (
                        <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Con productos elaborados">
                      {BUSINESS_TYPES.filter(t => t.group === 'elaborada').map(t => (
                        <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                      ))}
                    </optgroup>
                    {BUSINESS_TYPES.filter(t => t.group === 'otro').map(t => (
                      <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">{REGIONS[country]?.taxId.label} de la empresa <span className="text-white/40 font-normal">(opcional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">{REGIONS[country]?.taxId.label}</span>
                    <input
                      type="text"
                      value={setupRut}
                      onChange={e => { setSetupRut(e.target.value); setSetupErr(""); }}
                      placeholder={REGIONS[country]?.taxId.placeholder}
                      className="w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-12 pr-4 py-3 outline-none ring-1 ring-white/20 focus:ring-blue-500/70 transition-all"
                      onKeyDown={e => e.key === 'Enter' && handleGoogleSetup()}
                    />
                  </div>
                  <p className="text-white/30 text-xs mt-1">Se usará en pre-cuentas y documentos</p>
                </div>

                <button
                  onClick={handleGoogleSetup}
                  disabled={setupLoading || setupCompanyName.trim().length < 3 || setupAdminName.trim().length < 3}
                  className="w-full rounded-xl py-3 font-bold text-base bg-gradient-to-r from-blue-600 to-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                >
                  {setupLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {setupLoading ? "Creando empresa..." : "🎉 Crear empresa y entrar"}
                </button>

                <p className="text-center text-xs text-white/40">
                  ✓ 30 días GRATIS · Sin tarjeta de crédito
                </p>

                <button
                  onClick={() => { setGoogleUser(null); auth.signOut(); }}
                  className="w-full text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  Cancelar y volver al registro
                </button>
              </div>
            </motion.div>
          )}

          {/* Card principal (oculta si hay googleUser) */}
          {!googleUser && (
          <motion.div
            className="relative rounded-2xl sm:rounded-3xl border border-white/10 bg-black/20 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(15,15,15,0.8) 50%, rgba(0,0,0,0.9) 100%)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
            }}
          >
            {/* Header */}
            <motion.div
              className="flex flex-col items-center text-center mb-6 sm:mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <motion.div
                className="mb-4 sm:mb-6"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.2
                }}
              >
                <Logo size="lg" showText={true} />
              </motion.div>

              <motion.h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                Crea tu cuenta en Bodestock
              </motion.h1>

              <motion.p
                className="text-white/70 text-sm font-medium mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                Completa tus datos para empezar
              </motion.p>

              {/* Badge de trial */}
              <motion.div
                className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-full px-3 sm:px-4 py-2 mt-3 sm:mt-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 1 }}
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  ✨
                </motion.div>
                <span className="text-green-400 font-bold text-xs sm:text-sm">
                  30 días GRATIS - Acceso completo sin tarjeta
                </span>
              </motion.div>
            </motion.div>

            {/* Mensajes de error/éxito */}
            <AnimatePresence>
              {errMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm backdrop-blur-sm flex items-center gap-2"
                >
                  <AlertCircle className="w-5 h-5" />
                  {errMsg}
                </motion.div>
              )}

              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-200 text-sm backdrop-blur-sm flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Formulario de registro */}
            <motion.div
              className="space-y-4 sm:space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
                {/* Nombre de empresa */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Nombre de la empresa
                  </label>
                  <div className="relative group">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={handleCompanyName}
                      placeholder="Mi Empresa S.A."
                      className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                      ${companyNameErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    />
                  </div>
                  {companyNameErr && <p className="mt-2 text-xs text-red-300">{companyNameErr}</p>}
                </div>

                {/* País */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    País
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.values(REGIONS).map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => handleCountryChange(r.code)}
                        className={`flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-sm transition-all duration-200 ring-1
                        ${country === r.code
                          ? "bg-blue-600/90 text-white ring-blue-400"
                          : "bg-white/10 text-white/70 ring-white/20 hover:bg-white/20"}`}
                      >
                        <span className="text-lg">{r.flag}</span>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de negocio */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    ¿Qué tipo de negocio tenés?
                  </label>
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    className="w-full rounded-xl bg-white/90 text-black pl-4 pr-4 py-3 sm:py-4 outline-none ring-1 ring-white/20 focus:ring-blue-500/70 focus:bg-white transition-all duration-300 backdrop-blur-sm"
                  >
                    <optgroup label="Venta directa">
                      {BUSINESS_TYPES.filter(t => t.group === 'directa').map(t => (
                        <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Con productos elaborados">
                      {BUSINESS_TYPES.filter(t => t.group === 'elaborada').map(t => (
                        <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                      ))}
                    </optgroup>
                    {BUSINESS_TYPES.filter(t => t.group === 'otro').map(t => (
                      <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-white/40">Así preparamos tu inventario con las categorías que necesitás</p>
                </div>

                {/* Nombre del admin */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Tu nombre
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={adminName}
                      onChange={handleAdminName}
                      placeholder="Juan Pérez"
                      className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                      ${adminNameErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    />
                  </div>
                  {adminNameErr && <p className="mt-2 text-xs text-red-300">{adminNameErr}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={handleEmail}
                      placeholder="admin@miempresa.com"
                      className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                      ${emailErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    />
                  </div>
                  {emailErr && <p className="mt-2 text-xs text-red-300">{emailErr}</p>}
                </div>

                {/* Contraseña */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Contraseña
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={handlePwd}
                      placeholder="••••••••"
                      className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-12 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                      ${pwdErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-blue-500 p-1 rounded-lg transition-colors"
                    >
                      {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {pwdErr && <p className="mt-2 text-xs text-red-300">{pwdErr}</p>}
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <input
                      type={showConfirmPwd ? "text" : "password"}
                      value={confirmPassword}
                      onChange={handleConfirmPwd}
                      placeholder="••••••••"
                      className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-12 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                      ${confirmPwdErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-blue-500 p-1 rounded-lg transition-colors"
                    >
                      {showConfirmPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPwdErr && <p className="mt-2 text-xs text-red-300">{confirmPwdErr}</p>}
                </div>

                {/* Tax ID empresa (opcional) */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    {REGIONS[country]?.taxId.label} de la empresa <span className="text-white/40 font-normal">(opcional)</span>
                  </label>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">{REGIONS[country]?.taxId.label}</span>
                    <input
                      type="text"
                      value={rut}
                      onChange={e => setRut(e.target.value)}
                      placeholder={REGIONS[country]?.taxId.placeholder}
                      className="w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-12 pr-4 py-3 sm:py-4 outline-none ring-1 ring-white/20 focus:ring-blue-500/70 focus:bg-white transition-all duration-300 backdrop-blur-sm"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-white/30">Se usará en pre-cuentas y documentos</p>
                </div>

                {/* Código de referido (opcional) */}
                <div>
                  {!showReferral ? (
                    <button
                      type="button"
                      onClick={() => setShowReferral(true)}
                      className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Gift className="w-4 h-4" />
                      Tengo un código de referido
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-sm font-semibold text-white/80 mb-2">
                        Código de referido (opcional)
                      </label>
                      <div className="relative group">
                        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-purple-500 transition-colors" />
                        <input
                          type="text"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          placeholder="STOCKLY-XXXX"
                          className="w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 sm:py-4 outline-none ring-1 ring-white/20 focus:ring-purple-500/70 focus:bg-white transition-all duration-300 backdrop-blur-sm font-mono"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-purple-300/70">
                        Si alguien te recomendó Bodestock, ingresa su código para obtener beneficios
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Botón crear cuenta */}
                <button
                  onClick={handleRegister}
                  disabled={!canRegister() || loading}
                  className={`w-full rounded-xl px-4 sm:px-6 py-3 sm:py-4 font-bold text-base sm:text-lg transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3
                  ${!canRegister() || loading
                      ? "bg-white/10 text-white/50 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl hover:shadow-blue-500/25"}`
                  }
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {loading ? "Creando cuenta..." : "🎉 Empezar prueba GRATIS de 30 días"}
                </button>

                {/* Separador */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/40 text-xs font-medium">o regístrate con</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Botón Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 transition-all duration-200"
                >
                  {googleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {googleLoading ? "Conectando..." : "Registrarse con Google"}
                </button>

                {/* Información adicional */}
                <div className="text-center space-y-2">
                  <p className="text-xs text-white/50">
                    ✓ Sin tarjeta de crédito • ✓ Acceso completo • ✓ Cancela cuando quieras
                  </p>
                  <p className="text-xs text-white/40">
                    Después de los 30 días, elige el plan que mejor se adapte a tu empresa
                  </p>
                </div>
              </motion.div>

            {/* Footer */}
            <motion.p
              className="mt-6 sm:mt-8 text-center text-sm text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.6 }}
            >
              ¿Ya tienes cuenta?{" "}
              <span
                className="font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                onClick={() => navigate("/login")}
              >
                Inicia sesión
              </span>
            </motion.p>
          </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
