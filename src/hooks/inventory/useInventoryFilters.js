// src/hooks/inventory/useInventoryFilters.js
/**
 * Hook para gestionar filtros, ordenamiento y paginación de inventario
 * Contiene toda la lógica de filtrado compleja extraída de Inventory.jsx
 */

import { useState, useMemo, useEffect } from 'react';
import { toNum } from '../../utils/inventory/inventoryHelpers.js';
import { DEFAULT_STOCK_THRESHOLDS } from '../../utils/inventory/inventoryConstants.js';

/**
 * Hook que gestiona filtros, ordenamiento y paginación de productos
 *
 * @param {Array} items - Array de productos sin filtrar
 * @param {Object} stockThresholds - Umbrales de stock { critical, low, warning }
 * @returns {Object} - Estado y funciones para manejar filtros
 */
export function useInventoryFilters(items = [], stockThresholds = DEFAULT_STOCK_THRESHOLDS) {
  // Estado de filtros básicos
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado de filtros avanzados
  const [advancedFilters, setAdvancedFilters] = useState({
    stockRange: 'all', // 'all', 'critical', 'low', 'normal', 'custom'
    stockMin: '',
    stockMax: '',
    priceRange: 'all', // 'all', 'custom'
    priceMin: '',
    priceMax: '',
    categories: [], // Array de categorías seleccionadas
    providers: [], // Array de proveedores seleccionados
  });

  // Estado de ordenamiento
  const [sortBy, setSortBy] = useState('name'); // 'name', 'stock', 'ppp', 'totalValue', 'createdAt'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

  // Estado de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Resetear a página 1 cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWarehouse, searchQuery, advancedFilters, sortBy, sortOrder]);

  // Computed: Items filtrados y ordenados
  const filteredAndSortedItems = useMemo(() => {
    return items
      .filter((item) => {
        // 1. Filtro por bodega
        const warehouseMatch =
          selectedWarehouse === 'all' || item.warehouseId === selectedWarehouse;
        if (!warehouseMatch) return false;

        // 2. Filtro por búsqueda (nombre, SKU, proveedor, categoría)
        const query = searchQuery.toLowerCase().trim();
        if (query) {
          const searchMatch =
            (item.name || '').toLowerCase().includes(query) ||
            (item.sku || '').toLowerCase().includes(query) ||
            (item.provider || '').toLowerCase().includes(query) ||
            (item.category || '').toLowerCase().includes(query);
          if (!searchMatch) return false;
        }

        // 3. Filtro por rango de stock
        if (advancedFilters.stockRange !== 'all') {
          const stock = item.stock ?? 0;
          switch (advancedFilters.stockRange) {
            case 'critical':
              if (stock > stockThresholds.critical) return false;
              break;
            case 'low':
              if (stock <= stockThresholds.critical || stock > stockThresholds.low)
                return false;
              break;
            case 'normal':
              if (stock <= stockThresholds.low) return false;
              break;
            case 'custom':
              const min =
                advancedFilters.stockMin !== ''
                  ? toNum(advancedFilters.stockMin)
                  : -Infinity;
              const max =
                advancedFilters.stockMax !== ''
                  ? toNum(advancedFilters.stockMax)
                  : Infinity;
              if (stock < min || stock > max) return false;
              break;
            default:
              break;
          }
        }

        // 4. Filtro por rango de precio (PPP)
        if (advancedFilters.priceRange === 'custom') {
          const ppp = item.ppp ?? 0;
          const min =
            advancedFilters.priceMin !== ''
              ? toNum(advancedFilters.priceMin)
              : -Infinity;
          const max =
            advancedFilters.priceMax !== ''
              ? toNum(advancedFilters.priceMax)
              : Infinity;
          if (ppp < min || ppp > max) return false;
        }

        // 5. Filtro por categorías
        if (advancedFilters.categories.length > 0) {
          if (!advancedFilters.categories.includes(item.category)) return false;
        }

        // 6. Filtro por proveedores
        if (advancedFilters.providers.length > 0) {
          if (!advancedFilters.providers.includes(item.provider)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'name':
            comparison = String(a.name || '').localeCompare(String(b.name || ''));
            break;
          case 'stock':
            comparison = (a.stock ?? 0) - (b.stock ?? 0);
            break;
          case 'ppp':
            comparison = (a.ppp ?? 0) - (b.ppp ?? 0);
            break;
          case 'totalValue':
            const valueA = (a.stock ?? 0) * (a.ppp ?? 0);
            const valueB = (b.stock ?? 0) * (b.ppp ?? 0);
            comparison = valueA - valueB;
            break;
          case 'createdAt':
            const dateA = a.createdAt?.toMillis?.() || 0;
            const dateB = b.createdAt?.toMillis?.() || 0;
            comparison = dateA - dateB;
            break;
          default:
            comparison = 0;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [items, selectedWarehouse, searchQuery, advancedFilters, sortBy, sortOrder, stockThresholds]);

  // Computed: Items paginados
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedItems.slice(startIndex, endIndex);
  }, [filteredAndSortedItems, currentPage, itemsPerPage]);

  // Computed: Número total de páginas
  const totalPages = useMemo(() => {
    return Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  }, [filteredAndSortedItems.length, itemsPerPage]);

  // Computed: Información de paginación
  const paginationInfo = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredAndSortedItems.length);

    return {
      startIndex,
      endIndex,
      currentPage,
      totalPages,
      totalItems: filteredAndSortedItems.length,
      showing: `${startIndex + 1}-${endIndex} de ${filteredAndSortedItems.length}`
    };
  }, [currentPage, itemsPerPage, filteredAndSortedItems.length, totalPages]);

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedWarehouse('all');
    setAdvancedFilters({
      stockRange: 'all',
      stockMin: '',
      stockMax: '',
      priceRange: 'all',
      priceMin: '',
      priceMax: '',
      categories: [],
      providers: [],
    });
    setSortBy('name');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return (
      (searchQuery ? 1 : 0) +
      (selectedWarehouse !== 'all' ? 1 : 0) +
      (advancedFilters.stockRange !== 'all' ? 1 : 0) +
      (advancedFilters.priceRange !== 'all' ? 1 : 0) +
      advancedFilters.categories.length +
      advancedFilters.providers.length
    );
  }, [searchQuery, selectedWarehouse, advancedFilters]);

  // Funciones de navegación de paginación
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return {
    // Filtros básicos
    selectedWarehouse,
    setSelectedWarehouse,
    searchQuery,
    setSearchQuery,

    // Filtros avanzados
    advancedFilters,
    setAdvancedFilters,
    updateAdvancedFilters: (updates) => {
      setAdvancedFilters((prev) => ({ ...prev, ...updates }));
    },

    // Ordenamiento
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    toggleSortOrder: () => {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    },

    // Paginación
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginationInfo,
    goToPage,
    nextPage,
    prevPage,

    // Items computados
    filteredItems: filteredAndSortedItems,
    paginatedItems,

    // Utilidades
    clearAllFilters,
    activeFiltersCount,
    hasActiveFilters: activeFiltersCount > 0,

    // Computed: categorías y proveedores únicos para filtros
    uniqueCategories: [...new Set(items.map(item => item.category).filter(Boolean))],
    uniqueProviders: [...new Set(items.map(item => item.provider).filter(Boolean))]
  };
}
