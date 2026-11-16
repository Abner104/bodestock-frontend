// src/services/inventory/shrinkageService.js
/**
 * Servicio de mermas - Registro de desperdicios y pérdidas
 * Wrapper sobre inventory-exits-service para registrar mermas
 */

import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../companyService.js';
import { registerInventoryExit } from '../inventory-exits-service.js';
import { validateShrinkage } from '../../utils/inventory/inventoryValidators.js';
import { toNum } from '../../utils/inventory/inventoryHelpers.js';
import { SHRINKAGE_REASONS } from '../../utils/inventory/inventoryConstants.js';

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
 * Servicio de mermas
 */
export const shrinkageService = {
  /**
   * Registra una merma/desperdicio
   * - Reduce el stock del producto
   * - Crea entrada en inventory_exits con reason='WASTE'
   * - Agrega entrada en el historial del producto
   *
   * @param {string} productId - ID del producto
   * @param {Object} shrinkageData - Datos de la merma
   * @param {number} shrinkageData.quantity - Cantidad de merma
   * @param {string} shrinkageData.reason - Razón (vencido, dañado, robo, etc.)
   * @param {string} shrinkageData.notes - Notas adicionales (opcional)
   * @param {Object} currentItem - Datos actuales del producto
   * @param {Array} warehouses - Array de bodegas (para obtener nombre)
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<Object>} - { newStock, shrinkageValue, exitId }
   * @throws {Error} - Si falla la validación o el registro
   */
  async registerShrinkage(productId, shrinkageData, currentItem, warehouses = [], options = {}) {
    try {
      const { inventoryId = null } = options;

      if (!productId) {
        throw new Error('ID de producto es requerido');
      }

      if (!currentItem) {
        throw new Error('Datos actuales del producto son requeridos');
      }

      // 1. Validar datos de merma
      const validation = validateShrinkage(shrinkageData, currentItem);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      const quantity = toNum(shrinkageData.quantity);

      // 2. Verificar stock suficiente
      if (quantity > currentItem.stock) {
        throw new Error(
          `Stock insuficiente. Tienes ${currentItem.stock} ${currentItem.unit}, ` +
          `intentas registrar merma de ${quantity} ${currentItem.unit}`
        );
      }

      // 3. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 4. Calcular nuevo stock
      const newStock = Math.max(0, currentItem.stock - quantity);
      const shrinkageValue = quantity * (currentItem.ppp || 0);

      // 5. Actualizar stock del producto
      const inventoryPath = getInventoryPath(companyId, inventoryId);
      const ref = doc(db, inventoryPath, productId);

      // Crear entrada en el historial de merma
      const shrinkageEntry = {
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        quantity: -quantity, // Negativo para indicar pérdida
        reason: shrinkageData.reason,
        notes: shrinkageData.notes || '',
        type: 'shrinkage',
        by: "manual",
      };

      await updateDoc(ref, {
        stock: newStock,
        history: [...(currentItem.history || []), shrinkageEntry],
        updatedAt: serverTimestamp(),
      });

      console.log(
        `📉 Stock reducido por merma: ${currentItem.stock} → ${newStock} ${currentItem.unit}`
      );

      // 6. Registrar salida en inventory_exits para reportes
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'Usuario desconocido';
      const userId = currentUser?.uid || 'unknown';

      const warehouseName = warehouses.find(w => w.id === currentItem.warehouseId)?.name || 'Sin bodega';

      // Obtener label legible de la razón
      const reasonLabel = SHRINKAGE_REASONS.find(r => r.value === shrinkageData.reason)?.label || shrinkageData.reason;

      const exitData = {
        warehouseId: currentItem.warehouseId,
        warehouseName: warehouseName,
        worker: userName,
        workerId: userId,
        reason: 'WASTE', // Tipo de salida: Merma
        reasonName: reasonLabel,
        notes: `Motivo: ${reasonLabel}${shrinkageData.notes ? ' - ' + shrinkageData.notes : ''}`,
        items: [{
          itemId: currentItem.id,
          itemName: currentItem.name,
          quantity: quantity,
          unit: currentItem.unit,
          ppp: currentItem.ppp || 0,
          totalValue: shrinkageValue
        }],
        totalValue: shrinkageValue,
        totalUnits: quantity,
        createdAt: serverTimestamp()
      };

      const exitDocRef = await addDoc(
        collection(db, `companies/${companyId}/inventory_exits`),
        exitData
      );

      console.log(
        `✅ Merma registrada: -${quantity} ${currentItem.unit} de "${currentItem.name}" ` +
        `(${reasonLabel}). Valor: $${shrinkageValue.toFixed(0)}`
      );

      return {
        newStock,
        shrinkageValue,
        quantity,
        unit: currentItem.unit,
        productName: currentItem.name,
        reason: reasonLabel,
        exitId: exitDocRef.id
      };
    } catch (error) {
      console.error('❌ Error registering shrinkage:', error);
      throw error;
    }
  },

  /**
   * Obtiene las razones de merma disponibles
   *
   * @returns {Array} - Array de razones { value, label }
   */
  getShrinkageReasons() {
    return SHRINKAGE_REASONS;
  },

  /**
   * Calcula el valor total de mermas para un producto
   *
   * @param {Object} product - Producto con historial
   * @returns {number} - Valor total de mermas
   */
  calculateTotalShrinkageValue(product) {
    if (!product || !product.history) {
      return 0;
    }

    return product.history
      .filter(h => h.type === 'shrinkage')
      .reduce((sum, h) => {
        const qty = Math.abs(h.quantity || 0);
        const ppp = h.ppp || product.ppp || 0;
        return sum + (qty * ppp);
      }, 0);
  },

  /**
   * Obtiene el historial de mermas de un producto
   *
   * @param {Object} product - Producto con historial
   * @returns {Array} - Array de mermas ordenado por fecha (más reciente primero)
   */
  getShrinkageHistory(product) {
    if (!product || !product.history) {
      return [];
    }

    return product.history
      .filter(h => h.type === 'shrinkage')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
};
