// src/components/inventory/modals/WarehouseModal.jsx
/**
 * Modal para crear o editar bodegas
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as IconX, Warehouse, Package, ChefHat } from 'lucide-react';

const WAREHOUSE_TYPES = [
  {
    value: 'INSUMOS',
    label: 'Bodega de Insumos',
    description: 'Materias primas y materiales de producción',
    icon: Package,
    color: 'blue',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    selectedBorder: 'border-blue-500',
    selectedBg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    value: 'MOSTRADOR',
    label: 'Mostrador / Venta',
    description: 'Productos elaborados listos para vender',
    icon: ChefHat,
    color: 'indigo',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    selectedBorder: 'border-indigo-500',
    selectedBg: 'bg-indigo-50 dark:bg-indigo-900/20',
  },
  {
    value: 'GENERAL',
    label: 'Bodega General',
    description: 'Almacenamiento general de productos',
    icon: Warehouse,
    color: 'slate',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-400',
    selectedBorder: 'border-slate-500',
    selectedBg: 'bg-slate-50 dark:bg-slate-700/50',
  },
];

export default function WarehouseModal({
  isOpen = false,
  onClose,
  warehouse = null,
  onSubmit,
  mode = 'create',
  isProductionInventory = false,
  labelBodega = 'Bodega'
}) {
  const [warehouseData, setWarehouseData] = useState({
    name: '',
    description: '',
    location: '',
    type: isProductionInventory ? 'INSUMOS' : 'GENERAL'
  });

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && warehouse) {
        setWarehouseData({
          name: warehouse.name || '',
          description: warehouse.description || '',
          location: warehouse.location || '',
          type: warehouse.type || (isProductionInventory ? 'INSUMOS' : 'GENERAL')
        });
      } else {
        setWarehouseData({
          name: '',
          description: '',
          location: '',
          type: isProductionInventory ? 'INSUMOS' : 'GENERAL'
        });
      }
    }
  }, [isOpen, warehouse, mode, isProductionInventory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(warehouseData);
  };

  const isEdit = mode === 'edit';
  const typesToShow = isProductionInventory ? WAREHOUSE_TYPES : [WAREHOUSE_TYPES[2]]; // Solo GENERAL si no es producción

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
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Warehouse className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">
                  {isEdit ? `Editar ${labelBodega}` : `Crear ${labelBodega}`}
                </h3>
              </div>
              <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1 transition">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Tipo de bodega — solo en inventarios de producción */}
              {isProductionInventory && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Tipo de bodega *
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {WAREHOUSE_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = warehouseData.type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setWarehouseData(w => ({ ...w, type: type.value }))}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? `${type.selectedBorder} ${type.selectedBg}`
                              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${type.iconBg} flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${type.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {type.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{type.description}</p>
                          </div>
                          {isSelected && (
                            <div className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre de la bodega *
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  value={warehouseData.name}
                  onChange={(e) => setWarehouseData((w) => ({ ...w, name: e.target.value }))}
                  placeholder={
                    warehouseData.type === 'MOSTRADOR' ? 'Ej: Mostrador, Vitrina...' :
                    warehouseData.type === 'INSUMOS' ? 'Ej: Insumos, Almacén...' :
                    'Ej: Bodega Central, Almacén Norte...'
                  }
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Descripción
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">(Opcional)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  rows={2}
                  value={warehouseData.description}
                  onChange={(e) => setWarehouseData((w) => ({ ...w, description: e.target.value }))}
                  placeholder="Descripción opcional..."
                />
              </div>

              {/* Ubicación */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Ubicación
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">(Opcional)</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  value={warehouseData.location}
                  onChange={(e) => setWarehouseData((w) => ({ ...w, location: e.target.value }))}
                  placeholder="Ej: Planta baja, Sector A..."
                />
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
                  className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-md bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600 transition font-medium shadow-md hover:shadow-lg"
                >
                  {isEdit ? '✓ Actualizar bodega' : '✓ Crear bodega'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
