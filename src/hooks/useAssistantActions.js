// src/hooks/useAssistantActions.js
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

/**
 * Hook para ejecutar acciones del agente AI en la interfaz
 * Este hook permite al agente interactuar con formularios, modales y navegación
 */
export const useAssistantActions = () => {
  const navigate = useNavigate();

  /**
   * Navegación a páginas específicas
   */
  const navigateTo = useCallback((path) => {
    navigate(path);
    toast.info(`Navegando a ${path}`);
  }, [navigate]);

  /**
   * Abrir modal de crear producto con datos pre-rellenados
   */
  const openCreateProductModal = useCallback((productData) => {
    // Disparar evento custom que el componente Inventory puede escuchar
    window.dispatchEvent(new CustomEvent('assistant:openProductModal', {
      detail: { mode: 'add', data: productData }
    }));
  }, []);

  /**
   * Abrir modal de registrar compra con datos pre-rellenados
   */
  const openPurchaseModal = useCallback((purchaseData) => {
    window.dispatchEvent(new CustomEvent('assistant:openPurchaseModal', {
      detail: purchaseData
    }));
  }, []);

  /**
   * Abrir modal de crear bodega
   */
  const openWarehouseModal = useCallback((warehouseData) => {
    window.dispatchEvent(new CustomEvent('assistant:openWarehouseModal', {
      detail: warehouseData
    }));
  }, []);

  /**
   * Abrir wizard de costeo con producto específico
   */
  const openCostingWizard = useCallback((productData) => {
    // Navegar al wizard con query params
    const params = new URLSearchParams();
    if (productData.nombre) params.set('nombre', productData.nombre);
    if (productData.cantidad) params.set('cantidad', productData.cantidad);
    if (productData.precio) params.set('precio', productData.precio);

    navigate(`/costeo?${params.toString()}`);
    toast.info('✨ Abriendo wizard de costeo con tus datos');
  }, [navigate]);

  /**
   * Mostrar toast con información
   */
  const showToast = useCallback((message, type = 'info') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      default:
        toast.info(message);
    }
  }, []);

  /**
   * Ejecutar acción basada en el tipo
   */
  const executeAction = useCallback((action) => {
    const { type, data } = action;

    switch (type) {
      case 'navigate':
        navigateTo(data.path);
        break;

      case 'openProductModal':
        openCreateProductModal(data);
        break;

      case 'openPurchaseModal':
        openPurchaseModal(data);
        break;

      case 'openWarehouseModal':
        openWarehouseModal(data);
        break;

      case 'openCostingWizard':
        openCostingWizard(data);
        break;

      case 'toast':
        showToast(data.message, data.type);
        break;

      default:
        console.warn('Acción desconocida:', type);
    }
  }, [navigateTo, openCreateProductModal, openPurchaseModal, openWarehouseModal, openCostingWizard, showToast]);

  return {
    executeAction,
    navigateTo,
    openCreateProductModal,
    openPurchaseModal,
    openWarehouseModal,
    openCostingWizard,
    showToast
  };
};

/**
 * Tipos de acciones disponibles
 */
export const AssistantActionTypes = {
  NAVIGATE: 'navigate',
  OPEN_PRODUCT_MODAL: 'openProductModal',
  OPEN_PURCHASE_MODAL: 'openPurchaseModal',
  OPEN_WAREHOUSE_MODAL: 'openWarehouseModal',
  OPEN_COSTING_WIZARD: 'openCostingWizard',
  TOAST: 'toast'
};

export default useAssistantActions;
