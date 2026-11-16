// src/components/inventory/ui/PaginationControls.jsx
/**
 * Controles de paginación para el inventario
 * Muestra página actual, total de páginas y botones de navegación
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * @param {Object} props
 * @param {number} props.currentPage - Página actual (1-indexed)
 * @param {number} props.totalPages - Total de páginas
 * @param {number} props.totalItems - Total de items
 * @param {number} props.itemsPerPage - Items por página
 * @param {Function} props.onPageChange - Callback cuando cambia la página
 */
export default function PaginationControls({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 20,
  onPageChange
}) {
  // Si solo hay una página, no mostrar paginación
  if (totalPages <= 1) return null;

  // Calcular rango de items mostrados
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      scrollTop();
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      scrollTop();
    }
  };

  const handlePageClick = (page) => {
    onPageChange(page);
    scrollTop();
  };

  // Generar números de página a mostrar
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5; // Máximo de números de página visibles

    if (totalPages <= maxVisible) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Lógica para mostrar páginas con ellipsis
      if (currentPage <= 3) {
        // Inicio: 1 2 3 4 ... 10
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Final: 1 ... 7 8 9 10
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Medio: 1 ... 4 5 6 ... 10
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Info de items */}
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Mostrando{' '}
          <span className="font-semibold text-slate-900 dark:text-white">
            {startItem}
          </span>
          {' - '}
          <span className="font-semibold text-slate-900 dark:text-white">
            {endItem}
          </span>
          {' de '}
          <span className="font-semibold text-slate-900 dark:text-white">
            {totalItems}
          </span>
          {' productos'}
        </div>

        {/* Controles de paginación */}
        <div className="flex items-center gap-2">
          {/* Botón Anterior */}
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1}
            className={`
              p-2 rounded-lg border transition
              ${currentPage === 1
                ? 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }
            `}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Números de página */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-slate-400 dark:text-slate-600"
                  >
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => handlePageClick(page)}
                  className={`
                    min-w-[40px] h-10 px-3 rounded-lg font-semibold transition
                    ${currentPage === page
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Botón Siguiente */}
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className={`
              p-2 rounded-lg border transition
              ${currentPage === totalPages
                ? 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }
            `}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
