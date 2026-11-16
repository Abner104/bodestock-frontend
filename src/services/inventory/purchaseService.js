// src/services/inventory/purchaseService.js
/**
 * Servicio de compras - Registro de compras y recalculo de PPP
 * Maneja la lógica de negocio para registrar entradas de inventario
 */

import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../companyService.js';
import { validatePurchase } from '../../utils/inventory/inventoryValidators.js';
import { toNum, calculatePPP } from '../../utils/inventory/inventoryHelpers.js';
import { convertToBaseUnit } from './presentationsService.js';

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
 * Servicio de compras
 */
export const purchaseService = {
  /**
   * Registra una compra de producto
   * - Convierte presentaciones a unidades base
   * - Recalcula el PPP (Precio Promedio Ponderado)
   * - Actualiza el stock
   * - Agrega entrada al historial
   * - [NUEVO] Actualiza fecha de vencimiento si se proporciona
   *
   * @param {string} productId - ID del producto
   * @param {Object} purchaseData - Datos de la compra
   * @param {number} purchaseData.qty - Cantidad comprada
   * @param {number} purchaseData.price - Precio TOTAL de la compra
   * @param {string} purchaseData.presentationId - ID de la presentación (opcional)
   * @param {string} purchaseData.expiryDate - Fecha de vencimiento del lote (opcional)
   * @param {Object} currentItem - Datos actuales del producto
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<Object>} - { newStock, newPPP, convertedQty }
   * @throws {Error} - Si falla la validación o el registro
   */
  async registerPurchase(productId, purchaseData, currentItem, options = {}) {
    try {
      const { inventoryId = null } = options;

      if (!productId) {
        throw new Error('ID de producto es requerido');
      }

      if (!currentItem) {
        throw new Error('Datos actuales del producto son requeridos');
      }

      // 1. Validar datos de compra
      const validation = validatePurchase(purchaseData);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      // 2. Convertir cantidad si es por presentación
      let qty = toNum(purchaseData.qty);
      const price = toNum(purchaseData.price);
      let conversionInfo = null;

      if (purchaseData.presentationId && currentItem.presentations) {
        const presentation = currentItem.presentations.find(
          p => p.id === purchaseData.presentationId
        );

        if (presentation) {
          const originalQty = qty;
          qty = convertToBaseUnit(qty, presentation.id, currentItem.presentations);

          conversionInfo = {
            original: originalQty,
            presentationName: presentation.name,
            converted: qty,
            unit: currentItem.unit
          };

          console.log(
            `🔄 Conversión: ${originalQty} ${presentation.name} = ${qty} ${currentItem.unit}`
          );
        }
      }

      // 3. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 4. Calcular nuevo PPP
      const oldStock = toNum(currentItem.stock);
      const oldPPP = toNum(currentItem.ppp);

      const { newStock, newPPP, pricePerUnit } = calculatePPP(
        oldStock,
        oldPPP,
        qty,
        price
      );

      // 5. Crear entrada en historial
      const historyEntry = {
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        qty,
        price: pricePerUnit, // Precio por unidad de ESTA compra
        totalPrice: price, // Precio total de ESTA compra
        ppp: newPPP, // PPP resultante después de esta compra
        by: "manual",
      };

      // Agregar fecha de vencimiento al historial si se proporcionó
      if (purchaseData.expiryDate) {
        historyEntry.expiryDate = purchaseData.expiryDate;
      }

      const updatedHistory = [...(currentItem.history || []), historyEntry];

      // 6. Preparar datos de actualización
      const updateData = {
        stock: newStock,
        ppp: newPPP,
        history: updatedHistory,
        updatedAt: serverTimestamp(),
      };

      // Actualizar precio de venta si se proporcionó (no afecta el costo/PPP)
      if (purchaseData.salePrice !== undefined && purchaseData.salePrice !== null) {
        updateData.salePrice = toNum(purchaseData.salePrice);
      }

      // 7. [NUEVO] Actualizar fecha de vencimiento del producto si se proporcionó
      // Lógica: Usar la fecha más cercana entre las compras
      if (purchaseData.expiryDate) {
        const newExpiryDate = new Date(purchaseData.expiryDate);

        // Si no hay fecha de vencimiento actual, usar la nueva
        if (!currentItem.expiryDate) {
          updateData.expiryDate = newExpiryDate;
        } else {
          // Si ya hay una, comparar y usar la más cercana
          const currentExpiryDate = currentItem.expiryDate.toDate
            ? currentItem.expiryDate.toDate()
            : new Date(currentItem.expiryDate);

          if (newExpiryDate < currentExpiryDate) {
            updateData.expiryDate = newExpiryDate;
            console.log('⚠️ Actualizada fecha de vencimiento a la más cercana:', newExpiryDate);
          }
        }
      }

      // 8. Actualizar documento en Firestore
      const inventoryPath = getInventoryPath(companyId, inventoryId);
      const ref = doc(db, inventoryPath, productId);
      await updateDoc(ref, updateData);

      // 9. Registrar la compra como documento propio (companies/{id}/purchases)
      // -- el historial del producto (paso 5) no se puede consultar por
      // período/empresa en una sola query, así que se guarda también acá
      // con Timestamp real. Es la fuente que usa accountingAgent.js para el
      // crédito fiscal del IVA estimado (ver estimateMonthlyVAT), sumado a
      // las facturas de proveedores que se suban aparte.
      try {
        const now = new Date();
        await addDoc(collection(db, `companies/${companyId}/purchases`), {
          productId,
          productName: currentItem.name || null,
          qty,
          totalPrice: price,
          pricePerUnit,
          periodo: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          createdAt: serverTimestamp(),
        });
      } catch (purchaseLogError) {
        // No bloquea el registro de la compra si esto falla -- el stock y
        // el PPP ya se actualizaron correctamente en el paso 8.
        console.error('⚠️ No se pudo registrar la compra para el IVA estimado:', purchaseLogError);
      }

      console.log(
        `✅ Compra registrada: +${qty} ${currentItem.unit} de "${currentItem.name}" ` +
        `(Stock: ${oldStock} → ${newStock}, PPP: ${oldPPP} → ${newPPP})`
      );

      return {
        newStock,
        newPPP,
        convertedQty: qty,
        conversion: conversionInfo,
        expiryDateUpdated: !!purchaseData.expiryDate
      };
    } catch (error) {
      console.error('❌ Error registering purchase:', error);
      throw error;
    }
  },

  /**
   * Obtiene el historial de compras de un producto
   *
   * @param {Object} product - Producto con historial
   * @returns {Array} - Array de compras ordenado por fecha (más reciente primero)
   */
  getPurchaseHistory(product) {
    if (!product || !product.history) {
      return [];
    }

    return product.history
      .filter(h => h.qty && h.qty > 0) // Solo compras (no mermas)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Más reciente primero
  },

  /**
   * Calcula estadísticas del historial de compras
   *
   * @param {Object} product - Producto con historial
   * @returns {Object} - { totalPurchases, totalQuantity, totalSpent, averagePrice }
   */
  getPurchaseStats(product) {
    const history = this.getPurchaseHistory(product);

    if (history.length === 0) {
      return {
        totalPurchases: 0,
        totalQuantity: 0,
        totalSpent: 0,
        averagePrice: 0
      };
    }

    const totalQuantity = history.reduce((sum, h) => sum + (h.qty || 0), 0);
    const totalSpent = history.reduce((sum, h) => sum + (h.totalPrice || 0), 0);
    const averagePrice = totalQuantity > 0 ? totalSpent / totalQuantity : 0;

    return {
      totalPurchases: history.length,
      totalQuantity,
      totalSpent,
      averagePrice
    };
  },

  /**
   * Obtiene la última compra de un producto
   *
   * @param {Object} product - Producto con historial
   * @returns {Object|null} - Última compra o null si no hay historial
   */
  getLastPurchase(product) {
    const history = this.getPurchaseHistory(product);
    return history.length > 0 ? history[0] : null;
  }
};
