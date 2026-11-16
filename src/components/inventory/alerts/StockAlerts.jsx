// src/components/inventory/alerts/StockAlerts.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Package,
  TrendingDown,
  Warehouse,
  Eye,
  EyeOff,
  X,
  Calendar,
  BarChart3
} from 'lucide-react';

const StockAlerts = ({
  items = [],
  warehouses = [],
  onUpdateThreshold,
  className = ""
}) => {
  const [showAlerts, setShowAlerts] = useState(true);

  // Usar useMemo para evitar recrear el objeto en cada render
  const thresholds = useMemo(() => ({
    critical: 0,      // Stock crítico (rojo)
    low: 5,           // Stock bajo (amarillo)
    warning: 10       // Stock en advertencia (naranja)
  }), []);

  const [alertFilters, setAlertFilters] = useState({
    critical: true,
    low: true,
    warning: true,
    outOfStock: true
  });

  // Calcular alertas usando useMemo en lugar de useEffect para evitar loops
  const alerts = useMemo(() => {
    const newAlerts = [];

    items.forEach(item => {
      const stock = item.stock || 0;
      const warehouse = warehouses.find(w => w.id === item.warehouseId);

      let alertLevel = null;
      let alertMessage = '';
      let priority = 0;

      if (stock === 0) {
        alertLevel = 'outOfStock';
        alertMessage = 'Sin stock disponible';
        priority = 4;
      } else if (stock <= thresholds.critical) {
        alertLevel = 'critical';
        alertMessage = `Stock crítico: ${stock} ${item.unit}`;
        priority = 3;
      } else if (stock <= thresholds.low) {
        alertLevel = 'low';
        alertMessage = `Stock bajo: ${stock} ${item.unit}`;
        priority = 2;
      } else if (stock <= thresholds.warning) {
        alertLevel = 'warning';
        alertMessage = `Stock en advertencia: ${stock} ${item.unit}`;
        priority = 1;
      }

      if (alertLevel && alertFilters[alertLevel]) {
        newAlerts.push({
          id: item.id,
          itemName: item.name,
          sku: item.sku,
          stock,
          unit: item.unit,
          warehouseName: warehouse?.name || 'Sin bodega',
          warehouseId: item.warehouseId,
          alertLevel,
          alertMessage,
          priority,
          category: item.category,
          ppp: item.ppp,
          lastUpdated: new Date().toISOString()
        });
      }
    });

    // Ordenar por prioridad (mayor prioridad primero)
    return newAlerts.sort((a, b) => b.priority - a.priority);
  }, [items, warehouses, thresholds, alertFilters]);

  const getAlertColor = (level) => {
    const colors = {
      outOfStock: 'bg-black text-white border-black',
      critical: 'bg-red-100 text-red-800 border-red-200',
      low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      warning: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[level] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getAlertIcon = (level) => {
    switch (level) {
      case 'outOfStock':
        return <X className="w-4 h-4" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'low':
        return <TrendingDown className="w-4 h-4" />;
      case 'warning':
        return <Package className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const toggleAlertFilter = (filter) => {
    setAlertFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  const alertsByLevel = useMemo(() => ({
    outOfStock: alerts.filter(a => a.alertLevel === 'outOfStock').length,
    critical: alerts.filter(a => a.alertLevel === 'critical').length,
    low: alerts.filter(a => a.alertLevel === 'low').length,
    warning: alerts.filter(a => a.alertLevel === 'warning').length
  }), [alerts]);

  if (alerts.length === 0) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-full">
            <Package className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-green-900">✅ Stock Saludable</h3>
            <p className="text-sm text-green-700">Todos los productos tienen stock suficiente</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Alertas de Stock</h3>
              <p className="text-sm text-gray-600">{alerts.length} productos requieren atención</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              title={showAlerts ? 'Ocultar alertas' : 'Mostrar alertas'}
            >
              {showAlerts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="text-center p-2 bg-black/5 rounded-lg">
            <div className="text-lg font-bold text-black">{alertsByLevel.outOfStock}</div>
            <div className="text-xs text-gray-600">Sin Stock</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">{alertsByLevel.critical}</div>
            <div className="text-xs text-red-600">Crítico</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded-lg">
            <div className="text-lg font-bold text-yellow-600">{alertsByLevel.low}</div>
            <div className="text-xs text-yellow-600">Bajo</div>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <div className="text-lg font-bold text-orange-600">{alertsByLevel.warning}</div>
            <div className="text-xs text-orange-600">Advertencia</div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {showAlerts && (
        <div className="p-4">
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay alertas con los filtros actuales</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 border rounded-lg transition-all hover:shadow-sm ${getAlertColor(alert.alertLevel)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-1.5 bg-white/50 rounded-md flex-shrink-0">
                        {getAlertIcon(alert.alertLevel)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{alert.itemName}</h4>
                        {alert.sku && (
                          <p className="text-xs opacity-75 font-mono">{alert.sku}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Warehouse className="w-3 h-3 opacity-60" />
                            <span className="text-xs opacity-75">{alert.warehouseName}</span>
                          </div>
                          <span className="text-xs opacity-50">•</span>
                          <span className="text-xs opacity-75">{alert.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold">
                        {alert.stock} {alert.unit}
                      </div>
                      {alert.ppp > 0 && (
                        <div className="text-xs opacity-75">
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            minimumFractionDigits: 0
                          }).format(alert.ppp)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockAlerts;