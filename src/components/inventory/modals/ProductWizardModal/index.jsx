// src/components/inventory/modals/ProductWizardModal/index.jsx
/**
 * Modal wizard para crear/editar productos (3 pasos simplificados)
 * Step 0: Información del producto (nombre, categoría, bodega, unidad)
 * Step 1: Stock inicial (precio total, cantidad, presentación opcional)
 * Step 2: Extras opcionales (proveedor, SKU, fecha vencimiento, campos personalizados)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as IconX, Package, Scan, Camera, RotateCcw } from 'lucide-react';
import StepBasicInfo from './StepBasicInfo';
import StepInitialPurchase from './StepInitialPurchase';
import StepExtras from './StepExtras';
import ImprovedBarcodeScanner from '../../ImprovedBarcodeScanner';
import { useBarcodeScanner } from '../../../../hooks/useBarcodeScanner';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Object} props.product - Producto a editar (null para crear nuevo)
 * @param {Array} props.warehouses - Lista de bodegas disponibles
 * @param {Function} props.onSubmit - Callback al guardar producto
 * @param {string} props.mode - 'create' o 'edit'
 */
export default function ProductWizardModal({
  isOpen = false,
  onClose,
  product = null,
  warehouses = [],
  onSubmit,
  mode = 'create',
  existingItems = [],
  isInsumo = false,
  inventoryType = null
}) {
  const DRAFT_KEY = 'product-wizard-draft';

  const [wizardStep, setWizardStep] = useState(0); // 0-2
  const [hasDraft, setHasDraft] = useState(false);
  const _PROD_TYPES = ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'];
  const _initCategory = inventoryType === 'fashion' ? 'Ropa' : _PROD_TYPES.includes(inventoryType) ? 'Insumo' : 'Producto';
  const _initUnit = inventoryType === 'fashion' ? 'prenda' : _PROD_TYPES.includes(inventoryType) ? 'ml' : 'unidad';

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: _initCategory,
    unit: _initUnit,
    description: '',
    stock: 0,
    ppp: 0,
    provider: '',
    warehouseId: '',
    customFields: {},
    expiryDate: '',
    presentations: [],
    initialPresentationId: null,
    tempPresentationName: '',
    tempPresentationFactor: '',
    usePresentacion: false,
    photos: [],
    photoFiles: [],
    promociones: [],
    aliases: [],
  });

  // Estados para campos personalizados
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [scannerStatus, setScannerStatus] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hook para detectar pistola láser
  const { isScanning } = useBarcodeScanner(
    (code) => {
      // Cuando se escanea un código
      console.log('🔫 Código escaneado con pistola:', code);
      setScannerStatus(`✅ Escaneado: ${code}`);

      // Actualizar el SKU
      updateFormData({ sku: code });

      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setScannerStatus(''), 3000);
    },
    {
      enabled: isOpen, // Solo activar cuando el modal está abierto
      minLength: 3,
      maxLength: 50,
      scanTimeout: 100
    }
  );

  const PRODUCTION_TYPES = ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'];
  const defaultCategory = inventoryType === 'fashion' ? 'Ropa'
    : PRODUCTION_TYPES.includes(inventoryType) ? 'Insumo'
    : 'Producto';
  const defaultUnit = inventoryType === 'fashion' ? 'prenda'
    : PRODUCTION_TYPES.includes(inventoryType) ? 'ml'
    : 'unidad';

  const emptyForm = useCallback(() => ({
    name: '',
    sku: '',
    category: defaultCategory,
    unit: defaultUnit,
    stock: 0,
    ppp: 0,
    provider: '',
    warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
    customFields: {},
    expiryDate: '',
    presentations: [],
    initialPresentationId: null,
    tempPresentationName: '',
    tempPresentationFactor: '',
    usePresentacion: false,
    photos: [],
    photoFiles: [],
    promociones: [],
    aliases: [],
    _talla: '',
    _color: '',
    printStation: 'kitchen',
  }), [warehouses, inventoryType]);

  // Cargar datos al abrir para editar
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        const stock = Number(product.stock) || 0;
        const ppp = Number(product.ppp) || 0; // costo unitario guardado
        const totalValue = Math.round(ppp * stock); // total que se pagó por todo el stock
        setFormData({
          name: product.name || '',
          sku: product.sku || '',
          category: product.category || 'Insumo',
          unit: product.unit || 'unidad',
          description: product.description || '',
          stock: stock > 0 ? String(stock) : '',
          ppp: totalValue, // el campo de precio siempre representa el TOTAL en el wizard
          _tempUnitPrice: totalValue > 0 ? String(totalValue) : '',
          provider: product.provider || '',
          warehouseId: product.warehouseId || '',
          customFields: product.customFields || {},
          expiryDate: product.expiryDate ? (product.expiryDate.toDate ? product.expiryDate.toDate().toISOString().split('T')[0] : '') : '',
          presentations: product.presentations || [],
          initialPresentationId: null,
          tempPresentationName: '',
          tempPresentationFactor: '',
          usePresentacion: false,
          photos: product.photos || (product.photoURL ? [product.photoURL] : []),
          photoFiles: [],
          promociones: product.promociones || [],
          aliases: product.aliases || [],
          salePrice: product.salePrice || undefined,
          _tempSalePrice: product.salePrice ? String(product.salePrice) : '',
          printStation: product.printStation || 'kitchen',
        });
        setHasDraft(false);
      } else {
        // Modo crear: revisar si hay borrador guardado
        try {
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            const draft = JSON.parse(saved);
            if (draft.name || draft.sku || draft.provider) {
              setFormData({ ...emptyForm(), ...draft, photoFiles: [] });
              setHasDraft(true);
              setWizardStep(draft._step || 0);
              return;
            }
          }
        } catch (_) {}
        setFormData(emptyForm());
        setHasDraft(false);
      }
      setWizardStep(0);
    }
  }, [isOpen, product, mode, inventoryType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-guardar borrador mientras el usuario escribe (solo modo crear)
  useEffect(() => {
    if (!isOpen || mode === 'edit') return;
    try {
      // photoFiles trae objetos File (no serializables) — se excluyen del borrador
      const { photoFiles, ...saveable } = formData;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...saveable, _step: wizardStep }));
    } catch (_) {}
  }, [formData, wizardStep, isOpen, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Si no estamos en el último paso, avanzar
    if (wizardStep < 2) {
      setWizardStep(wizardStep + 1);
      return;
    }

    // Prevenir doble-click
    if (saving) return;
    setSaving(true);

    try {
      const insumosWarehouse = isInsumo
        ? warehouses.find(w => w.name?.toLowerCase() === 'insumos')
        : null;
      // formData.ppp ya es el TOTAL de la compra (no hay que volver a multiplicar)
      // Para fashion: componer nombre con talla y color si se ingresaron
      let finalName = formData.name;
      if (inventoryType === 'fashion') {
        const talla = (formData._talla || '').trim();
        const color = (formData._color || '').trim();
        const sufijo = [talla, color].filter(Boolean).join(' / ');
        if (sufijo) finalName = `${formData.name} - ${sufijo}`;
      }

      const { _talla, _color, ...cleanData } = formData;
      // productType: 'INSUMO' es el campo que el resto del sistema usa para
      // distinguir "no es vendible" -- lo lee PublicStore.jsx para excluir
      // insumos del catálogo público, y ProductoElaboradoModal.jsx para
      // ofrecerlo como ingrediente de receta. El botón "+ Insumo" (isInsumo)
      // ya asignaba la bodega "Insumos" y una categoría de texto "Insumo",
      // pero nunca este campo -- un insumo creado así quedaba indistinguible
      // de un producto de venta real y aparecía en la tienda pública.
      const dataToSubmit = isInsumo
        ? { ...cleanData, name: finalName, warehouseId: cleanData.warehouseId || insumosWarehouse?.id || '', productType: 'INSUMO' }
        : { ...cleanData, name: finalName };
      await onSubmit(dataToSubmit);
      // Limpiar borrador al guardar exitosamente
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      console.error('Error en submit:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = () => {
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    onClose();
    setWizardStep(0);
    setSaving(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setFormData(emptyForm());
    setHasDraft(false);
    setWizardStep(0);
  };

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Handler para cuando la cámara escanea un código
  const handleCameraScan = (product, code) => {
    const scannedCode = code || product?.sku || product?.code || product?.barcode || '';
    if (scannedCode) {
      setFormData(prev => ({ ...prev, sku: scannedCode }));
      setScannerStatus(`✅ SKU: ${scannedCode}`);
      setTimeout(() => setScannerStatus(''), 5000);
    }
    setShowCameraScanner(false);
  };

  const isEdit = mode === 'edit';
  const stepNames = ['Producto', 'Stock', 'Extras'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 sm:rounded-xl shadow-2xl sm:max-w-2xl w-full h-[100dvh] sm:h-auto sm:max-h-[88vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between flex-shrink-0 pt-safe">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
                  </h3>
                  {/* Indicador de pistola láser */}
                  {(isScanning || scannerStatus) && (
                    <div className="flex items-center gap-2 mt-1">
                      {isScanning && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="flex items-center gap-1 text-yellow-300 text-sm"
                        >
                          <Scan className="w-4 h-4" />
                          <span>Escaneando...</span>
                        </motion.div>
                      )}
                      {scannerStatus && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-green-300 text-sm font-medium"
                        >
                          {scannerStatus}
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Indicador de pasos */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
              <div className="flex items-center justify-between">
                {stepNames.map((step, index) => (
                  <div key={index} className="flex items-center flex-1">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      index === wizardStep
                        ? 'bg-blue-600 text-white scale-110'
                        : index < wizardStep
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                    }`}>
                      {index < wizardStep ? '✓' : index + 1}
                    </div>
                    <div className={`hidden sm:block ml-2 text-xs font-medium ${
                      index === wizardStep
                        ? 'text-blue-600 dark:text-blue-400'
                        : index < wizardStep
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {step}
                    </div>
                    {index < 2 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        index < wizardStep ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Banner de borrador recuperado */}
            {hasDraft && mode === 'create' && (
              <div className="px-4 sm:px-6 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/40 flex items-center justify-between gap-3">
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  📝 Borrador recuperado — continuás donde lo dejaste
                </span>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-red-500 dark:hover:text-red-400 transition font-medium whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  Descartar
                </button>
              </div>
            )}

            {/* Body con los steps */}
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                // Bloquear Enter en inputs para evitar submit accidental (pistola láser manda Enter al final)
                if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
                  e.preventDefault();
                }
              }}
              className="flex-1 min-h-0 flex flex-col"
            >
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <AnimatePresence mode="wait">
                {wizardStep === 0 && (
                  <StepBasicInfo
                    key="step-0"
                    formData={formData}
                    updateFormData={updateFormData}
                    warehouses={warehouses}
                    inventoryType={inventoryType}
                  />
                )}
                {wizardStep === 1 && (
                  <StepInitialPurchase
                    key="step-1"
                    formData={formData}
                    updateFormData={updateFormData}
                    isInsumo={isInsumo}
                    inventoryType={inventoryType}
                    isEdit={isEdit}
                  />
                )}
                {wizardStep === 2 && (
                  <StepExtras
                    key="step-2"
                    formData={formData}
                    updateFormData={updateFormData}
                    newFieldKey={newFieldKey}
                    setNewFieldKey={setNewFieldKey}
                    newFieldValue={newFieldValue}
                    existingItems={existingItems}
                    setNewFieldValue={setNewFieldValue}
                    onOpenBarcodeScanner={() => setShowCameraScanner(true)}
                  />
                )}
              </AnimatePresence>

              {/* Camera Scanner Overlay */}
              <AnimatePresence>
                {showCameraScanner && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4"
                    onClick={() => setShowCameraScanner(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden w-full max-w-md shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-white" />
                          <span className="text-sm font-bold text-white">Escanear con cámara</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCameraScanner(false)}
                          className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/20 transition"
                        >
                          <IconX className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="aspect-[4/3] relative">
                        <ImprovedBarcodeScanner
                          onScanSuccess={handleCameraScan}
                          onClose={() => setShowCameraScanner(false)}
                          products={existingItems}
                          inline={true}
                          rawMode={true}
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

              {/* Botones de navegación — footer fijo, no scrollea con el contenido */}
              <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-slate-700 pb-safe">
                <div className="flex gap-2">
                  {wizardStep > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="px-4 py-2.5 text-sm rounded-md border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-medium"
                    >
                      ← Anterior
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    Cancelar
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '⏳ Guardando...' : wizardStep < 2 ? 'Continuar →' : (isEdit ? '✓ Guardar cambios' : '✓ Crear producto')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
