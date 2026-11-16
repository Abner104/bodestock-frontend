// src/components/pos/ProductPickerSheet.jsx
// Modal unificado para seleccionar tamaño (presentación) + extras al vender un producto elaborado

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingCart, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const CLP = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

export default function ProductPickerSheet({ product, isOpen, onClose, onConfirm, existingCartItem }) {
  const { isDark } = useTheme();

  const hasPresentations = product?.presentations && product.presentations.length > 0;
  const hasExtras = product?.extras && product.extras.length > 0;

  // Si solo tiene 1 presentación, pre-seleccionarla
  const [selectedPresentationId, setSelectedPresentationId] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState(new Set());
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen || !product) return;
    // Reset
    if (existingCartItem) {
      setQuantity(existingCartItem.quantity || 1);
      setSelectedPresentationId(existingCartItem.selectedPresentationId || null);
      const extrasSet = new Set((existingCartItem.selectedExtras || []).map(e => e.id));
      setSelectedExtras(extrasSet);
    } else {
      setQuantity(1);
      setSelectedExtras(new Set());
      // Pre-seleccionar si solo hay 1 presentación
      if (product.presentations?.length === 1) {
        setSelectedPresentationId(product.presentations[0].id);
      } else {
        setSelectedPresentationId(null);
      }
    }
  }, [isOpen, product]);

  if (!product) return null;

  const selectedPresentation = hasPresentations
    ? product.presentations.find(p => p.id === selectedPresentationId)
    : null;

  // Precio base del producto
  const basePrice = selectedPresentation?.salePrice ?? product.precioVenta ?? 0;

  // Extras seleccionados
  const extrasTotal = hasExtras
    ? product.extras.filter(e => selectedExtras.has(e.id)).reduce((sum, e) => sum + (e.price || 0), 0)
    : 0;

  const unitTotal = basePrice + extrasTotal;
  const grandTotal = unitTotal * quantity;

  const canConfirm = !hasPresentations || selectedPresentationId !== null;

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      if (next.has(extraId)) next.delete(extraId);
      else next.add(extraId);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const extrasArr = hasExtras
      ? product.extras.filter(e => selectedExtras.has(e.id))
      : [];
    onConfirm({
      presentationId: selectedPresentationId,
      presentationName: selectedPresentation?.name || null,
      presentationSalePrice: selectedPresentation?.salePrice || null,
      presentationFactor: selectedPresentation?.factor || 1,
      extras: extrasArr,
      extrasTotal: extrasTotal * quantity,
      quantity,
      unitTotal,
      grandTotal,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className={`fixed bottom-0 left-0 right-0 z-[81] rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col ${
              isDark ? 'bg-slate-800' : 'bg-white'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`} />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0">
              {product.photoURL && (
                <img
                  src={product.photoURL}
                  alt={product.name}
                  className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-lg leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {product.name}
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {product.category}
                  {!hasPresentations && ` · ${CLP(product.precioVenta)}`}
                </p>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-5">

              {/* SECCIÓN TAMAÑOS */}
              {hasPresentations && (
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tamaño
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {product.presentations.map(p => {
                      const isSelected = selectedPresentationId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPresentationId(p.id)}
                          className={`relative rounded-2xl py-4 px-3 text-center border-2 transition-all active:scale-95 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10'
                              : isDark
                                ? 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </span>
                          )}
                          <p className={`font-bold text-base ${isSelected ? 'text-blue-600' : isDark ? 'text-white' : 'text-slate-800'}`}>
                            {p.name}
                          </p>
                          <p className={`text-xl font-black mt-1 ${isSelected ? 'text-blue-500' : isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {CLP(p.salePrice ?? product.precioVenta)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECCIÓN EXTRAS */}
              {hasExtras && (
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Extras (opcional)
                  </p>
                  <div className="space-y-2">
                    {product.extras.map(extra => {
                      const isChecked = selectedExtras.has(extra.id);
                      return (
                        <button
                          key={extra.id}
                          onClick={() => toggleExtra(extra.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.99] ${
                            isChecked
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : isDark
                                ? 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            isChecked
                              ? 'border-emerald-500 bg-emerald-500'
                              : isDark ? 'border-slate-500' : 'border-slate-300'
                          }`}>
                            {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className={`flex-1 text-left font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {extra.name}
                          </span>
                          <span className={`font-bold text-sm ${isChecked ? 'text-emerald-500' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            +{CLP(extra.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer fijo — cantidad + total + botón */}
            <div className={`px-5 py-4 border-t flex-shrink-0 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
              {/* Cantidad */}
              <div className="flex items-center justify-between mb-4">
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cantidad</span>
                <div className={`flex items-center gap-3 rounded-2xl px-2 py-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-90 ${
                      isDark ? 'hover:bg-slate-600 text-white' : 'hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className={`w-8 text-center font-black text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-90 ${
                      isDark ? 'hover:bg-slate-600 text-white' : 'hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Desglose precio */}
              {(extrasTotal > 0 || quantity > 1) && (
                <div className={`rounded-xl p-3 mb-3 space-y-1 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  {selectedPresentation && (
                    <div className="flex justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{selectedPresentation.name}</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{CLP(selectedPresentation.salePrice ?? product.precioVenta)}</span>
                    </div>
                  )}
                  {extrasTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Extras</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>+{CLP(extrasTotal)}</span>
                    </div>
                  )}
                  {quantity > 1 && (
                    <div className="flex justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>x{quantity}</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{CLP(unitTotal)} c/u</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botón confirmar */}
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${
                  canConfirm
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                    : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {canConfirm
                  ? `Agregar · ${CLP(grandTotal)}`
                  : 'Selecciona un tamaño'
                }
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
