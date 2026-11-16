// src/components/inventory/filters/InventoryFilters.jsx
/**
 * Barra principal de filtros del inventario
 * Incluye: búsqueda, selector de bodega, ordenamiento y botón de filtros avanzados
 */

import React from 'react';
import { Search, Warehouse, ArrowUpDown, Filter, ChevronUp, ChevronDown, X as IconX, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import VoiceStockQuery from '../VoiceStockQuery';

/**
 * @param {Object} props
 * @param {string} props.searchQuery - Texto de búsqueda
 * @param {Function} props.onSearchChange - Callback cuando cambia el texto de búsqueda
 * @param {string} props.selectedWarehouse - ID de bodega seleccionada o 'all'
 * @param {Function} props.onWarehouseChange - Callback cuando cambia la bodega
 * @param {Array} props.warehouses - Array de bodegas disponibles
 * @param {string} props.sortBy - Campo de ordenamiento actual
 * @param {string} props.sortOrder - Orden: 'asc' o 'desc'
 * @param {Function} props.onSortChange - Callback cuando cambia el ordenamiento
 * @param {boolean} props.showAdvancedFilters - Si los filtros avanzados están visibles
 * @param {Function} props.onToggleAdvancedFilters - Callback para toggle de filtros avanzados
 * @param {number} props.activeFiltersCount - Cantidad de filtros activos
 * @param {Function} props.onClearFilters - Callback para limpiar todos los filtros
 */
export default function InventoryFilters({
  searchQuery = '',
  onSearchChange,
  selectedWarehouse = 'all',
  onWarehouseChange,
  warehouses = [],
  sortBy = 'name',
  sortOrder = 'asc',
  onSortChange,
  showAdvancedFilters = false,
  onToggleAdvancedFilters,
  activeFiltersCount = 0,
  onClearFilters,
  onScanClick,
  companyId,
  inventoryId,
  items = [], // productos ya cargados — fallback local de VoiceStockQuery si el backend no responde
  onVoiceMatch, // (nombreProducto) => void — para centrar el producto en el carrusel
}) {
  const sortValue = `${sortBy}-${sortOrder}`;

  const handleSortChange = (e) => {
    const [newSortBy, newSortOrder] = e.target.value.split('-');
    onSortChange(newSortBy, newSortOrder);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
      {/* Buscador */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, proveedor o categoría..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>
        {onScanClick && (
          <button
            onClick={onScanClick}
            className="flex items-center gap-2 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-sm hover:shadow"
            title="Escanear código de barras"
          >
            <Camera className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Escanear</span>
          </button>
        )}
        {companyId && (
          <VoiceStockQuery
            companyId={companyId}
            inventoryId={inventoryId}
            onSearch={(name) => { onSearchChange(name); onVoiceMatch?.(name); }}
            products={items}
          />
        )}
      </div>

      {/* Fila de controles: Bodega, Ordenar, Filtros Avanzados */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Selector de bodega */}
        <div className="flex items-center gap-2 flex-1">
          <Warehouse className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <select
            value={selectedWarehouse}
            onChange={(e) => onWarehouseChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="all">Todas las bodegas</option>
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de ordenamiento */}
        <div className="flex items-center gap-2 flex-1">
          <ArrowUpDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <select
            value={sortValue}
            onChange={handleSortChange}
            className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="name-asc">Nombre (A-Z)</option>
            <option value="name-desc">Nombre (Z-A)</option>
            <option value="stock-asc">Stock (Menor a Mayor)</option>
            <option value="stock-desc">Stock (Mayor a Menor)</option>
            <option value="ppp-asc">Precio (Más Barato)</option>
            <option value="ppp-desc">Precio (Más Caro)</option>
            <option value="totalValue-desc">Valor Total (Mayor)</option>
            <option value="totalValue-asc">Valor Total (Menor)</option>
            <option value="createdAt-desc">Más Recientes</option>
            <option value="createdAt-asc">Más Antiguos</option>
          </select>
        </div>

        {/* Botón de filtros avanzados */}
        <button
          onClick={onToggleAdvancedFilters}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
            showAdvancedFilters
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300'
              : activeFiltersCount > 0
              ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600 text-orange-800 dark:text-orange-200'
              : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-600 text-white text-xs font-bold rounded-full">
              {activeFiltersCount}
            </span>
          )}
          {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Botón limpiar filtros */}
        {activeFiltersCount > 0 && (
          <motion.button
            onClick={onClearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 transition-all text-sm font-medium"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <IconX className="w-4 h-4" />
            <span className="hidden sm:inline">Limpiar</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
