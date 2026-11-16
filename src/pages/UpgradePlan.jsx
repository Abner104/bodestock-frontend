// src/pages/UpgradePlan.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useCompanyStatus } from '../hooks/useCompanyStatus';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import Logo from '../components/ui/Logo';
import { API_URL } from '../config/env';

const PLANS = [
  {
    id: 'basico',
    name: 'Básico',
    price: 19990,
    features: [
      '3 usuarios',
      '200 productos',
      '2 bodegas',
      'Alertas por email',
      'Exportar a Excel'
    ],
    color: 'from-blue-600 to-blue-700'
  },
  {
    id: 'profesional',
    name: 'Profesional',
    price: 49990,
    features: [
      '10 usuarios',
      '1000 productos',
      '5 bodegas',
      'Reportes mensuales',
      'Soporte prioritario',
      'Alertas avanzadas'
    ],
    color: 'from-orange-600 to-amber-600',
    popular: true
  },
  {
    id: 'empresa',
    name: 'Empresa',
    price: 79990,
    features: [
      'Usuarios ilimitados',
      'Productos ilimitados',
      'Bodegas ilimitadas',
      'API personalizada',
      'Soporte 24/7',
      'Integraciones'
    ],
    color: 'from-purple-600 to-pink-600'
  }
];

export default function UpgradePlan() {
  const navigate = useNavigate();
  const { status, active, companyId: statusCompanyId } = useCompanyStatus();
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    const loadCompanyInfo = async () => {
      const id = statusCompanyId;
      if (id) {
        const companyDoc = await getDoc(doc(db, 'companies', id));
        if (companyDoc.exists()) {
          setCompanyName(companyDoc.data().name);
        }
      }
    };
    loadCompanyInfo();
  }, [statusCompanyId]);

  const handlePayment = async (planId) => {
    const plan = PLANS.find(p => p.id === planId);
    setSelectedPlan(planId);
    setLoading(true);

    try {
      // Crear preferencia de Mercado Pago
      const preference = {
        items: [
          {
            title: `Plan ${plan.name} - ProControl`,
            unit_price: plan.price,
            quantity: 1,
            description: `Suscripción mensual - ${companyName || 'Tu empresa'}`
          }
        ],
        back_urls: {
          success: `${window.location.origin}/payment-success`,
          failure: `${window.location.origin}/payment-failure`,
          pending: `${window.location.origin}/payment-pending`
        },
        auto_return: 'approved',
        external_reference: `${statusCompanyId}_${planId}_${Date.now()}`,
        metadata: {
          companyId: statusCompanyId,
          plan: planId
        }
      };

      // Llamar al backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || `${API_URL}`;
      const response = await fetch(`${backendUrl}/api/payments/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preference)
      });

      if (!response.ok) {
        throw new Error('Error al crear preferencia de pago');
      }

      const data = await response.json();

      // Redirigir a Mercado Pago
      window.location.href = data.init_point;

    } catch (error) {
      console.error('Error creando preferencia:', error);
      alert('Error al procesar el pago. Intenta nuevamente o contacta a soporte.');
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  // Si está activo, mostrar mensaje diferente
  if (active && status === 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4">
        <motion.div
          className="text-center text-white max-w-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Check className="w-20 h-20 text-green-400 mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl font-bold mb-3">¡Tu plan está activo!</h2>
          <p className="text-gray-400 mb-8">Estás disfrutando de todos los beneficios de ProControl</p>
          <motion.button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl hover:from-orange-700 hover:to-amber-600 transition font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Volver al Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" showText={true} />
          {!loading && (
            <motion.button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              whileHover={{ x: -5 }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Volver</span>
            </motion.button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Alert de trial expirado */}
        {(status === 'trial_expired' || status === 'suspended') && (
          <motion.div
            className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Tu período de prueba ha finalizado</h2>
                <p className="text-gray-300">
                  Selecciona un plan para continuar usando ProControl sin interrupciones.
                  Todos tus datos están seguros y listos para cuando reactives tu cuenta.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Header de planes */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {!(status === 'trial_expired' || status === 'suspended') && (
            <>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Elige el plan perfecto para tu negocio
              </h1>
              <p className="text-xl text-gray-400">
                Desbloquea todo el potencial de ProControl
              </p>
            </>
          )}
        </motion.div>

        {/* Planes */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-7xl mx-auto">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={`relative rounded-2xl p-8 backdrop-blur-sm border transition-all ${
                plan.popular
                  ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/50 md:scale-105'
                  : 'bg-white/5 border-white/10 hover:border-white/30'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ y: -8, scale: plan.popular ? 1.05 : 1.02 }}
            >
              {plan.popular && (
                <motion.div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  MÁS POPULAR
                </motion.div>
              )}

              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold">${plan.price.toLocaleString('es-CL')}</span>
                <span className="text-gray-400 text-lg">/mes</span>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <motion.li
                    key={idx}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.05 }}
                  >
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">{feature}</span>
                  </motion.li>
                ))}
              </ul>

              <motion.button
                onClick={() => handlePayment(plan.id)}
                disabled={loading}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg hover:shadow-orange-500/50 hover:from-orange-700 hover:to-amber-600'
                    : 'bg-white/10 border border-white/20 hover:bg-white/20'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                whileHover={!loading ? { scale: 1.05 } : {}}
                whileTap={!loading ? { scale: 0.95 } : {}}
              >
                {loading && selectedPlan === plan.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Elegir Plan'
                )}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Garantía */}
        <motion.div
          className="text-center text-gray-400 text-sm max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Lock className="w-5 h-5" />
            <span className="font-semibold">Pago 100% Seguro con Mercado Pago</span>
          </div>
          <p>
            Cancela cuando quieras • Sin contratos • Sin compromisos
          </p>
        </motion.div>
      </div>
    </div>
  );
}
