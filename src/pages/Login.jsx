// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCustomToken, browserPopupRedirectResolver } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useNavigate, useLocation } from "react-router-dom";
import { getWorkerByEmail } from "../services/workers-service.js";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Loader2, X, Building2, User, Fingerprint, ShieldCheck } from "lucide-react";
import Logo from "../components/ui/Logo";
import { SUPER_ADMIN_EMAIL, API_URL } from "../config/env";
import { FUNCTIONS_ENDPOINTS } from "../config/functions";
import { REGIONS } from "../config/regions";
import { useRegionContext } from "../contexts/RegionContext";
import { BUSINESS_TYPES, DEFAULT_BUSINESS_TYPE } from "../config/business-types";
import {
  isWebAuthnSupported,
  hasPasskeyRegistered,
  registerPasskey,
  authenticateWithPasskey,
  hasAnyUserPasskey,
  hasUserPasskeyRegistered,
  getStoredPasskeyEmail,
  authenticateUserWithPasskey,
  registerUserPasskey,
} from "../services/passkey-service.js";

const isEmail = (v) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(v || ""));

export default function Login() {
  const { regionCode: detectedRegionCode, setRegion: setDetectedRegion } = useRegionContext();
  const [country, setCountry] = useState(detectedRegionCode);
  const [countryTouched, setCountryTouched] = useState(false);
  useEffect(() => {
    if (!countryTouched) setCountry(detectedRegionCode);
  }, [detectedRegionCode, countryTouched]);
  const handleCountryChange = (code) => {
    setCountry(code);
    setCountryTouched(true);
    setDetectedRegion(code);
  };
  const [businessType, setBusinessType] = useState(DEFAULT_BUSINESS_TYPE);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  // Estados para recuperar contraseña
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailErr, setResetEmailErr] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);


  // DEBUG: Ver params cuando el componente se monta
  useEffect(() => {
    console.log('🚀 Login montado');
    console.log('📍 Query params:', location.search);
    console.log('🏭 warehouseId:', searchParams.get('warehouseId'));
    console.log('🏭 name:', searchParams.get('name'));
  }, []);

  const handleEmail = (e) => {
    const v = e.target.value;
    setEmail(v);
    setEmailErr(!isEmail(v) ? "Ingresa un correo válido." : "");
  };

  const handlePwd = (e) => {
    const v = e.target.value;
    setPassword(v);
    setPwdErr(v.length < 6 ? "Mínimo 6 caracteres." : "");
  };

  const firebaseError = (code) => {
    switch (code) {
      case "auth/invalid-email":
        return "Correo inválido.";
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Correo o contraseña incorrectos.";
      case "auth/too-many-requests":
        return "Demasiados intentos. Intenta más tarde.";
      default:
        return "No se pudo iniciar sesión. Intenta nuevamente.";
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrMsg("");
    if (!isEmail(email)) {
      setEmailErr("Ingresa un correo válido.");
      return;
    }
    if (password.length < 6) {
      setPwdErr("Mínimo 6 caracteres.");
      return;
    }
    try {
      setLoading(true);

      // Verificar si hay params de bodega en la URL del login
      const warehouseId = searchParams.get('warehouseId');
      const warehouseName = searchParams.get('name');

      console.log('🔍 DEBUG - warehouseId desde URL:', warehouseId);
      console.log('🔍 DEBUG - warehouseName desde URL:', warehouseName);

      // Si hay params de bodega, redirigir a la bodega después del login
      if (warehouseId && warehouseName) {
        console.log('🏭 Detectados params de bodega - redirigiendo después del login');

        // Autenticar con Firebase
        await signInWithEmailAndPassword(auth, email, password);

        // Construir URL de la bodega
        const warehouseUrl = `/salida-inventario?warehouseId=${encodeURIComponent(warehouseId)}&name=${encodeURIComponent(warehouseName)}`;
        console.log('✅ Autenticación exitosa, redirigiendo a:', warehouseUrl);

        // Navegar a la bodega
        navigate(warehouseUrl, { replace: true });
        return;
      }

      // Si NO hay params de bodega, hacer flujo normal según rol
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verificar si el email fue confirmado (excepto super admin)
      if (!user.emailVerified && user.email !== SUPER_ADMIN_EMAIL) {
        // App.jsx mostrará EmailVerificationScreen automáticamente
        navigate('/', { replace: true });
        return;
      }

      // ⭐ VERIFICAR SI ES SUPER ADMIN (dueño del SaaS)
      if (user.email === SUPER_ADMIN_EMAIL) {
        console.log('👑 SUPER ADMIN detectado - Redirigiendo a /super-admin');
        // Ofrecer guardar huella si WebAuthn soportado y no tiene passkey aún
        const hasPasskey = hasPasskeyRegistered();
        if (isWebAuthnSupported() && !hasPasskey) {
          setShowPasskeyModal(true);
        } else {
          navigate("/super-admin", { replace: true });
        }
        return;
      }

      // Verificar si es trabajador registrado
      try {
        const worker = await Promise.race([
          getWorkerByEmail(user.email),
          new Promise(resolve => setTimeout(() => resolve(null), 4000))
        ]);

        if (worker) {
          // Es un trabajador - redirigir según rol
          console.log('✅ Trabajador encontrado:', worker.name, '- Rol:', worker.role, '- ID:', worker.id);

          const workerRoles = ['WORKER', 'CAJERA', 'VENDEDORA', 'GARZON'];
          const destino = workerRoles.includes(worker.role) ? "/dashboard-trabajador" : "/";

          // Si WebAuthn disponible y no tiene huella, preguntar primero
          if (isWebAuthnSupported() && !hasUserPasskeyRegistered(user.email)) {
            setPendingNavigateTo(destino);
            setUserPasskeyRegErr('');
            setUserPasskeyRegSuccess(false);
            setShowUserPasskeyModal(true);
          } else {
            navigate(destino);
          }
        } else {
          // No es trabajador registrado - asumir que es admin
          console.log('❌ Trabajador no encontrado, asumiendo admin');
          if (isWebAuthnSupported() && !hasUserPasskeyRegistered(user.email)) {
            setPendingNavigateTo('/');
            setUserPasskeyRegErr('');
            setUserPasskeyRegSuccess(false);
            setShowUserPasskeyModal(true);
          } else {
            navigate("/", { replace: true });
          }
        }

      } catch (workerError) {
        // Error al buscar trabajador - asumir que es admin
        console.log('🚨 Error buscando trabajador:', workerError);
        console.log('➡️ Asumiendo admin por error');
        navigate("/", { replace: true });
      }

    } catch (err) {
      setErrMsg(firebaseError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  // Función para enviar email de recuperación
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess(false);

    if (!isEmail(resetEmail)) {
      setResetEmailErr("Ingresa un correo válido.");
      return;
    }

    try {
      setResetLoading(true);
      // Se envía vía Resend (dominio bodestock.cl verificado) en vez del correo nativo
      // de Firebase Auth, que llegaba a spam o no llegaba por no coincidir con el SPF/DKIM del dominio.
      const res = await fetch(FUNCTIONS_ENDPOINTS.SEND_PASSWORD_RESET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al enviar el correo');

      setResetSuccess(true);
      setResetEmail("");

      // Cerrar el modal después de 3 segundos
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error al enviar email de recuperación:", error);
      setResetError("Error al enviar el correo. Intenta nuevamente.");
    } finally {
      setResetLoading(false);
    }
  };

  // Estados para passkey/huella
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false); // modal post-login "¿Guardar huella?"
  const [passkeyRegLoading, setPasskeyRegLoading] = useState(false);
  const [passkeyRegErr, setPasskeyRegErr] = useState("");
  const [passkeyRegSuccess, setPasskeyRegSuccess] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);
  // Setup de empresa para usuarios nuevos de Google
  const [googleUser, setGoogleUser] = useState(null); // { uid, email, displayName }
  const [setupCompanyName, setSetupCompanyName] = useState("");
  const [setupAdminName, setSetupAdminName] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupErr, setSetupErr] = useState("");

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrMsg("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const mobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    try {
      if (mobile) {
        // En móvil el popup falla seguido (bloqueo de popups, postMessage roto en WebViews).
        // signInWithRedirect navega fuera y vuelve; el resultado se procesa en el useEffect de abajo.
        await signInWithRedirect(auth, provider);
        return;
      }
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await processGoogleUser(result.user);
      }
    } catch (err) {
      const ignored = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
      if (!ignored.includes(err.code)) {
        setErrMsg(`Error Google: ${err.code || err.message}`);
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
          await processGoogleUser(result.user);
          setGoogleLoading(false);
        }
      } catch (err) {
        const ignored = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
        if (!ignored.includes(err.code)) {
          setErrMsg(`Error Google: ${err.code || err.message}`);
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
      // Llamar al Cloud Function pasando el uid existente de Google
      const res = await fetch(FUNCTIONS_ENDPOINTS.REGISTER_COMPANY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: setupCompanyName.trim(),
          adminName: setupAdminName.trim(),
          adminEmail: googleUser.email,
          existingUid: googleUser.uid, // uid ya existente de Google
          country,
          businessType,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al crear la empresa');
      navigate("/", { replace: true });
    } catch (err) {
      setSetupErr(err.message || 'Error al crear la empresa. Intenta nuevamente.');
    } finally {
      setSetupLoading(false);
    }
  };

  // Passkey para usuarios normales
  const [userPasskeyAvailable, setUserPasskeyAvailable] = useState(false);
  const [userPasskeyEmail, setUserPasskeyEmail] = useState('');
  const [userPasskeyLoading, setUserPasskeyLoading] = useState(false);
  const [showUserPasskeyModal, setShowUserPasskeyModal] = useState(false);
  const [userPasskeyRegLoading, setUserPasskeyRegLoading] = useState(false);
  const [userPasskeyRegErr, setUserPasskeyRegErr] = useState('');
  const [userPasskeyRegSuccess, setUserPasskeyRegSuccess] = useState(false);
  const [pendingNavigateTo, setPendingNavigateTo] = useState('/');
  const [isMobile, setIsMobile] = useState(false);

  const processGoogleUser = async (user) => {
    console.log('🔵 [1] processGoogleUser START', user.email);

    if (user.email === SUPER_ADMIN_EMAIL) {
      console.log('🔵 [2] Es super admin → navegando');
      const hasPasskey = hasPasskeyRegistered();
      if (isWebAuthnSupported() && !hasPasskey) {
        setGoogleLoading(false);
        setShowPasskeyModal(true);
      } else {
        navigate("/super-admin", { replace: true });
      }
      return;
    }

    // Leer claims del token (usa cache local de Firebase, rápido)
    let companyId = null;
    let claimRole = null;
    try {
      console.log('🔵 [3] Leyendo claims...');
      const tokenResult = await Promise.race([
        user.getIdTokenResult(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      companyId = tokenResult.claims.companyId || null;
      claimRole = tokenResult.claims.role || null;
      console.log('🔵 [4] Claims leídos → companyId:', companyId, 'role:', claimRole);
    } catch (e) {
      console.log('🔵 [4] Claims fallaron:', e.message);
    }

    // Si tiene companyId en claims → usuario existente con empresa → navegar directo
    if (companyId) {
      const workerOnlyRoles = ['WORKER', 'CAJERA', 'VENDEDORA', 'GARZON'];
      const destino = workerOnlyRoles.includes(claimRole) ? "/dashboard-trabajador" : "/";
      console.log('🔵 [5] Tiene companyId → destino:', destino);
      if (isWebAuthnSupported() && !hasUserPasskeyRegistered(user.email)) {
        console.log('🔵 [6] Mostrando modal passkey antes de navegar');
        setPendingNavigateTo(destino);
        setUserPasskeyRegErr('');
        setUserPasskeyRegSuccess(false);
        setGoogleLoading(false);
        setShowUserPasskeyModal(true);
      } else {
        console.log('🔵 [6] Navegando a:', destino);
        navigate(destino, { replace: true });
      }
      return;
    }

    // Sin companyId en claims → usuario nuevo
    console.log('🔵 [5] Sin companyId → mostrando setup empresa');
    setGoogleUser({ uid: user.uid, email: user.email, displayName: user.displayName || "" });
    setSetupAdminName(user.displayName || "");
  };


  // Detectar si hay passkey registrada en este dispositivo (síncrono, usa localStorage)
  useEffect(() => {
    // Limpiar huellas viejas que puedan estar de un dominio incorrecto
    // 1. Si hay una huella de usuario normal guardada para el SUPER_ADMIN_EMAIL, limpiarla
    //    (fue registrada con el sistema incorrecto)
    const superAdminUserKey = `bodestock_passkey_id_${btoa(SUPER_ADMIN_EMAIL).replace(/=/g, '')}`;
    const superAdminUserEmailKey = `bodestock_passkey_email_${btoa(SUPER_ADMIN_EMAIL).replace(/=/g, '')}`;
    if (localStorage.getItem(superAdminUserKey)) {
      localStorage.removeItem(superAdminUserKey);
      localStorage.removeItem(superAdminUserEmailKey);
    }
    // 2. Limpiar passkey super-admin vieja UNA SOLA VEZ (migración de dominio)
    //    Solo si no se hizo ya la limpieza de migración
    if (!localStorage.getItem('bodestock_passkey_migration_v7')) {
      localStorage.removeItem('bodestock_passkey_id');
      localStorage.removeItem('bodestock_passkey_email');
      localStorage.removeItem('bodestock_passkey_migration_v1');
      localStorage.removeItem('bodestock_passkey_migration_v2');
      localStorage.removeItem('bodestock_passkey_migration_v3');
      localStorage.removeItem('bodestock_passkey_migration_v4');
      localStorage.removeItem('bodestock_passkey_migration_v5');
      localStorage.removeItem('bodestock_passkey_migration_v6');
      localStorage.setItem('bodestock_passkey_migration_v7', '1');
    }

    setPasskeyAvailable(hasPasskeyRegistered());
    const anyUserPasskey = hasAnyUserPasskey();
    setUserPasskeyAvailable(anyUserPasskey);
    if (anyUserPasskey) {
      const storedEmail = getStoredPasskeyEmail();
      if (storedEmail) setUserPasskeyEmail(storedEmail);
    }
    const mobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    setIsMobile(mobile);
  }, []);

  // Autenticar con huella (passkey) - Super Admin
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setErrMsg("");
    try {
      const userEmail = await authenticateWithPasskey();
      if (userEmail !== SUPER_ADMIN_EMAIL) {
        throw new Error('Esta passkey no pertenece al super admin.');
      }
      // Si ya hay sesión activa, navegar directo
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email === SUPER_ADMIN_EMAIL) {
        navigate("/super-admin", { replace: true });
        return;
      }
      // Huella verificada → login automático con custom token
      const res = await fetch(`${API_URL}/api/auth/passkey-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'No se pudo completar el acceso con huella.');
      }
      await signInWithCustomToken(auth, data.token);
      navigate("/super-admin", { replace: true });
    } catch (err) {
      const isDomainError = err.name === 'InvalidStateError'
        || err.message?.includes('insufen')
        || err.message?.includes('insufficient')
        || err.message?.includes('dominio')
        || err.message?.includes('not allowed');

      if (err.name === 'NotAllowedError') {
        setErrMsg("Autenticación cancelada.");
      } else if (isDomainError) {
        localStorage.removeItem('bodestock_passkey_id');
        localStorage.removeItem('bodestock_passkey_email');
        setPasskeyAvailable(false);
        setIsMobile(false);
        setErrMsg("Tu huella no es válida en este dispositivo. Inicia sesión para registrarla de nuevo.");
      } else {
        setErrMsg(err.message || "No se pudo autenticar con huella.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Registrar passkey después del login exitoso como super-admin
  const handleRegisterPasskey = async () => {
    setPasskeyRegLoading(true);
    setPasskeyRegErr("");
    try {
      await registerPasskey(SUPER_ADMIN_EMAIL);
      setPasskeyRegSuccess(true);
      setPasskeyAvailable(true);
      setTimeout(() => {
        setShowPasskeyModal(false);
        navigate("/super-admin", { replace: true });
      }, 1500);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setPasskeyRegErr("Registro cancelado.");
      } else {
        setPasskeyRegErr(err.message || "No se pudo registrar la huella.");
      }
    } finally {
      setPasskeyRegLoading(false);
    }
  };

  // Registrar huella post-login para usuario normal
  const handleRegisterUserPasskey = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setUserPasskeyRegLoading(true);
    setUserPasskeyRegErr('');
    try {
      await registerUserPasskey(user.email, user.displayName || user.email);
      setUserPasskeyRegSuccess(true);
      setUserPasskeyAvailable(true);
      setUserPasskeyEmail(user.email);
      setTimeout(() => {
        setShowUserPasskeyModal(false);
        navigate(pendingNavigateTo, { replace: true });
      }, 1500);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setUserPasskeyRegErr('Registro cancelado.');
      } else {
        setUserPasskeyRegErr(err.message || 'No se pudo registrar la huella.');
      }
    } finally {
      setUserPasskeyRegLoading(false);
    }
  };

  // Autenticar usuario normal con huella
  const handleUserPasskeyLogin = async () => {
    setUserPasskeyLoading(true);
    setErrMsg("");
    try {
      const verifiedEmail = await authenticateUserWithPasskey(userPasskeyEmail);

      // Si ya hay sesión activa con ese email, navegar directo
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email === verifiedEmail) {
        const worker = await getWorkerByEmail(verifiedEmail).catch(() => null);
        const workerRoles = ['WORKER', 'CAJERA', 'VENDEDORA', 'GARZON'];
        if (workerRoles.includes(worker?.role)) {
          navigate("/dashboard-trabajador", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
        return;
      }

      // Huella verificada localmente → pedir custom token al backend y hacer login sin contraseña
      const res = await fetch(`${API_URL}/api/auth/passkey-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifiedEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'No se pudo completar el acceso con huella.');
      }

      await signInWithCustomToken(auth, data.token);

      // Login exitoso — determinar destino según rol
      const worker = await getWorkerByEmail(verifiedEmail).catch(() => null);
      const workerRoles2 = ['WORKER', 'CAJERA', 'VENDEDORA', 'GARZON'];
      if (workerRoles2.includes(worker?.role)) {
        navigate("/dashboard-trabajador", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      const isDomainError = err.name === 'InvalidStateError'
        || err.message?.includes('insufen')
        || err.message?.includes('insufficient')
        || err.message?.includes('dominio')
        || err.message?.includes('not allowed');

      if (err.name === 'NotAllowedError') {
        setErrMsg("Autenticación cancelada.");
      } else if (isDomainError) {
        // Limpiar huella inválida y llevar al form con contraseña
        if (userPasskeyEmail) {
          const key = `bodestock_passkey_id_${btoa(userPasskeyEmail).replace(/=/g, '')}`;
          const emailKey = `bodestock_passkey_email_${btoa(userPasskeyEmail).replace(/=/g, '')}`;
          localStorage.removeItem(key);
          localStorage.removeItem(emailKey);
        }
        localStorage.removeItem('bodestock_passkey_id');
        localStorage.removeItem('bodestock_passkey_email');
        setUserPasskeyAvailable(false);
        setPasskeyAvailable(false);
        setIsMobile(false);
        setErrMsg("Tu huella anterior no es válida en este dominio. Inicia sesión con contraseña para registrarla de nuevo.");
      } else {
        setErrMsg(err.message || "No se pudo autenticar con huella.");
      }
    } finally {
      setUserPasskeyLoading(false);
    }
  };

  const disabled = loading || !!emailErr || !!pwdErr || !email || !password;

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
          className="w-full max-w-md"
        >

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
                    onKeyDown={e => e.key === 'Enter' && handleGoogleSetup()}
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
                Cancelar y volver al inicio de sesión
              </button>
            </div>
          </motion.div>
        )}

        {/* ===== PANTALLA HUELLA MÓVIL ===== */}
        {/* Solo en móvil, sin googleUser, y si hay huella registrada (usuario normal o super-admin) */}
        {!googleUser && isMobile && (userPasskeyAvailable || passkeyAvailable) && (
          <motion.div
            key="mobile-biometric"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex flex-col items-center justify-center min-h-[70vh] px-4"
          >
            {/* Glow de fondo (estático) */}
            <div
              className="absolute w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle, #3B82F6, #60A5FA, transparent)" }}
            />

            {/* Logo */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Logo size="2xl" animated={true} />
            </motion.div>

            {/* Icono huella principal */}
            <motion.button
              onClick={passkeyAvailable ? handlePasskeyLogin : handleUserPasskeyLogin}
              disabled={userPasskeyLoading || passkeyLoading}
              className="relative flex items-center justify-center focus:outline-none"
              whileTap={{ scale: 0.93 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {/* Anillos (estáticos) */}
              {!(userPasskeyLoading || passkeyLoading) && (<>
                <span
                  className="absolute rounded-full border border-blue-400/30"
                  style={{ width: 140, height: 140 }}
                />
                <span
                  className="absolute rounded-full border border-blue-400/20"
                  style={{ width: 180, height: 180 }}
                />
              </>)}

              {/* Círculo base */}
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(96,165,250,0.15))",
                  border: "1.5px solid rgba(96,165,250,0.4)",
                  boxShadow: "0 0 40px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.1)"
                }}
              >
                {(userPasskeyLoading || passkeyLoading) ? (
                  <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                ) : (
                  <Fingerprint className="w-14 h-14 text-blue-400" strokeWidth={1.3} />
                )}
              </div>
            </motion.button>

            {/* Texto */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <p className="text-white text-lg font-semibold">
                {(userPasskeyLoading || passkeyLoading) ? "Verificando..." : "Toca para entrar"}
              </p>
              {(userPasskeyEmail) && !(userPasskeyLoading || passkeyLoading) && (
                <p className="text-white/40 text-sm mt-1">{userPasskeyEmail}</p>
              )}
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {errMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm text-center max-w-xs"
                >
                  <p>{errMsg}</p>
                  {(errMsg.includes('dominio') || errMsg.includes('válida') || errMsg.includes('registrarla')) && (
                    <button
                      className="mt-2 text-xs text-red-400 underline underline-offset-2 hover:text-red-200 transition-colors"
                      onClick={() => {
                        // Limpiar huella inválida y volver al form normal
                        if (userPasskeyEmail) {
                          const key = `bodestock_passkey_id_${btoa(userPasskeyEmail).replace(/=/g, '')}`;
                          const emailKey = `bodestock_passkey_email_${btoa(userPasskeyEmail).replace(/=/g, '')}`;
                          localStorage.removeItem(key);
                          localStorage.removeItem(emailKey);
                        }
                        localStorage.removeItem('bodestock_passkey_id');
                        localStorage.removeItem('bodestock_passkey_email');
                        setUserPasskeyAvailable(false);
                        setPasskeyAvailable(false);
                        setIsMobile(false);
                        setErrMsg('');
                      }}
                    >
                      Borrar huella y usar contraseña
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Opciones secundarias */}
            <motion.div
              className="mt-10 flex flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <button
                className="text-white/60 text-sm font-medium hover:text-white transition-colors underline underline-offset-2"
                onClick={() => setIsMobile(false)}
              >
                Usar correo y contraseña
              </button>
              <button
                className="text-blue-400/70 text-xs hover:text-blue-300 transition-colors"
                onClick={() => { setIsMobile(false); setTimeout(() => setShowResetModal(true), 100); }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Card de login normal (oculta si hay googleUser, o si es móvil con huella) */}
        {!googleUser && !(isMobile && (userPasskeyAvailable || passkeyAvailable)) && (<>
          {/* Glow decorativo (estático) */}
          <div
            className="absolute -inset-2 rounded-3xl opacity-60 blur-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(96, 165, 250, 0.2), rgba(6, 182, 212, 0.3))"
            }}
          />

          {/* Card principal */}
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
            {/* Header animado */}
            <motion.div
              className="flex flex-col items-center text-center mb-6 sm:mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {/* Logo Bodestock */}
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
                <Logo size="xl" animated={true} />
              </motion.div>

              <motion.h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                Bienvenido de vuelta
              </motion.h1>

              <motion.p
                className="text-white/70 text-sm font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                Ingresa tus credenciales para continuar
              </motion.p>
            </motion.div>

            {/* Error global animado */}
            <AnimatePresence>
              {errMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm backdrop-blur-sm"
                >
                  {errMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <motion.form
              onSubmit={onSubmit}
              className="space-y-4 sm:space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.1 }}
              >
                <label className="block text-sm font-semibold text-white/80 mb-2">
                  Correo electrónico
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                  <motion.input
                    type="email"
                    value={email}
                    onChange={handleEmail}
                    placeholder="tucorreo@empresa.com"
                    className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                    ${emailErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    whileFocus={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </div>
                <AnimatePresence>
                  {emailErr && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mt-2 text-xs text-red-300"
                    >
                      {emailErr}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
              >
                <label className="block text-sm font-semibold text-white/80 mb-2">
                  Contraseña
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                  <motion.input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={handlePwd}
                    placeholder="••••••••"
                    className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-12 py-3 sm:py-4 outline-none ring-1 transition-all duration-300 backdrop-blur-sm
                    ${pwdErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                    whileFocus={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-blue-500 p-1 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {pwdErr && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mt-2 text-xs text-red-300"
                    >
                      {pwdErr}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Extras */}
              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.3 }}
              >
                <motion.label
                  className="inline-flex items-center gap-3 text-sm text-white/70 select-none cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500/60 focus:ring-2"
                  />
                  Recuérdame
                </motion.label>
                <motion.button
                  type="button"
                  className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  onClick={() => setShowResetModal(true)}
                  whileHover={{ scale: 1.05 }}
                >
                  ¿Olvidaste tu contraseña?
                </motion.button>
              </motion.div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={disabled}
                className={`w-full rounded-xl px-4 sm:px-6 py-3 sm:py-4 font-bold text-base sm:text-lg transition-all duration-300 relative overflow-hidden
                ${disabled
                    ? "bg-white/10 text-white/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl hover:shadow-blue-500/25"}`
                }
                style={{
                  boxShadow: disabled ? "none" : "0 10px 30px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                }}
                whileHover={disabled ? {} : { scale: 1.02, y: -2 }}
                whileTap={disabled ? {} : { scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.4 }}
              >
                {!disabled && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      repeatDelay: 3
                    }}
                  />
                )}

                <div className="relative flex items-center justify-center gap-3">
                  {loading && (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                  {loading ? "Ingresando..." : "Iniciar sesión"}
                </div>
              </motion.button>
            </motion.form>

            {/* Separador */}
            <motion.div
              className="flex items-center gap-3 mt-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.5 }}
            >
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-xs font-medium">o continúa con</span>
              <div className="flex-1 h-px bg-white/10" />
            </motion.div>

            {/* Botón Google */}
            <motion.button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="mt-3 w-full flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 transition-all duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ? "Iniciando con Google..." : "Continuar con Google"}
            </motion.button>

            {/* Botón Huella - usuarios normales (clientes/trabajadores) */}
            <AnimatePresence>
              {userPasskeyAvailable && !passkeyAvailable && (
                <motion.button
                  type="button"
                  onClick={handleUserPasskeyLogin}
                  disabled={userPasskeyLoading || loading}
                  className="mt-3 w-full flex items-center justify-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-blue-300 font-semibold py-3 transition-all duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  {userPasskeyLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  <span className="flex flex-col items-start leading-tight">
                    <span>{userPasskeyLoading ? "Verificando huella..." : "Entrar con huella"}</span>
                    {userPasskeyEmail && !userPasskeyLoading && (
                      <span className="text-[10px] text-blue-400/60 font-normal">{userPasskeyEmail}</span>
                    )}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Botón Huella (super-admin) */}
            <AnimatePresence>
              {passkeyAvailable && (
                <motion.button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading || loading}
                  className="mt-3 w-full flex items-center justify-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-purple-300 font-semibold py-3 transition-all duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  {passkeyLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  {passkeyLoading ? "Verificando huella..." : "Entrar con huella"}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Footer */}
            <motion.p
              className="mt-6 sm:mt-8 text-center text-sm text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.6 }}
            >
              ¿No tienes cuenta?{" "}
              <motion.span
                className="font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                onClick={() => navigate("/register")}
                whileHover={{ scale: 1.05 }}
              >
                Regístrate aquí
              </motion.span>
            </motion.p>
          </motion.div>
        </>)}
        </motion.div>
      </div>

      {/* Modal: Guardar huella (post-login super-admin) */}
      <AnimatePresence>
        {showPasskeyModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-900 to-gray-900 p-8 shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Icono */}
              <div className="flex flex-col items-center text-center mb-6">
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Fingerprint className="w-8 h-8 text-purple-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">¿Activar acceso por huella?</h2>
                <p className="text-white/60 text-sm">
                  La próxima vez podrás entrar al panel de super-admin usando la huella de este dispositivo.
                </p>
              </div>

              {/* Error */}
              <AnimatePresence>
                {passkeyRegErr && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm flex items-center gap-2"
                  >
                    <X className="w-4 h-4 flex-shrink-0" />
                    {passkeyRegErr}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Éxito */}
              <AnimatePresence>
                {passkeyRegSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-200 text-sm flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    ¡Huella guardada! Entrando al panel...
                  </motion.div>
                )}
              </AnimatePresence>

              {!passkeyRegSuccess && (
                <div className="space-y-3">
                  <button
                    onClick={handleRegisterPasskey}
                    disabled={passkeyRegLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-base bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-purple-500/25"
                  >
                    {passkeyRegLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Fingerprint className="w-5 h-5" />
                    )}
                    {passkeyRegLoading ? "Registrando huella..." : "Activar huella"}
                  </button>

                  <button
                    onClick={() => { setShowPasskeyModal(false); navigate("/super-admin", { replace: true }); }}
                    className="w-full text-sm text-white/40 hover:text-white/70 py-2 transition-colors"
                  >
                    Ahora no, entrar sin huella
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Activar huella post-login (usuarios normales) */}
      <AnimatePresence>
        {showUserPasskeyModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-gray-900 p-8 shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex flex-col items-center text-center mb-6">
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Fingerprint className="w-8 h-8 text-blue-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">¿Activar acceso por huella?</h2>
                <p className="text-white/60 text-sm">
                  La próxima vez podrás entrar directamente usando la huella de este dispositivo, sin escribir tu contraseña.
                </p>
              </div>

              <AnimatePresence>
                {userPasskeyRegErr && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm flex items-center gap-2"
                  >
                    <X className="w-4 h-4 flex-shrink-0" />
                    {userPasskeyRegErr}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {userPasskeyRegSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-200 text-sm flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    ¡Huella guardada! Entrando...
                  </motion.div>
                )}
              </AnimatePresence>

              {!userPasskeyRegSuccess && (
                <div className="space-y-3">
                  <button
                    onClick={handleRegisterUserPasskey}
                    disabled={userPasskeyRegLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-base bg-gradient-to-r from-blue-600 to-indigo-600 text-white disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-blue-500/25"
                  >
                    {userPasskeyRegLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Fingerprint className="w-5 h-5" />
                    )}
                    {userPasskeyRegLoading ? "Registrando huella..." : "Activar huella"}
                  </button>

                  <button
                    onClick={() => { setShowUserPasskeyModal(false); navigate(pendingNavigateTo, { replace: true }); }}
                    className="w-full text-sm text-white/40 hover:text-white/70 py-2 transition-colors"
                  >
                    Ahora no, entrar sin huella
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Recuperar Contraseña */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResetModal(false)}
          >
            <motion.div
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-gray-900 p-8 shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botón cerrar */}
              <motion.button
                onClick={() => setShowResetModal(false)}
                className="absolute top-4 right-4 text-black/60 hover:text-white transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-6 h-6" />
              </motion.button>

              {/* Título */}
              <motion.h2
                className="text-2xl font-bold text-white mb-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Recuperar contraseña
              </motion.h2>

              <motion.p
                className="text-white/70 text-sm mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </motion.p>

              {/* Mensaje de éxito */}
              <AnimatePresence>
                {resetSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-200 text-sm"
                  >
                    ✅ Correo enviado exitosamente. Revisa tu bandeja de entrada.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mensaje de error */}
              <AnimatePresence>
                {resetError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm"
                  >
                    {resetError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <motion.input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setResetEmailErr(!isEmail(e.target.value) ? "Ingresa un correo válido." : "");
                        setResetError("");
                      }}
                      placeholder="tucorreo@empresa.com"
                      className={`w-full rounded-xl bg-white/90 text-black placeholder-gray-500 pl-11 pr-4 py-3 outline-none ring-1 transition-all duration-300
                        ${resetEmailErr ? "ring-red-500/60 bg-red-500/10" : "ring-white/20 focus:ring-blue-500/70 focus:bg-white"}`}
                      whileFocus={{ scale: 1.02 }}
                    />
                  </div>
                  <AnimatePresence>
                    {resetEmailErr && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="mt-2 text-xs text-red-300"
                      >
                        {resetEmailErr}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all border border-white/20"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={resetLoading || !resetEmail || !!resetEmailErr}
                    className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                      ${resetLoading || !resetEmail || !!resetEmailErr
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/25"
                      }`}
                    whileHover={resetLoading || !resetEmail || !!resetEmailErr ? {} : { scale: 1.02 }}
                    whileTap={resetLoading || !resetEmail || !!resetEmailErr ? {} : { scale: 0.98 }}
                  >
                    {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {resetLoading ? "Enviando..." : "Enviar enlace"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
