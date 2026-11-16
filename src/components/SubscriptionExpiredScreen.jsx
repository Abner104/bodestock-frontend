// src/components/SubscriptionExpiredScreen.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, CreditCard, MessageSquare, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import Logo from './ui/Logo';

export default function SubscriptionExpiredScreen({ billingExpired = false }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-black p-4">
      {/* Glow de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center shadow-2xl">

          <div className="flex justify-center mb-6">
            <Logo size="sm" animated={false} />
          </div>

          {/* Icono */}
          <motion.div
            className="w-20 h-20 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Lock className="w-10 h-10 text-red-400" />
          </motion.div>

          <h2 className="text-2xl font-bold text-white mb-3">
            {billingExpired ? 'Suscripción vencida' : 'Período de prueba finalizado'}
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-8">
            {billingExpired
              ? 'Tu suscripción ha vencido y el período de gracia de 2 días ha terminado. Realiza el pago para recuperar el acceso y no perder tus datos.'
              : 'Tu período de prueba gratuito ha terminado. Elige un plan para seguir usando Bodestock y no perder tus datos.'}
          </p>

          {/* Botones */}
          <div className="space-y-3">
            <motion.button
              onClick={() => navigate('/plans')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <CreditCard className="w-5 h-5" />
              {billingExpired ? 'Pagar suscripción' : 'Ver planes y precios'}
            </motion.button>

            <a
              href="https://wa.me/56948487391?text=Hola%2C%20necesito%20ayuda%20con%20mi%20plan%20de%20Bodestock"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 font-semibold text-sm transition-all"
            >
              <MessageSquare className="w-4 h-4 text-green-400" />
              Contactar soporte por WhatsApp
            </a>

            <button
              onClick={handleLogout}
              className="w-full text-white/30 hover:text-white/60 text-sm py-2 transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
