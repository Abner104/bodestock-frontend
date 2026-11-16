// src/hooks/inventory/useTransferOperations.js
/**
 * Hook para operaciones de transferencias entre bodegas
 * Wrapper sobre transferService con manejo de toasts
 */

import { useCallback } from 'react';
import { transferService } from '../../services/inventory/transferService.js';
import { useToast } from '../../components/ui/Toast.jsx';

/**
 * Hook que proporciona funciones para transferir stock entre bodegas
 *
 * @returns {Object} - { transferStock, validateTransfer }
 */
export function useTransferOperations() {
  const toast = useToast();

  /**
   * Transfiere stock entre bodegas
   */
  const transferStock = useCallback(
    async (transferData, currentItem, allItems, warehouses = []) => {
      try {
        const result = await transferService.transferStock(
          transferData,
          currentItem,
          allItems
        );

        // Obtener nombres de bodegas
        const fromWarehouse = warehouses.find(
          (w) => w.id === result.fromWarehouseId
        )?.name || 'Bodega origen';

        const toWarehouse = warehouses.find(
          (w) => w.id === result.toWarehouseId
        )?.name || 'Bodega destino';

        // Mensaje de éxito
        toast.success(
          `✅ Transferencia exitosa: ${result.quantity} ${result.unit} de "${result.productName}" de ${fromWarehouse} a ${toWarehouse}`
        );

        // Mensaje adicional si se creó nuevo producto
        if (result.createdNew) {
          toast.info(`✨ Producto creado en ${toWarehouse}`);
        }

        return result;
      } catch (error) {
        console.error('❌ Error transferring stock:', error);

        if (error.message.includes('Datos inválidos')) {
          toast.error(`⚠️ ${error.message}`);
        } else if (error.message.includes('Stock insuficiente')) {
          toast.error('⚠️ Stock insuficiente para transferir');
        } else {
          toast.error('❌ No se pudo completar la transferencia.');
        }

        throw error;
      }
    },
    [toast]
  );

  /**
   * Valida una transferencia antes de ejecutarla
   */
  const validateTransfer = useCallback((transferData, currentItem) => {
    return transferService.validateTransferBeforeExecute(transferData, currentItem);
  }, []);

  return {
    transferStock,
    validateTransfer
  };
}
