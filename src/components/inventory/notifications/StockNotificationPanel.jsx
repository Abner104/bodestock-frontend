// src/components/inventory/notifications/StockNotificationPanel.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  Settings,
  Mail,
  CheckCircle,
  Clock,
  Play,
  Square,
  TestTube,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  getNotificationSettings,
  updateNotificationSettings,
  checkAndSendLowStockNotifications,
  getLowStockProducts
} from '../../../services/notification-service';
import {
  initializeStockMonitoring,
  stopStockMonitoring,
  getMonitorStatus
} from '../../../services/stock-triggers';

const StockNotificationPanel = ({ items = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState({
    email: { enabled: false, address: '', threshold: 5 },
    general: { enabled: true, checkInterval: 24 }
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState({ isMonitoring: false });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadSettings();
    checkLowStock();
    updateMonitorStatus();
  }, [items]);

  const loadSettings = async () => {
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  const checkLowStock = async () => {
    try {
      const threshold = settings.email.threshold || 5;
      const products = await getLowStockProducts(threshold);
      setLowStockProducts(products);
    } catch (error) {
      console.error('Error verificando stock:', error);
    }
  };

  const updateMonitorStatus = () => {
    const status = getMonitorStatus();
    setMonitorStatus(status);
  };

  const handleToggleEmail = async (enabled) => {
    try {
      const newSettings = {
        ...settings,
        email: { ...settings.email, enabled }
      };
      await updateNotificationSettings(newSettings);
      setSettings(newSettings);
      setResult({
        success: true,
        message: enabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'
      });
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({ success: false, message: 'Error actualizando configuración' });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const handleTestNotifications = async () => {
    setLoading(true);
    try {
      const result = await checkAndSendLowStockNotifications();
      if (result.success) {
        setResult({
          success: true,
          message: result.products?.length > 0
            ? `Email preparado para ${result.products.length} productos`
            : 'No hay productos con stock bajo'
        });
      } else {
        setResult({ success: false, message: result.message });
      }
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  const handleToggleMonitor = async () => {
    setLoading(true);
    try {
      if (monitorStatus.isMonitoring) {
        stopStockMonitoring();
        setResult({ success: true, message: 'Monitor detenido' });
      } else {
        await initializeStockMonitoring();
        setResult({ success: true, message: 'Monitor iniciado' });
      }
      updateMonitorStatus();
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 3000);
    }
  };

  const criticalProducts = lowStockProducts.filter(p => p.stock <= 2);
  const warningProducts = lowStockProducts.filter(p => p.stock > 2 && p.stock <= 5);

  return (
    <motion.div
      className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header compacto */}
      <motion.div
        className={`p-4 cursor-pointer transition-colors ${
          lowStockProducts.length > 0
            ? 'bg-orange-50 border-b border-orange-200 hover:bg-orange-100'
            : 'bg-gray-50 border-b border-gray-200 hover:bg-gray-100'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className={`w-5 h-5 ${
                lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-500'
              }`} />
              {lowStockProducts.length > 0 && (
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Notificaciones de Stock
              </h3>
              <div className="flex items-center gap-4 text-sm">
                {lowStockProducts.length > 0 ? (
                  <span className="text-orange-600 font-medium">
                    {lowStockProducts.length} producto{lowStockProducts.length !== 1 ? 's' : ''} con stock bajo
                  </span>
                ) : (
                  <span className="text-green-600">Todo el stock está bien</span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  settings.email.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  Email {settings.email.enabled ? 'ON' : 'OFF'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  monitorStatus.isMonitoring
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  Monitor {monitorStatus.isMonitoring ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalProducts.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span className="text-xs font-medium text-red-700">
                  {criticalProducts.length} críticos
                </span>
              </div>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Panel expandido */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-4 space-y-4">
              {/* Productos con stock bajo */}
              {lowStockProducts.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Productos con Stock Bajo
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {lowStockProducts.map(product => (
                      <div
                        key={product.id}
                        className={`p-2 rounded-lg border text-sm ${
                          product.stock <= 2
                            ? 'bg-red-50 border-red-200'
                            : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-xs text-gray-600">
                          Stock: <span className={`font-bold ${
                            product.stock <= 2 ? 'text-red-600' : 'text-orange-600'
                          }`}>
                            {product.stock} {product.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Configuración rápida */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Configuración Rápida</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium">Notificaciones Email</span>
                    </div>
                    <button
                      onClick={() => handleToggleEmail(!settings.email.enabled)}
                      disabled={!settings.email.address}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        settings.email.enabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {settings.email.enabled ? 'Activado' : 'Desactivado'}
                    </button>
                  </div>

                  {/* Monitor */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium">Monitor Automático</span>
                    </div>
                    <button
                      onClick={handleToggleMonitor}
                      disabled={loading}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        monitorStatus.isMonitoring
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      } disabled:opacity-50`}
                    >
                      {loading ? 'Cargando...' : (monitorStatus.isMonitoring ? 'Activo' : 'Inactivo')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={handleTestNotifications}
                  disabled={loading || !settings.email.enabled}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  ) : (
                    <TestTube className="w-3 h-3" />
                  )}
                  Probar Email
                </button>

                <button
                  onClick={() => window.open('/notificaciones', '_blank')}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Configurar
                </button>
              </div>

              {/* Resultado */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-3 rounded-lg border text-sm ${
                      result.success
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {result.message}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StockNotificationPanel;