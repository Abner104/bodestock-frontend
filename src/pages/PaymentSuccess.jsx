// src/pages/PaymentSuccess.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import Logo from '../components/ui/Logo';
import confetti from 'canvas-confetti';
import { API_URL } from '../config/env';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Lanzar confetti
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF6F00', '#FFA726', '#FFB74D']
      });

      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FF6F00', '#FFA726', '#FFB74D']
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      const paymentId = searchParams.get('payment_id');
      const externalRef = searchParams.get('external_reference');

      if (!paymentId) {
        setError(true);
        setVerifying(false);
        return;
      }

      try {
        // Verificar el pago con el backend
        const backendUrl = import.meta.env.VITE_BACKEND_URL || `${API_URL}`;
        const verifyUrl = new URL(`${backendUrl}/api/payments/verify/${paymentId}`);
        if (externalRef) verifyUrl.searchParams.set('external_reference', externalRef);
        const response = await fetch(verifyUrl.toString());

        if (!response.ok) throw new Error('Error verificando pago');

        const data = await response.json();
        setPaymentData(data);
        setVerifying(false);

        // Auto-redirect después de 5 segundos
        // Forzar recarga completa para que useCompanyStatus detecte el nuevo estado
        setTimeout(() => {
          window.location.replace('/');
        }, 5000);

      } catch (err) {
        console.error('Error verificando pago:', err);
        setError(true);
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4">
        <motion.div
          className="text-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-xl font-semibold">Verificando tu pago...</p>
          <p className="text-gray-400 mt-2">Esto tomará solo un momento</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4">
        <motion.div
          className="text-center text-white max-w-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-8 mb-6">
            <p className="text-xl font-semibold mb-2">Error al verificar el pago</p>
            <p className="text-gray-400">Por favor contacta a soporte si el dinero fue debitado.</p>
          </div>
          <motion.button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl hover:from-orange-700 hover:to-amber-600 transition font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Ir al Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Logo size="md" showText={true} />
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
          {/* Icono de éxito */}
          <motion.div
            className="relative inline-block mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 blur-3xl bg-green-500/50 rounded-full" />

            <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-8">
              <CheckCircle className="w-24 h-24 text-white" />
            </div>

            {/* Sparkles */}
            <motion.div
              className="absolute -top-4 -right-4"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-8 h-8 text-yellow-400" />
            </motion.div>
          </motion.div>

          {/* Título */}
          <motion.h1
            className="text-4xl md:text-5xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            ¡Pago Exitoso! 🎉
          </motion.h1>

          {/* Descripción */}
          <motion.p
            className="text-xl text-gray-300 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Tu suscripción ha sido activada correctamente
          </motion.p>

          {/* Información del pago */}
          {paymentData && (
            <motion.div
              className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Estado</p>
                  <p className="text-white font-semibold">
                    {paymentData.status === 'approved' ? '✅ Aprobado' : paymentData.status}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Monto</p>
                  <p className="text-white font-semibold">
                    ${paymentData.amount?.toLocaleString('es-CL') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Método de pago</p>
                  <p className="text-white font-semibold capitalize">
                    {paymentData.paymentMethod || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Detalles</p>
                  <p className="text-white font-semibold">
                    {paymentData.statusDetail || 'Acreditado'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Mensaje de bienvenida */}
          <motion.div
            className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-2xl p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              ¡Bienvenido a ProControl Premium! 🚀
            </h3>
            <p className="text-gray-300">
              Ya puedes disfrutar de todas las funcionalidades de tu plan.
              Serás redirigido al dashboard en 5 segundos...
            </p>
          </motion.div>

          {/* Botón de continuar */}
          <motion.button
            onClick={() => window.location.replace('/')}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl hover:from-orange-700 hover:to-amber-600 transition font-semibold text-lg text-white shadow-lg hover:shadow-orange-500/50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Ir al Dashboard
            <ArrowRight className="w-5 h-5" />
          </motion.button>

          {/* Auto-redirect indicator */}
          <motion.p
            className="text-gray-500 text-sm mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            O espera a ser redirigido automáticamente
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
