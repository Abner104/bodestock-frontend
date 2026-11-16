// src/utils/inventory/inventoryHelpers.js
/**
 * Utilidades y helpers puros para inventario
 * Funciones sin dependencias externas, fáciles de testear
 */

/**
 * Formatea un número como moneda chilena (CLP)
 * @param {number} n - Número a formatear
 * @returns {string} - Número formateado como CLP (ej: "$15.000")
 */
export const CLP = (n) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

/**
 * Convierte un valor a número seguro
 * Maneja strings con comas, valores null/undefined
 * @param {any} v - Valor a convertir
 * @returns {number} - Número convertido o 0 si no es válido
 */
export const toNum = (v) => {
  const n = Number(String(v ?? 0).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calcula el estado de vencimiento de un producto
 * @param {Date|Timestamp} expiryDate - Fecha de vencimiento (puede ser Firebase Timestamp)
 * @returns {Object|null} - Objeto con status, días, color, icono y label, o null si no hay fecha
 */
export const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return null;

  const now = new Date();
  const expiry = expiryDate.toDate ? expiryDate.toDate() : new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return {
      status: 'expired',
      days: Math.abs(daysUntilExpiry),
      color: 'red',
      icon: '🚫',
      label: 'Vencido'
    };
  } else if (daysUntilExpiry <= 7) {
    return {
      status: 'critical',
      days: daysUntilExpiry,
      color: 'red',
      icon: '⚠️',
      label: 'Vence pronto'
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      status: 'warning',
      days: daysUntilExpiry,
      color: 'yellow',
      icon: '⏰',
      label: 'Por vencer'
    };
  }

  return {
    status: 'ok',
    days: daysUntilExpiry,
    color: 'green',
    icon: '✓',
    label: 'OK'
  };
};

/**
 * Calcula el valor total del inventario
 * @param {Array} items - Array de productos
 * @returns {number} - Suma de (stock * ppp) de todos los items
 */
export const calculateTotalValue = (items) => {
  return items.reduce((sum, item) => sum + (item.stock || 0) * (item.ppp || 0), 0);
};

/**
 * Determina el estado del stock según umbrales configurados
 * @param {number} stock - Cantidad de stock
 * @param {Object} thresholds - Umbrales { critical, low, warning }
 * @returns {string} - 'critical' | 'low' | 'warning' | 'ok'
 */
export const getStockStatus = (stock, thresholds) => {
  if (stock <= thresholds.critical) return 'critical';
  if (stock <= thresholds.low) return 'low';
  if (stock <= thresholds.warning) return 'warning';
  return 'ok';
};

/**
 * Obtiene el nombre de una bodega desde su ID
 * @param {string} warehouseId - ID de la bodega
 * @param {Array} warehouses - Array de bodegas
 * @returns {string} - Nombre de la bodega o "Sin bodega"
 */
export const getWarehouseName = (warehouseId, warehouses) => {
  const warehouse = warehouses.find(w => w.id === warehouseId);
  return warehouse?.name || "Sin bodega";
};

/**
 * Calcula el PPP (Precio Promedio Ponderado) después de una compra
 * @param {number} oldStock - Stock anterior
 * @param {number} oldPPP - PPP anterior
 * @param {number} newQuantity - Cantidad comprada
 * @param {number} newPrice - Precio total de la compra
 * @returns {Object} - { newStock, newPPP, pricePerUnit }
 */
export const calculatePPP = (oldStock, oldPPP, newQuantity, newPrice) => {
  const totalPrev = oldStock * oldPPP;
  const totalNew = newPrice;
  const newStock = oldStock + newQuantity;
  const newPPP = newStock === 0 ? 0 : Math.round(((totalPrev + totalNew) / newStock) * 100) / 100;
  const pricePerUnit = newQuantity > 0 ? newPrice / newQuantity : 0;

  return {
    newStock,
    newPPP,
    pricePerUnit
  };
};

/**
 * Formatea una fecha como string legible en español
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} - Fecha formateada (ej: "15 de enero de 2025, 10:30")
 */
export const formatDate = (date) => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Trunca un texto si excede la longitud máxima
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} - Texto truncado con "..." si aplica
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
};
