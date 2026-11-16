// src/components/inventory/filters/AdvancedFilters.jsx
/**
 * Panel de filtros avanzados (colapsable)
 * Incluye: filtros por stock, precio, categorías y proveedores
 */

import React from 'react';
import { Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el panel está abierto
 * @param {Object} props.advancedFilters - Estado de filtros avanzados
 * @param {Function} props.onFiltersChange - Callback cuando cambian los filtros
 * @param {Object} props.stockThresholds - Umbrales de stock {critical, low, warning}
 * @param {Array} props.uniqueCategories - Categorías únicas disponibles
 * @param {Array} props.uniqueProviders - Proveedores únicos disponibles
 */
export default function AdvancedFilters({
  isOpen = false,
  advancedFilters = {},
  onFiltersChange,
  stockThresholds = { critical: 0, low: 5, warning: 10 },
  uniqueCategories = [],
  uniqueProviders = []
}) {
  const updateFilter = (key, value) => {
    onFiltersChange({ ...advancedFilters, [key]: value });
  };

  const toggleCategory = (category) => {
    const categories = advancedFilters.categories || [];
    if (categories.includes(category)) {
      updateFilter('categories', categories.filter(c => c !== category));
    } else {
      updateFilter('categories', [...categories, category]);
    }
  };

  const toggleProvider = (provider) => {
    const providers = advancedFilters.providers || [];
    if (providers.includes(provider)) {
      updateFilter('providers', providers.filter(p => p !== provider));
    } else {
      updateFilter('providers', [...providers, provider]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-4">
            {/* Título */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Filtros Avanzados</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtro por rango de stock */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Rango de Stock
                </label>
                <select
                  value={advancedFilters.stockRange || 'all'}
                  onChange={(e) => updateFilter('stockRange', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="all">Todos los rangos</option>
                  <option value="critical">🔴 Crítico (≤{stockThresholds.critical})</option>
                  <option value="low">🟡 Bajo ({stockThresholds.critical + 1}-{stockThresholds.low})</option>
                  <option value="normal">🟢 Normal (&gt;{stockThresholds.low})</option>
                  <option value="custom">Personalizado</option>
                </select>

                {advancedFilters.stockRange === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Mínimo"
                      value={advancedFilters.stockMin || ''}
                      onChange={(e) => updateFilter('stockMin', e.target.value)}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Máximo"
                      value={advancedFilters.stockMax || ''}
                      onChange={(e) => updateFilter('stockMax', e.target.value)}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Filtro por rango de precio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Rango de Precio (PPP)
                </label>
                <select
                  value={advancedFilters.priceRange || 'all'}
                  onChange={(e) => updateFilter('priceRange', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="all">Todos los precios</option>
                  <option value="custom">Personalizado</option>
                </select>

                {advancedFilters.priceRange === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Precio mínimo"
                      value={advancedFilters.priceMin || ''}
                      onChange={(e) => updateFilter('priceMin', e.target.value)}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Precio máximo"
                      value={advancedFilters.priceMax || ''}
                      onChange={(e) => updateFilter('priceMax', e.target.value)}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Filtro por categorías */}
              {uniqueCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Categorías
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700">
                    {uniqueCategories.map(category => (
                      <label
                        key={category}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={(advancedFilters.categories || []).includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtro por proveedores */}
              {uniqueProviders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Proveedores
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700">
                    {uniqueProviders.map(provider => (
                      <label
                        key={provider}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={(advancedFilters.providers || []).includes(provider)}
                          onChange={() => toggleProvider(provider)}
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{provider}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
