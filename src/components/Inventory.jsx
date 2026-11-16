// src/components/InventoryNew.jsx
/**
 * Componente principal de Inventario - REFACTORIZADO
 * Orquesta todos los módulos y componentes del inventario
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, deleteDoc, addDoc, collection, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from '../services/companyService';
import QRCode from 'qrcode';
import { useToast, ToastContainer } from './ui/Toast.jsx';
import { useTheme } from '../contexts/ThemeContext';

// Hooks
import { useInventoryData } from '../hooks/inventory/useInventoryData';
import { useWarehousesData } from '../hooks/inventory/useWarehousesData';
import { useInventoryFilters } from '../hooks/inventory/useInventoryFilters';
import { usePermissionRequests } from '../hooks/inventory/usePermissionRequests';
import { setActiveInventoryId, usePlanFeatures } from '../hooks/usePlanFeatures';

// Helpers
import { CLP, toNum, getExpiryStatus } from '../utils/inventory/inventoryHelpers';

// Services
import { inventoryService } from '../services/inventory/inventoryService';
import { warehouseService } from '../services/inventory/warehouseService';
import { purchaseService } from '../services/inventory/purchaseService';
import { transferService } from '../services/inventory/transferService';
import { getInventoryById } from '../services/inventories-service';

// UI Components
import InventoryFilters from './inventory/filters/InventoryFilters';
import AdvancedFilters from './inventory/filters/AdvancedFilters';
import PaginationControls from './inventory/ui/PaginationControls';
import EmptyState from './inventory/ui/EmptyState';
import InventoryStats from './inventory/ui/InventoryStats';
import StockAlerts from './inventory/alerts/StockAlerts';

// Grid Components
// ProductGrid / ProductCard reemplazados por VitrinaCarousel (modo inventario) — se conservan por si se revierte:
// import ProductGrid from './inventory/grid/ProductGrid';
// import ProductCard from './inventory/grid/ProductCard';
import ElaboradosGrid from './inventory/grid/ElaboradosGrid';
import VitrinaCarousel from './vitrina/VitrinaCarousel';
import ProductDetailSheet from './vitrina/ProductDetailSheet';
import InventoryKpiBar from './vitrina/InventoryKpiBar';

// Modals
import ProductWizardModal from './inventory/modals/ProductWizardModal';
import ProductoElaboradoModal from './inventory/modals/ProductoElaboradoModal';
import PurchaseModal from './inventory/modals/PurchaseModal';
import TransferModal from './inventory/modals/TransferModal';
import WarehouseModal from './inventory/modals/WarehouseModal';
import HistoryModal from './inventory/modals/HistoryModal';
import ShrinkageModal from './inventory/modals/ShrinkageModal';
import ImportExcelModal from './inventory/modals/ImportExcelModal';
import PermissionRequestNotification from './inventory/notifications/PermissionRequestNotification';
import ImprovedBarcodeScanner from './inventory/ImprovedBarcodeScanner';

export default function Inventory() {
  // Router
  const location = useLocation();
  const navigate = useNavigate();
  const { inventoryId } = useParams(); // Obtener inventoryId desde la URL (opcional)
  const toast = useToast();
  const { isDark } = useTheme();
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => {
    getUserCompanyId().then(cid => setCompanyId(cid)).catch(() => {});
  }, []);

  // Scroll al top al entrar al inventario (evita que el foco en inputs jale la página)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Guardar el inventario activo para que usePlanFeatures aplique features por sucursal
  useEffect(() => {
    setActiveInventoryId(inventoryId || null);
    return () => {
      // Al salir del inventario, limpiar para no arrastrar el override
      setActiveInventoryId(null);
    };
  }, [inventoryId]);

  // Data hooks - pasar inventoryId para soportar múltiples inventarios
  const { items, loading } = useInventoryData(inventoryId);
  const { warehouses, loading: warehousesLoading } = useWarehousesData(inventoryId);
  const { pendingPermissions } = usePermissionRequests();
  const { limits } = usePlanFeatures();

  // Filters hook (maneja toda la lógica de filtrado, ordenamiento y paginación)
  const {
    searchQuery,
    setSearchQuery,
    selectedWarehouse,
    setSelectedWarehouse,
    advancedFilters,
    setAdvancedFilters,
    sortBy,
    sortOrder,
    handleSortChange,
    showAdvancedFilters,
    setShowAdvancedFilters,
    activeFiltersCount,
    clearAllFilters,
    filteredItems,
    paginatedItems,
    currentPage,
    setCurrentPage,
    totalPages,
    uniqueCategories,
    uniqueProviders
  } = useInventoryFilters(items);

  // Modal states
  const [productModal, setProductModal] = useState({ open: false, product: null, mode: 'create' });
  const [elaboradoModal, setElaboradoModal] = useState({ open: false, product: null, mode: 'create' });
  const [purchaseModal, setPurchaseModal] = useState({ open: false, item: null });
  const [transferModal, setTransferModal] = useState({ open: false, item: null });
  const [warehouseModal, setWarehouseModal] = useState({ open: false, warehouse: null, mode: 'create' });
  const [historyModal, setHistoryModal] = useState({ open: false, item: null });
  const [shrinkageModal, setShrinkageModal] = useState({ open: false, item: null });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [qrWarehouseModal, setQrWarehouseModal] = useState(false);
  const [selectedQrWarehouses, setSelectedQrWarehouses] = useState([]);
  const [importLoading, setImportLoading] = useState(false);

  // Tipo de inventario (para mostrar botón de producto elaborado)
  const [inventoryType, setInventoryType] = useState(null);

  const PRODUCTION_TYPES = ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'];
  const isProductionInventory = PRODUCTION_TYPES.includes(inventoryType);
  const isFashionInventory = inventoryType === 'fashion';

  // Labels dinámicos según tipo de inventario
  const labelBodega = isFashionInventory ? 'Local' : 'Bodega';
  const labelBodegas = isFashionInventory ? 'Locales' : 'Bodegas';
  const labelNuevaBodega = isFashionInventory ? 'Nuevo local' : 'Nueva bodega';
  const labelAgregarBodega = isFashionInventory ? 'Agregar Local' : 'Agregar Bodega';
  const labelMisBodegas = isFashionInventory ? 'Mis Locales' : 'Mis Bodegas';

  // Detectar el tipo de la bodega actualmente seleccionada
  const activeWarehouse = warehouses.find(w => w.id === selectedWarehouse);
  const activeWarehouseType = activeWarehouse?.type || 'GENERAL';
  const isMostradorView = activeWarehouseType === 'MOSTRADOR'
    || activeWarehouse?.name?.toLowerCase() === 'mostrador'; // fallback para bodegas legacy

  // Permission modal
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [currentPermissionRequest, setCurrentPermissionRequest] = useState(null);

  // Stock alerts
  const [showStockAlerts, setShowStockAlerts] = useState(false);
  const [stockThresholds, setStockThresholds] = useState({ critical: 0, low: 5, warning: 10 });
  const [detailProduct, setDetailProduct] = useState(null); // vitrina: panel de detalle abierto
  const inv_carouselRef = useRef(null); // vitrina: para centrar un producto (voz)

  // Cargar umbrales de stock desde configuración guardada
  useEffect(() => {
    getUserCompanyId().then(async companyId => {
      if (!companyId) return;
      const snap = await getDoc(doc(db, `companies/${companyId}/settings`, 'inventory'));
      if (snap.exists()) {
        const data = snap.data();
        setStockThresholds({
          critical: data.criticalStockThreshold ?? 0,
          low: data.lowStockThreshold ?? 5,
          warning: data.lowStockThreshold ?? 10,
        });
      }
    }).catch(() => {});
  }, []);

  // Cargar tipo de inventario para saber si es producción
  useEffect(() => {
    if (!inventoryId) return;
    getInventoryById(inventoryId).then(inv => {
      if (inv?.type) setInventoryType(inv.type);
    }).catch(() => {});
  }, [inventoryId]);

  // Navigation from location state
  useEffect(() => {
    if (location.state?.openProduct) {
      const product = items.find(p => p.id === location.state.openProduct);
      if (product) {
        setProductModal({ open: true, product, mode: 'edit' });
      }
    }
  }, [location.state, items]);

  // Check for pending permissions
  useEffect(() => {
    if (pendingPermissions.length > 0 && !showPermissionModal && !currentPermissionRequest) {
      setCurrentPermissionRequest(pendingPermissions[0]);
      setShowPermissionModal(true);
    }
  }, [pendingPermissions]);

  // Helper functions
  const getWarehouseName = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'Sin bodega';
  };

  // ============ CRUD HANDLERS ============

  // Banner de imprimir etiqueta después de crear
  const [printBanner, setPrintBanner] = useState(null); // { name, sku, id }

  const handleCreateProduct = async (formData) => {
    try {
      if (limits.maxProducts && limits.maxProducts !== Infinity && items.length >= limits.maxProducts) {
        toast.error(`Límite alcanzado: tu plan permite máximo ${limits.maxProducts} productos. Actualiza tu plan para agregar más.`);
        return;
      }
      const productId = await inventoryService.createProduct(formData, { inventoryId });
      setProductModal({ open: false, product: null, mode: 'create' });

      // Si tiene SKU generado, mostrar banner de imprimir
      if (formData.sku) {
        setPrintBanner({ name: formData.name, sku: formData.sku, id: productId });
      } else {
        toast.success(`✅ Producto "${formData.name}" creado exitosamente`);
      }
    } catch (error) {
      console.error('❌ Error creando producto:', error);
      toast.error(error.message || 'Error al crear producto');
    }
  };

  const handleEditProduct = async (formData) => {
    try {
      await inventoryService.updateProduct(productModal.product.id, formData, { inventoryId });
      toast.success(`✅ Producto "${formData.name}" actualizado exitosamente`);
      setProductModal({ open: false, product: null, mode: 'create' });
    } catch (error) {
      console.error('❌ Error actualizando producto:', error);
      toast.error(error.message || 'Error al actualizar producto');
    }
  };

  const handleCreateElaborado = async (formData) => {
    try {
      if (limits.maxProducts && limits.maxProducts !== Infinity && items.length >= limits.maxProducts) {
        toast.error(`Límite alcanzado: tu plan permite máximo ${limits.maxProducts} productos.`);
        return;
      }
      await inventoryService.createProduct(formData, { inventoryId });
      toast.success(`✅ Producto elaborado "${formData.name}" creado`);
      setElaboradoModal({ open: false, product: null, mode: 'create' });
    } catch (error) {
      console.error('❌ Error creando producto elaborado:', error);
      toast.error(error.message || 'Error al crear producto elaborado');
    }
  };

  const handleEditElaborado = async (formData) => {
    try {
      await inventoryService.updateProduct(elaboradoModal.product.id, formData, { inventoryId });
      toast.success(`✅ Producto "${formData.name}" actualizado`);
      setElaboradoModal({ open: false, product: null, mode: 'create' });
    } catch (error) {
      console.error('❌ Error actualizando producto elaborado:', error);
      toast.error(error.message || 'Error al actualizar producto elaborado');
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;

    try {
      await inventoryService.deleteProduct(product.id, product, { inventoryId });
      toast.success(`✅ Producto "${product.name}" eliminado`);
    } catch (error) {
      console.error('❌ Error eliminando producto:', error);
      toast.error(error.message || 'Error al eliminar producto');
    }
  };

  // ============ PURCHASE HANDLERS ============

  const handleRegisterPurchase = async (purchaseData) => {
    try {
      const result = await purchaseService.registerPurchase(
        purchaseModal.item.id,
        purchaseData,
        purchaseModal.item,
        { inventoryId }
      );

      let successMessage = `✅ Compra registrada: ${result.convertedQty} ${purchaseModal.item.unit}`;

      if (result.conversion?.applied) {
        successMessage += `\n📦 Conversión aplicada: ${purchaseData.qty} ${result.conversion.presentationName} → ${result.convertedQty} ${purchaseModal.item.unit}`;
      }

      if (result.expiryDateUpdated) {
        successMessage += '\n📅 Fecha de vencimiento actualizada';
      }

      toast.success(successMessage);
      setPurchaseModal({ open: false, item: null });
    } catch (error) {
      console.error('❌ Error registrando compra:', error);
      toast.error(error.message || 'Error al registrar compra');
    }
  };

  // ============ TRANSFER HANDLERS ============

  const handleTransfer = async (transferData) => {
    try {
      await transferService.transferStock(transferData, transferModal.item, items, { inventoryId });

      const fromWarehouse = getWarehouseName(transferData.fromWarehouseId);
      const toWarehouse = getWarehouseName(transferData.toWarehouseId);

      toast.success(`✅ Transferencia exitosa: ${transferData.quantity} ${transferModal.item.unit} de "${transferModal.item.name}" de ${fromWarehouse} a ${toWarehouse}`);
      setTransferModal({ open: false, item: null });
    } catch (error) {
      console.error('❌ Error en transferencia:', error);
      toast.error(error.message || 'Error al transferir stock');
    }
  };

  // ============ WAREHOUSE HANDLERS ============

  const handleCreateWarehouse = async (warehouseData) => {
    try {
      // Verificar límite de bodegas del plan
      if (limits.maxWarehouses && limits.maxWarehouses !== Infinity && warehouses.length >= limits.maxWarehouses) {
        toast.error(`Límite alcanzado: tu plan permite máximo ${limits.maxWarehouses} bodega${limits.maxWarehouses !== 1 ? 's' : ''}. Actualiza tu plan para agregar más.`);
        return;
      }
      await warehouseService.createWarehouse(warehouseData, { inventoryId });
      toast.success(`✅ Bodega "${warehouseData.name}" creada exitosamente`);
      setWarehouseModal({ open: false, warehouse: null, mode: 'create' });
    } catch (error) {
      console.error('❌ Error creando bodega:', error);
      toast.error(error.message || 'Error al crear bodega');
    }
  };

  const handleEditWarehouse = async (warehouseData) => {
    try {
      await warehouseService.updateWarehouse(warehouseModal.warehouse.id, warehouseData, { inventoryId });
      toast.success(`✅ Bodega "${warehouseData.name}" actualizada`);
      setWarehouseModal({ open: false, warehouse: null, mode: 'create' });
    } catch (error) {
      console.error('❌ Error actualizando bodega:', error);
      toast.error(error.message || 'Error al actualizar bodega');
    }
  };

  const handleDeleteWarehouse = async (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    const productsInWarehouse = items.filter(item => item.warehouseId === warehouseId).length;

    if (productsInWarehouse > 0) {
      toast.error(`No se puede eliminar la bodega "${warehouse?.name}" porque tiene ${productsInWarehouse} producto(s).`);
      return;
    }

    if (!window.confirm(`¿Eliminar bodega "${warehouse?.name}"?`)) return;

    try {
      await warehouseService.deleteWarehouse(warehouseId, items, { inventoryId });
      toast.success(`✅ Bodega "${warehouse?.name}" eliminada`);
    } catch (error) {
      console.error('❌ Error eliminando bodega:', error);
      toast.error(error.message || 'Error al eliminar bodega');
    }
  };

  // ============ SHRINKAGE HANDLER ============

  const handleRegisterShrinkage = async (shrinkageData) => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('No se pudo identificar la empresa');

      const item = shrinkageModal.item;
      const qty = toNum(shrinkageData.quantity);

      if (qty > item.stock) {
        throw new Error('La cantidad de merma excede el stock disponible');
      }

      // Usar ruta correcta según inventoryId
      const inventoryPath = inventoryId
        ? `companies/${companyId}/inventories/${inventoryId}/products`
        : `companies/${companyId}/inventory`;

      const itemRef = doc(db, inventoryPath, item.id);
      const newStock = item.stock - qty;
      const shrinkageValue = qty * (item.ppp || 0);

      await updateDoc(itemRef, {
        stock: newStock,
        history: [
          ...(item.history || []),
          {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'shrinkage',
            qty: qty,
            reason: shrinkageData.reason,
            notes: shrinkageData.notes || '',
            user: shrinkageData.user || 'Sistema'
          }
        ],
        updatedAt: serverTimestamp()
      });

      // Registrar en inventory_exits para que aparezca en reportes
      const { auth } = await import('../firebase/firebase.js');
      const currentUser = auth.currentUser;
      const warehouseName = warehouses.find(w => w.id === item.warehouseId)?.name || 'Sin bodega';

      await addDoc(
        collection(db, `companies/${companyId}/inventory_exits`),
        {
          warehouseId: item.warehouseId || '',
          warehouseName: warehouseName,
          worker: currentUser?.displayName || currentUser?.email || 'Sistema',
          workerId: currentUser?.uid || 'unknown',
          reason: 'WASTE',
          reasonName: shrinkageData.reason || 'Merma',
          notes: `Merma: ${shrinkageData.reason}${shrinkageData.notes ? ' - ' + shrinkageData.notes : ''}`,
          items: [{
            itemId: item.id,
            itemName: item.name,
            quantity: qty,
            unit: item.unit,
            ppp: item.ppp || 0,
            totalValue: shrinkageValue
          }],
          totalValue: shrinkageValue,
          totalUnits: qty,
          createdAt: serverTimestamp()
        }
      );

      // El hook useInventoryData actualizará items automáticamente vía onSnapshot

      toast.success(`✅ Merma registrada: ${qty} ${item.unit} de "${item.name}"`);
      setShrinkageModal({ open: false, item: null });
    } catch (error) {
      console.error('❌ Error registrando merma:', error);
      toast.error(error.message || 'Error al registrar merma');
    }
  };

  // ============ IMPORT/EXPORT HANDLERS ============

  const handleImportExcel = async (productsToImport) => {
    try {
      setImportLoading(true);
      const companyId = await getUserCompanyId();
      if (!companyId) {
        toast.error('No se pudo identificar la empresa');
        setImportLoading(false);
        return;
      }

      const inventoryPath = inventoryId
        ? `companies/${companyId}/inventories/${inventoryId}/products`
        : `companies/${companyId}/inventory`;

      let successCount = 0;
      let errorCount = 0;

      for (const product of productsToImport) {
        try {
          const stock = Number(product.stock) || 0;
          const ppp = Number(product.ppp) || 0;
          const salePrice = Number(product.salePrice) || 0;

          await addDoc(collection(db, inventoryPath), {
            name: product.name,
            sku: product.sku || null,
            category: product.category || 'Insumo',
            unit: product.unit || 'unidad',
            stock: stock,
            ppp: ppp,
            // Se guarda en ambos nombres — ProductCard/ProductGrid leen salePrice,
            // ElaboradosGrid (productos con receta) lee precioVenta.
            ...(salePrice > 0 ? { salePrice, precioVenta: salePrice } : {}),
            provider: product.provider || '',
            warehouseId: product.warehouseId || '',
            history: stock > 0 ? [{
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
              date: new Date().toISOString(),
              qty: stock,
              price: ppp,
              totalPrice: stock * ppp,
              ppp: ppp,
              by: 'importacion-excel'
            }] : [],
            createdAt: serverTimestamp()
          });
          successCount++;
        } catch (err) {
          console.error(`Error importando "${product.name}":`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} productos importados exitosamente`);
      } else {
        toast.warning(`${successCount} importados, ${errorCount} con errores`);
      }

      setImportModalOpen(false);
    } catch (error) {
      console.error('Error en importación:', error);
      toast.error('Error al importar productos');
    } finally {
      setImportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      if (items.length === 0) {
        toast.error('No hay productos para exportar');
        return;
      }

      const XLSX = await import('xlsx');

      const exportData = items.map(item => ({
        'Nombre': item.name || '',
        'SKU': item.sku || '',
        'Categoría': item.category || '',
        'Stock': item.stock || 0,
        'Unidad': item.unit || '',
        'PPP (Costo)': item.ppp || 0,
        'Valor Total': (item.stock || 0) * (item.ppp || 0),
        'Proveedor': item.provider || '',
        'Bodega': warehouses.find(w => w.id === item.warehouseId)?.name || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
      XLSX.writeFile(wb, `inventario-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${items.length} productos exportados a Excel`);
    } catch (error) {
      console.error('Error exportando Excel:', error);
      toast.error('Error al exportar productos');
    }
  };

  const handleExportQR = () => {
    if (warehouses.length === 0) {
      toast.error('No hay bodegas para generar etiquetas QR. Crea una bodega primero.');
      return;
    }
    setSelectedQrWarehouses(warehouses.map(wh => wh.id));
    setQrWarehouseModal(true);
  };

  // ── Generar etiquetas de productos con código de barras ──
  const [labelModal, setLabelModal] = useState(false);
  const [mobileMoreMenu, setMobileMoreMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false); // menú "⋯" desktop
  const [labelProducts, setLabelProducts] = useState([]);
  const [labelConfig, setLabelConfig] = useState({ cols: 3, showPrice: true, showSku: true });
  const [generatingLabels, setGeneratingLabels] = useState(false);

  const openLabelModal = () => {
    // Pre-seleccionar productos con SKU
    const withSku = items.filter(p => p.sku && p.productType !== 'INSUMO');
    const withoutSku = items.filter(p => !p.sku && p.productType !== 'INSUMO');
    setLabelProducts(withSku.map(p => ({ ...p, selected: true })).concat(
      withoutSku.map(p => ({ ...p, selected: false }))
    ));
    setLabelModal(true);
  };

  const printSingleLabel = async (product) => {
    // Abre el modal con solo ese producto preseleccionado
    setLabelProducts(items.map(p => ({ ...p, selected: p.id === product.id })));
    setLabelModal(true);
  };

  const generateLabels = async () => {
    const selected = labelProducts.filter(p => p.selected);
    if (selected.length === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }
    setGeneratingLabels(true);
    try {
      const JsBarcode = (await import('jsbarcode')).default;
      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();

      const cols = labelConfig.cols;
      const margin = 8;
      const gap = 3;
      const labelW = (pw - margin * 2 - gap * (cols - 1)) / cols;
      const labelH = 28;
      let col = 0, row = 0;

      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        const x = margin + col * (labelW + gap);
        const y = margin + row * (labelH + gap);

        // Verificar espacio en página
        if (y + labelH > ph - margin) {
          pdf.addPage();
          col = 0; row = 0;
        }
        const cx = margin + col * (labelW + gap);
        const cy = margin + row * (labelH + gap);

        // Borde de la etiqueta
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(cx, cy, labelW, labelH, 1.5, 1.5, 'S');

        // Nombre del producto
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(20, 20, 20);
        const nameLines = pdf.splitTextToSize(p.name || 'Sin nombre', labelW - 3);
        pdf.text(nameLines.slice(0, 2), cx + 1.5, cy + 4);

        // Código de barras
        const skuCode = p.sku || p.barcode || p.ean || p.code;
        if (skuCode) {
          try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, skuCode, {
              format: 'CODE128',
              width: 1.2,
              height: 18,
              displayValue: false,
              margin: 0,
            });
            const barcodeImg = canvas.toDataURL('image/png');
            const barcodeW = labelW - 3;
            const barcodeH = 10;
            const barcodeY = cy + (nameLines.length > 1 ? 9 : 7);
            pdf.addImage(barcodeImg, 'PNG', cx + 1.5, barcodeY, barcodeW, barcodeH);

            // SKU debajo del código
            if (labelConfig.showSku) {
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(5.5);
              pdf.setTextColor(80, 80, 80);
              pdf.text(skuCode, cx + labelW / 2, barcodeY + barcodeH + 1.5, { align: 'center' });
            }

            // Precio
            if (labelConfig.showPrice && (p.precioVenta || p.salePrice || p.price)) {
              const precio = p.precioVenta || p.salePrice || p.price || 0;
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(7);
              pdf.setTextColor(20, 20, 20);
              const priceCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(precio);
              pdf.text(priceCLP, cx + labelW - 1.5, cy + labelH - 2, { align: 'right' });
            }
          } catch (e) {
            // Si falla el barcode, solo muestra el texto
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6);
            pdf.setTextColor(100, 100, 100);
            pdf.text(skuCode, cx + labelW / 2, cy + 15, { align: 'center' });
          }
        } else {
          // Sin código — mostrar texto "SIN CÓDIGO"
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6);
          pdf.setTextColor(180, 180, 180);
          pdf.text('SIN CÓDIGO', cx + labelW / 2, cy + 15, { align: 'center' });
        }

        col++;
        if (col >= cols) { col = 0; row++; }
      }

      pdf.save(`etiquetas-productos-${new Date().toISOString().split('T')[0]}.pdf`);
      setLabelModal(false);
      toast.success(`✅ ${selected.length} etiquetas generadas`);
    } catch (e) {
      console.error('Error generando etiquetas:', e);
      toast.error('Error al generar etiquetas: ' + e.message);
    } finally {
      setGeneratingLabels(false);
    }
  };

  const generateQRForWarehouses = async (selectedWarehouses) => {
    try {
      setQrWarehouseModal(false);
      toast.info('Generando etiquetas QR...');

      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const cols = 3;
      const rows = 5;
      const labelWidth = (pageWidth - 20) / cols;
      const labelHeight = (pageHeight - 20) / rows;
      const marginLeft = 10;
      const marginTop = 10;
      const qrSize = 30;

      let col = 0;
      let row = 0;

      for (let i = 0; i < selectedWarehouses.length; i++) {
        const warehouse = selectedWarehouses[i];

        if (row >= rows) {
          doc.addPage();
          row = 0;
          col = 0;
        }

        const x = marginLeft + col * labelWidth;
        const y = marginTop + row * labelHeight;

        const qrData = JSON.stringify({
          type: 'warehouse',
          id: warehouse.id,
          name: warehouse.name
        });

        const qrDataURL = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M'
        });

        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, labelWidth, labelHeight);

        doc.addImage(qrDataURL, 'PNG', x + (labelWidth - qrSize) / 2, y + 3, qrSize, qrSize);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const name = warehouse.name.length > 20 ? warehouse.name.substring(0, 20) + '...' : warehouse.name;
        doc.text(name, x + labelWidth / 2, y + qrSize + 8, { align: 'center' });

        const productsCount = items.filter(item => item.warehouseId === warehouse.id).length;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`${productsCount} productos`, x + labelWidth / 2, y + qrSize + 13, { align: 'center' });

        col++;
        if (col >= cols) {
          col = 0;
          row++;
        }
      }

      doc.save(`etiquetas-qr-bodegas-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(`Etiquetas QR generadas para ${selectedWarehouses.length} bodegas`);
    } catch (error) {
      console.error('Error generating QR labels:', error);
      toast.error('Error al generar etiquetas QR');
    }
  };

  const handleBarcodeScan = (product, rawCode) => {
    const barcode = rawCode || '';
    const found = items.find(item =>
      item.sku === barcode ||
      item.barcode === barcode ||
      item.ean === barcode ||
      item.code === barcode
    );
    if (found) {
      // Buscar en el inventario escribiendo el nombre en el buscador
      setSearchQuery(found.name);
      toast.success(`✅ ${found.name} — Stock: ${found.stock} ${found.unit || 'un'}`);
    } else {
      toast.error(`No se encontró producto con código: ${barcode}`);
    }
    setShowBarcodeScanner(false);
  };

  // ============ PERMISSION HANDLERS ============

  const handleApprovePermission = async () => {
    // TODO: Implementar aprobación de permisos
    toast.success('Permiso aprobado');
    setShowPermissionModal(false);
  };

  const handleRejectPermission = async () => {
    // TODO: Implementar rechazo de permisos
    toast.success('Permiso rechazado');
    setShowPermissionModal(false);
  };

  // ============ RENDER ============

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 pb-safe-nav">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Stock Alerts */}
        {showStockAlerts && (
          <StockAlerts
            items={items}
            stockThresholds={stockThresholds}
            onClose={() => setShowStockAlerts(false)}
            onViewProduct={(item) => {
              const isElaborado = item.productType === 'ELABORADO' || (Array.isArray(item.receta) && item.receta.length > 0);
              if (isElaborado) {
                setElaboradoModal({ open: true, product: item, mode: 'edit' });
              } else {
                setProductModal({ open: true, product: item, mode: 'edit' });
              }
            }}
          />
        )}

        {/* Stats — barra compacta colapsable (mostrador conserva el panel completo) */}
        {isMostradorView ? (
          <InventoryStats items={items} warehouses={warehouses} CLP={CLP} />
        ) : (
          <InventoryKpiBar items={items} warehouses={warehouses} />
        )}

        {/* Botones de Acción */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-3 sm:p-4 border border-slate-200/80 dark:border-slate-700/80">
          {isMostradorView ? (
            /* ── Vista Mostrador: solo agregar elaborado y bodega ── */
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setElaboradoModal({ open: true, product: null, mode: 'create' })}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Producto Elaborado
              </button>
              <button
                onClick={() => setWarehouseModal({ open: true, warehouse: null, mode: 'create' })}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl font-semibold text-slate-700 dark:text-slate-200 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {labelAgregarBodega}
              </button>
            </div>
          ) : (
            /* ── Vista Insumos / General ── */
            <>
              {/* Mobile: 2 botones principales + menú Más */}
              <div className="flex sm:hidden gap-2">
                {/* En restaurante/cafetería, lo que se carga a diario son platos con
                    precio de venta — ese botón va primero. Insumo queda secundario. */}
                {isProductionInventory ? (
                  <>
                    <button
                      onClick={() => setElaboradoModal({ open: true, product: null, mode: 'create' })}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold text-sm transition shadow-md"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      + Plato
                    </button>
                    <button
                      onClick={() => setProductModal({ open: true, product: null, mode: 'create' })}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-bold text-sm transition shadow-md"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      + Insumo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setProductModal({ open: true, product: null, mode: 'create' })}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-bold text-sm transition shadow-md"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      + Producto
                    </button>
                    {!isFashionInventory && (
                      <button
                        onClick={() => setElaboradoModal({ open: true, product: null, mode: 'create' })}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold text-sm transition shadow-md"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        + Elaborado
                      </button>
                    )}
                  </>
                )}

                {/* Botón Más — abre menú desplegable */}
                <div className="relative">
                  <button
                    onClick={() => setMobileMoreMenu(v => !v)}
                    className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-2xl transition border border-slate-200 dark:border-slate-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" />
                    </svg>
                  </button>

                  {/* Menú desplegable */}
                  {mobileMoreMenu && (
                    <>
                      {/* Backdrop para cerrar */}
                      <div className="fixed inset-0 z-40" onClick={() => setMobileMoreMenu(false)} />
                      <div className="absolute right-0 top-14 z-50 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button
                          onClick={() => { setWarehouseModal({ open: true, warehouse: null, mode: 'create' }); setMobileMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="font-medium">{labelNuevaBodega}</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700" />
                        <button
                          onClick={() => { setImportModalOpen(true); setMobileMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="font-medium">Importar Excel</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700" />
                        <button
                          onClick={() => { handleExportExcel(); setMobileMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="font-medium">Exportar Excel</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700" />
                        <button
                          onClick={() => { handleExportQR(); setMobileMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span className="font-medium">Etiquetas QR {labelBodegas.toLowerCase()}</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700" />
                        <button
                          onClick={() => { openLabelModal(); setMobileMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          <span className="font-medium">Imprimir etiquetas</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Desktop: full buttons */}
              <div className="hidden sm:flex flex-wrap gap-2">
                {isProductionInventory ? (
                  <>
                    <button
                      onClick={() => setElaboradoModal({ open: true, product: null, mode: 'create' })}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition shadow-sm"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar Plato
                      {limits.maxProducts && limits.maxProducts !== Infinity && (
                        <span className="text-xs opacity-75">({items.length}/{limits.maxProducts})</span>
                      )}
                    </button>
                    <button
                      onClick={() => setProductModal({ open: true, product: null, mode: 'create' })}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar Insumo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setProductModal({ open: true, product: null, mode: 'create' })}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar Producto
                      {limits.maxProducts && limits.maxProducts !== Infinity && (
                        <span className="text-xs opacity-75">({items.length}/{limits.maxProducts})</span>
                      )}
                    </button>
                    {!isFashionInventory && (
                      <button
                        onClick={() => setElaboradoModal({ open: true, product: null, mode: 'create' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition shadow-sm"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nuevo Elaborado
                      </button>
                    )}
                  </>
                )}
                {/* Menú "⋯ Más" — acciones de gestión poco frecuentes */}
                <div className="relative">
                  <button
                    onClick={() => setMoreMenu((v) => !v)}
                    aria-expanded={moreMenu}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl font-semibold text-slate-700 dark:text-slate-200 transition"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                    Más
                    <svg className={`w-3.5 h-3.5 transition-transform ${moreMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {moreMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMoreMenu(false)} />
                      <div className="absolute right-0 top-12 z-50 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden py-1">
                        <button
                          onClick={() => { setWarehouseModal({ open: true, warehouse: null, mode: 'create' }); setMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-4.5 h-4.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="font-medium">{labelAgregarBodega}</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                        <button
                          onClick={() => { setImportModalOpen(true); setMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-4.5 h-4.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="font-medium">Importar Excel</span>
                        </button>
                        <button
                          onClick={() => { handleExportExcel(); setMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-4.5 h-4.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="font-medium">Exportar Excel</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                        <button
                          onClick={() => { handleExportQR(); setMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-4.5 h-4.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span className="font-medium">Etiquetas QR {labelBodegas.toLowerCase()}</span>
                        </button>
                        <button
                          onClick={() => { openLabelModal(); setMoreMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-slate-700 transition"
                        >
                          <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          <span className="font-medium">Imprimir etiquetas</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sección de Bodegas */}
        {warehouses.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {labelMisBodegas} ({warehouses.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {warehouses.map((warehouse) => {
                const productsCount = items.filter(item => item.warehouseId === warehouse.id).length;
                const isSelected = selectedWarehouse === warehouse.id;
                return (
                  <div
                    key={warehouse.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedWarehouse("all");
                      } else {
                        setSelectedWarehouse(warehouse.id);
                      }
                    }}
                    className={`rounded-xl p-4 border-2 shadow-sm cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-900/40 dark:to-blue-800/40 border-blue-500 dark:border-blue-600 ring-2 ring-blue-400 dark:ring-blue-700'
                        : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold truncate text-base ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{warehouse.name}</h4>
                        {warehouse.location && (
                          <p className={`text-sm truncate mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-600 dark:text-slate-400'}`}>{warehouse.location}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setWarehouseModal({ open: true, warehouse, mode: 'edit' });
                          }}
                          className={`p-2 rounded-lg transition ${isSelected ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'}`}
                          title={`Editar ${labelBodega.toLowerCase()}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWarehouse(warehouse.id);
                          }}
                          className={`p-2 rounded-lg transition ${isSelected ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'}`}
                          title={`Eliminar ${labelBodega.toLowerCase()}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {warehouse.description && (
                      <p className={`text-sm mb-3 line-clamp-2 ${isSelected ? 'text-blue-100' : 'text-slate-600 dark:text-slate-400'}`}>{warehouse.description}</p>
                    )}
                    <div className={`flex items-center justify-between pt-3 border-t ${isSelected ? 'border-blue-400' : 'border-slate-200 dark:border-slate-600'}`}>
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-100' : 'text-slate-600 dark:text-slate-400'}`}>Productos:</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : productsCount > 0
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {productsCount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="space-y-3">
          <InventoryFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedWarehouse={selectedWarehouse}
            onWarehouseChange={setSelectedWarehouse}
            warehouses={warehouses}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={clearAllFilters}
            onScanClick={() => setShowBarcodeScanner(true)}
            companyId={companyId}
            inventoryId={inventoryId}
            items={items}
            onVoiceMatch={(name) => {
              const found = items.find((it) => it.name === name);
              if (found) requestAnimationFrame(() => inv_carouselRef.current?.focusProduct(found.id, true));
            }}
          />

          <AdvancedFilters
            isOpen={showAdvancedFilters}
            advancedFilters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            stockThresholds={stockThresholds}
            uniqueCategories={uniqueCategories}
            uniqueProviders={uniqueProviders}
          />
        </div>

        {/* Empty State o Grid/Cards */}
        {filteredItems.length === 0 ? (
          <EmptyState
            type={searchQuery || activeFiltersCount > 0 ? 'no-results' : selectedWarehouse !== 'all' ? 'no-warehouse' : 'no-products'}
            onAddProduct={() => isMostradorView
              ? setElaboradoModal({ open: true, product: null, mode: 'create' })
              : setProductModal({ open: true, product: null, mode: 'create' })
            }
            onClearFilters={clearAllFilters}
          />
        ) : isMostradorView ? (
          /* ── Vista Mostrador: ElaboradosGrid ── */
          <>
            <ElaboradosGrid
              items={paginatedItems}
              loading={loading}
              onEdit={(item) => setElaboradoModal({ open: true, product: item, mode: 'edit' })}
              onDelete={handleDeleteProduct}
              CLP={CLP}
            />
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              itemsPerPage={20}
              onPageChange={setCurrentPage}
            />
          </>
        ) : (
          /* ── Vista Insumos / General: Vitrina carrusel (modo inventario) ── */
          <>
            <VitrinaCarousel
              ref={inv_carouselRef}
              items={paginatedItems}
              mode="inventario"
              loading={loading}
              canSeePrice
              onOpenDetail={(item) => setDetailProduct(item)}
            />

            {/* Panel de detalle: métricas + 7 acciones (réplica de ProductCard) */}
            <ProductDetailSheet
              product={detailProduct}
              onClose={() => setDetailProduct(null)}
              getWarehouseName={getWarehouseName}
              getExpiryStatus={getExpiryStatus}
              onAction={(key, item) => {
                const esElaborado = item.productType === 'ELABORADO' || (Array.isArray(item.receta) && item.receta.length > 0);
                if (key === 'edit') {
                  esElaborado
                    ? setElaboradoModal({ open: true, product: item, mode: 'edit' })
                    : setProductModal({ open: true, product: item, mode: 'edit' });
                } else if (key === 'purchase') setPurchaseModal({ open: true, item });
                else if (key === 'history') setHistoryModal({ open: true, item });
                else if (key === 'transfer') setTransferModal({ open: true, item });
                else if (key === 'shrinkage') setShrinkageModal({ open: true, item });
                else if (key === 'label') printSingleLabel(item);
                else if (key === 'delete') handleDeleteProduct(item);
                setDetailProduct(null);
              }}
            />

            {/* Paginación */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              itemsPerPage={20}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        {/* ============ MODALES ============ */}

        {/* Product Wizard Modal */}
        <ProductWizardModal
          isOpen={productModal.open}
          onClose={() => setProductModal({ open: false, product: null, mode: 'create' })}
          product={productModal.product}
          warehouses={warehouses}
          onSubmit={productModal.mode === 'create' ? handleCreateProduct : handleEditProduct}
          mode={productModal.mode}
          existingItems={items}
          isInsumo={isProductionInventory}
          inventoryType={inventoryType}
        />

        {/* Producto Elaborado Modal (solo inventarios de producción) */}
        <ProductoElaboradoModal
          isOpen={elaboradoModal.open}
          onClose={() => setElaboradoModal({ open: false, product: null, mode: 'create' })}
          product={elaboradoModal.product}
          inventoryId={inventoryId}
          warehouses={warehouses}
          onSubmit={elaboradoModal.mode === 'create' ? handleCreateElaborado : handleEditElaborado}
          mode={elaboradoModal.mode}
          defaultWarehouseId={selectedWarehouse !== 'all' ? selectedWarehouse : null}
          existingItems={items}
          inventoryType={inventoryType}
        />

        {/* Purchase Modal */}
        <PurchaseModal
          isOpen={purchaseModal.open}
          onClose={() => setPurchaseModal({ open: false, item: null })}
          item={purchaseModal.item}
          onSubmit={handleRegisterPurchase}
          CLP={CLP}
          toNum={toNum}
        />

        {/* Transfer Modal */}
        <TransferModal
          isOpen={transferModal.open}
          onClose={() => setTransferModal({ open: false, item: null })}
          item={transferModal.item}
          warehouses={warehouses}
          onSubmit={handleTransfer}
          getWarehouseName={getWarehouseName}
        />

        {/* Warehouse Modal */}
        <WarehouseModal
          isOpen={warehouseModal.open}
          onClose={() => setWarehouseModal({ open: false, warehouse: null, mode: 'create' })}
          warehouse={warehouseModal.warehouse}
          onSubmit={warehouseModal.mode === 'create' ? handleCreateWarehouse : handleEditWarehouse}
          mode={warehouseModal.mode}
          isProductionInventory={isProductionInventory}
          labelBodega={labelBodega}
        />

        {/* History Modal */}
        <HistoryModal
          isOpen={historyModal.open}
          onClose={() => setHistoryModal({ open: false, item: null })}
          item={historyModal.item ? (items.find(p => p.id === historyModal.item.id) || historyModal.item) : null}
          CLP={CLP}
        />

        {/* Shrinkage Modal */}
        <ShrinkageModal
          isOpen={shrinkageModal.open}
          onClose={() => setShrinkageModal({ open: false, item: null })}
          item={shrinkageModal.item}
          onRegisterShrinkage={handleRegisterShrinkage}
          CLP={CLP}
        />

        {/* Import Excel Modal */}
        <ImportExcelModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={handleImportExcel}
          warehouses={warehouses}
        />

        {/* Permission Request Notification */}
        <PermissionRequestNotification
          isOpen={showPermissionModal}
          onClose={() => setShowPermissionModal(false)}
          onApprove={handleApprovePermission}
          onReject={handleRejectPermission}
          permissionData={currentPermissionRequest}
        />

        {/* Barcode Scanner */}
        <AnimatePresence>
          {showBarcodeScanner && (
            <ImprovedBarcodeScanner
              onScanSuccess={handleBarcodeScan}
              onClose={() => setShowBarcodeScanner(false)}
              products={items}
              rawMode={true}
            />
          )}
        </AnimatePresence>

        {/* QR Warehouse Selector Modal */}
        <AnimatePresence>
          {qrWarehouseModal && (
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrWarehouseModal(false)}
            >
              <motion.div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Generar Etiquetas QR</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Selecciona los {labelBodegas.toLowerCase()} para generar QR</p>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {warehouses.map((wh) => {
                    const isChecked = selectedQrWarehouses.includes(wh.id);
                    return (
                      <label key={wh.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedQrWarehouses(prev =>
                              isChecked
                                ? prev.filter(id => id !== wh.id)
                                : [...prev, wh.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{wh.name}</p>
                          <p className="text-xs text-slate-500">{items.filter(i => i.warehouseId === wh.id).length} productos</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setQrWarehouseModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const selected = warehouses.filter(wh => selectedQrWarehouses.includes(wh.id));
                      if (selected.length === 0) {
                        toast.error('Selecciona al menos una bodega');
                        return;
                      }
                      generateQRForWarehouses(selected);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:from-orange-600 hover:to-orange-700 transition shadow-lg"
                  >
                    Generar QR
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import Loading Overlay */}
        <AnimatePresence>
          {importLoading && (
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full mx-4"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
              >
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-600" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Importando productos</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Esto puede tomar unos segundos...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banner imprimir etiqueta después de crear producto con SKU */}
        <AnimatePresence>
          {printBanner && (
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
            >
              <div className="bg-[#111118] border border-violet-500/[0.30] rounded-2xl shadow-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/[0.15] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white">Producto creado</p>
                    <p className="text-[11px] text-zinc-500 truncate">{printBanner.name}</p>
                    <p className="text-[11px] text-violet-400 font-mono mt-0.5">SKU: {printBanner.sku}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Buscar el producto en items y abrir modal de etiqueta
                      const prod = items.find(p => p.id === printBanner.id) || { ...printBanner, name: printBanner.name, sku: printBanner.sku };
                      setLabelProducts([{ ...prod, selected: true }]);
                      setLabelModal(true);
                      setPrintBanner(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir etiqueta
                  </button>
                  <button
                    onClick={() => setPrintBanner(null)}
                    className="px-3 py-2 rounded-xl border border-white/[0.08] text-zinc-500 hover:text-zinc-300 text-[12px] transition-colors"
                  >
                    Omitir
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notifications */}
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

        {/* ── Modal de etiquetas de productos ── */}
        <AnimatePresence>
          {labelModal && (
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLabelModal(false)}
            >
              <motion.div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Imprimir etiquetas de productos</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {labelProducts.filter(p => p.selected).length} de {labelProducts.length} productos seleccionados
                    </p>
                  </div>
                  <button onClick={() => setLabelModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Config */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Columnas:</span>
                      {[2, 3, 4].map(c => (
                        <button key={c} onClick={() => setLabelConfig(prev => ({ ...prev, cols: c }))}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${labelConfig.cols === c ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={labelConfig.showPrice} onChange={e => setLabelConfig(prev => ({ ...prev, showPrice: e.target.checked }))} className="rounded text-violet-600" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Mostrar precio</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={labelConfig.showSku} onChange={e => setLabelConfig(prev => ({ ...prev, showSku: e.target.checked }))} className="rounded text-violet-600" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Mostrar SKU</span>
                    </label>
                    <button
                      onClick={() => setLabelProducts(prev => prev.map(p => ({ ...p, selected: !prev.every(x => x.selected) })))}
                      className="ml-auto text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      {labelProducts.every(p => p.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                </div>

                {/* Lista de productos */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                  {labelProducts.map((p, i) => (
                    <label
                      key={p.id || i}
                      style={p.selected ? { backgroundColor: isDark ? 'rgba(124,58,237,0.18)' : '#f5f3ff' } : {}}
                      className="flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={e => setLabelProducts(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                        className="rounded text-violet-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p style={{ color: isDark ? '#fff' : '#0f172a' }} className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs">
                          {p.sku
                            ? <span style={{ color: isDark ? '#34d399' : '#059669' }} className="font-mono">SKU: {p.sku}</span>
                            : <span style={{ color: isDark ? '#fbbf24' : '#d97706' }}>Sin SKU — se imprimirá sin código de barras</span>}
                        </p>
                      </div>
                      {(p.precioVenta || p.salePrice || p.price) > 0 && (
                        <span style={{ color: isDark ? '#cbd5e1' : '#475569' }} className="text-xs font-semibold shrink-0">
                          {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(p.precioVenta || p.salePrice || p.price || 0)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    PDF tamaño A4 · {labelConfig.cols} columnas · {Math.ceil(labelProducts.filter(p => p.selected).length / labelConfig.cols)} filas aprox.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setLabelModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                      Cancelar
                    </button>
                    <button
                      onClick={generateLabels}
                      disabled={generatingLabels || labelProducts.filter(p => p.selected).length === 0}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition disabled:opacity-50"
                    >
                      {generatingLabels ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Descargar PDF</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
