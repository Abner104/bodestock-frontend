// src/components/inventory/modals/ProductWizardModal/StepBasicInfo.jsx

import React from 'react';
import { motion } from 'framer-motion';

const PRODUCTION_TYPES = ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'];

const CATEGORY_BY_TYPE = {
  fashion: ['Ropa', 'Calzado', 'Accesorios', 'Ropa Mujer', 'Ropa Hombre', 'Ropa Niño', 'Ropa Niña'],
  WHOLESALE: ['Abarrotes', 'Bebidas', 'Limpieza', 'Lácteos', 'Congelados', 'Snacks', 'Otros'],
  RETAIL: ['Abarrotes', 'Bebidas', 'Limpieza', 'Snacks', 'Frutas y Verduras', 'Otros'],
  default: ['Licores', 'Insumo', 'Bebidas', 'Producto', 'Alimentos', 'Limpieza'],
};

const UNIT_BY_TYPE = {
  fashion: [
    { value: 'prenda', label: 'prenda' },
    { value: 'par', label: 'par (calzado)' },
    { value: 'unidad', label: 'unidad' },
    { value: 'set', label: 'set / conjunto' },
  ],
  production: [
    { value: 'ml', label: 'ml (mililitros)' },
    { value: 'g', label: 'g (gramos)' },
    { value: 'kg', label: 'kg (kilogramos)' },
    { value: 'unidad', label: 'unidad' },
    { value: 'litro', label: 'litro' },
  ],
  default: [
    { value: 'unidad', label: 'unidad' },
    { value: 'caja', label: 'caja' },
    { value: 'kg', label: 'kg (kilogramos)' },
    { value: 'litro', label: 'litro' },
    { value: 'ml', label: 'ml (mililitros)' },
  ],
};

const PLACEHOLDER_NAME_BY_TYPE = {
  fashion: 'Ej: Polera manga corta, Jean slim, Vestido floral...',
  WHOLESALE: 'Ej: Arroz 1kg, Aceite 1L, Detergente...',
  RETAIL: 'Ej: Coca-Cola 1.5L, Pan molde, Shampoo...',
  default: 'Ej: Pisco 35°, Ron Blanco, Huevos...',
};

const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '34', '36', '38', '40', '42', '44', 'Único'];
const COLORES_SUGERIDOS = ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Beige', 'Café', 'Rosado', 'Amarillo', 'Morado', 'Naranja'];

export default function StepBasicInfo({ formData, updateFormData, warehouses = [], inventoryType = null, existingItems = [] }) {
  const isProduction = PRODUCTION_TYPES.includes(inventoryType);
  const isFashion = inventoryType === 'fashion';
  const hasPrintStations = ['RESTAURANT', 'CAFETERIA'].includes(inventoryType);

  // Categorías reales del inventario + sugerencias por tipo (sin duplicados)
  const existingCategories = [...new Set(existingItems.map(p => p.category).filter(Boolean))].sort();
  const defaultSuggestions = CATEGORY_BY_TYPE[inventoryType] || CATEGORY_BY_TYPE.default;
  const categories = [...new Set([...existingCategories, ...defaultSuggestions])];
  const units = isProduction
    ? UNIT_BY_TYPE.production
    : isFashion
      ? UNIT_BY_TYPE.fashion
      : UNIT_BY_TYPE.default;

  const placeholderName = PLACEHOLDER_NAME_BY_TYPE[inventoryType] || PLACEHOLDER_NAME_BY_TYPE.default;
  const labelBodega = isFashion ? 'Local *' : 'Bodega *';
  const labelUnidad = isProduction ? 'Unidad base para recetas *' : 'Unidad de venta *';
  const hintUnidad = isProduction
    ? '💡 Usa la unidad más pequeña: ml (no botella), g (no paquete)'
    : '💡 Ej: unidad, caja, kg, litro, bolsa';

  // Categoría por defecto al abrir si no hay valor aún
  const defaultCategory = isFashion ? 'Ropa' : isProduction ? 'Insumo' : 'Producto';
  const defaultUnit = isFashion ? 'prenda' : isProduction ? 'ml' : 'unidad';

  return (
    <motion.div
      className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
          1
        </span>
        Información del Producto
      </h4>

      <div className="space-y-3">
        {/* Nombre */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            📦 Nombre *
          </label>
          <input
            required
            type="text"
            className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            value={formData.name}
            onChange={(e) => updateFormData({ name: e.target.value })}
            placeholder={placeholderName}
          />
        </div>

        {/* Talla y Color — solo fashion */}
        {isFashion && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                📐 Talla
              </label>
              <input
                type="text"
                list="talla-suggestions"
                className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                value={formData._talla || ''}
                onChange={(e) => {
                  const talla = e.target.value;
                  updateFormData({ _talla: talla });
                }}
                placeholder="S, M, L, XL..."
              />
              <datalist id="talla-suggestions">
                {TALLAS_SUGERIDAS.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                🎨 Color
              </label>
              <input
                type="text"
                list="color-suggestions"
                className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                value={formData._color || ''}
                onChange={(e) => {
                  const color = e.target.value;
                  updateFormData({ _color: color });
                }}
                placeholder="Negro, Blanco..."
              />
              <datalist id="color-suggestions">
                {COLORES_SUGERIDOS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
        )}

        {/* Categoría y Bodega */}
        <div className="grid grid-cols-2 gap-3">
          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              🏷️ Categoría
            </label>
            <input
              type="text"
              list="category-suggestions"
              className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              value={formData.category}
              onChange={(e) => updateFormData({ category: e.target.value })}
              placeholder={isFashion ? 'Ej: Ropa, Calzado...' : 'Ej: Abarrotes, Bebidas...'}
            />
            <datalist id="category-suggestions">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Bodega / Local */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              📍 {labelBodega}
            </label>
            <select
              required
              className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              value={formData.warehouseId}
              onChange={(e) => updateFormData({ warehouseId: e.target.value })}
            >
              <option value="">Seleccionar...</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Unidad de medida — oculta en fashion (siempre "prenda") */}
        {!isFashion && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              📏 {labelUnidad}
            </label>
            <input
              type="text"
              list="unit-suggestions"
              className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              value={formData.unit}
              onChange={(e) => updateFormData({ unit: e.target.value })}
              placeholder={isProduction ? 'ml, g, kg, unidad, litro' : 'unidad, caja, kg...'}
            />
            <datalist id="unit-suggestions">
              {units.map(unit => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hintUnidad}</p>
          </div>
        )}

        {/* Descripción -- antes no existía en ningún modal de producto
            (ni este ni ProductoElaboradoModal.jsx); PublicStore.jsx ya leía
            este campo del catálogo pero nunca había forma de llenarlo. */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            📝 Descripción <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => updateFormData({ description: e.target.value })}
            placeholder="Ej: Jugo natural de naranja, sin azúcar agregada, 350ml..."
            rows={2}
            maxLength={300}
            className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none"
          />
        </div>

        {/* Estación de impresión — solo restaurantes/cafeterías con cocina y bar separados */}
        {hasPrintStations && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              🖨️ ¿A qué estación se imprime?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'kitchen', label: '🍳 Cocina' },
                { value: 'bar', label: '🍹 Bar' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFormData({ printStation: opt.value })}
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    (formData.printStation || 'kitchen') === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Define en qué impresora aparece este producto cuando un garzón lo pide
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
