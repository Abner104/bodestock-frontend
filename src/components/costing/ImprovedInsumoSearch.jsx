// src/components/costing/ImprovedInsumoSearch.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Package, Plus, Loader2, AlertCircle } from 'lucide-react';

const ImprovedInsumoSearch = ({
  insumosDisponibles,
  onSelectInsumo,
  placeholder = "Buscar ingrediente... (Ej: ron, azúcar, limón)"
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Debug: Ver qué insumos están disponibles
  useEffect(() => {
    console.log('📦 Insumos disponibles:', insumosDisponibles);
    console.log('📊 Total insumos:', insumosDisponibles?.length || 0);
  }, [insumosDisponibles]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  // Filtrar productos
  const filteredProducts = searchQuery.trim()
    ? insumosDisponibles
        .filter(producto => {
          const query = searchQuery.toLowerCase();
          const nombreMatch = producto.nombre?.toLowerCase().includes(query);
          const skuMatch = producto.sku?.toLowerCase().includes(query);
          const categoriaMatch = producto.categoria?.toLowerCase().includes(query);

          console.log(`🔍 Buscando "${query}" en:`, {
            nombre: producto.nombre,
            nombreMatch,
            skuMatch,
            categoriaMatch
          });

          return nombreMatch || skuMatch || categoriaMatch;
        })
        .slice(0, 8) // Máximo 8 resultados
    : [];

  // Debug resultados filtrados
  useEffect(() => {
    if (searchQuery.trim()) {
      console.log('🎯 Resultados filtrados:', filteredProducts.length);
    }
  }, [filteredProducts, searchQuery]);

  // Manejar selección
  const handleSelect = (producto) => {
    onSelectInsumo(producto);
    setSearchQuery('');
    setShowResults(false);
    setSelectedIndex(-1);
  };

  // Navegación con teclado
  const handleKeyDown = (e) => {
    if (!showResults || filteredProducts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredProducts[selectedIndex]) {
          handleSelect(filteredProducts[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll automático al item seleccionado
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="relative" ref={resultsRef}>
      {/* Input de búsqueda */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 sm:py-3.5 border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm sm:text-base font-medium"
        />

        {/* Botón limpiar */}
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowResults(false);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Resultados */}
      <AnimatePresence>
        {showResults && searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto"
          >
            {filteredProducts.length === 0 ? (
              // Sin resultados
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium mb-1">No se encontraron insumos</p>
                <p className="text-sm text-gray-500">
                  Intenta con otro nombre o agrega un insumo manual
                </p>
              </div>
            ) : (
              // Lista de resultados
              <div className="divide-y divide-gray-100">
                {filteredProducts.map((producto, index) => (
                  <motion.button
                    key={producto.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelect(producto)}
                    className={`w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors text-left ${
                      selectedIndex === index ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''
                    }`}
                  >
                    {/* Icono */}
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedIndex === index ? 'bg-indigo-500' : 'bg-indigo-100 dark:bg-indigo-950'
                    }`}>
                      <Package className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedIndex === index ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{producto.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {formatCurrency(producto.costoUnitario)} / {producto.unidad}
                        {producto.stock !== undefined && (
                          <span className={`ml-2 font-medium ${
                            producto.stock > 10 ? 'text-emerald-600' : producto.stock > 0 ? 'text-amber-600' : 'text-red-500'
                          }`}>· Stock: {producto.stock}</span>
                        )}
                      </p>
                    </div>

                    {/* Botón agregar */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedIndex === index ? 'bg-indigo-600' : 'bg-indigo-100 dark:bg-indigo-950'
                    }`}>
                      <Plus className={`w-4 h-4 ${selectedIndex === index ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Footer con ayuda de teclado */}
            {filteredProducts.length > 0 && (
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  💡 Usa ↑↓ para navegar, Enter para seleccionar, Esc para cerrar
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImprovedInsumoSearch;
