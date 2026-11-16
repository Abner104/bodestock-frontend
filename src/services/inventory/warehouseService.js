// src/services/inventory/warehouseService.js
/**
 * Servicio de bodegas - CRUD de bodegas en Firestore
 * Maneja la lógica de negocio para gestionar bodegas/almacenes
 */

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/firebase.js';
import { getUserCompanyId, checkResourceLimit, getUserRole, isUserSuperAdmin } from '../companyService.js';
import { validateWarehouse } from '../../utils/inventory/inventoryValidators.js';
import { ERROR_MESSAGES } from '../../utils/inventory/inventoryConstants.js';

/**
 * Helper: Obtiene la ruta de la colección de bodegas
 * @param {string} companyId - ID de la empresa
 * @param {string} inventoryId - ID del inventario (opcional)
 * @returns {string} - Ruta de la colección
 */
function getWarehousesPath(companyId, inventoryId = null) {
  return inventoryId
    ? `companies/${companyId}/inventories/${inventoryId}/warehouses`
    : `companies/${companyId}/warehouses`;
}

/**
 * Servicio de bodegas
 */
export const warehouseService = {
  /**
   * Crea una nueva bodega
   *
   * @param {Object} warehouseData - Datos de la bodega { name, description?, location? }
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<string>} - ID de la bodega creada
   * @throws {Error} - Si falla la validación o la creación
   */
  async createWarehouse(warehouseData, options = {}) {
    try {
      const { inventoryId = null } = options;

      // 1. Validar datos
      const validation = validateWarehouse(warehouseData);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      // 2. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 3. Verificar límites del plan
      const limitCheck = await checkResourceLimit('warehouses');
      if (!limitCheck.allowed) {
        throw new Error(
          `Límite alcanzado: Tu plan permite un máximo de ${limitCheck.limit} bodega${limitCheck.limit > 1 ? 's' : ''}. ` +
          `Actualmente tienes ${limitCheck.current}. Actualiza tu plan para crear más bodegas.`
        );
      }

      // 4. Crear documento
      const warehousesPath = getWarehousesPath(companyId, inventoryId);
      const docRef = await addDoc(
        collection(db, warehousesPath),
        {
          name: String(warehouseData.name).trim(),
          description: warehouseData.description || "",
          location: warehouseData.location || "",
          createdAt: serverTimestamp(),
        }
      );

      console.log(`✅ Bodega creada: ${warehouseData.name} (ID: ${docRef.id})`);

      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating warehouse:', error);
      throw error;
    }
  },

  /**
   * Actualiza una bodega existente
   *
   * @param {string} warehouseId - ID de la bodega
   * @param {Object} warehouseData - Datos actualizados
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<void>}
   * @throws {Error} - Si falla la actualización
   */
  async updateWarehouse(warehouseId, warehouseData, options = {}) {
    try {
      const { inventoryId = null } = options;

      if (!warehouseId) {
        throw new Error('ID de bodega es requerido');
      }

      // 1. Validar datos
      const validation = validateWarehouse(warehouseData);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      // 2. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 3. Actualizar documento
      const warehousesPath = getWarehousesPath(companyId, inventoryId);
      const ref = doc(db, warehousesPath, warehouseId);
      await updateDoc(ref, {
        name: String(warehouseData.name).trim(),
        description: warehouseData.description || "",
        location: warehouseData.location || "",
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Bodega actualizada: ${warehouseData.name} (ID: ${warehouseId})`);
    } catch (error) {
      console.error('❌ Error updating warehouse:', error);
      throw error;
    }
  },

  /**
   * Elimina una bodega
   * Valida que no tenga productos antes de eliminar
   *
   * @param {string} warehouseId - ID de la bodega
   * @param {Array} allItems - Array de todos los productos (para validar)
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<void>}
   * @throws {Error} - Si la bodega tiene productos o el usuario no tiene permisos
   */
  async deleteWarehouse(warehouseId, allItems = [], options = {}) {
    try {
      const { inventoryId = null } = options;

      if (!warehouseId) {
        throw new Error('ID de bodega es requerido');
      }

      // 1. Verificar permisos (solo ADMIN o Super Admin)
      const userRole = await getUserRole();
      const isSuperAdmin = await isUserSuperAdmin();

      if (userRole !== 'ADMIN' && !isSuperAdmin) {
        throw new Error('Solo los administradores pueden eliminar bodegas');
      }

      // 2. Verificar si hay productos en esta bodega
      const productsInWarehouse = allItems.filter(item => item.warehouseId === warehouseId);
      if (productsInWarehouse.length > 0) {
        throw new Error(
          `${ERROR_MESSAGES.WAREHOUSE_HAS_PRODUCTS}. Tiene ${productsInWarehouse.length} producto(s) asignado(s). ` +
          `Muévelos o elimínalos primero.`
        );
      }

      // 3. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 4. Eliminar documento
      const warehousesPath = getWarehousesPath(companyId, inventoryId);
      await deleteDoc(doc(db, warehousesPath, warehouseId));

      console.log(`✅ Bodega eliminada: ${warehouseId}`);
    } catch (error) {
      console.error('❌ Error deleting warehouse:', error);
      throw error;
    }
  },

  /**
   * Obtiene el nombre de una bodega por su ID
   *
   * @param {string} warehouseId - ID de la bodega
   * @param {Array} warehouses - Array de bodegas
   * @returns {string} - Nombre de la bodega o "Sin bodega"
   */
  getWarehouseName(warehouseId, warehouses) {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || "Sin bodega";
  },

  /**
   * Obtiene productos de una bodega específica
   *
   * @param {string} warehouseId - ID de la bodega
   * @param {Array} allItems - Array de todos los productos
   * @returns {Array} - Productos de esa bodega
   */
  getWarehouseProducts(warehouseId, allItems) {
    return allItems.filter(item => item.warehouseId === warehouseId);
  },

  /**
   * Calcula estadísticas de una bodega
   *
   * @param {string} warehouseId - ID de la bodega
   * @param {Array} allItems - Array de todos los productos
   * @returns {Object} - { productCount, totalStock, totalValue }
   */
  getWarehouseStats(warehouseId, allItems) {
    const products = this.getWarehouseProducts(warehouseId, allItems);

    return {
      productCount: products.length,
      totalStock: products.reduce((sum, p) => sum + (p.stock || 0), 0),
      totalValue: products.reduce((sum, p) => sum + (p.stock || 0) * (p.ppp || 0), 0)
    };
  }
};
