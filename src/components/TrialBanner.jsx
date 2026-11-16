// src/components/TrialBanner.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, CreditCard, X } from 'lucide-react';
import { useCompanyStatus } from '../hooks/useCompanyStatus';
import { auth } from '../firebase/firebase';
import { SUPER_ADMIN_EMAIL } from '../config/env.js';

export default function TrialBanner() {
  const navigate = useNavigate();
  const { status, trialDaysLeft, billingDaysLeft, graceDaysLeft, needsUpgrade } = useCompanyStatus();
  const [dismissed, setDismissed] = React.useState(
    () => { try { return sessionStorage.getItem('banner-dismissed') === 'true'; } catch { return false; } }
  );

  // SUPER_ADMIN nunca ve el banner en su propio panel
  if (auth.currentUser?.email === SUPER_ADMIN_EMAIL) return null;
  if (!needsUpgrade) return null;

  // En modo impersonación mostrar banner informativo (solo lectura, sin botón pagar)
  const isImpersonating = (() => { try { return !!sessionStorage.getItem('impersonation'); } catch { return false; } })();

  const isGrace = status === 'grace_period' || status === 'billing_grace';
  const isExpired = status === 'trial_expired' || status === 'billing_expired' || status === 'suspended' || status === 'cancelled';
  const isCritical = isGrace || isExpired;

  // Si es crítico (venció/gracia) no se puede cerrar
  // Si no es crítico, el cliente puede cerrarlo manualmente hasta la próxima recarga
  if (dismissed && !isCritical) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem('banner-dismissed', 'true'); } catch {}
    setDismissed(true);
  };

  const bgColor = isExpired
    ? 'from-red-600 to-red-700'
    : isGrace
      ? 'from-orange-500 to-orange-600'
      : (status === 'active' && billingDaysLeft !== null && billingDaysLeft <= 0)
        ? 'from-red-500 to-red-600'
        : 'from-amber-500 to-amber-600';

  const getMessage = () => {
    if (status === 'suspended') return 'Tu suscripción ha sido suspendida. Renueva tu plan para continuar.';
    if (status === 'cancelled') return 'Tu suscripción ha sido cancelada. Reactiva tu plan para acceder a todas las funciones.';
    if (status === 'trial_expired') return 'Tu período de prueba ha vencido. Elige un plan para continuar.';
    if (status === 'billing_expired') return 'Tu suscripción ha vencido. Realiza el pago para continuar.';
    if (status === 'grace_period') return `Período de gracia: te quedan ${graceDaysLeft} día${graceDaysLeft !== 1 ? 's' : ''} hábil${graceDaysLeft !== 1 ? 'es' : ''} para elegir un plan.`;
    if (status === 'billing_grace') return `Tu suscripción venció. Te quedan ${graceDaysLeft} día${graceDaysLeft !== 1 ? 's' : ''} para pagar antes de que se bloquee el acceso.`;
    if (status === 'trial') return `Período de prueba: te quedan ${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} gratis.`;
    if (status === 'active' && billingDaysLeft !== null) {
      if (billingDaysLeft <= 0) return '⚠️ Tu plan vence hoy. Renuévalo para no perder el acceso.';
      return `Tu plan vence en ${billingDaysLeft} día${billingDaysLeft !== 1 ? 's' : ''}. Renuévalo para no perder el acceso.`;
    }
    return 'Tu suscripción ha vencido. Renueva tu plan para continuar.';
  };

  const ctaLabel = 'Pagar ahora';
  const ctaPath = '/plans';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className={`fixed top-[64px] left-0 right-0 z-40 bg-gradient-to-r ${bgColor} text-white shadow-lg`}
        style={{ paddingTop: '0.6rem', paddingBottom: '0.6rem' }}
      >
        <div className="container mx-auto px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isCritical ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Clock className="w-4 h-4 flex-shrink-0" />
            )}
            <p className="text-sm font-semibold truncate">
              {getMessage()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.button
              onClick={() => navigate(ctaPath)}
              className="bg-white text-gray-900 px-3 sm:px-5 py-1.5 rounded-lg font-bold text-sm hover:bg-gray-100 transition-all flex items-center gap-1.5"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{ctaLabel}</span>
            </motion.button>
            {!isCritical && !isImpersonating && (
              <motion.button
                onClick={handleDismiss}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                whileTap={{ scale: 0.9 }}
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
