// src/components/PlanGate.jsx
// Bloquea acceso a features que no están incluidas en el plan del usuario
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { FEATURE_LABELS } from '../config/plan-features';
import { useTheme } from '../contexts/ThemeContext';

/**
 * PlanGate - Wrapper component that blocks content if the plan doesn't include the feature
 *
 * @param {string} feature - The feature ID to check (e.g., 'excel_export', 'ai_assistant')
 * @param {React.ReactNode} children - Content to show if feature is available
 * @param {React.ReactNode} [fallback] - Optional custom fallback component
 * @param {'block' | 'hide' | 'badge'} [mode='block'] - How to handle missing feature:
 *   - 'block': Show upgrade prompt (default for pages/sections)
 *   - 'hide': Render nothing (for buttons/small elements)
 *   - 'badge': Show the children but with an upgrade badge overlay
 */
export function PlanGate({ feature, children, fallback, mode = 'block' }) {
  const { hasFeature, loading, plan } = usePlanFeatures();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  if (loading) return null;

  if (hasFeature(feature)) {
    return children;
  }

  // Mode: hide - just don't render
  if (mode === 'hide') return null;

  // Mode: badge - render with overlay
  if (mode === 'badge') {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => navigate('/plans')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            <Lock className="w-3 h-3" />
            Upgrade
          </button>
        </div>
      </div>
    );
  }

  // Mode: block - show full upgrade prompt
  if (fallback) return fallback;

  const featureLabel = FEATURE_LABELS[feature] || feature;

  return (
    <div className={`flex items-center justify-center min-h-[60vh] p-4`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-md w-full text-center rounded-3xl p-8 border ${
          isDark
            ? 'bg-slate-800/80 border-slate-700 backdrop-blur-xl'
            : 'bg-white border-gray-200 shadow-xl'
        }`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/30"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Feature Premium
        </h2>
        <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <strong className={isDark ? 'text-blue-300' : 'text-blue-600'}>{featureLabel}</strong> no está disponible en tu plan
          {plan && <span className={`text-xs ml-1 px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{plan}</span>}
          . Actualiza tu plan para desbloquear esta funcionalidad.
        </p>

        <motion.button
          onClick={() => navigate('/plans')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Ver Planes
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </div>
  );
}

/**
 * Inline version for small elements (buttons, menu items)
 * Shows children normally if feature available, otherwise shows upgrade badge
 */
export function PlanBadge({ feature, children }) {
  return (
    <PlanGate feature={feature} mode="badge">
      {children}
    </PlanGate>
  );
}
