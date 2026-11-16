import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Package, AlertTriangle, Clock, ChevronRight } from 'lucide-react';

/**
 * Notification Bell - Muestra stock bajo + productos próximos a vencer
 * Mobile: bottom sheet centrado | Desktop: dropdown centrado
 */
export default function DynamicIslandNotification({
  lowStockItems = [],
  hasViewedNotifications,
  onMarkAsViewed,
  isMobile: isMobileProp = false,
  isDark = true
}) {
  const isMobile = isMobileProp || window.innerWidth < 900;
  const [isExpanded, setIsExpanded] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [previousCount, setPreviousCount] = useState(0);
  const [activeTab, setActiveTab] = useState('stock');
  const navigate = useNavigate();

  // Separar alertas por tipo
  const { stockAlerts, expiringAlerts } = useMemo(() => {
    const stock = lowStockItems.filter(i => i._alertType === 'lowStock' || !i._alertType);
    const expiring = lowStockItems.filter(i => i._alertType === 'expiring');
    const expiringIds = new Set(expiring.map(i => i.id));
    const stockOnly = stock.filter(i => !expiringIds.has(i.id) || i._alertType === 'lowStock');
    return { stockAlerts: stockOnly, expiringAlerts: expiring.sort((a, b) => (a._daysLeft || 999) - (b._daysLeft || 999)) };
  }, [lowStockItems]);

  // Detectar nueva notificación
  useEffect(() => {
    if (lowStockItems.length > previousCount && previousCount > 0) {
      setRinging(true);
      // Sonido generado con Web Audio API — sin dependencias externas
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* silencioso si el browser bloquea audio */ }
      setTimeout(() => setRinging(false), 800);
    }
    setPreviousCount(lowStockItems.length);
  }, [lowStockItems.length, previousCount]);

  const totalAlerts = stockAlerts.length + expiringAlerts.length;
  const hasUnread = totalAlerts > 0 && !hasViewedNotifications;

  const handleToggle = () => {
    if (totalAlerts > 0) {
      setIsExpanded(!isExpanded);
      if (!isExpanded && onMarkAsViewed) {
        onMarkAsViewed();
      }
    }
  };

  const handleNavigate = () => {
    setIsExpanded(false);
    navigate('/mis-inventarios');
  };

  // Contenido compartido del panel
  const PanelContent = () => (
    <>
      {/* Header */}
      <div className={`px-5 py-4 flex items-center justify-between border-b ${
        isDark ? 'border-slate-700/50' : 'border-gray-100'
      }`}>
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: -20, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
          >
            <Bell className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Notificaciones
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''} activa{totalAlerts !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsExpanded(false)}
          className={`p-2 rounded-xl transition-colors ${
            isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-400'
          }`}
        >
          <X className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Tabs */}
      <div className={`flex mx-4 mt-3 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'stock'
              ? isDark
                ? 'bg-slate-700 text-red-400 shadow-sm'
                : 'bg-white text-red-600 shadow-sm'
              : isDark
                ? 'text-slate-500'
                : 'text-gray-400'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Stock Bajo
          {stockAlerts.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'stock'
                ? 'bg-red-500 text-white'
                : isDark ? 'bg-slate-600 text-slate-400' : 'bg-gray-200 text-gray-500'
            }`}>
              {stockAlerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('expiring')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'expiring'
              ? isDark
                ? 'bg-slate-700 text-amber-400 shadow-sm'
                : 'bg-white text-amber-600 shadow-sm'
              : isDark
                ? 'text-slate-500'
                : 'text-gray-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Por Vencer
          {expiringAlerts.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'expiring'
                ? 'bg-amber-500 text-white'
                : isDark ? 'bg-slate-600 text-slate-400' : 'bg-gray-200 text-gray-500'
            }`}>
              {expiringAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[50vh] md:max-h-72 overflow-y-auto mt-2 px-2">
        <AnimatePresence mode="wait">
          {activeTab === 'stock' ? (
            <motion.div
              key="stock-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              {stockAlerts.length > 0 ? (
                <div className="space-y-1 p-1">
                  {stockAlerts.map((item, index) => {
                    const isCritical = (item.stock || 0) === 0;
                    return (
                      <motion.div
                        key={item.id + '-stock'}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        onClick={handleNavigate}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                          isDark ? 'hover:bg-slate-800/80' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isCritical
                            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/25'
                            : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25'
                        }`}>
                          {isCritical ? (
                            <AlertTriangle className="w-5 h-5 text-white" />
                          ) : (
                            <Package className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {item.name}
                          </p>
                          <p className={`text-xs font-bold ${isCritical ? 'text-red-400' : 'text-amber-500'}`}>
                            {isCritical ? 'SIN STOCK' : `Quedan ${item.stock} ${item.unit || 'und'}`}
                          </p>
                        </div>
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Package className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-gray-200'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    Todo el stock está bien
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="expiring-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {expiringAlerts.length > 0 ? (
                <div className="space-y-1 p-1">
                  {expiringAlerts.map((item, index) => {
                    const days = item._daysLeft || 0;
                    const isExpired = days < 0;
                    const isUrgent = days <= 7;
                    return (
                      <motion.div
                        key={item.id + '-expiry'}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        onClick={handleNavigate}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                          isDark ? 'hover:bg-slate-800/80' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isExpired
                            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/25'
                            : isUrgent
                              ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25'
                              : 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/25'
                        }`}>
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {item.name}
                          </p>
                          <p className={`text-xs font-bold ${
                            isExpired ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-amber-500'
                          }`}>
                            {isExpired
                              ? `VENCIDO hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`
                              : days === 0
                                ? 'Vence HOY'
                                : `Vence en ${days} día${days !== 1 ? 's' : ''}`
                            }
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 ${
                          isExpired
                            ? 'bg-red-500/15 text-red-400'
                            : isUrgent
                              ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-amber-500/15 text-amber-500'
                        }`}>
                          {item.stock} {item.unit || 'und'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Clock className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-gray-200'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    No hay productos por vencer
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className={`p-4 border-t ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNavigate}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/25"
        >
          Ver Mis Inventarios
        </motion.button>
      </div>
    </>
  );

  return (
    <div className="relative">
      {/* Bell Button */}
      <motion.button
        onClick={handleToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`relative p-2.5 rounded-xl transition-all ${
          isDark
            ? 'bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50'
            : 'bg-gray-100 hover:bg-gray-200 border border-gray-200'
        }`}
      >
        <motion.div
          animate={ringing
            ? { rotate: [0, -20, 20, -15, 15, -5, 5, 0] }
            : hasUnread
              ? { rotate: [0, -8, 8, -8, 0] }
              : {}
          }
          transition={ringing
            ? { duration: 0.7 }
            : { duration: 0.5, repeat: Infinity, repeatDelay: 4 }
          }
        >
          <Bell className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
        </motion.div>

        {/* Badge */}
        <AnimatePresence>
          {hasUnread && (
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40"
            >
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-white text-[10px] font-bold"
              >
                {totalAlerts > 99 ? '99+' : totalAlerts}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel - renderizado en portal para evitar problemas con stacking context del navbar */}
      {isExpanded && totalAlerts > 0 && createPortal(
        <AnimatePresence>
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`fixed inset-0 z-[98] ${
                isMobile ? 'bg-black/50 backdrop-blur-sm' : ''
              }`}
              onClick={() => setIsExpanded(false)}
            />

            {isMobile ? (
              /* MOBILE: Bottom sheet */
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`fixed bottom-0 left-0 right-0 z-[99] rounded-t-3xl overflow-hidden ${
                  isDark
                    ? 'bg-slate-900 border-t border-slate-700/50'
                    : 'bg-white border-t border-gray-200'
                }`}
                style={{ maxHeight: '85vh' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`} />
                </div>
                <PanelContent />
                <div className="pb-6" />
              </motion.div>
            ) : (
              /* DESKTOP: Dropdown centrado */
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className={`fixed top-20 left-1/2 -translate-x-1/2 w-[400px] rounded-2xl shadow-2xl border overflow-hidden z-[99] ${
                  isDark
                    ? 'bg-slate-900/95 backdrop-blur-xl border-slate-700/50 shadow-black/40'
                    : 'bg-white/95 backdrop-blur-xl border-gray-200 shadow-gray-300/50'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <PanelContent />
              </motion.div>
            )}
          </>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
