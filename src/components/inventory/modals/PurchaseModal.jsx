// src/components/inventory/modals/PurchaseModal.jsx
/**
 * Modal para registrar compras de productos
 * Pregunta precio unitario + cantidad → calcula total automáticamente
 * Muestra alerta si hay stock antiguo próximo a vencer (FIFO)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as IconX, PackagePlus, AlertTriangle } from 'lucide-react';

export default function PurchaseModal({
  isOpen = false,
  onClose,
  item,
  onSubmit,
  CLP,
  toNum
}) {
  const [purchaseData, setPurchaseData] = useState({
    qty: '',
    price: '',        // Este será el TOTAL calculado (unitPrice * qty) — costo de compra
    unitPrice: '',     // Costo por unidad ingresado por el usuario
    salePrice: '',     // Precio de venta al público (no afecta el costo/PPP)
    presentationId: null,
    expiryDate: ''
  });

  // Resetear form cuando se abre/cierra
  useEffect(() => {
    if (isOpen) {
      setPurchaseData({
        qty: '',
        price: '',
        unitPrice: '',
        salePrice: item?.salePrice ? String(item.salePrice) : '',
        presentationId: null,
        expiryDate: ''
      });
    }
  }, [isOpen, item?.id]);

  // Calcular total automáticamente cuando cambia precio unitario o cantidad
  const handleUnitPriceChange = (value) => {
    const unitPrice = value;
    const qty = toNum(purchaseData.qty);
    const total = qty > 0 ? Math.round(toNum(unitPrice) * qty) : 0;
    setPurchaseData((p) => ({ ...p, unitPrice: value, price: total > 0 ? String(total) : '' }));
  };

  const handleQtyChange = (value) => {
    const qty = toNum(value);
    const unitPrice = toNum(purchaseData.unitPrice);
    const total = unitPrice > 0 && qty > 0 ? Math.round(unitPrice * qty) : 0;
    setPurchaseData((p) => ({ ...p, qty: value, price: total > 0 ? String(total) : '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const qtyFinal = Math.round(toNum(purchaseData.qty));
    const unitPrice = toNum(purchaseData.unitPrice);
    onSubmit({
      qty: String(qtyFinal),
      price: String(Math.round(unitPrice * qtyFinal)),
      salePrice: purchaseData.salePrice ? toNum(purchaseData.salePrice) : undefined,
      presentationId: purchaseData.presentationId,
      expiryDate: purchaseData.expiryDate
    });
  };

  // Calcular total de unidades base (con presentación)
  const getTotalUnits = () => {
    if (!purchaseData.presentationId || !item?.presentations) return toNum(purchaseData.qty);
    const presentation = item.presentations.find(p => p.id === purchaseData.presentationId);
    if (!presentation) return toNum(purchaseData.qty);
    return toNum(purchaseData.qty) * toNum(presentation.factor || 1);
  };

  const selectedPresentation = item?.presentations?.find(p => p.id === purchaseData.presentationId);

  // Detectar stock antiguo próximo a vencer (FIFO alert)
  const expiryAlert = useMemo(() => {
    if (!item?.expiryDate) return null;
    try {
      const expiry = item.expiryDate.toDate
        ? item.expiryDate.toDate()
        : new Date(item.expiryDate);

      const now = new Date();
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { type: 'expired', days: Math.abs(diffDays), date: expiry };
      }
      if (diffDays <= 30) {
        return { type: 'soon', days: diffDays, date: expiry };
      }
    } catch {
      // ignore
    }
    return null;
  }, [item?.expiryDate]);

  // Última compra info
  const lastPurchaseInfo = useMemo(() => {
    if (!item?.history || item.history.length === 0) return null;
    const last = item.history[item.history.length - 1];
    const unitPrice = last.price || (last.totalPrice && last.qty ? Math.round(last.totalPrice / last.qty) : 0);
    return { unitPrice, total: last.totalPrice || 0, qty: last.qty || 0 };
  }, [item?.history]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PackagePlus className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">Ingreso de Mercadería</h3>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Información del producto */}
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-2">{item?.name}</h4>
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    Stock actual: <span className="font-semibold text-slate-800 dark:text-slate-200">{item?.stock ?? 0} {item?.unit}</span>
                  </div>
                  <div>
                    {lastPurchaseInfo ? (
                      <>Último precio: <span className="font-semibold text-slate-800 dark:text-slate-200">{CLP(lastPurchaseInfo.unitPrice)}/{item?.unit}</span></>
                    ) : (
                      <>Último precio: <span className="font-semibold text-slate-800 dark:text-slate-200">N/A</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Alerta FIFO - Stock próximo a vencer */}
              {expiryAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg border-2 flex items-start gap-2 ${
                    expiryAlert.type === 'expired'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    expiryAlert.type === 'expired' ? 'text-red-500' : 'text-amber-500'
                  }`} />
                  <div>
                    <p className={`text-sm font-bold ${
                      expiryAlert.type === 'expired'
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-amber-800 dark:text-amber-200'
                    }`}>
                      {expiryAlert.type === 'expired'
                        ? `Stock VENCIDO hace ${expiryAlert.days} días`
                        : `Stock vence en ${expiryAlert.days} días`
                      }
                    </p>
                    <p className={`text-xs mt-1 ${
                      expiryAlert.type === 'expired'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {expiryAlert.type === 'expired'
                        ? `Tienes ${item?.stock} ${item?.unit} vencidos. Considera darlos de baja antes de ingresar nuevo stock.`
                        : `Tienes ${item?.stock} ${item?.unit} que vencen el ${expiryAlert.date.toLocaleDateString('es-CL')}. Prioriza vender el stock antiguo primero.`
                      }
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Selector de presentación */}
              {item?.presentations && item.presentations.length > 0 && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    📦 Presentación
                  </label>
                  <select
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={purchaseData.presentationId || ''}
                    onChange={(e) => setPurchaseData((p) => ({ ...p, presentationId: e.target.value || null }))}
                  >
                    <option value="">Por {item.unit} (unidad base)</option>
                    {item.presentations.map((pres) => (
                      <option key={pres.id} value={pres.id}>
                        Por {pres.name} (1 = {pres.factor} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Costo de compra (por unidad) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  💰 ¿Cuánto pagaste por cada {item?.unit || 'unidad'}? (costo) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-slate-500 dark:text-slate-400">
                    $
                  </span>
                  <input
                    required
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                    value={purchaseData.unitPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    placeholder={lastPurchaseInfo ? `Último: $${lastPurchaseInfo.unitPrice.toLocaleString('es-CL')}` : 'Ej: 1.500'}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Lo que te cobró el proveedor — se usa para calcular el costo promedio
                </p>
              </div>

              {/* Cantidad */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  📦 ¿Cuántas {item?.unit || 'unidades'} ingresaras? *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                  value={purchaseData.qty}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  onBlur={(e) => {
                    const val = toNum(e.target.value);
                    if (val > 0 && !Number.isInteger(val)) {
                      const rounded = Math.round(val);
                      handleQtyChange(String(rounded));
                    }
                  }}
                  placeholder="Ej: 24"
                />
                {purchaseData.qty && !Number.isInteger(toNum(purchaseData.qty)) && (
                  <p className="text-xs text-amber-500 mt-1 font-medium">
                    ⚠️ Cantidad con decimales — se redondeará a {Math.round(toNum(purchaseData.qty))} al guardar
                  </p>
                )}
                {purchaseData.presentationId && toNum(purchaseData.qty) > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                    = {getTotalUnits()} {item?.unit} en total
                  </p>
                )}
              </div>

              {/* Total calculado */}
              {toNum(purchaseData.unitPrice) > 0 && toNum(purchaseData.qty) > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border-2 border-emerald-300 dark:border-emerald-700"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total del ingreso:</span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                      {CLP(toNum(purchaseData.price))}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    {toNum(purchaseData.qty)} {item?.unit} × ${toNum(purchaseData.unitPrice).toLocaleString('es-CL')} c/u
                  </p>
                </motion.div>
              )}

              {/* Precio de venta (no afecta el costo, solo se guarda para calcular margen) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  🏷️ ¿En cuánto vendes cada {item?.unit || 'unidad'}?
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">(Opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-slate-500 dark:text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="w-full pl-8 pr-3 py-2.5 border border-violet-300 dark:border-violet-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                    value={purchaseData.salePrice}
                    onChange={(e) => setPurchaseData(p => ({ ...p, salePrice: e.target.value }))}
                    placeholder="Ej: 1.890"
                  />
                </div>
                {toNum(purchaseData.unitPrice) > 0 && toNum(purchaseData.salePrice) > 0 && (() => {
                  const costo = toNum(purchaseData.unitPrice);
                  const venta = toNum(purchaseData.salePrice);
                  const margen = ((venta - costo) / costo) * 100;
                  const ganancia = venta - costo;
                  const bueno = margen >= 15;
                  return (
                    <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center justify-between ${bueno ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'}`}>
                      <span className="font-bold">Margen: {margen.toFixed(0)}%</span>
                      <span>Ganas ${Math.round(ganancia).toLocaleString('es-CL')}/{item?.unit}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Fecha de Vencimiento */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  📅 Fecha de Vencimiento
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">(Opcional)</span>
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={purchaseData.expiryDate}
                  onChange={(e) => setPurchaseData((p) => ({ ...p, expiryDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-1">
                  Si el producto tiene vencimiento más cercano, se actualizará
                </p>
              </div>

              {/* Botones */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition font-medium shadow-md hover:shadow-lg"
                >
                  ✓ Registrar ingreso
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
