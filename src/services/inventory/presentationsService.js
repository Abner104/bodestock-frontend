// src/services/inventory/presentationsService.js
/**
 * Servicio para gestionar presentaciones de productos
 * Conversiones entre unidades base y presentaciones (cajas, botellas, etc.)
 */

import { validatePresentation } from '../../utils/inventory/inventoryValidators.js';
import { toNum } from '../../utils/inventory/inventoryHelpers.js';

/**
 * Convierte una cantidad de presentación a unidades base
 * Ejemplo: 5 botellas de 500ml → 2500ml
 *
 * @param {number} quantity - Cantidad en presentación
 * @param {string} presentationId - ID de la presentación
 * @param {Array} presentations - Array de presentaciones del producto
 * @returns {number} - Cantidad en unidad base
 */
export const convertToBaseUnit = (quantity, presentationId, presentations) => {
  if (!presentationId || !presentations || presentations.length === 0) {
    return toNum(quantity);
  }

  const presentation = presentations.find(p => p.id === presentationId);

  if (!presentation || !presentation.factor) {
    console.warn(`Presentación ${presentationId} no encontrada, usando cantidad original`);
    return toNum(quantity);
  }

  const baseQuantity = toNum(quantity) * toNum(presentation.factor);

  return baseQuantity;
};

/**
 * Convierte una cantidad de unidades base a presentación
 * Ejemplo: 2500ml → 5 botellas de 500ml
 *
 * @param {number} baseQuantity - Cantidad en unidad base
 * @param {string} presentationId - ID de la presentación
 * @param {Array} presentations - Array de presentaciones del producto
 * @returns {number} - Cantidad en presentación
 */
export const convertFromBaseUnit = (baseQuantity, presentationId, presentations) => {
  if (!presentationId || !presentations || presentations.length === 0) {
    return toNum(baseQuantity);
  }

  const presentation = presentations.find(p => p.id === presentationId);

  if (!presentation || !presentation.factor) {
    console.warn(`Presentación ${presentationId} no encontrada, usando cantidad original`);
    return toNum(baseQuantity);
  }

  const presentationQuantity = toNum(baseQuantity) / toNum(presentation.factor);

  return Math.round(presentationQuantity * 100) / 100; // Redondear a 2 decimales
};

/**
 * Crea un objeto de presentación
 *
 * @param {string} name - Nombre de la presentación (ej: "Botella 500ml")
 * @param {number} factor - Factor de conversión (ej: 500 para 500ml)
 * @returns {Object} - Objeto de presentación { id, name, factor }
 * @throws {Error} - Si la validación falla
 */
export const createPresentation = (name, factor) => {
  // Validar datos
  const validation = validatePresentation(name, factor);
  if (!validation.isValid) {
    const errorMessages = Object.values(validation.errors).join(', ');
    throw new Error(`Presentación inválida: ${errorMessages}`);
  }

  return {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
    name: name.trim(),
    factor: parseFloat(factor)
  };
};

/**
 * Actualiza una presentación existente
 *
 * @param {Array} presentations - Array de presentaciones
 * @param {string} presentationId - ID de la presentación a actualizar
 * @param {Object} updates - Objeto con los cambios { name?, factor? }
 * @returns {Array} - Nuevo array de presentaciones actualizado
 * @throws {Error} - Si la presentación no existe o la validación falla
 */
export const updatePresentation = (presentations, presentationId, updates) => {
  const index = presentations.findIndex(p => p.id === presentationId);

  if (index === -1) {
    throw new Error(`Presentación ${presentationId} no encontrada`);
  }

  const currentPresentation = presentations[index];
  const updatedPresentation = {
    ...currentPresentation,
    ...updates
  };

  // Validar nueva presentación
  const validation = validatePresentation(
    updatedPresentation.name,
    updatedPresentation.factor
  );

  if (!validation.isValid) {
    const errorMessages = Object.values(validation.errors).join(', ');
    throw new Error(`Presentación inválida: ${errorMessages}`);
  }

  // Crear nuevo array con la presentación actualizada
  const newPresentations = [...presentations];
  newPresentations[index] = {
    ...updatedPresentation,
    factor: parseFloat(updatedPresentation.factor)
  };

  return newPresentations;
};

/**
 * Elimina una presentación
 *
 * @param {Array} presentations - Array de presentaciones
 * @param {string} presentationId - ID de la presentación a eliminar
 * @returns {Array} - Nuevo array sin la presentación eliminada
 */
export const deletePresentation = (presentations, presentationId) => {
  return presentations.filter(p => p.id !== presentationId);
};

/**
 * Obtiene el texto descriptivo de una presentación
 * Ejemplo: "1 Botella 500ml = 500 ml"
 *
 * @param {Object} presentation - Objeto de presentación
 * @param {string} baseUnit - Unidad base del producto (ej: "ml")
 * @returns {string} - Texto descriptivo
 */
export const getPresentationDescription = (presentation, baseUnit) => {
  if (!presentation) return '';

  return `1 ${presentation.name} = ${presentation.factor} ${baseUnit}`;
};

/**
 * Calcula el precio por unidad base a partir del precio de presentación
 * Ejemplo: Botella de 500ml a $1500 → $3 por ml
 *
 * @param {number} presentationPrice - Precio de la presentación
 * @param {number} factor - Factor de conversión
 * @returns {number} - Precio por unidad base
 */
export const calculatePricePerBaseUnit = (presentationPrice, factor) => {
  if (factor <= 0) {
    console.warn('Factor de conversión inválido, retornando precio original');
    return toNum(presentationPrice);
  }

  return toNum(presentationPrice) / toNum(factor);
};

/**
 * Calcula el precio de presentación a partir del precio por unidad base
 * Ejemplo: $3 por ml × 500ml → $1500 por botella
 *
 * @param {number} baseUnitPrice - Precio por unidad base
 * @param {number} factor - Factor de conversión
 * @returns {number} - Precio de la presentación
 */
export const calculatePresentationPrice = (baseUnitPrice, factor) => {
  return toNum(baseUnitPrice) * toNum(factor);
};

/**
 * Obtiene todas las presentaciones disponibles para un producto
 * Incluye la unidad base como opción
 *
 * @param {Array} presentations - Array de presentaciones
 * @param {string} baseUnit - Unidad base (ej: "ml")
 * @returns {Array} - Array con todas las opciones (base + presentaciones)
 */
export const getAllPresentationOptions = (presentations = [], baseUnit) => {
  const options = [
    {
      id: null,
      name: `Por ${baseUnit} (unidad base)`,
      factor: 1,
      isBase: true
    }
  ];

  if (presentations && presentations.length > 0) {
    presentations.forEach(presentation => {
      options.push({
        ...presentation,
        isBase: false
      });
    });
  }

  return options;
};

/**
 * Encuentra la presentación más apropiada para una cantidad dada
 * Útil para mostrar stock de forma legible
 * Ejemplo: 2500ml → "5 botellas de 500ml" en lugar de "2500ml"
 *
 * @param {number} baseQuantity - Cantidad en unidad base
 * @param {Array} presentations - Array de presentaciones
 * @param {string} baseUnit - Unidad base
 * @returns {Object} - { quantity, presentation, text }
 */
export const findBestPresentationForDisplay = (baseQuantity, presentations = [], baseUnit) => {
  if (!presentations || presentations.length === 0) {
    return {
      quantity: baseQuantity,
      presentation: null,
      text: `${baseQuantity} ${baseUnit}`
    };
  }

  // Ordenar presentaciones por factor (mayor a menor)
  const sortedPresentations = [...presentations].sort((a, b) => b.factor - a.factor);

  // Buscar la presentación que divida exactamente
  for (const presentation of sortedPresentations) {
    const quantity = baseQuantity / presentation.factor;
    if (Number.isInteger(quantity) && quantity > 0) {
      return {
        quantity,
        presentation,
        text: `${quantity} ${presentation.name} (${baseQuantity} ${baseUnit})`
      };
    }
  }

  // Si no hay división exacta, retornar en unidad base
  return {
    quantity: baseQuantity,
    presentation: null,
    text: `${baseQuantity} ${baseUnit}`
  };
};
