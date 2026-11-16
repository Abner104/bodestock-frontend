// src/hooks/inventory/useInventoryCRUD.js
/**
 * Hook para operaciones CRUD de inventario
 * Wrapper sobre inventoryService con manejo de toasts y estados
 */

import { useCallback } from 'react';
import { inventoryService } from '../../services/inventory/inventoryService.js';
import { useToast } from '../../components/ui/Toast.jsx';

/**
 * Hook que proporciona funciones CRUD para productos de inventario
 *
 * @returns {Object} - { createProduct, updateProduct, deleteProduct }
 */
export function useInventoryCRUD() {
  const toast = useToast();

  /**
   * Crea un nuevo producto
   */
  const createProduct = useCallback(
    async (productData) => {
      try {
        const productId = await inventoryService.createProduct(productData);

        toast.success(`✅ Producto "${productData.name}" creado exitosamente`);

        return productId;
      } catch (error) {
        console.error('❌ Error creating product:', error);

        // Mensajes de error específicos
        if (error.message.includes('Límite alcanzado')) {
          toast.error(`❌ ${error.message}`);
        } else if (error.message.includes('Datos inválidos')) {
          toast.error(`⚠️ ${error.message}`);
        } else {
          toast.error('❌ No se pudo crear el producto. Revisa la consola.');
        }

        throw error;
      }
    },
    [toast]
  );

  /**
   * Actualiza un producto existente
   */
  const updateProduct = useCallback(
    async (productId, productData) => {
      try {
        await inventoryService.updateProduct(productId, productData);

        toast.success(`✅ Producto "${productData.name}" actualizado exitosamente`);
      } catch (error) {
        console.error('❌ Error updating product:', error);

        if (error.message.includes('Datos inválidos')) {
          toast.error(`⚠️ ${error.message}`);
        } else {
          toast.error('❌ No se pudieron guardar los cambios.');
        }

        throw error;
      }
    },
    [toast]
  );

  /**
   * Elimina un producto
   */
  const deleteProduct = useCallback(
    async (productId, productName) => {
      try {
        // Confirmación del usuario
        const confirmed = window.confirm(
          `¿Eliminar "${productName}" del inventario?`
        );

        if (!confirmed) {
          return false;
        }

        await inventoryService.deleteProduct(productId, { name: productName });

        toast.success(`✅ Producto "${productName}" eliminado`);

        return true;
      } catch (error) {
        console.error('❌ Error deleting product:', error);

        if (error.message.includes('Solo los administradores')) {
          toast.error('⚠️ Solo los administradores pueden eliminar productos del inventario');
        } else {
          toast.error('❌ No se pudo eliminar el producto.');
        }

        throw error;
      }
    },
    [toast]
  );

  return {
    createProduct,
    updateProduct,
    deleteProduct
  };
}
