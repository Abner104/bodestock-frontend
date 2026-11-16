// src/components/costing/CostingPreview.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Package, Wrench, Zap, Calculator } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const CostingPreview = ({
  costoInsumos = 0,
  costoExtras = 0,
  costoManoObra = 0,
  costosIndirectos = 0,
  costoTotal = 0,
  precioVenta = 0,
  utilidadPorcentaje = 0,
  numeroPorciones = 1,
  precioPorPorcion = 0,
  nombreProducto = '',
  formatPrice
}) => {
  const { isDark } = useTheme();

  const formatCurrency = formatPrice;

  const utilidadTotal = precioVenta - costoTotal;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`sticky top-4 rounded-2xl p-6 border-2 shadow-lg ${
        isDark
          ? 'bg-slate-800/80 border-indigo-500/30'
          : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Resumen en Vivo</h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Actualización automática</p>
        </div>
      </div>

      {/* Nombre del producto */}
      {nombreProducto && (
        <div className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-indigo-100'}`}>
          <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Producto:</p>
          <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{nombreProducto}</p>
        </div>
      )}

      {/* Desglose de costos */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>Insumos</span>
          </div>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(costoInsumos)}</span>
        </div>

        {costoExtras > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>Extras</span>
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(costoExtras)}</span>
          </div>
        )}

        {costoManoObra > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-500" />
              <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>Mano de obra</span>
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(costoManoObra)}</span>
          </div>
        )}

        {costosIndirectos > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>Costos fijos</span>
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(costosIndirectos)}</span>
          </div>
        )}
      </div>

      {/* Línea divisoria */}
      <div className={`border-t-2 my-4 ${isDark ? 'border-slate-600' : 'border-indigo-200'}`} />

      {/* Costo Total */}
      <div className="flex items-center justify-between mb-4">
        <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>COSTO TOTAL</span>
        <span className="font-bold text-xl text-indigo-500">{formatCurrency(costoTotal)}</span>
      </div>

      {/* Precio de Venta */}
      {precioVenta > 0 && (
        <>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">Precio de Venta</span>
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(precioVenta)}</p>
            {numeroPorciones > 1 && (
              <div className="mt-2 pt-2 border-t border-emerald-400">
                <p className="text-emerald-100 text-xs">
                  {numeroPorciones} porciones × {formatCurrency(precioPorPorcion)}
                </p>
              </div>
            )}
          </div>

          {/* Utilidad */}
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-emerald-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Utilidad</span>
              <div className="text-right">
                <p className="font-bold text-emerald-500">{formatCurrency(utilidadTotal)}</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {utilidadPorcentaje > 0 ? `+${utilidadPorcentaje.toFixed(0)}%` : ''}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Estado vacío */}
      {costoTotal === 0 && (
        <div className="text-center py-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-slate-700' : 'bg-indigo-100'}`}>
            <Calculator className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-400'}`} />
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Agrega insumos para ver el cálculo
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default CostingPreview;
