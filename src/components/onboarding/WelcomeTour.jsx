// src/components/onboarding/WelcomeTour.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check, Sparkles } from 'lucide-react';

const WelcomeTour = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Verificar si el usuario ya vio el tour
    const hasSeenTour = localStorage.getItem('bodestock-tour-completed');
    if (!hasSeenTour) {
      // Esperar 1 segundo antes de mostrar
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  const steps = [
    {
      title: '¡Bienvenido a Bodestock! 🎉',
      description: 'Estás a punto de tomar control total de tu inventario. Te mostraremos lo básico en 3 pasos simples.',
      image: '📦',
      position: 'center'
    },
    {
      title: 'Paso 1: Crea tu primera bodega',
      description: 'Las bodegas son los lugares donde guardas tus productos. Ve a "Inventario" → "Crear Bodega" y agrega una (Ej: "Bodega Principal").',
      highlight: 'inventario',
      image: '🏭',
      action: 'Ir a crear bodega'
    },
    {
      title: 'Paso 2: Agrega productos',
      description: 'Puedes agregar productos uno por uno, o importar desde Excel si ya tienes un inventario. Click en "Agregar Producto" o "Importar Excel".',
      highlight: 'productos',
      image: '📝',
      action: 'Ir a inventario'
    },
    {
      title: '¡Listo para despegar! 🚀',
      description: 'Ya tienes todo configurado. Explora el dashboard, revisa alertas de stock y gestiona tu equipo. ¡Cualquier duda, estamos para ayudarte!',
      image: '✨',
      position: 'center'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('bodestock-tour-completed', 'true');
    setShow(false);
    if (onComplete) onComplete();
  };

  if (!show) return null;

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        {/* Modal */}
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        >
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-20">
              <Sparkles className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="text-5xl mb-2">{step.image}</div>
                <button
                  onClick={handleSkip}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h2 className="text-2xl font-bold">{step.title}</h2>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed mb-6">
              {step.description}
            </p>

            {/* Progress indicators */}
            <div className="flex gap-2 mb-6">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    index <= currentStep
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Atrás
                </button>
              )}

              <button
                onClick={handleNext}
                className="flex-1 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <Check className="w-5 h-5" />
                    ¡Comenzar!
                  </>
                ) : (
                  <>
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Skip button */}
            {currentStep < steps.length - 1 && (
              <button
                onClick={handleSkip}
                className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Saltar tutorial
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeTour;
