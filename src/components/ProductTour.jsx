// src/components/ProductTour.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { auth } from '../firebase/firebase';

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: '¡Bienvenido a ProControl! 🎉',
    description: 'Déjanos mostrarte las funciones principales para que aproveches al máximo tu sistema de gestión.',
    target: null, // Modal centrado
    placement: 'center'
  },
  {
    id: 'navbar',
    title: 'Navegación Principal',
    description: 'Desde aquí puedes acceder a todas las funcionalidades: Dashboard, Inventario, Catálogo, Costeo y más.',
    target: 'nav',
    placement: 'bottom',
    highlight: true
  },
  {
    id: 'dashboard-cards',
    title: 'Resumen de tu Negocio',
    description: 'Visualiza métricas importantes: productos totales, valor del inventario, alertas de stock bajo y más.',
    target: '[data-tour="dashboard-cards"]',
    placement: 'bottom',
    highlight: true
  },
  {
    id: 'quick-actions',
    title: 'Acciones Rápidas',
    description: 'Crea productos, añade insumos y registra salidas de inventario directamente desde aquí.',
    target: '[data-tour="quick-actions"]',
    placement: 'top',
    highlight: true
  },
  {
    id: 'inventory-link',
    title: 'Gestión de Inventario',
    description: 'Administra todos tus insumos y materiales. Registra compras, controla stock y visualiza el valor total.',
    target: '[href="/inventario"]',
    placement: 'bottom',
    highlight: true
  },
  {
    id: 'costing-link',
    title: 'Costeo de Productos',
    description: 'Calcula automáticamente el costo de producción de tus productos sumando todos los insumos necesarios.',
    target: '[href="/costeo"]',
    placement: 'bottom',
    highlight: true
  },
  {
    id: 'catalog-link',
    title: 'Catálogo de Productos',
    description: 'Visualiza todos tus productos terminados con sus costos, precios y márgenes de ganancia.',
    target: '[href="/catalogo"]',
    placement: 'bottom',
    highlight: true
  },
  {
    id: 'notifications',
    title: 'Alertas y Notificaciones',
    description: 'Recibe avisos cuando el stock esté bajo o necesites reponer inventario.',
    target: '[data-tour="notifications"]',
    placement: 'left',
    highlight: true
  },
  {
    id: 'profile',
    title: 'Tu Perfil',
    description: 'Gestiona tu cuenta, visualiza tu plan actual y cierra sesión desde aquí.',
    target: '[data-tour="profile"]',
    placement: 'left',
    highlight: true
  },
  {
    id: 'finish',
    title: '¡Listo para empezar! 🚀',
    description: 'Ya conoces las funciones principales. Si necesitas ayuda, recuerda que tenemos soporte disponible.',
    target: null,
    placement: 'center'
  }
];

export default function ProductTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetPosition, setTargetPosition] = useState(null);

  useEffect(() => {
    // Iniciar el tour automáticamente
    setIsActive(true);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    if (step.target && step.target !== null) {
      // Calcular posición del elemento target
      const calculatePosition = () => {
        const element = document.querySelector(step.target);
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetPosition({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          });
        }
      };

      calculatePosition();
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition);

      return () => {
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition);
      };
    } else {
      setTargetPosition(null);
    }
  }, [currentStep, isActive]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsActive(false);

    // Marcar el tour como completado en localStorage
    try {
      const user = auth.currentUser;
      if (user) {
        localStorage.setItem(`tour_completed_${user.uid}`, 'true');
        localStorage.setItem(`tour_completed_at_${user.uid}`, new Date().toISOString());
      }
    } catch (error) {
      console.error('Error marcando tour como completado:', error);
    }

    if (onComplete) {
      onComplete();
    }
  };

  const currentStepData = TOUR_STEPS[currentStep];
  const isCenter = currentStepData.placement === 'center';

  const getTooltipPosition = () => {
    if (!targetPosition || isCenter) return {};

    const placement = currentStepData.placement;
    const offset = 20;

    switch (placement) {
      case 'bottom':
        return {
          top: targetPosition.top + targetPosition.height + offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: 'translateX(-50%)'
        };
      case 'top':
        return {
          bottom: window.innerHeight - targetPosition.top + offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: targetPosition.top + targetPosition.height / 2,
          right: window.innerWidth - targetPosition.left + offset,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          top: targetPosition.top + targetPosition.height / 2,
          left: targetPosition.left + targetPosition.width + offset,
          transform: 'translateY(-50%)'
        };
      default:
        return {};
    }
  };

  if (!isActive) return null;

  return (
    <AnimatePresence>
      {/* Overlay oscuro */}
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 999999 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleSkip}
      />

      {/* Highlight del elemento target */}
      {currentStepData.highlight && targetPosition && (
        <motion.div
          className="fixed pointer-events-none"
          style={{
            zIndex: 1000000,
            top: targetPosition.top - 4,
            left: targetPosition.left - 4,
            width: targetPosition.width + 8,
            height: targetPosition.height + 8,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 rounded-xl border-4 border-orange-500 shadow-2xl shadow-orange-500/50" />
          <div className="absolute inset-0 rounded-xl bg-white/5" />

          {/* Pulse animation */}
          <motion.div
            className="absolute inset-0 rounded-xl border-4 border-orange-500"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>
      )}

      {/* Tooltip / Modal */}
      <motion.div
        className={`fixed ${isCenter ? 'inset-0 flex items-center justify-center p-4' : ''}`}
        style={{
          zIndex: 1000001,
          ...(!isCenter ? getTooltipPosition() : {})
        }}
        initial={{ opacity: 0, scale: 0.9, y: isCenter ? 0 : -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`bg-gradient-to-br from-slate-900 to-gray-900 rounded-2xl shadow-2xl border border-white/10 ${isCenter ? 'max-w-lg w-full' : 'max-w-sm'}`}>
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Sparkles className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {currentStepData.title}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {currentStepData.description}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {TOUR_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'w-8 bg-orange-500'
                      : index < currentStep
                      ? 'w-2 bg-green-500'
                      : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <motion.button
                  onClick={handlePrevious}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-medium flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Atrás
                </motion.button>
              )}

              <motion.button
                onClick={handleNext}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 transition-colors text-white font-semibold flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {currentStep === TOUR_STEPS.length - 1 ? '¡Empezar!' : 'Siguiente'}
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Progress text */}
          <div className="px-6 pb-4 text-center text-gray-500 text-xs">
            Paso {currentStep + 1} de {TOUR_STEPS.length}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
