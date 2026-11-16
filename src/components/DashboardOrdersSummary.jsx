// src/components/DashboardOrdersSummary.jsx
// Resumen de pedidos de la tienda pública en el Dashboard -- antes había
// que entrar a "Pedidos" para enterarse de si hay algo pendiente. Para un
// negocio tipo RESTAURANT/cocina con delivery, esto es lo más urgente del
// panel, así que se muestra apenas se entra, antes de las métricas de venta.
import { motion } from 'framer-motion';
import { ShoppingBag, Clock, Bike, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrdersSummary } from '../hooks/useOrdersSummary';

export default function DashboardOrdersSummary({ isDark }) {
  const navigate = useNavigate();
  const { hasActiveStore, loading, pending, delivering, approvedToday } = useOrdersSummary();

  if (loading || !hasActiveStore) return null;

  const hasUrgent = pending > 0 || delivering > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/pedidos')}
      className={`rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6 cursor-pointer transition-shadow hover:shadow-lg ${
        hasUrgent
          ? (isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200')
          : (isDark ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-white border border-gray-100 shadow-sm')
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasUrgent ? (isDark ? 'bg-amber-500/20' : 'bg-amber-100') : (isDark ? 'bg-blue-500/15' : 'bg-blue-50')
          }`}>
            <ShoppingBag className={`w-4.5 h-4.5 ${hasUrgent ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Pedidos de la tienda</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {hasUrgent ? 'Hay pedidos que necesitan atención' : 'Todo al día'}
            </p>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
      </div>

      <div className="flex items-center gap-4 sm:gap-6 mt-4 pt-3 border-t border-dashed border-current/10">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${pending > 0 ? 'text-amber-500' : (isDark ? 'text-slate-600' : 'text-gray-300')}`} />
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{pending}</span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>pendiente{pending !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <Bike className={`w-4 h-4 ${delivering > 0 ? 'text-indigo-500' : (isDark ? 'text-slate-600' : 'text-gray-300')}`} />
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{delivering}</span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>en camino</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`} />
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{approvedToday}</span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>aprobados hoy</span>
        </div>
      </div>
    </motion.div>
  );
}
