// src/components/notifications/NotificationSettings.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Settings,
  Save,
  AlertTriangle,
  CheckCircle,
  Package
} from 'lucide-react';
import {
  getNotificationSettings,
  updateNotificationSettings,
  getAllLowStockProducts,
  getAllExpiringProducts
} from '../../services/notification-service';

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    thresholds: {
      critical: 0,      // Stock crítico (≤0)
      low: 5,           // Stock bajo (≤5)
      warning: 10       // Stock advertencia (≤10)
    },
    general: {
      enabled: true
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockByInventory, setLowStockByInventory] = useState(null);
  const [expiringByInventory, setExpiringByInventory] = useState(null);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadSettings();
    checkLowStock();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getNotificationSettings();

      // Asegurar que la estructura tenga thresholds
      const normalizedData = {
        thresholds: {
          critical: data?.thresholds?.critical ?? data?.email?.threshold ?? 0,
          low: data?.thresholds?.low ?? data?.email?.threshold ?? 5,
          warning: data?.thresholds?.warning ?? 10
        },
        general: {
          enabled: data?.general?.enabled ?? true
        }
      };

      setSettings(normalizedData);
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkLowStock = async () => {
    try {
      // Obtener productos con stock bajo de todos los inventarios
      const allLowStock = await getAllLowStockProducts(settings.thresholds.low);
      setLowStockByInventory(allLowStock);

      // Calcular total de productos con stock bajo
      const total = allLowStock.legacy.length +
        Object.values(allLowStock.inventories).reduce((sum, inv) => sum + inv.products.length, 0);
      setLowStockCount(total);

      // Obtener productos próximos a vencer (7 días)
      const allExpiring = await getAllExpiringProducts(7);
      setExpiringByInventory(allExpiring);
    } catch (error) {
      console.error('Error verificando stock bajo:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(settings);
      setTestResult({
        success: true,
        message: 'Configuración guardada correctamente'
      });

      // Verificar stock después de guardar
      await checkLowStock();

      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Error guardando configuración: ' + error.message
      });
      setTimeout(() => setTestResult(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = (key, value) => {
    setSettings(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: Math.max(0, parseInt(value) || 0)
      }
    }));
  };

  const updateGeneralSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      general: {
        ...prev.general,
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-4xl mx-auto p-6 space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center"
            whileHover={{ rotate: 12, scale: 1.1 }}
          >
            <Bell className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configuración de Notificaciones</h2>
            <p className="text-gray-600 text-sm">Configura alertas automáticas para stock bajo</p>
          </div>
        </div>

        {/* Estado actual del stock */}
        {lowStockCount > 0 && (
          <motion.div
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-blue-800 font-medium">
                Atención: {lowStockCount} {lowStockCount === 1 ? 'producto tiene' : 'productos tienen'} stock bajo
              </p>
              <p className="text-blue-600 text-sm">
                Considera activar las notificaciones automáticas
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Configuración de Umbrales de Stock */}
      <motion.div
        className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Umbrales de Stock</h3>
        </div>

        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Define los niveles de stock que determinarán cuándo se envían alertas automáticas por email a los administradores.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stock Crítico */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔴 Stock Crítico (≤)
              </label>
              <input
                type="number"
                min="0"
                value={settings.thresholds.critical}
                onChange={(e) => updateThreshold('critical', e.target.value)}
                className="w-full px-3 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50"
              />
              <p className="text-xs text-gray-500 mt-1">Alerta máxima prioridad</p>
            </div>

            {/* Stock Bajo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🟡 Stock Bajo (≤)
              </label>
              <input
                type="number"
                min="0"
                value={settings.thresholds.low}
                onChange={(e) => updateThreshold('low', e.target.value)}
                className="w-full px-3 py-2 border border-yellow-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-yellow-50"
              />
              <p className="text-xs text-gray-500 mt-1">Requiere reabastecimiento</p>
            </div>

            {/* Stock Advertencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🟠 Stock Advertencia (≤)
              </label>
              <input
                type="number"
                min="0"
                value={settings.thresholds.warning}
                onChange={(e) => updateThreshold('warning', e.target.value)}
                className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50"
              />
              <p className="text-xs text-gray-500 mt-1">Planificar próxima compra</p>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">📧 Notificaciones Automáticas</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Los emails se envían cada 6 horas a todos los ADMIN</li>
                  <li>• Solo se envían si hay productos que cumplan los umbrales</li>
                  <li>• No necesitas configurar direcciones de email</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Botones de acción */}
      <motion.div
        className="flex justify-start"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <motion.button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </motion.button>
      </motion.div>

      {/* Resultado de la prueba */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            className={`rounded-lg p-4 border ${
              testResult.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{testResult.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Productos con stock bajo por inventario */}
      {lowStockByInventory && lowStockCount > 0 && (
        <motion.div
          className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Productos con Stock Bajo ({lowStockCount})
            </h3>
          </div>

          <div className="space-y-6">
            {/* Inventario Legacy */}
            {lowStockByInventory.legacy.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Inventario Principal ({lowStockByInventory.legacy.length})
                </h4>
                <div className="space-y-2">
                  {lowStockByInventory.legacy.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.category || 'Sin categoría'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">{product.stock} {product.unit}</p>
                        <p className="text-xs text-gray-500">Stock bajo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventarios Dinámicos */}
            {Object.entries(lowStockByInventory.inventories).map(([inventoryId, inventory]) => (
              <div key={inventoryId}>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {inventory.name} ({inventory.products.length})
                </h4>
                <div className="space-y-2">
                  {inventory.products.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.category || 'Sin categoría'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">{product.stock} {product.unit}</p>
                        <p className="text-xs text-gray-500">Stock bajo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Productos próximos a vencer por inventario */}
      {expiringByInventory && (expiringByInventory.legacy.length > 0 || Object.keys(expiringByInventory.inventories).length > 0) && (
        <motion.div
          className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Productos Próximos a Vencer (7 días)
            </h3>
          </div>

          <div className="space-y-6">
            {/* Inventario Legacy */}
            {expiringByInventory.legacy.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Inventario Principal ({expiringByInventory.legacy.length})
                </h4>
                <div className="space-y-2">
                  {expiringByInventory.legacy.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.category || 'Sin categoría'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{product.daysUntilExpiry} días</p>
                        <p className="text-xs text-gray-500">hasta vencer</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventarios Dinámicos */}
            {Object.entries(expiringByInventory.inventories).map(([inventoryId, inventory]) => (
              <div key={inventoryId}>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {inventory.name} ({inventory.products.length})
                </h4>
                <div className="space-y-2">
                  {inventory.products.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.category || 'Sin categoría'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{product.daysUntilExpiry} días</p>
                        <p className="text-xs text-gray-500">hasta vencer</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default NotificationSettings;