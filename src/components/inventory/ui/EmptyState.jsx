// src/components/inventory/ui/EmptyState.jsx
/**
 * Componente para mostrar estado vacío
 * Se muestra cuando no hay productos o cuando los filtros no retornan resultados
 */

import React from 'react';
import { Package, Search, Filter } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string} props.type - Tipo de empty state: 'no-products' | 'no-results' | 'no-warehouse'
 * @param {Function} props.onAddProduct - Callback para abrir modal de crear producto (opcional)
 * @param {Function} props.onClearFilters - Callback para limpiar filtros (opcional)
 */
export default function EmptyState({
  type = 'no-products',
  onAddProduct,
  onClearFilters
}) {
  // Estados diferentes según el tipo
  const states = {
    'no-products': {
      icon: Package,
      iconColor: 'text-slate-400 dark:text-slate-500',
      title: 'No hay productos en el inventario',
      description: 'Comienza agregando tu primer producto al inventario',
      actionLabel: 'Agregar Producto',
      onAction: onAddProduct
    },
    'no-results': {
      icon: Search,
      iconColor: 'text-slate-400 dark:text-slate-500',
      title: 'No se encontraron productos',
      description: 'Intenta ajustar los filtros de búsqueda',
      actionLabel: 'Limpiar Filtros',
      onAction: onClearFilters
    },
    'no-warehouse': {
      icon: Filter,
      iconColor: 'text-slate-400 dark:text-slate-500',
      title: 'No hay productos en esta bodega',
      description: 'Esta bodega aún no tiene productos asignados',
      actionLabel: 'Ver Todos',
      onAction: onClearFilters
    }
  };

  const state = states[type] || states['no-products'];
  const Icon = state.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icono */}
      <div className="mb-6">
        <Icon className={`w-20 h-20 sm:w-24 sm:h-24 ${state.iconColor}`} />
      </div>

      {/* Texto */}
      <h3 className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-300 mb-2 text-center">
        {state.title}
      </h3>
      <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 text-center mb-6 max-w-md">
        {state.description}
      </p>

      {/* Botón de acción */}
      {state.onAction && (
        <button
          onClick={state.onAction}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition transform hover:scale-105"
        >
          {state.actionLabel}
        </button>
      )}
    </div>
  );
}
