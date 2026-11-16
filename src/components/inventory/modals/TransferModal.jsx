// src/components/inventory/modals/TransferModal.jsx
/**
 * Modal para transferir stock entre bodegas
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as IconX, ArrowRightLeft } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Object} props.item - Producto seleccionado
 * @param {Array} props.warehouses - Lista de bodegas disponibles
 * @param {Function} props.onSubmit - Callback al registrar transferencia
 * @param {Function} props.getWarehouseName - Helper para obtener nombre de bodega
 */
export default function TransferModal({
  isOpen = false,
  onClose,
  item,
  warehouses = [],
  onSubmit,
  getWarehouseName
}) {
  const [transferData, setTransferData] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: ''
  });

  // Inicializar bodega origen cuando se abre
  useEffect(() => {
    if (isOpen && item) {
      setTransferData({
        fromWarehouseId: item.warehouseId || '',
        toWarehouseId: '',
        quantity: ''
      });
    }
  }, [isOpen, item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(transferData);
  };

  // Filtrar bodegas de destino (excluir la bodega origen)
  const availableDestinations = warehouses.filter(w => w.id !== transferData.fromWarehouseId);

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
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowRightLeft className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">Transferir Stock</h3>
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
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-4">
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">Producto:</strong> {item?.name}
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">Stock actual:</strong> {item?.stock ?? 0} {item?.unit}
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">Bodega actual:</strong> {getWarehouseName(item?.warehouseId)}
                  </div>
                </div>
              </div>

              {/* Bodegas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Bodega Origen */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Bodega origen
                  </label>
                  <select
                    required
                    disabled
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    value={transferData.fromWarehouseId}
                  >
                    <option value={transferData.fromWarehouseId}>
                      {getWarehouseName(transferData.fromWarehouseId)}
                    </option>
                  </select>
                </div>

                {/* Bodega Destino */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Bodega destino *
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={transferData.toWarehouseId}
                    onChange={(e) => setTransferData((t) => ({ ...t, toWarehouseId: e.target.value }))}
                  >
                    <option value="">Seleccionar bodega</option>
                    {availableDestinations.map(warehouse => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cantidad a transferir */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Cantidad a transferir *
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  max={item?.stock ?? 0}
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={transferData.quantity}
                  onChange={(e) => setTransferData((t) => ({ ...t, quantity: e.target.value }))}
                  placeholder={`Máximo: ${item?.stock ?? 0} ${item?.unit}`}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Disponible: {item?.stock ?? 0} {item?.unit}
                </p>
              </div>

              {/* Preview de transferencia */}
              {transferData.quantity && transferData.toWarehouseId && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">
                    📋 Resumen de transferencia:
                  </p>
                  <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <div>
                      • Se transferirán <strong>{transferData.quantity} {item?.unit}</strong>
                    </div>
                    <div>
                      • Desde <strong>{getWarehouseName(transferData.fromWarehouseId)}</strong>
                    </div>
                    <div>
                      • Hacia <strong>{getWarehouseName(transferData.toWarehouseId)}</strong>
                    </div>
                    <div className="pt-1 border-t border-blue-300 dark:border-blue-600 mt-2">
                      Stock restante en origen: <strong>{(item?.stock ?? 0) - parseFloat(transferData.quantity || 0)} {item?.unit}</strong>
                    </div>
                  </div>
                </div>
              )}

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
                  className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition font-medium shadow-md hover:shadow-lg"
                >
                  ✓ Transferir
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
