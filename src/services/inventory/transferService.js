// src/services/inventory/transferService.js
/**
 * Servicio de transferencias - Mover stock entre bodegas
 * Maneja la lógica de negocio para transferir productos entre almacenes
 */

import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../companyService.js';
import { validateTransfer } from '../../utils/inventory/inventoryValidators.js';
import { toNum } from '../../utils/inventory/inventoryHelpers.js';

/**
 * Helper: Obtiene la ruta de la colección de inventario
 * @param {string} companyId - ID de la empresa
 * @param {string} inventoryId - ID del inventario (opcional)
 * @returns {string} - Ruta de la colección
 */
function getInventoryPath(companyId, inventoryId = null) {
  return inventoryId
    ? `companies/${companyId}/inventories/${inventoryId}/products`
    : `companies/${companyId}/inventory`;
}

/**
 * Servicio de transferencias
 */
export const transferService = {
  /**
   * Transfiere stock de un producto entre bodegas
   * - Reduce stock en bodega origen
   * - Aumenta o crea producto en bodega destino
   * - Mantiene el PPP del producto original
   *
   * @param {Object} transferData - Datos de la transferencia
   * @param {string} transferData.productId - ID del producto a transferir
   * @param {string} transferData.fromWarehouseId - ID bodega origen
   * @param {string} transferData.toWarehouseId - ID bodega destino
   * @param {number} transferData.quantity - Cantidad a transferir
   * @param {Object} currentItem - Datos actuales del producto
   * @param {Array} allItems - Todos los productos (para buscar en destino)
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<Object>} - { fromWarehouseName, toWarehouseName, quantity, createdNew }
   * @throws {Error} - Si falla la validación o la transferencia
   */
  async transferStock(transferData, currentItem, allItems, options = {}) {
    try {
      const { inventoryId = null } = options;
      if (!transferData.productId) {
        throw new Error('ID de producto es requerido');
      }

      if (!currentItem) {
        throw new Error('Datos actuales del producto son requeridos');
      }

      // 1. Validar datos de transferencia
      const validation = validateTransfer(transferData, currentItem);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      const qty = toNum(transferData.quantity);

      // 2. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 3. Reducir stock en bodega origen
      const inventoryPath = getInventoryPath(companyId, inventoryId);
      const fromRef = doc(
        db,
        inventoryPath,
        transferData.productId
      );

      await updateDoc(fromRef, {
        stock: currentItem.stock - qty,
        updatedAt: serverTimestamp(),
      });

      console.log(
        `📦 Stock reducido en origen: ${currentItem.stock} → ${currentItem.stock - qty}`
      );

      // 4. Buscar si ya existe el producto en la bodega destino
      const existingInDestination = allItems.find(
        it =>
          it.name === currentItem.name &&
          it.warehouseId === transferData.toWarehouseId
      );

      let createdNew = false;

      if (existingInDestination) {
        // 4a. Aumentar stock del item existente en destino
        const toRef = doc(
          db,
          inventoryPath,
          existingInDestination.id
        );

        await updateDoc(toRef, {
          stock: existingInDestination.stock + qty,
          updatedAt: serverTimestamp(),
        });

        console.log(
          `📦 Stock aumentado en destino: ${existingInDestination.stock} → ${existingInDestination.stock + qty}`
        );
      } else {
        // 4b. Crear nuevo item en bodega destino
        const newProductData = {
          name: currentItem.name,
          sku: currentItem.sku || null,
          category: currentItem.category,
          unit: currentItem.unit,
          stock: qty,
          ppp: currentItem.ppp, // Mantener el mismo PPP
          provider: currentItem.provider || "",
          warehouseId: transferData.toWarehouseId,
          history: [],
          createdAt: serverTimestamp(),
        };

        // Copiar presentaciones si existen
        if (currentItem.presentations && currentItem.presentations.length > 0) {
          newProductData.presentations = currentItem.presentations;
        }

        // Copiar fecha de vencimiento si existe
        if (currentItem.expiryDate) {
          newProductData.expiryDate = currentItem.expiryDate;
        }

        // Copiar campos personalizados si existen
        if (currentItem.customFields && Object.keys(currentItem.customFields).length > 0) {
          newProductData.customFields = currentItem.customFields;
        }

        await addDoc(
          collection(db, inventoryPath),
          newProductData
        );

        createdNew = true;

        console.log(
          `✨ Producto creado en destino con stock: ${qty}`
        );
      }

      console.log(
        `✅ Transferencia completada: ${qty} ${currentItem.unit} de "${currentItem.name}"`
      );

      return {
        quantity: qty,
        unit: currentItem.unit,
        productName: currentItem.name,
        createdNew,
        fromWarehouseId: transferData.fromWarehouseId,
        toWarehouseId: transferData.toWarehouseId
      };
    } catch (error) {
      console.error('❌ Error transferring stock:', error);
      throw error;
    }
  },

  /**
   * Valida si una transferencia es posible antes de ejecutarla
   * Útil para mostrar warnings en la UI
   *
   * @param {Object} transferData - Datos de la transferencia
   * @param {Object} currentItem - Producto actual
   * @returns {Object} - { canTransfer, warnings }
   */
  validateTransferBeforeExecute(transferData, currentItem) {
    const warnings = [];

    // Verificar stock suficiente
    if (transferData.quantity > currentItem.stock) {
      warnings.push(
        `Stock insuficiente. Tienes ${currentItem.stock} ${currentItem.unit}, ` +
        `intentas transferir ${transferData.quantity} ${currentItem.unit}`
      );
    }

    // Verificar que las bodegas sean diferentes
    if (transferData.fromWarehouseId === transferData.toWarehouseId) {
      warnings.push('Las bodegas de origen y destino deben ser diferentes');
    }

    // Warning si el producto tiene vencimiento cercano
    if (currentItem.expiryDate) {
      const expiry = currentItem.expiryDate.toDate
        ? currentItem.expiryDate.toDate()
        : new Date(currentItem.expiryDate);
      const daysUntilExpiry = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 7) {
        warnings.push(
          `⚠️ Este producto vence en ${daysUntilExpiry} día(s). ` +
          `Considera esto al transferir.`
        );
      }
    }

    return {
      canTransfer: warnings.length === 0,
      warnings
    };
  }
};
