// src/pages/PaymentFailure.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, AlertTriangle, ArrowLeft, RotateCcw, HelpCircle } from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function PaymentFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorDetails, setErrorDetails] = useState(null);

  useEffect(() => {
    const status = searchParams.get('status');
    const statusDetail = searchParams.get('status_detail');
    const externalRef = searchParams.get('external_reference');

    setErrorDetails({
      status: status || 'rejected',
      statusDetail: statusDetail || 'unknown',
      externalRef
    });
  }, [searchParams]);

  const getErrorMessage = () => {
    if (!errorDetails) return 'El pago no pudo ser procesado';

    const detail = errorDetails.statusDetail;

    if (detail.includes('insufficient_funds')) {
      return 'Fondos insuficientes en tu cuenta';
    }
    if (detail.includes('declined')) {
      return 'El pago fue rechazado por tu banco';
    }
    if (detail.includes('cc_rejected_bad_filled')) {
      return 'Verifica los datos de tu tarjeta';
    }
    if (detail.includes('cc_rejected_card_disabled')) {
      return 'Tu tarjeta está deshabilitada';
    }
    if (detail.includes('cc_rejected_high_risk')) {
      return 'El pago fue rechazado por seguridad';
    }

    return 'El pago no pudo ser procesado';
  };

  const getHelpText = () => {
    if (!errorDetails) return 'Intenta nuevamente o usa otro método de pago.';

    const detail = errorDetails.statusDetail;

    if (detail.includes('insufficient_funds')) {
      return 'Verifica que tengas fondos suficientes en tu cuenta o usa otro método de pago.';
    }
    if (detail.includes('declined') || detail.includes('high_risk')) {
      return 'Contacta a tu banco para más información o intenta con otra tarjeta.';
    }
    if (detail.includes('bad_filled')) {
      return 'Revisa que hayas ingresado correctamente todos los datos de tu tarjeta.';
    }
    if (detail.includes('card_disabled')) {
      return 'Contacta a tu banco para habilitar tu tarjeta o usa otro método de pago.';
    }

    return 'Intenta nuevamente o usa otro método de pago. Si el problema persiste, contacta a soporte.';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" showText={true} />
          <motion.button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            whileHover={{ x: -5 }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Volver</span>
          </motion.button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <motion.div
          className="max-w-2xl w-full text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Icono de error */}
          <motion.div
            className="relative inline-block mb-8"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 blur-3xl bg-red-500/30 rounded-full" />

            <div className="relative bg-gradient-to-br from-red-500 to-red-600 rounded-full p-8">
              <XCircle className="w-24 h-24 text-white" />
            </div>

            {/* Warning icon */}
            <motion.div
              className="absolute -top-2 -right-2"
              animate={{
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <div className="bg-yellow-500 rounded-full p-2">
                <AlertTriangle className="w-6 h-6 text-black" />
              </div>
            </motion.div>
          </motion.div>

          {/* Título */}
          <motion.h1
            className="text-4xl md:text-5xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Pago Rechazado
          </motion.h1>

          {/* Mensaje de error */}
          <motion.p
            className="text-xl text-gray-300 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {getErrorMessage()}
          </motion.p>

          {/* Detalles del error */}
          <motion.div
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-start gap-4">
              <HelpCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white mb-2">¿Qué puedes hacer?</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {getHelpText()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Razones comunes */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Razones comunes de rechazo:</h3>
            <ul className="space-y-3 text-gray-300 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span>Fondos insuficientes en la cuenta</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span>Datos de la tarjeta incorrectos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span>Límite de compra excedido</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span>Tarjeta vencida o bloqueada</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span>Problemas de seguridad detectados por el banco</span>
              </li>
            </ul>
          </motion.div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              onClick={() => navigate('/upgrade')}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl hover:from-orange-700 hover:to-amber-600 transition font-semibold text-lg text-white shadow-lg hover:shadow-orange-500/50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-5 h-5" />
              Intentar Nuevamente
            </motion.button>

            <motion.button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition font-semibold text-lg text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al Dashboard
            </motion.button>
          </div>

          {/* Soporte */}
          <motion.div
            className="mt-8 text-gray-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <p>
              ¿Necesitas ayuda?{' '}
              <a
                href="mailto:soporte@bodestockgo.com"
                className="text-orange-400 hover:text-orange-300 font-semibold"
              >
                Contacta a soporte
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
