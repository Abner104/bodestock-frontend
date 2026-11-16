// src/components/inventory/modals/ProductWizardModal/StepInitialPurchase.jsx
/**
 * Step 2: Stock inicial + Formatos de venta
 * Sección A: Cómo compraste (precio unitario, cantidad, presentación de compra)
 * Sección B: Formatos de venta (sixpack, caja, etc.) → se guardan en presentations[]
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Tag, Lock, ShoppingCart, AlertTriangle } from 'lucide-react';

const toNum = (v) => {
  // Eliminar puntos de miles (Chile usa punto como separador de miles, coma como decimal)
  const str = String(v ?? 0).replace(/\./g, '').replace(',', '.');
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function StepInitialPurchase({ formData, updateFormData, isInsumo = false, inventoryType = null, isEdit = false }) {
  const isBotilleria = inventoryType === 'BOTILLERIA';
  // Estado LOCAL para los inputs - evita que React se coma caracteres
  const [priceInput, setPriceInput] = useState('');
  const [stockInput, setStockInput] = useState('');

  // Estado para el formulario de agregar formato de venta
  const [newFormatName, setNewFormatName] = useState('');
  const [newFormatFactor, setNewFormatFactor] = useState('');
  const [newFormatPrice, setNewFormatPrice] = useState('');
  const [formatError, setFormatError] = useState('');

  // Sincronizar estado local con formData al montar o cuando formData cambia externamente
  useEffect(() => {
    const price = formData._tempUnitPrice;
    if (price !== undefined && price !== null && price !== '') {
      const digits = String(price).replace(/\D/g, '');
      setPriceInput(digits ? Number(digits).toLocaleString('es-CL') : '');
    } else {
      setPriceInput('');
    }
  }, [formData._tempUnitPrice]);

  useEffect(() => {
    const stock = formData.stock;
    if (stock !== undefined && stock !== null && stock !== 0 && stock !== '0' && stock !== '') {
      setStockInput(String(stock));
    } else if (stock === 0 || stock === '0') {
      setStockInput(prev => prev === '' ? '' : String(stock));
    }
  }, [formData.stock]);

  const calculateUnitCost = () => {
    if (isEdit) {
      // En edición: el campo muestra el TOTAL (ppp * stock), se recalcula como total/stock
      const total = toNum(priceInput);
      const qty = toNum(stockInput);
      return qty > 0 ? total / qty : 0;
    }
    // En creación: el campo es el TOTAL de la factura, costo = total / cantidad
    const total = toNum(priceInput);
    const qty = toNum(stockInput);
    return qty > 0 ? total / qty : 0;
  };

  const getTotalUnits = () => {
    if (formData.usePresentacion && formData.tempPresentationFactor) {
      return toNum(formData.stock) * toNum(formData.tempPresentationFactor);
    }
    return toNum(formData.stock);
  };

  const unitCost = calculateUnitCost();

  // Precio cambia — siempre es el TOTAL pagado por este producto
  const handlePriceChange = (rawValue) => {
    const digits = rawValue.replace(/\D/g, '');
    setPriceInput(digits ? Number(digits).toLocaleString('es-CL') : '');
    updateFormData({ ppp: digits, _tempUnitPrice: digits });
  };

  // Cantidad cambia — el total (priceInput/formData.ppp) no cambia, solo se recalcula el costo unitario
  const handleStockChange = (rawValue) => {
    const val = rawValue.replace(/[^0-9.,]/g, '');
    setStockInput(val);
    updateFormData({ stock: val });
  };

  // ── Formatos de venta ──────────────────────────────────────────────
  const sellFormats = formData.presentations || [];

  const handleAddFormat = () => {
    setFormatError('');
    const name = newFormatName.trim();
    const factor = toNum(newFormatFactor);
    const price = toNum(newFormatPrice);

    if (!name) { setFormatError('El nombre del formato es obligatorio.'); return; }
    if (factor <= 1) { setFormatError('La cantidad de unidades debe ser mayor a 1.'); return; }
    if (sellFormats.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      setFormatError('Ya existe un formato con ese nombre.');
      return;
    }

    const newFormat = {
      id: generateId(),
      name,
      factor,
      // salePrice opcional — si el usuario lo ingresó lo guardamos
      ...(price > 0 ? { salePrice: price } : {})
    };

    updateFormData({ presentations: [...sellFormats, newFormat] });
    setNewFormatName('');
    setNewFormatFactor('');
    setNewFormatPrice('');
  };

  const handleRemoveFormat = (id) => {
    updateFormData({ presentations: sellFormats.filter(f => f.id !== id) });
  };

  const unitName = formData.unit || 'unidad';

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── SECCIÓN A: COMPRA ────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
          {isInsumo ? 'Compra del insumo' : 'Stock Inicial'}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 ml-8">
          {isInsumo
            ? 'Ingresá cuánto pagaste y cuánto tenés disponible'
            : 'Define tu precio de venta y cuántas unidades compraste'}
        </p>

        <div className="space-y-4">
          {/* Precio — total pagado solo por este producto */}
          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border-2 border-blue-300 dark:border-blue-600">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              💰 ¿Cuánto pagaste en total por <span className="text-blue-600 dark:text-blue-400">este producto</span>?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-600 dark:text-slate-400">$</span>
              <input
                required
                type="text"
                inputMode="numeric"
                className="w-full pl-10 pr-4 py-3 border-2 border-blue-400 dark:border-blue-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm"
                value={priceInput}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder={isInsumo ? 'Ej: 3500' : 'Ej: 79400'}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Solo lo que corresponde a <strong>este producto</strong> — no el total de la factura. El sistema calculará el costo por {unitName} automáticamente.
            </p>
          </div>

          {/* Cantidad — bloqueada en modo edición */}
          {isEdit ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-300 dark:border-amber-700">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Stock actual: {toNum(stockInput).toLocaleString('es-CL')} {unitName}</p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                La cantidad no se puede editar directamente para mantener la trazabilidad del inventario.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
                  <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>¿Llegó mercadería? Usa <strong>Registrar Compra</strong></span>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>¿Se dañó producto? Usa <strong>Registrar Merma</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                📦 {isInsumo ? `¿Cuántos ${unitName} compraste?` : `¿Cuántas ${unitName}s compraste?`}
              </label>
              <input
                required
                type="text"
                inputMode="decimal"
                className="w-full px-4 py-3 border-2 border-blue-400 dark:border-blue-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm"
                value={stockInput}
                onChange={(e) => handleStockChange(e.target.value)}
                placeholder={isInsumo ? 'Ej: 1000' : 'Ej: 24'}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {isInsumo ? `Total de ${unitName} que entraron al stock` : `Cantidad de ${unitName}s que tienes en stock`}
              </p>
            </div>
          )}


          {/* Checkbox: ¿Compraste en presentación? */}
          <div>
            <label className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition">
              <input
                type="checkbox"
                checked={formData.usePresentacion || false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateFormData({
                    usePresentacion: checked,
                    tempPresentationName: checked ? formData.tempPresentationName : '',
                    tempPresentationFactor: checked ? formData.tempPresentationFactor : ''
                  });
                }}
                className="mt-1 w-5 h-5 text-amber-600 border-amber-400 rounded focus:ring-amber-500"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  📦 Compré en paquete (ej: cajas, paquetes)
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Marca esto si compraste en bulto. <strong>Ejemplo:</strong> Compraste 2 cajas de 24 unidades
                </p>
              </div>
            </label>
          </div>

          {/* Campos de presentación de compra */}
          {formData.usePresentacion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg"
            >
              <p className="text-xs font-bold text-amber-900 dark:text-amber-100 mb-3">
                🎯 ¿Qué compraste y cuánto contiene cada unidad de compra?
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1.5">
                    Nombre del paquete
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border-2 border-amber-300 dark:border-amber-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    placeholder="Ej: Caja"
                    value={formData.tempPresentationName || ''}
                    onChange={(e) => updateFormData({ tempPresentationName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1.5">
                    ¿Cuántos {unitName} contiene?
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2.5 border-2 border-amber-300 dark:border-amber-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                    placeholder="Ej: 24"
                    value={formData.tempPresentationFactor || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      updateFormData({ tempPresentationFactor: val });
                    }}
                  />
                </div>
              </div>

              {formData.tempPresentationName && toNum(formData.tempPresentationFactor) > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                  <p className="text-sm text-green-700 dark:text-green-300 text-center font-mono">
                    {toNum(stockInput)} {formData.tempPresentationName} × {toNum(formData.tempPresentationFactor)} {unitName}
                    <span className="mx-2">=</span>
                    <strong className="text-lg text-green-900 dark:text-green-100">
                      {getTotalUnits().toLocaleString('es-CL')} {unitName}
                    </strong>
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 text-center mt-1">Stock total disponible</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Costo unitario calculado automáticamente: total ÷ cantidad */}
          {toNum(stockInput) > 0 && toNum(priceInput) > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-400 dark:border-green-600 rounded-xl"
            >
              <p className="text-xs font-bold text-green-800 dark:text-green-200 mb-1">✅ Costo por {unitName}:</p>
              <p className="text-2xl font-black text-green-700 dark:text-green-300">
                ${Math.round(unitCost).toLocaleString('es-CL')} / {unitName}
              </p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                ${toNum(priceInput).toLocaleString('es-CL')} ÷ {toNum(stockInput).toLocaleString('es-CL')} {unitName}
              </p>
            </motion.div>
          )}

          {/* Precio de venta + margen en vivo (solo productos, no insumos) */}
          {!isInsumo && (
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border-2 border-violet-300 dark:border-violet-600">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  🏷️ ¿En cuánto vendes cada {unitName}?
                </label>
                {/* Toggle: definir por precio o por % margen */}
                <div className="flex rounded-lg border border-violet-300 dark:border-violet-600 overflow-hidden text-[11px] font-bold self-start sm:self-auto flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => updateFormData({ _modoPrecio: 'precio' })}
                    className={`px-2.5 py-1.5 sm:py-1 transition-colors ${(formData._modoPrecio || 'precio') === 'precio' ? 'bg-violet-600 text-white' : 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400'}`}
                  >
                    $ Precio
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFormData({ _modoPrecio: 'margen' })}
                    className={`px-2.5 py-1.5 sm:py-1 transition-colors ${formData._modoPrecio === 'margen' ? 'bg-violet-600 text-white' : 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400'}`}
                  >
                    % Margen
                  </button>
                </div>
              </div>

              {(formData._modoPrecio || 'precio') === 'precio' ? (
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-600 dark:text-slate-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full pl-10 pr-4 py-3 border-2 border-violet-400 dark:border-violet-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm"
                    value={formData._tempSalePrice ?? formData.salePrice ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      updateFormData({ _tempSalePrice: val, salePrice: toNum(val) || undefined, _tempMargenPct: '' });
                    }}
                    placeholder="Ej: 1335"
                  />
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full pl-4 pr-10 py-3 border-2 border-violet-400 dark:border-violet-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm"
                    value={formData._tempMargenPct ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      const pct = toNum(val);
                      const precioCalc = unitCost > 0 && pct > 0 ? Math.round(unitCost * (1 + pct / 100)) : 0;
                      updateFormData({
                        _tempMargenPct: val,
                        _tempSalePrice: precioCalc > 0 ? String(precioCalc) : '',
                        salePrice: precioCalc || undefined,
                      });
                    }}
                    placeholder="Ej: 50"
                    disabled={unitCost === 0}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-600 dark:text-slate-400">%</span>
                </div>
              )}
              {formData._modoPrecio === 'margen' && unitCost === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">Ingresa primero el costo para calcular por margen</p>
              )}

              {/* Resultado: precio calculado + margen */}
              {unitCost > 0 && toNum(formData._tempSalePrice ?? formData.salePrice) > 0 && (() => {
                const venta = toNum(formData._tempSalePrice ?? formData.salePrice);
                const margen = ((venta - unitCost) / unitCost) * 100;
                const ganancia = venta - unitCost;
                const bueno = margen >= 15;
                return (
                  <div className={`mt-3 p-3 rounded-lg border ${bueno ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${bueno ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {formData._modoPrecio === 'margen' ? `Precio de venta: $${venta.toLocaleString('es-CL')}` : `Margen: ${margen.toFixed(0)}%`}
                      </span>
                      <span className={`text-xs font-semibold ${bueno ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Ganas ${Math.round(ganancia).toLocaleString('es-CL')} por {unitName}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Opcional — si lo defines aquí, el sistema podrá avisarte si vendes bajo tu margen objetivo
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN B: FORMATOS DE VENTA (solo botillería) ── */}
      {!isInsumo && isBotilleria && <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-4 border-2 border-violet-200 dark:border-violet-600">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Tag className="w-4 h-4 text-violet-600" />
          Formatos de venta
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          ¿Vendes este producto en distintos formatos? Agrégalos aquí y aparecerán como opción al registrar una venta.
          <br />
          <span className="text-violet-600 dark:text-violet-400 font-medium">
            Ejemplo: vendes cerveza por unidad, pero también como Sixpack (6 unidades) o Caja (24 unidades).
          </span>
        </p>

        {/* Lista de formatos existentes */}
        {sellFormats.length > 0 && (
          <div className="mb-3 space-y-2">
            {sellFormats.map((fmt) => (
              <motion.div
                key={fmt.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-between bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full flex items-center justify-center text-xs font-bold">
                    {fmt.factor}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fmt.factor} {unitName}
                      {fmt.salePrice ? ` · $${fmt.salePrice.toLocaleString('es-CL')}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFormat(fmt.id)}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Formulario para agregar formato */}
        <div className="bg-slate-50 dark:bg-slate-700/50 border-2 border-dashed border-violet-300 dark:border-violet-600 rounded-lg p-3">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">+ Agregar formato</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Nombre del formato</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-violet-200 dark:border-violet-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                placeholder={`Ej: Sixpack`}
                value={newFormatName}
                onChange={(e) => { setFormatError(''); setNewFormatName(e.target.value); }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Cuántos {unitName} incluye
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="w-full px-3 py-2 border border-violet-200 dark:border-violet-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                placeholder="Ej: 6"
                value={newFormatFactor}
                onChange={(e) => { setFormatError(''); setNewFormatFactor(e.target.value.replace(/[^0-9.,]/g, '')); }}
              />
            </div>
          </div>

          {/* Precio de venta del formato (opcional) */}
          <div className="mb-2">
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              Precio de venta del formato <span className="text-slate-400">(opcional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
              <input
                type="text"
                inputMode="numeric"
                className="w-full pl-7 pr-3 py-2 border border-violet-200 dark:border-violet-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                placeholder={
                  newFormatFactor && toNum(priceInput) > 0
                    ? `Sugerido: ${(toNum(newFormatFactor) * toNum(priceInput)).toLocaleString('es-CL')}`
                    : 'Ej: 4500'
                }
                value={newFormatPrice}
                onChange={(e) => setNewFormatPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              />
            </div>
            {newFormatFactor && toNum(priceInput) > 0 && (
              <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">
                Precio sugerido: ${(toNum(newFormatFactor) * toNum(priceInput)).toLocaleString('es-CL')} ({newFormatFactor} × ${toNum(priceInput).toLocaleString('es-CL')})
              </p>
            )}
          </div>

          {formatError && (
            <p className="text-xs text-red-500 mb-2">{formatError}</p>
          )}

          <button
            type="button"
            onClick={handleAddFormat}
            className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Agregar formato
          </button>
        </div>

        {sellFormats.length === 0 && (
          <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">
            Sin formatos adicionales — solo se venderá por {unitName}
          </p>
        )}
      </div>}
    </motion.div>
  );
}
