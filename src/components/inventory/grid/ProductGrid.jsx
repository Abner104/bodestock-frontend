// src/components/inventory/grid/ProductGrid.jsx
/**
 * Tabla de productos para desktop
 */

import React from 'react';
import { Edit3, Trash2, ShoppingCart, History, ArrowRightLeft, AlertTriangle, Warehouse, Package, Printer } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

export default function ProductGrid({
  items = [],
  loading = false,
  onEdit,
  onDelete,
  onPurchase,
  onHistory,
  onTransfer,
  onShrinkage,
  onPrintLabel,
  getWarehouseName,
  getExpiryStatus,
  CLP
}) {
  const { isDark } = useTheme();

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <div className="text-center text-slate-500 dark:text-slate-400">Cargando inventario...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return null; // EmptyState se muestra en el componente padre
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Foto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Producto</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">SKU</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Bodega</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Categoría</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Stock</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Valor Total</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Ganancia</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isElaborado = item.productType === 'ELABORADO' || (Array.isArray(item.receta) && item.receta.length > 0);
              const isOutOfStock = !isElaborado && (item.stock || 0) === 0;
              const expiryStatus = getExpiryStatus(item.expiryDate);
              const totalValue = (item.stock || 0) * (item.ppp || 0);

              return (
                <tr
                  key={item.id}
                  style={isOutOfStock ? { backgroundColor: isDark ? '#4c0519' : '#fef2f2' } : {}}
                  className={`border-t transition-colors ${
                    isOutOfStock
                      ? 'border-red-300 dark:border-red-900'
                      : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {/* Foto */}
                  <td className="px-4 py-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      {item.photoURL ? (
                        <img
                          src={item.photoURL}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                      )}
                      <Package className="w-6 h-6 text-slate-400 dark:text-slate-500" style={{ display: 'none' }} />
                    </div>
                  </td>

                  {/* Producto */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>

                    {/* Alerta de vencimiento */}
                    {expiryStatus && expiryStatus.status !== 'ok' && (
                      <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        expiryStatus.status === 'expired' ? 'bg-red-100 border-red-300 text-red-800' :
                        expiryStatus.status === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                        'bg-yellow-50 border-yellow-200 text-yellow-700'
                      }`}>
                        <span className="mr-1">{expiryStatus.icon}</span>
                        {expiryStatus.status === 'expired'
                          ? `Vencido hace ${expiryStatus.days} días`
                          : `Vence en ${expiryStatus.days} días`
                        }
                      </div>
                    )}

                    {/* Campos personalizados */}
                    {item.customFields && Object.keys(item.customFields).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.customFields).slice(0, 2).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                            title={`${key}: ${value}`}
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    <div className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                      {item.sku || "Sin SKU"}
                    </div>
                  </td>

                  {/* Bodega */}
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-slate-400" />
                      {getWarehouseName(item.warehouseId)}
                    </div>
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.category}</td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    {isElaborado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                        🍳 Bajo pedido
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${isOutOfStock ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                          {(item.stock ?? 0).toLocaleString('es-CL')} {item.unit}
                        </span>
                        {item.presentations && item.presentations.length > 0 && (() => {
                          const presentation = item.presentations[0];
                          const stockInPresentation = (item.stock ?? 0) / presentation.factor;
                          return (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              ≈ {stockInPresentation.toFixed(1)} {presentation.name}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </td>

                  {/* Valor Total */}
                  <td className="px-4 py-3">
                    {isElaborado ? (
                      <div>
                        <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          {CLP(item.costoProduccion || item.ppp || 0)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">costo producción</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          {CLP(totalValue)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {CLP(item.ppp || 0)}/{item.unit}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Ganancia — solo si tiene precio de venta cargado */}
                  <td className="px-4 py-3">
                    {!isElaborado && item.salePrice > 0 && item.ppp > 0 ? (() => {
                      const gananciaUnit = item.salePrice - item.ppp;
                      // Margen sobre precio de venta, no markup sobre costo
                      // -- mismo fix que VitrinaCard.jsx (ver su comentario).
                      const margen = item.salePrice > 0 ? (gananciaUnit / item.salePrice) * 100 : 0;
                      const gananciaTotal = gananciaUnit * (item.stock || 0);
                      return (
                        <div>
                          <div className={`text-sm font-semibold ${gananciaUnit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {CLP(gananciaTotal)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {margen.toFixed(0)}% · {CLP(gananciaUnit)}/{item.unit}
                          </div>
                        </div>
                      );
                    })() : (
                      <span className="text-xs text-slate-400 dark:text-slate-600">Sin precio venta</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(item)}
                        className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onPurchase(item)}
                        className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                        title="Comprar"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onHistory(item)}
                        className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition"
                        title="Historial"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTransfer(item)}
                        className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition"
                        title="Transferir"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onShrinkage(item)}
                        className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
                        title="Merma"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                      {item.sku && onPrintLabel && (
                        <button
                          onClick={() => onPrintLabel(item)}
                          className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition"
                          title="Imprimir etiqueta"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(item)}
                        className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
