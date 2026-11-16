// src/components/DashboardLiveFeed.jsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

function timeAgo(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'Ahora mismo';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

export default function DashboardLiveFeed({ movements = [], isDark, onNavigate }) {
  const navigate = useNavigate();
  const [newIds, setNewIds] = useState(new Set());
  const prevIdsRef = useRef(new Set());
  const [tick, setTick] = useState(0);

  // Actualizar tiempo relativo cada 30 segundos
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Detectar ventas nuevas para animarlas
  useEffect(() => {
    const currentIds = new Set(movements.map(m => m.id));
    const incoming = [...currentIds].filter(id => !prevIdsRef.current.has(id));
    if (incoming.length > 0 && prevIdsRef.current.size > 0) {
      setNewIds(new Set(incoming));
      setTimeout(() => setNewIds(new Set()), 3000);
    }
    prevIdsRef.current = currentIds;
  }, [movements]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className={`rounded-2xl p-4 sm:p-5 border ${
        isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-gray-100 shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
            <ShoppingCart className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          </div>
          <div className="flex items-center gap-2">
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Ventas en vivo
            </h2>
            {/* Badge pulsante */}
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 rounded-full">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold text-emerald-500">EN VIVO</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate('/historial')}
          className={`text-xs font-semibold flex items-center gap-0.5 transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Ver todo
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Feed */}
      {movements.length === 0 ? (
        <div className="text-center py-10">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
            <ShoppingCart className={`w-7 h-7 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
          </div>
          <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Sin ventas aún</h3>
          <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Las ventas aparecerán aquí en tiempo real</p>
          <button
            onClick={() => navigate('/salida-inventario')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-600/25 transition-colors inline-flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Registrar Venta
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {movements.map((movement, index) => {
              const isNew = newIds.has(movement.id);
              // Resumir productos: "3× Pepsi, 2× Empanada..."
              const productSummary = movement.products
                ?.slice(0, 3)
                .map(p => `${Number(p.quantity).toFixed(0)}× ${p.productName || p.name}`)
                .join(', ') + (movement.products?.length > 3 ? ` +${movement.products.length - 3} más` : '');

              return (
                <motion.div
                  key={movement.id}
                  layout
                  initial={{ opacity: 0, y: -12, scale: 0.97 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    backgroundColor: isNew
                      ? isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)'
                      : 'transparent'
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: index === 0 ? 0 : index * 0.04 }}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors relative overflow-hidden ${
                    isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                  } ${isNew ? (isDark ? 'border border-emerald-500/20' : 'border border-emerald-200') : 'border border-transparent'}`}
                >
                  {/* Borde izquierdo animado para ventas nuevas */}
                  {isNew && (
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 rounded-full"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}

                  {/* Avatar trabajador */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(movement.workerName || 'V').charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {movement.workerName || 'Venta'}
                      </span>
                      {isNew && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0"
                        >
                          NUEVA
                        </motion.span>
                      )}
                    </div>
                    {/* Productos resumidos */}
                    {productSummary && (
                      <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {productSummary}
                      </p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {movement.warehouseName} · {timeAgo(movement.createdAt)}
                    </p>
                  </div>

                  {/* Monto */}
                  <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-black block ${
                      isNew ? 'text-emerald-500' : isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      {CLP(movement.totalValue)}
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>
                      {movement.products?.length || 0} prod.
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
