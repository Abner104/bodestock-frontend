// src/utils/inventory/inventoryValidators.js
/**
 * Validadores de negocio para inventario
 * Funciones puras que retornan { isValid, errors }
 */

import { VALIDATION_LIMITS, ERROR_MESSAGES } from './inventoryConstants.js';

/**
 * Valida los datos de un producto
 * @param {Object} productData - Datos del producto
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validateProduct = (productData) => {
  const errors = {};

  // Nombre (requerido)
  if (!productData.name || productData.name.trim() === '') {
    errors.name = ERROR_MESSAGES.REQUIRED_FIELD;
  } else if (productData.name.length > VALIDATION_LIMITS.MAX_PRODUCT_NAME_LENGTH) {
    errors.name = ERROR_MESSAGES.MAX_LENGTH(VALIDATION_LIMITS.MAX_PRODUCT_NAME_LENGTH);
  }

  // Bodega (requerida, excepto para productos elaborados que no tienen bodega)
  if (!productData.warehouseId && productData.productType !== 'ELABORADO') {
    errors.warehouseId = ERROR_MESSAGES.NO_WAREHOUSE_SELECTED;
  }

  // Stock (debe ser número no negativo)
  if (productData.stock !== undefined && productData.stock !== null) {
    const stock = Number(productData.stock);
    if (isNaN(stock)) {
      errors.stock = ERROR_MESSAGES.INVALID_NUMBER;
    } else if (stock < VALIDATION_LIMITS.MIN_STOCK) {
      errors.stock = ERROR_MESSAGES.MIN_VALUE(VALIDATION_LIMITS.MIN_STOCK);
    } else if (stock > VALIDATION_LIMITS.MAX_STOCK) {
      errors.stock = ERROR_MESSAGES.MAX_VALUE(VALIDATION_LIMITS.MAX_STOCK);
    }
  }

  // PPP (debe ser número no negativo)
  if (productData.ppp !== undefined && productData.ppp !== null) {
    const ppp = Number(productData.ppp);
    if (isNaN(ppp)) {
      errors.ppp = ERROR_MESSAGES.INVALID_NUMBER;
    } else if (ppp < VALIDATION_LIMITS.MIN_PRICE) {
      errors.ppp = ERROR_MESSAGES.MIN_VALUE(VALIDATION_LIMITS.MIN_PRICE);
    } else if (ppp > VALIDATION_LIMITS.MAX_PRICE) {
      errors.ppp = ERROR_MESSAGES.MAX_VALUE(VALIDATION_LIMITS.MAX_PRICE);
    }
  }

  // SKU (longitud máxima)
  if (productData.sku && productData.sku.length > VALIDATION_LIMITS.MAX_SKU_LENGTH) {
    errors.sku = ERROR_MESSAGES.MAX_LENGTH(VALIDATION_LIMITS.MAX_SKU_LENGTH);
  }

  // Proveedor (longitud máxima)
  if (productData.provider && productData.provider.length > VALIDATION_LIMITS.MAX_PROVIDER_LENGTH) {
    errors.provider = ERROR_MESSAGES.MAX_LENGTH(VALIDATION_LIMITS.MAX_PROVIDER_LENGTH);
  }

  // Fecha de vencimiento (debe ser fecha válida)
  if (productData.expiryDate) {
    const date = new Date(productData.expiryDate);
    if (isNaN(date.getTime())) {
      errors.expiryDate = ERROR_MESSAGES.INVALID_DATE;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Valida los datos de una bodega
 * @param {Object} warehouseData - Datos de la bodega
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validateWarehouse = (warehouseData) => {
  const errors = {};

  // Nombre (requerido)
  if (!warehouseData.name || warehouseData.name.trim() === '') {
    errors.name = ERROR_MESSAGES.REQUIRED_FIELD;
  } else if (warehouseData.name.length > 100) {
    errors.name = ERROR_MESSAGES.MAX_LENGTH(100);
  }

  // Descripción (longitud máxima)
  if (warehouseData.description && warehouseData.description.length > 500) {
    errors.description = ERROR_MESSAGES.MAX_LENGTH(500);
  }

  // Ubicación (longitud máxima)
  if (warehouseData.location && warehouseData.location.length > 200) {
    errors.location = ERROR_MESSAGES.MAX_LENGTH(200);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Valida los datos de una compra
 * @param {Object} purchaseData - Datos de la compra
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validatePurchase = (purchaseData) => {
  const errors = {};

  // Cantidad (requerida, mayor a 0)
  if (!purchaseData.qty || purchaseData.qty <= 0) {
    errors.qty = 'La cantidad debe ser mayor a 0';
  } else if (isNaN(Number(purchaseData.qty))) {
    errors.qty = ERROR_MESSAGES.INVALID_NUMBER;
  }

  // Precio (requerido, mayor a 0)
  if (!purchaseData.price || purchaseData.price <= 0) {
    errors.price = 'El precio debe ser mayor a 0';
  } else if (isNaN(Number(purchaseData.price))) {
    errors.price = ERROR_MESSAGES.INVALID_NUMBER;
  }

  // Fecha de vencimiento (opcional, pero si existe debe ser válida)
  if (purchaseData.expiryDate) {
    const date = new Date(purchaseData.expiryDate);
    if (isNaN(date.getTime())) {
      errors.expiryDate = ERROR_MESSAGES.INVALID_DATE;
    } else {
      // Validar que la fecha no sea en el pasado
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (date < now) {
        errors.expiryDate = 'La fecha de vencimiento no puede ser en el pasado';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Valida los datos de una transferencia
 * @param {Object} transferData - Datos de la transferencia
 * @param {Object} currentItem - Item actual con su stock
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validateTransfer = (transferData, currentItem) => {
  const errors = {};

  // Cantidad (requerida, mayor a 0)
  if (!transferData.quantity || transferData.quantity <= 0) {
    errors.quantity = 'La cantidad debe ser mayor a 0';
  } else if (isNaN(Number(transferData.quantity))) {
    errors.quantity = ERROR_MESSAGES.INVALID_NUMBER;
  } else if (transferData.quantity > currentItem.stock) {
    errors.quantity = ERROR_MESSAGES.INSUFFICIENT_STOCK;
  }

  // Bodegas (requeridas)
  if (!transferData.fromWarehouseId || !transferData.toWarehouseId) {
    errors.warehouses = 'Debes seleccionar ambas bodegas';
  } else if (transferData.fromWarehouseId === transferData.toWarehouseId) {
    errors.warehouses = ERROR_MESSAGES.SAME_WAREHOUSE;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Valida los datos de una merma
 * @param {Object} shrinkageData - Datos de la merma
 * @param {Object} currentItem - Item actual con su stock
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validateShrinkage = (shrinkageData, currentItem) => {
  const errors = {};

  // Cantidad (requerida, mayor a 0)
  if (!shrinkageData.quantity || shrinkageData.quantity <= 0) {
    errors.quantity = 'La cantidad debe ser mayor a 0';
  } else if (isNaN(Number(shrinkageData.quantity))) {
    errors.quantity = ERROR_MESSAGES.INVALID_NUMBER;
  } else if (shrinkageData.quantity > currentItem.stock) {
    errors.quantity = ERROR_MESSAGES.INSUFFICIENT_STOCK;
  }

  // Razón (requerida)
  if (!shrinkageData.reason) {
    errors.reason = ERROR_MESSAGES.REQUIRED_FIELD;
  }

  // Notas (longitud máxima)
  if (shrinkageData.notes && shrinkageData.notes.length > 500) {
    errors.notes = ERROR_MESSAGES.MAX_LENGTH(500);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Valida una presentación
 * @param {string} name - Nombre de la presentación
 * @param {number} factor - Factor de conversión
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validatePresentation = (name, factor) => {
  const errors = {};

  // Nombre (requerido)
  if (!name || name.trim() === '') {
    errors.name = ERROR_MESSAGES.REQUIRED_FIELD;
  } else if (name.length > 100) {
    errors.name = ERROR_MESSAGES.MAX_LENGTH(100);
  }

  // Factor (debe ser número mayor a 0)
  const factorNum = parseFloat(factor);
  if (isNaN(factorNum) || factorNum <= 0) {
    errors.factor = 'El factor debe ser un número mayor a 0';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Valida campos personalizados
 * @param {string} key - Clave del campo
 * @param {string} value - Valor del campo
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export const validateCustomField = (key, value) => {
  const errors = {};

  // Clave (requerida)
  if (!key || key.trim() === '') {
    errors.key = ERROR_MESSAGES.REQUIRED_FIELD;
  } else if (key.length > VALIDATION_LIMITS.MAX_CUSTOM_FIELD_KEY_LENGTH) {
    errors.key = ERROR_MESSAGES.MAX_LENGTH(VALIDATION_LIMITS.MAX_CUSTOM_FIELD_KEY_LENGTH);
  }

  // Valor (requerido)
  if (!value || value.trim() === '') {
    errors.value = ERROR_MESSAGES.REQUIRED_FIELD;
  } else if (value.length > VALIDATION_LIMITS.MAX_CUSTOM_FIELD_VALUE_LENGTH) {
    errors.value = ERROR_MESSAGES.MAX_LENGTH(VALIDATION_LIMITS.MAX_CUSTOM_FIELD_VALUE_LENGTH);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
