// src/components/inventory/grid/ElaboradosGrid.jsx
/**
 * Tabla de productos elaborados para el Mostrador
 * Vista completamente separada de la tabla de insumos
 */

import React from 'react';
import { Edit3, Trash2, ChefHat, Package } from 'lucide-react';

export default function ElaboradosGrid({
  items = [],
  loading = false,
  onEdit,
  onDelete,
  CLP
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <div className="text-center text-slate-500 dark:text-slate-400">Cargando productos...</div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-indigo-50 dark:bg-indigo-900/20">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Foto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Producto</th>
              <th className="px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Categoría</th>
              <th className="px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Receta</th>
              <th className="px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Costo Producción</th>
              <th className="px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Precio Venta</th>
              <th className="px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const costo = item.costoProduccion || item.ppp || 0;
              const precioVenta = item.precioVenta || item.salePrice || 0;
              const margen = precioVenta > 0 ? ((precioVenta - costo) / precioVenta * 100) : null;
              const receta = item.receta || [];

              return (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors"
                >
                  {/* Foto */}
                  <td className="px-4 py-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-indigo-50 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      {item.photoURL ? (
                        <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ChefHat className="w-5 h-5 text-indigo-400 dark:text-indigo-500" />
                      )}
                    </div>
                  </td>

                  {/* Nombre */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.unit}</p>
                    </div>
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-3 text-center">
                    {item.category ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.category}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Receta */}
                  <td className="px-4 py-3 text-center">
                    {receta.length > 0 ? (
                      <div className="group relative inline-block">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 cursor-pointer">
                          <ChefHat className="w-3 h-3" />
                          {receta.length} ingrediente{receta.length !== 1 ? 's' : ''}
                        </span>
                        {/* Tooltip con ingredientes */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10 min-w-max">
                          <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs">
                            <p className="font-semibold mb-1 text-indigo-300">Ingredientes:</p>
                            {receta.map((r, i) => (
                              <p key={i} className="text-slate-200">
                                • {r.cantidad} {r.unidad} {r.insumoNombre}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">Sin receta</span>
                    )}
                  </td>

                  {/* Costo Producción */}
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                      {CLP(costo)}
                    </span>
                  </td>

                  {/* Precio Venta */}
                  <td className="px-4 py-3 text-center">
                    {precioVenta > 0 ? (
                      <div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {CLP(precioVenta)}
                        </span>
                        {margen !== null && (
                          <p className={`text-xs mt-0.5 ${margen >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {margen >= 0 ? '+' : ''}{margen.toFixed(0)}% margen
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin precio</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(item)}
                        className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                        title="Editar receta"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item)}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                        title="Eliminar producto"
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
