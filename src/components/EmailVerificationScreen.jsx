// src/components/EmailVerificationScreen.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, LogOut, CheckCircle, ArrowRight } from 'lucide-react';
import { sendEmailVerification, signOut, reload } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { API_URL } from '../config/env';

export default function EmailVerificationScreen() {
  const [resending, setResending]   = useState(false);
  const [resent, setResent]         = useState(false);
  const [checking, setChecking]     = useState(false);
  const [error, setError]           = useState('');
  const [cooldown, setCooldown]     = useState(0); // segundos hasta poder reenviar

  const startCooldown = (secs = 60) => {
    setCooldown(secs);
    const t = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError('');
    try {
      const user = auth.currentUser;
      const res = await fetch(`${API_URL}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.displayName || '' }),
      });
      if (!res.ok) throw new Error('Backend error');
      setResent(true);
      startCooldown(60);
      setTimeout(() => setResent(false), 6000);
    } catch {
      try {
        await sendEmailVerification(auth.currentUser);
        setResent(true);
        startCooldown(60);
        setTimeout(() => setResent(false), 6000);
      } catch {
        setError('No se pudo reenviar. Espera unos minutos e intenta de nuevo.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    setChecking(true);
    setError('');
    try {
      await reload(auth.currentUser);
      if (auth.currentUser?.emailVerified) {
        await auth.currentUser.getIdToken(true);
        window.location.href = '/';
      } else {
        setError('Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada (y la carpeta de spam).');
      }
    } catch {
      setError('Error al verificar. Intenta nuevamente.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">

          {/* Icono animado */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30"
          >
            <Mail className="w-10 h-10 text-white" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-2">Confirma tu correo</h1>
          <p className="text-white/50 text-sm mb-1">
            Te enviamos un enlace de activación a:
          </p>
          <p className="text-blue-400 font-semibold mb-2 text-sm break-all">
            {auth.currentUser?.email}
          </p>
          <p className="text-white/30 text-xs mb-7 leading-relaxed">
            Haz clic en el botón del correo para activar tu cuenta.<br />
            Si no lo ves, revisa la carpeta de <span className="text-white/50">spam</span> o <span className="text-white/50">correo no deseado</span>.
          </p>

          {/* Alertas */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-left"
              >
                {error}
              </motion.div>
            )}
            {resent && (
              <motion.div
                key="resent"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ¡Correo reenviado! Revisa tu bandeja de entrada.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {/* Botón principal — ya verifiqué */}
            <button
              onClick={handleCheckVerified}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all disabled:opacity-60 shadow-lg shadow-blue-600/20"
            >
              {checking
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <CheckCircle className="w-4 h-4" />
              }
              {checking ? 'Verificando...' : 'Ya activé mi correo'}
              {!checking && <ArrowRight className="w-4 h-4 ml-auto" />}
            </button>

            {/* Reenviar */}
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm hover:bg-white/10 hover:text-white/80 transition disabled:opacity-40"
            >
              {resending
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Mail className="w-4 h-4" />
              }
              {resending
                ? 'Enviando...'
                : cooldown > 0
                  ? `Reenviar en ${cooldown}s`
                  : 'Reenviar correo de activación'
              }
            </button>

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-white/25 text-xs hover:text-white/50 transition"
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Nota inferior */}
        <p className="text-center text-white/20 text-xs mt-4">
          ¿Problemas? Escríbenos a{' '}
          <a href="mailto:soporte@bodestock.cl" className="text-white/40 hover:text-white/60 underline transition">
            soporte@bodestock.cl
          </a>
        </p>
      </motion.div>
    </div>
  );
}
