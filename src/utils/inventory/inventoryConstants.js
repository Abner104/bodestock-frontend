// src/utils/inventory/inventoryConstants.js
/**
 * Constantes del dominio de inventario
 * Valores estáticos reutilizables en toda la app
 */

/**
 * Categorías sugeridas para productos
 */
export const PRODUCT_CATEGORIES = [
  'Licores',
  'Insumo',
  'Bebidas',
  'Producto',
  'Alimentos',
  'Limpieza',
  'Otros'
];

/**
 * Unidades de medida sugeridas
 */
export const UNIT_SUGGESTIONS = [
  'ml',
  'litro',
  'g',
  'kg',
  'unidad',
  'caja',
  'paquete',
  'bolsa'
];

/**
 * Razones de merma/desperdicio
 */
export const SHRINKAGE_REASONS = [
  { value: 'vencido', label: 'Producto vencido' },
  { value: 'dañado', label: 'Producto dañado' },
  { value: 'robo', label: 'Robo/Pérdida' },
  { value: 'error_conteo', label: 'Error de conteo' },
  { value: 'deterioro', label: 'Deterioro natural' },
  { value: 'otros', label: 'Otros motivos' }
];

/**
 * Opciones de ordenamiento
 */
export const SORT_OPTIONS = [
  { value: 'name', label: 'Nombre' },
  { value: 'stock', label: 'Stock' },
  { value: 'ppp', label: 'Precio' },
  { value: 'totalValue', label: 'Valor Total' },
  { value: 'createdAt', label: 'Fecha de Creación' }
];

/**
 * Umbrales predeterminados de stock
 */
export const DEFAULT_STOCK_THRESHOLDS = {
  critical: 0,
  low: 5,
  warning: 10
};

/**
 * Opciones de items por página
 */
export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

/**
 * Filtros de rango de stock
 */
export const STOCK_RANGE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'critical', label: 'Stock crítico' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'normal', label: 'Stock normal' },
  { value: 'custom', label: 'Rango personalizado' }
];

/**
 * Tipos de salida de inventario
 */
export const EXIT_REASONS = {
  SALE: { value: 'SALE', label: 'Venta', color: 'green', icon: '💰' },
  WASTE: { value: 'WASTE', label: 'Merma/Desperdicio', color: 'red', icon: '🗑️' },
  TRANSFER: { value: 'TRANSFER', label: 'Transferencia', color: 'blue', icon: '↔️' },
  PRODUCTION: { value: 'PRODUCTION', label: 'Producción', color: 'orange', icon: '🏭' },
  CONSUMPTION: { value: 'CONSUMPTION', label: 'Consumo', color: 'purple', icon: '🍽️' },
  CREDIT: { value: 'CREDIT', label: 'Fiado/Crédito', color: 'yellow', icon: '🤝' },
  OTHER: { value: 'OTHER', label: 'Otro', color: 'gray', icon: '📦' }
};

/**
 * Estados de vencimiento
 */
export const EXPIRY_STATUSES = {
  EXPIRED: { value: 'expired', label: 'Vencido', color: 'red', icon: '🚫' },
  CRITICAL: { value: 'critical', label: 'Vence pronto', color: 'red', icon: '⚠️' },
  WARNING: { value: 'warning', label: 'Por vencer', color: 'yellow', icon: '⏰' },
  OK: { value: 'ok', label: 'OK', color: 'green', icon: '✓' }
};

/**
 * Configuración del wizard de producto
 */
export const PRODUCT_WIZARD_STEPS = [
  { id: 0, name: 'Básico', label: 'Información básica' },
  { id: 1, name: 'Presentación', label: 'Unidad de medida' },
  { id: 2, name: 'Compra', label: 'Stock inicial' },
  { id: 3, name: 'Extras', label: 'Datos adicionales' }
];

/**
 * Límites de validación
 */
export const VALIDATION_LIMITS = {
  MAX_PRODUCT_NAME_LENGTH: 100,
  MAX_SKU_LENGTH: 50,
  MAX_PROVIDER_LENGTH: 100,
  MAX_CUSTOM_FIELD_KEY_LENGTH: 50,
  MAX_CUSTOM_FIELD_VALUE_LENGTH: 200,
  MIN_STOCK: 0,
  MIN_PRICE: 0,
  MAX_STOCK: 999999999,
  MAX_PRICE: 999999999
};

/**
 * Mensajes de error comunes
 */
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'Este campo es requerido',
  INVALID_NUMBER: 'Debe ser un número válido',
  INVALID_DATE: 'Fecha inválida',
  MIN_VALUE: (min) => `El valor mínimo es ${min}`,
  MAX_VALUE: (max) => `El valor máximo es ${max}`,
  MAX_LENGTH: (max) => `Máximo ${max} caracteres`,
  NO_WAREHOUSE_SELECTED: 'Debes seleccionar una bodega',
  INSUFFICIENT_STOCK: 'Stock insuficiente',
  SAME_WAREHOUSE: 'Las bodegas deben ser diferentes',
  WAREHOUSE_HAS_PRODUCTS: 'No puedes eliminar una bodega con productos'
};
