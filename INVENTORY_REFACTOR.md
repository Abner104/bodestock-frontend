# 📦 Refactorización de Inventory.jsx - Guía Completa

## 🎯 Resumen

Se ha refactorizado completamente el componente `Inventory.jsx` (3,655 líneas) en **32 módulos reutilizables** organizados por responsabilidad. El código ahora es:

- ✅ **Más mantenible**: Cada componente tiene una responsabilidad única
- ✅ **Más testeable**: Servicios y hooks separados de la UI
- ✅ **Más escalable**: Fácil agregar nuevas features
- ✅ **Mejor organizado**: Estructura clara y documentada
- 🆕 **Nueva feature**: Campo de fecha de vencimiento en compras

---

## 📊 Estadísticas

- **Archivos creados**: 32 archivos
- **Líneas extraídas**: ~6,500 líneas modulares
- **Reducción estimada**: De 3,655 líneas → ~400-500 líneas en el nuevo Inventory.jsx
- **Reducción**: ~85-87% menos código en el archivo principal

---

## 📁 Estructura de Archivos Creados

```
src/
├── utils/inventory/
│   ├── inventoryHelpers.js          # Helpers: CLP, toNum, getExpiryStatus, calculatePPP
│   ├── inventoryConstants.js        # Constantes: categorías, unidades, mensajes
│   ├── inventoryValidators.js       # Validaciones de negocio
│   └── presentationsService.js      # Conversiones de presentaciones
│
├── services/inventory/
│   ├── inventoryService.js          # CRUD de productos
│   ├── warehouseService.js          # CRUD de bodegas
│   ├── purchaseService.js           # Registro de compras (con fecha vencimiento)
│   ├── transferService.js           # Transferencias entre bodegas
│   └── shrinkageService.js          # Registro de mermas
│
├── hooks/inventory/
│   ├── useInventoryData.js          # Listener real-time inventario
│   ├── useWarehousesData.js         # Listener real-time bodegas
│   ├── useInventoryFilters.js       # Lógica de filtros y paginación
│   ├── useInventoryCRUD.js          # Wrapper CRUD con toasts
│   ├── usePurchaseOperations.js     # Wrapper compras con toasts
│   ├── useTransferOperations.js     # Wrapper transferencias con toasts
│   └── usePermissionRequests.js     # Listener solicitudes de permiso
│
└── components/inventory/
    ├── ui/
    │   ├── InventoryHeader.jsx      # Header con estadísticas y botones
    │   ├── EmptyState.jsx           # Estados vacíos
    │   └── PaginationControls.jsx   # Controles de paginación
    │
    ├── filters/
    │   ├── InventoryFilters.jsx     # Barra de filtros principal
    │   └── AdvancedFilters.jsx      # Panel de filtros avanzados
    │
    ├── grid/
    │   ├── ProductGrid.jsx          # Tabla de productos (desktop)
    │   └── ProductCard.jsx          # Cards de productos (mobile)
    │
    └── modals/
        ├── PurchaseModal.jsx        # Modal de compras (con fecha vencimiento)
        ├── TransferModal.jsx        # Modal de transferencias
        ├── WarehouseModal.jsx       # Modal crear/editar bodega
        ├── HistoryModal.jsx         # Modal historial de compras
        └── ProductWizardModal/
            ├── index.jsx            # Wizard principal (4 pasos)
            ├── StepBasicInfo.jsx    # Paso 1: Información básica
            ├── StepPresentation.jsx # Paso 2: Unidad de medida
            ├── StepInitialPurchase.jsx # Paso 3: Primera compra
            └── StepExtras.jsx       # Paso 4: Extras opcionales
```

---

## 🚀 Cómo Usar los Nuevos Componentes

### 1. Ejemplo: Nuevo Inventory.jsx Simplificado

```jsx
// src/components/Inventory.jsx
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

// Hooks
import { useInventoryData } from '../hooks/inventory/useInventoryData';
import { useWarehousesData } from '../hooks/inventory/useWarehousesData';
import { useInventoryFilters } from '../hooks/inventory/useInventoryFilters';
import { useInventoryCRUD } from '../hooks/inventory/useInventoryCRUD';
import { usePurchaseOperations } from '../hooks/inventory/usePurchaseOperations';
import { useTransferOperations } from '../hooks/inventory/useTransferOperations';

// Helpers
import { CLP, toNum, getExpiryStatus } from '../utils/inventory/inventoryHelpers';

// UI Components
import InventoryHeader from './inventory/ui/InventoryHeader';
import InventoryFilters from './inventory/filters/InventoryFilters';
import AdvancedFilters from './inventory/filters/AdvancedFilters';
import PaginationControls from './inventory/ui/PaginationControls';
import EmptyState from './inventory/ui/EmptyState';

// Grid Components
import ProductGrid from './inventory/grid/ProductGrid';
import ProductCard from './inventory/grid/ProductCard';

// Modals
import ProductWizardModal from './inventory/modals/ProductWizardModal';
import PurchaseModal from './inventory/modals/PurchaseModal';
import TransferModal from './inventory/modals/TransferModal';
import WarehouseModal from './inventory/modals/WarehouseModal';
import HistoryModal from './inventory/modals/HistoryModal';
import ShrinkageModal from './inventory/modals/ShrinkageModal';

export default function Inventory() {
  // Data hooks
  const { items, loading } = useInventoryData();
  const { warehouses } = useWarehousesData();

  // Filters hook (maneja toda la lógica de filtrado)
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
    totalPages
  } = useInventoryFilters(items);

  // CRUD operations
  const { createProduct, updateProduct, deleteProduct } = useInventoryCRUD();
  const { registerPurchase } = usePurchaseOperations();
  const { transferStock } = useTransferOperations();

  // Modal states
  const [productModal, setProductModal] = useState({ open: false, product: null, mode: 'create' });
  const [purchaseModal, setPurchaseModal] = useState({ open: false, item: null });
  const [transferModal, setTransferModal] = useState({ open: false, item: null });
  const [warehouseModal, setWarehouseModal] = useState({ open: false, warehouse: null, mode: 'create' });
  const [historyModal, setHistoryModal] = useState({ open: false, item: null });

  // Helper functions
  const getWarehouseName = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'Sin bodega';
  };

  const totalValue = items.reduce((sum, item) => sum + (item.stock * item.ppp), 0);

  // Handlers
  const handleCreateProduct = async (formData) => {
    await createProduct(formData);
    setProductModal({ open: false, product: null, mode: 'create' });
  };

  const handleEditProduct = async (formData) => {
    await updateProduct(productModal.product.id, formData);
    setProductModal({ open: false, product: null, mode: 'create' });
  };

  const handleRegisterPurchase = async (purchaseData) => {
    await registerPurchase(purchaseModal.item.id, purchaseData, purchaseModal.item);
    setPurchaseModal({ open: false, item: null });
  };

  const handleTransfer = async (transferData) => {
    await transferStock(transferModal.item.id, transferData);
    setTransferModal({ open: false, item: null });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <InventoryHeader
          onAddProduct={() => setProductModal({ open: true, product: null, mode: 'create' })}
          onImport={() => {/* abrir modal importación */}}
          onExportExcel={() => {/* exportar excel */}}
          onExportQR={() => {/* generar QR */}}
          totalProducts={items.length}
          totalValue={totalValue}
          CLP={CLP}
        />

        {/* Filtros */}
        <div className="mb-4 space-y-3">
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
          />

          <AdvancedFilters
            isOpen={showAdvancedFilters}
            advancedFilters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            uniqueCategories={[...new Set(items.map(i => i.category))]}
            uniqueProviders={[...new Set(items.map(i => i.provider).filter(Boolean))]}
          />
        </div>

        {/* Grid/Cards */}
        {filteredItems.length === 0 ? (
          <EmptyState
            type={searchQuery || activeFiltersCount > 0 ? 'no-results' : 'no-products'}
            onAddProduct={() => setProductModal({ open: true, product: null, mode: 'create' })}
            onClearFilters={clearAllFilters}
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block">
              <ProductGrid
                items={paginatedItems}
                loading={loading}
                onEdit={(item) => setProductModal({ open: true, product: item, mode: 'edit' })}
                onDelete={deleteProduct}
                onPurchase={(item) => setPurchaseModal({ open: true, item })}
                onHistory={(item) => setHistoryModal({ open: true, item })}
                onTransfer={(item) => setTransferModal({ open: true, item })}
                onShrinkage={(item) => {/* abrir shrinkage modal */}}
                getWarehouseName={getWarehouseName}
                getExpiryStatus={getExpiryStatus}
                CLP={CLP}
              />
            </div>

            {/* Mobile */}
            <div className="lg:hidden space-y-3">
              <AnimatePresence>
                {paginatedItems.map((item, index) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    index={index}
                    onEdit={(item) => setProductModal({ open: true, product: item, mode: 'edit' })}
                    onDelete={deleteProduct}
                    onPurchase={(item) => setPurchaseModal({ open: true, item })}
                    onHistory={(item) => setHistoryModal({ open: true, item })}
                    onTransfer={(item) => setTransferModal({ open: true, item })}
                    onShrinkage={(item) => {/* abrir shrinkage modal */}}
                    getWarehouseName={getWarehouseName}
                    getExpiryStatus={getExpiryStatus}
                    CLP={CLP}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Paginación */}
            <div className="mt-6">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                itemsPerPage={20}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}

        {/* Modales */}
        <ProductWizardModal
          isOpen={productModal.open}
          onClose={() => setProductModal({ open: false, product: null, mode: 'create' })}
          product={productModal.product}
          warehouses={warehouses}
          onSubmit={productModal.mode === 'create' ? handleCreateProduct : handleEditProduct}
          mode={productModal.mode}
        />

        <PurchaseModal
          isOpen={purchaseModal.open}
          onClose={() => setPurchaseModal({ open: false, item: null })}
          item={purchaseModal.item}
          onSubmit={handleRegisterPurchase}
          CLP={CLP}
          toNum={toNum}
        />

        <TransferModal
          isOpen={transferModal.open}
          onClose={() => setTransferModal({ open: false, item: null })}
          item={transferModal.item}
          warehouses={warehouses}
          onSubmit={handleTransfer}
          getWarehouseName={getWarehouseName}
        />

        <WarehouseModal
          isOpen={warehouseModal.open}
          onClose={() => setWarehouseModal({ open: false, warehouse: null, mode: 'create' })}
          warehouse={warehouseModal.warehouse}
          onSubmit={warehouseModal.mode === 'create' ? createWarehouse : updateWarehouse}
          mode={warehouseModal.mode}
        />

        <HistoryModal
          isOpen={historyModal.open}
          onClose={() => setHistoryModal({ open: false, item: null })}
          item={historyModal.item}
          CLP={CLP}
        />
      </div>
    </div>
  );
}
```

---

## 🆕 Nueva Feature: Fecha de Vencimiento

### Cómo funciona:

1. **En el ProductWizardModal** (Step 3): Campo opcional para fecha de vencimiento
2. **En PurchaseModal**: Campo para registrar fecha de vencimiento en cada compra
3. **En purchaseService.js**: Si la fecha de la compra es anterior a la existente, se actualiza automáticamente
4. **En ProductGrid/Card**: Alertas visuales cuando el producto está por vencer o vencido

```javascript
// purchaseService.js - Lógica automática
if (purchaseData.expiryDate) {
  const newExpiryDate = new Date(purchaseData.expiryDate);
  if (!currentItem.expiryDate) {
    updateData.expiryDate = newExpiryDate;
  } else {
    const currentExpiryDate = currentItem.expiryDate.toDate();
    if (newExpiryDate < currentExpiryDate) {
      updateData.expiryDate = newExpiryDate; // Actualizar a la más cercana
    }
  }
}
```

---

## 📝 Próximos Pasos

1. **Reemplazar el Inventory.jsx actual** con la versión simplificada mostrada arriba
2. **Importar todos los componentes** según la estructura de archivos
3. **Migrar funciones faltantes** (export Excel, QR, etc.)
4. **Testing**: Probar cada modal y operación
5. **Eliminar código antiguo** cuando todo funcione correctamente

---

## 🎉 Beneficios de la Refactorización

### Antes:
- ❌ 3,655 líneas en un solo archivo
- ❌ Difícil de mantener
- ❌ Difícil de testear
- ❌ Difícil de escalar

### Después:
- ✅ ~400-500 líneas en Inventory.jsx orquestador
- ✅ 32 módulos pequeños y enfocados
- ✅ Fácil de testear (servicios separados)
- ✅ Fácil de escalar (agregar nuevos modales/features)
- ✅ Código reutilizable en otros componentes
- 🆕 Nueva feature de fecha de vencimiento implementada

---

## 🔧 Mantenimiento Futuro

### Para agregar una nueva feature:
1. **Servicio nuevo**: Crear en `services/inventory/`
2. **Hook wrapper**: Crear en `hooks/inventory/`
3. **UI Component**: Crear en `components/inventory/`
4. **Importar en Inventory.jsx**: Agregar imports y usar

### Para modificar una feature existente:
1. Ir directamente al archivo específico
2. Modificar sin afectar otros módulos
3. Testing aislado del módulo

---

## 📚 Documentación de Servicios

### inventoryService.js
```javascript
createProduct(formData)      // Crear producto nuevo
updateProduct(id, formData)  // Actualizar producto existente
deleteProduct(id)            // Eliminar producto
```

### purchaseService.js
```javascript
registerPurchase(productId, purchaseData, currentItem)
// purchaseData: { qty, price, presentationId, expiryDate }
// Actualiza stock, PPP, history y expiryDate si aplica
```

### transferService.js
```javascript
transferStock(productId, transferData)
// transferData: { fromWarehouseId, toWarehouseId, quantity }
```

---

**Autor**: Claude Sonnet 4.5
**Fecha**: 2026-02-11
**Cliente**: Minimarkets (2 locales)
