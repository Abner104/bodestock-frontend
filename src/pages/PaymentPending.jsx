// src/pages/PaymentPending.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, AlertCircle, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function PaymentPending() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    const paymentId = searchParams.get('payment_id');
    const externalRef = searchParams.get('external_reference');
    const status = searchParams.get('status');

    setPaymentInfo({
      paymentId,
      externalRef,
      status: status || 'pending'
    });
  }, [searchParams]);

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
          {/* Icono de pendiente */}
          <motion.div
            className="relative inline-block mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 blur-3xl bg-yellow-500/30 rounded-full" />

            <div className="relative bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full p-8">
              <Clock className="w-24 h-24 text-white" />
            </div>

            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-yellow-500"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>

          {/* Título */}
          <motion.h1
            className="text-4xl md:text-5xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Pago Pendiente
          </motion.h1>

          {/* Descripción */}
          <motion.p
            className="text-xl text-gray-300 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Tu pago está siendo procesado
          </motion.p>

          {/* Información principal */}
          <motion.div
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white mb-2">¿Qué significa esto?</h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-3">
                  Tu pago está siendo procesado por Mercado Pago. Esto puede suceder cuando:
                </p>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Pagaste en efectivo y está pendiente de acreditación</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>El banco está validando tu transferencia</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Hay un proceso de verificación en curso</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Próximos pasos */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Próximos pasos
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-orange-500 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Recibirás un email de confirmación</p>
                  <p className="text-gray-400 text-sm">
                    Te notificaremos cuando tu pago sea procesado
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-orange-500 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Tu plan se activará automáticamente</p>
                  <p className="text-gray-400 text-sm">
                    Una vez confirmado el pago, tu suscripción se activará sin necesidad de hacer nada
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-orange-500 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Puedes seguir usando el sistema</p>
                  <p className="text-gray-400 text-sm">
                    Mientras tanto, continúa con tu periodo de prueba
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tiempo estimado */}
          <motion.div
            className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-2xl p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="flex items-center gap-3 justify-center">
              <CheckCircle className="w-6 h-6 text-blue-400" />
              <div className="text-left">
                <p className="text-white font-semibold">Tiempo estimado de procesamiento</p>
                <p className="text-gray-300 text-sm">
                  Normalmente entre 1 a 3 días hábiles
                </p>
              </div>
            </div>
          </motion.div>

          {/* Botón de volver */}
          <motion.button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl hover:from-orange-700 hover:to-amber-600 transition font-semibold text-lg text-white shadow-lg hover:shadow-orange-500/50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al Dashboard
          </motion.button>

          {/* ID de pago (si existe) */}
          {paymentInfo?.paymentId && (
            <motion.div
              className="mt-8 text-gray-500 text-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <p>ID de pago: {paymentInfo.paymentId}</p>
              <p className="mt-1">
                Guarda este número para consultas con soporte
              </p>
            </motion.div>
          )}

          {/* Soporte */}
          <motion.div
            className="mt-6 text-gray-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <p>
              ¿Tienes dudas?{' '}
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
