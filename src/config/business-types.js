// src/config/business-types.js
// Tipos de negocio disponibles — usado en el registro (para personalizar el onboarding)
// y al crear un inventario (src/pages/InventoriesManagement.jsx)

export const BUSINESS_TYPES = [
  { value: 'RETAIL',     emoji: '🏪', label: 'Retail / Minimarket',         group: 'directa' },
  { value: 'WHOLESALE',  emoji: '🏭', label: 'Distribuidora / Mayorista',   group: 'directa' },
  { value: 'WAREHOUSE',  emoji: '📦', label: 'Bodega / Almacén',            group: 'directa' },
  { value: 'fashion',    emoji: '👗', label: 'Tienda de Ropa / Fashion',    group: 'directa' },
  { value: 'HELADERIA',  emoji: '🍦', label: 'Heladería / Repostería',      group: 'elaborada' },
  { value: 'CAFETERIA',  emoji: '☕', label: 'Cafetería / Bar',             group: 'elaborada' },
  { value: 'FOODTRUCK',  emoji: '🚚', label: 'Food Truck',                  group: 'elaborada' },
  { value: 'PANADERIA',  emoji: '🥐', label: 'Panadería / Pastelería',      group: 'elaborada' },
  { value: 'RESTAURANT', emoji: '🍽️', label: 'Restaurante / Cocina',        group: 'elaborada' },
  { value: 'OTHER',      emoji: '📋', label: 'Otro',                        group: 'otro' },
];

export const DEFAULT_BUSINESS_TYPE = 'RETAIL';

// Tipos que usan productos elaborados con receta (descuenta ingredientes al vender)
export const PRODUCTION_BUSINESS_TYPES = ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'];

export const isProductionBusinessType = (type) => PRODUCTION_BUSINESS_TYPES.includes(type);
