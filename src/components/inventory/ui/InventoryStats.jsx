// src/components/inventory/ui/InventoryStats.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Warehouse,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

const InventoryStats = ({
  items = [],
  warehouses = [],
  className = ""
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);

  // Recalcular estadísticas cuando cambien los items
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [items.length]);

  if (!isVisible) {
    return (
      <motion.div
        className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Estadísticas de Inventario</h3>
          <motion.button
            onClick={() => setIsVisible(true)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Eye className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Calcular estadísticas
  const stats = {
    totalProducts: items.length,
    totalStock: items.reduce((sum, item) => sum + (item.stock || 0), 0),
    totalValue: items.reduce((sum, item) => {
      const stock = item.stock || 0;
      const ppp = item.ppp || 0;
      const itemValue = stock * ppp;
      return sum + itemValue;
    }, 0),
    outOfStock: items.filter(item => item.productType !== 'ELABORADO' && !(Array.isArray(item.receta) && item.receta.length > 0) && (item.stock || 0) === 0).length,
    lowStock: items.filter(item => item.productType !== 'ELABORADO' && !(Array.isArray(item.receta) && item.receta.length > 0) && (item.stock || 0) > 0 && (item.stock || 0) <= 5).length,
    averageValuePerUnit: 0, // Calcularemos después
    warehousesCount: warehouses.length
  };

  // Calcular valor promedio por unidad (solo si hay stock)
  stats.averageValuePerUnit = stats.totalStock > 0
    ? stats.totalValue / stats.totalStock
    : 0;

  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const StatCard = ({ icon: IconComponent, title, value, subtitle, color = 'blue', trend = null }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      red: 'bg-red-50 text-red-600',
      orange: 'bg-orange-50 text-orange-600',
      purple: 'bg-purple-50 text-purple-600',
      gray: 'bg-gray-50 text-gray-600'
    };

    return (
      <motion.div
        key={animationKey}
        className="bg-white p-4 rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300"
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", damping: 20 }}
        whileHover={{ scale: 1.02, y: -2 }}
        layout
      >
        <div className="flex items-center justify-between mb-3">
          <motion.div
            className={`p-2 rounded-lg ${colorClasses[color]}`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <IconComponent className="w-5 h-5" />
          </motion.div>
          {trend && (
            <motion.div
              className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
              {trend !== 0 && `${Math.abs(trend)}%`}
            </motion.div>
          )}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.p
            className="text-2xl font-bold text-gray-900 mb-1"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            {value}
          </motion.p>
          <p className="text-sm text-gray-600">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </motion.div>
      </motion.div>
    );
  };

  const healthScore = stats.totalProducts > 0 ? Math.round(
    ((stats.totalProducts - stats.outOfStock - stats.lowStock) / stats.totalProducts) * 100
  ) : 100;

  return (
    <motion.div
      className={`bg-gray-50 rounded-xl border border-gray-200 p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Estadísticas de Inventario</h3>
          <p className="text-sm text-gray-600">Resumen del estado actual</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Health Score */}
          <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
            <div className={`w-2 h-2 rounded-full ${
              healthScore >= 80 ? 'bg-green-500' :
              healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-sm font-medium text-gray-700">
              Salud: {healthScore}%
            </span>
          </div>
          <motion.button
            onClick={() => setIsVisible(false)}
            className="p-2 text-gray-500 hover:bg-white rounded-lg transition"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <EyeOff className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <StatCard
          icon={Package}
          title="Productos Totales"
          value={stats.totalProducts.toLocaleString()}
          subtitle={`En ${stats.warehousesCount} bodegas`}
          color="blue"
        />

        <StatCard
          icon={Warehouse}
          title="Stock Total"
          value={Math.round(stats.totalStock).toLocaleString()}
          subtitle="Unidades en inventario"
          color="green"
        />

        <StatCard
          icon={DollarSign}
          title="Inversión Total"
          value={formatCLP(stats.totalValue)}
          subtitle={`Valor total del inventario`}
          color="purple"
        />

        <StatCard
          icon={TrendingUp}
          title="Disponibilidad"
          value={`${100 - Math.round((stats.outOfStock / Math.max(stats.totalProducts, 1)) * 100)}%`}
          subtitle={`${stats.totalProducts - stats.outOfStock} productos disponibles`}
          color="green"
        />
      </motion.div>

      {/* Alerts Summary */}
      <AnimatePresence>
        {(stats.outOfStock > 0 || stats.lowStock > 0) && (
          <motion.div
            className="bg-white rounded-lg p-4 border border-orange-200"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h4 className="font-medium text-orange-900">Productos que Requieren Atención</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.outOfStock > 0 && (
                <motion.div
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div>
                    <p className="font-semibold text-red-900">Sin Stock</p>
                    <p className="text-sm text-red-700">{stats.outOfStock} productos</p>
                  </div>
                  <motion.div
                    className="text-2xl font-bold text-red-600"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                  >
                    {stats.outOfStock}
                  </motion.div>
                </motion.div>
              )}

              {stats.lowStock > 0 && (
                <motion.div
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div>
                    <p className="font-semibold text-yellow-900">Stock Bajo</p>
                    <p className="text-sm text-yellow-700">{stats.lowStock} productos</p>
                  </div>
                  <motion.div
                    className="text-2xl font-bold text-yellow-600"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    {stats.lowStock}
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {stats.outOfStock === 0 && stats.lowStock === 0 && stats.totalProducts > 0 && (
          <motion.div
            className="bg-green-50 border border-green-200 rounded-lg p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <CheckCircle className="w-5 h-5 text-green-600" />
              </motion.div>
              <div>
                <h4 className="font-medium text-green-900">¡Excelente gestión de inventario!</h4>
                <p className="text-sm text-green-700">
                  Todos los productos tienen stock adecuado
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      <AnimatePresence>
        {stats.totalProducts === 0 && (
          <motion.div
            className="text-center py-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            </motion.div>
            <h4 className="font-medium text-gray-900 mb-2">No hay productos en el inventario</h4>
            <p className="text-sm text-gray-600">Agrega productos para comenzar a ver estadísticas</p>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default InventoryStats;