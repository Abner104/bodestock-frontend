// src/components/ContextTracker.jsx
import { useEffect } from 'react';
import { useRecentActions } from '../hooks/useAssistantContext';

/**
 * Componente invisible que rastrea acciones del usuario
 * Úsalo en componentes que realizan acciones importantes
 *
 * Ejemplo de uso:
 *
 * import { ContextTracker } from './ContextTracker';
 *
 * function MiComponente() {
 *   const tracker = ContextTracker.useTracker();
 *
 *   const handleCreateProduct = async (product) => {
 *     // ... crear producto
 *     tracker.track({
 *       type: 'product_created',
 *       description: `Creó producto "${product.name}"`
 *     });
 *   };
 * }
 */

export const ContextTracker = {
  // Hook para usar el tracker
  useTracker: () => {
    const { addAction } = useRecentActions();

    return {
      track: (action) => {
        if (!action.type || !action.description) {
          console.warn('ContextTracker: action debe tener type y description');
          return;
        }
        addAction(action);
      }
    };
  }
};

/**
 * Componente wrapper que auto-rastrea acciones
 * Útil para componentes específicos
 */
export const WithContextTracking = ({ children, onAction }) => {
  const { addAction } = useRecentActions();

  useEffect(() => {
    if (onAction) {
      const wrappedAction = (action) => {
        addAction(action);
        onAction(action);
      };
      return () => {}; // cleanup si es necesario
    }
  }, [onAction, addAction]);

  return children;
};

/**
 * Tipos de acciones predefinidas para consistencia
 */
export const ActionTypes = {
  // Productos
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
  PRODUCT_VIEWED: 'product_viewed',

  // Inventario
  STOCK_ADDED: 'stock_added',
  STOCK_REMOVED: 'stock_removed',
  PURCHASE_REGISTERED: 'purchase_registered',

  // Bodegas
  WAREHOUSE_CREATED: 'warehouse_created',
  WAREHOUSE_UPDATED: 'warehouse_updated',

  // Trabajadores
  WORKER_CREATED: 'worker_created',
  WORKER_UPDATED: 'worker_updated',

  // Salidas
  EXIT_CREATED: 'exit_created',
  EXIT_APPROVED: 'exit_approved',

  // Costeo
  COSTING_STARTED: 'costing_started',
  COSTING_COMPLETED: 'costing_completed',

  // Filtros/Navegación
  FILTER_APPLIED: 'filter_applied',
  VIEW_CHANGED: 'view_changed',
  PAGE_VIEWED: 'page_viewed'
};

export default ContextTracker;
