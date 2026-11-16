// src/hooks/inventory/usePurchaseOperations.js
/**
 * Hook para operaciones de compras
 * Wrapper sobre purchaseService con manejo de toasts
 */

import { useCallback } from 'react';
import { purchaseService } from '../../services/inventory/purchaseService.js';
import { useToast } from '../../components/ui/Toast.jsx';

/**
 * Hook que proporciona funciones para registrar compras
 *
 * @returns {Object} - { registerPurchase, getPurchaseHistory, getPurchaseStats }
 */
export function usePurchaseOperations() {
  const toast = useToast();

  /**
   * Registra una compra de producto
   */
  const registerPurchase = useCallback(
    async (productId, purchaseData, currentItem) => {
      try {
        const result = await purchaseService.registerPurchase(
          productId,
          purchaseData,
          currentItem
        );

        // Mostrar mensaje de conversión si aplica
        if (result.conversion) {
          toast.success(
            `🔄 Convertido: ${result.conversion.original} ${result.conversion.presentationName} = ${result.conversion.converted} ${result.conversion.unit}`
          );
        }

        // Mensaje principal
        toast.success(
          `✅ Compra registrada: +${result.convertedQty} ${currentItem.unit} de "${currentItem.name}"`
        );

        // Mensaje adicional si se actualizó vencimiento
        if (result.expiryDateUpdated) {
          toast.info('📅 Fecha de vencimiento actualizada');
        }

        return result;
      } catch (error) {
        console.error('❌ Error registering purchase:', error);

        if (error.message.includes('Datos inválidos')) {
          toast.error(`⚠️ ${error.message}`);
        } else {
          toast.error('❌ No se pudo registrar la compra.');
        }

        throw error;
      }
    },
    [toast]
  );

  /**
   * Obtiene el historial de compras
   */
  const getPurchaseHistory = useCallback((product) => {
    return purchaseService.getPurchaseHistory(product);
  }, []);

  /**
   * Obtiene estadísticas de compras
   */
  const getPurchaseStats = useCallback((product) => {
    return purchaseService.getPurchaseStats(product);
  }, []);

  /**
   * Obtiene la última compra
   */
  const getLastPurchase = useCallback((product) => {
    return purchaseService.getLastPurchase(product);
  }, []);

  return {
    registerPurchase,
    getPurchaseHistory,
    getPurchaseStats,
    getLastPurchase
  };
}
