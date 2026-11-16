// src/pages/InventoriesManagement.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Store,
  Warehouse,
  ShoppingCart,
  UtensilsCrossed,
  Box,
  Eye,
  EyeOff,
  Loader,
  AlertCircle,
  Link2,
  Copy,
  Check,
  IceCream,
  Coffee,
  Truck,
  CookingPot,
  Palette,
  X,
  Image,
  Type,
  Sun,
  Moon,
  QrCode,
  Download,
  Banknote,
} from 'lucide-react';
import {
  getAllInventories,
  createInventory,
  updateInventory,
  deleteInventory,
  countProductsInInventory,
  countSellableProductsInInventory
} from '../services/inventories-service';
import { getUserCompanyId } from '../services/companyService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { DEFAULT_BUSINESS_TYPE } from '../config/business-types';
import { getWorkerByEmail } from '../services/workers-service';
import { auth, storage } from '../firebase/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const InventoriesManagement = () => {
  const navigate = useNavigate();
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInventory, setEditingInventory] = useState(null);
  const [productCounts, setProductCounts] = useState({});
  // Solo se puebla para inventarios con catalogEnabled=true -- permite
  // avisar en la tarjeta si un inventario YA tenía la tienda activada antes
  // de existir el guardrail de toggleCatalog/handleEdit (ej. "Insumos"
  // activado por error), para que el dueño lo note y lo desactive.
  const [sellableCounts, setSellableCounts] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    type: DEFAULT_BUSINESS_TYPE,
    description: '',
    catalogEnabled: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasLegacyInventory, setHasLegacyInventory] = useState(false);
  const [legacyProductCount, setLegacyProductCount] = useState(0);
  const [companyId, setCompanyId] = useState(null);
  const [companyBusinessType, setCompanyBusinessType] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [themeInventory, setThemeInventory] = useState(null);
  const [themeForm, setThemeForm] = useState({});
  const [savingTheme, setSavingTheme] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    loadInventories();
    checkLegacyInventory();
    loadCompanyId();
  }, []);

  const loadCompanyId = async () => {
    try {
      const id = await getUserCompanyId();
      setCompanyId(id);
      const companySnap = await getDoc(doc(db, 'companies', id));
      if (companySnap.exists()) {
        setCompanyBusinessType(companySnap.data().businessType || null);
      }
    } catch (error) {
      console.error('Error obteniendo companyId:', error);
    }
  };

  const getCatalogUrl = (inventoryId) => {
    return `${window.location.origin}/catalogo-publico/${companyId}/${inventoryId}`;
  };

  const getStoreUrl = (inventoryId) => {
    return `${window.location.origin}/tienda/${companyId}/${inventoryId}`;
  };

  const downloadQRPdf = async (e, inventory) => {
    e.stopPropagation();
    const url = getStoreUrl(inventory.id);
    const name = inventory.name || 'Tienda';

    // Generar QR como data URL usando qrcode library
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Crear PDF con jsPDF
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();

    // Fondo blanco
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pw, 297, 'F');

    // Marco con borde
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(15, 15, pw - 30, 267, 4, 4, 'S');

    // Título del negocio
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(20, 20, 20);
    pdf.text(name, pw / 2, 38, { align: 'center' });

    // Subtítulo
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Escanea el código QR para ver nuestros productos', pw / 2, 48, { align: 'center' });
    pdf.text('y hacer tu pedido fácilmente desde tu celular', pw / 2, 55, { align: 'center' });

    // QR centrado
    const qrSize = 120;
    const qrX = (pw - qrSize) / 2;
    pdf.addImage(qrDataUrl, 'PNG', qrX, 65, qrSize, qrSize);

    // Instrucciones debajo del QR
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(20, 20, 20);
    pdf.text('¿Cómo usar?', pw / 2, 200, { align: 'center' });

    const pasos = [
      '1. Abre la cámara de tu celular',
      '2. Apunta al código QR',
      '3. Elige tus productos y agrega al carrito',
      '4. Confirma tu pedido y paga en caja',
    ];
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    pasos.forEach((paso, i) => {
      pdf.text(paso, pw / 2, 210 + i * 8, { align: 'center' });
    });

    // URL pequeña al fondo
    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 160);
    pdf.text(url, pw / 2, 268, { align: 'center' });

    pdf.save(`QR-${name.replace(/\s+/g, '-')}.pdf`);
  };

  const copyCatalogLink = (e, inventoryId) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getCatalogUrl(inventoryId));
    setCopiedId(`catalog-${inventoryId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyStoreLink = (e, inventoryId) => {
    e.stopPropagation();
    const url = getStoreUrl(inventoryId);
    navigator.clipboard.writeText(url);
    setCopiedId(inventoryId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCatalog = async (e, inventory) => {
    e.stopPropagation();
    try {
      const newValue = !(inventory.catalogEnabled === true);

      // Bloquear activar la tienda pública en un inventario que es
      // puramente de insumos (ej. "Insumos" separado de "Mostrador" en una
      // cocina) -- sin esto, cualquier inventario podía activar su tienda
      // sin relación con si tenía algo vendible, y el cliente final podía
      // terminar viendo un inventario de materias primas como si fuera una
      // tienda real (el bug reportado: "el catálogo muestra Insumos").
      if (newValue) {
        const sellableCount = await countSellableProductsInInventory(inventory.id);
        if (sellableCount === 0) {
          alert(
            `No puedes activar la tienda pública en "${inventory.name}" porque no tiene productos a la venta ` +
            `(solo insumos, o está vacío). Activa la tienda en tu inventario de productos terminados (ej. "Mostrador").`
          );
          return;
        }
      }

      await updateInventory(inventory.id, { catalogEnabled: newValue });
      setInventories(prev => prev.map(inv =>
        inv.id === inventory.id ? { ...inv, catalogEnabled: newValue } : inv
      ));
    } catch (err) {
      alert('Error al actualizar: ' + err.message);
    }
  };

  const checkLegacyInventory = async () => {
    try {
      const count = await countProductsInInventory(null); // null = inventario legacy
      if (count > 0) {
        setHasLegacyInventory(true);
        setLegacyProductCount(count);
      }
    } catch (error) {
      console.log('No hay inventario legacy o error al verificar:', error);
    }
  };

  const loadInventories = async () => {
    try {
      setLoading(true);
      let data = await getAllInventories();

      // Filtrar por inventarios asignados si el usuario tiene restricción
      const currentUser = auth.currentUser;
      if (currentUser) {
        const workerData = await getWorkerByEmail(currentUser.email);
        if (workerData && workerData.assignedInventories && workerData.assignedInventories.length > 0) {
          data = data.filter(inv => workerData.assignedInventories.includes(inv.id));
        }
      }

      setInventories(data);

      // Cargar conteo de productos para cada inventario
      const counts = {};
      for (const inv of data) {
        counts[inv.id] = await countProductsInInventory(inv.id);
      }
      setProductCounts(counts);

      // Solo para los que tienen la tienda activada -- detecta inventarios
      // "tienda activa" sin nada vendible (ver nota en el useState de arriba).
      const sellable = {};
      for (const inv of data) {
        if (inv.catalogEnabled === true) {
          sellable[inv.id] = await countSellableProductsInInventory(inv.id);
        }
      }
      setSellableCounts(sellable);
    } catch (error) {
      console.error('Error cargando inventarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('El nombre del inventario es obligatorio');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createInventory(formData);
      await loadInventories();
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim()) {
      setError('El nombre del inventario es obligatorio');
      return;
    }

    // Mismo guardrail que toggleCatalog: no dejar activar la tienda pública
    // desde el modal de edición en un inventario sin productos vendibles.
    const isEnablingCatalog = formData.catalogEnabled && editingInventory.catalogEnabled !== true;
    if (isEnablingCatalog) {
      const sellableCount = await countSellableProductsInInventory(editingInventory.id);
      if (sellableCount === 0) {
        setError(
          `No puedes activar la tienda pública en "${formData.name}" porque no tiene productos a la venta ` +
          `(solo insumos, o está vacío). Activa la tienda en tu inventario de productos terminados (ej. "Mostrador").`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await updateInventory(editingInventory.id, formData);
      await loadInventories();
      setEditingInventory(null);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inventory) => {
    if (!window.confirm(`¿Estás seguro de eliminar el inventario "${inventory.name}"?\n\nSolo se puede eliminar si no tiene productos.`)) {
      return;
    }

    try {
      await deleteInventory(inventory.id);
      await loadInventories();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetForm = () => {
    // Precargar el tipo de negocio elegido en el registro solo para el primer
    // inventario — si ya tiene otros, no forzamos el tipo (puede tener rubros distintos)
    const defaultType = (inventories.length === 0 && companyBusinessType)
      ? companyBusinessType
      : DEFAULT_BUSINESS_TYPE;
    setFormData({
      name: '',
      type: defaultType,
      description: '',
      catalogEnabled: false
    });
    setError(null);
  };

  const uploadImage = async (file, path, setUploading, field) => {
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setThemeForm(f => ({ ...f, [field]: url }));
    } catch (e) {
      alert('Error al subir imagen: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const openThemeModal = (e, inventory) => {
    e.stopPropagation();
    setThemeInventory(inventory);
    setThemeForm({
      primaryColor: inventory.catalogTheme?.primaryColor || '#3b82f6',
      darkMode: inventory.catalogTheme?.darkMode ?? false,
      logoUrl: inventory.catalogTheme?.logoUrl || '',
      bannerUrl: inventory.catalogTheme?.bannerUrl || '',
      welcomeText: inventory.catalogTheme?.welcomeText || '',
      showStock: inventory.catalogTheme?.showStock ?? true,
      bankTransferEnabled: inventory.catalogTheme?.bankTransferEnabled ?? false,
      bankName: inventory.catalogTheme?.bankName || '',
      bankAccountType: inventory.catalogTheme?.bankAccountType || '',
      bankAccountNumber: inventory.catalogTheme?.bankAccountNumber || '',
      bankAccountHolder: inventory.catalogTheme?.bankAccountHolder || '',
      bankAccountRut: inventory.catalogTheme?.bankAccountRut || '',
      bankAccountEmail: inventory.catalogTheme?.bankAccountEmail || '',
    });
  };

  const saveTheme = async () => {
    if (!themeInventory) return;
    setSavingTheme(true);
    try {
      await updateInventory(themeInventory.id, { catalogTheme: themeForm });
      setInventories(prev => prev.map(inv =>
        inv.id === themeInventory.id ? { ...inv, catalogTheme: themeForm } : inv
      ));
      setThemeInventory(null);
    } catch (err) {
      alert('Error al guardar tema: ' + err.message);
    } finally {
      setSavingTheme(false);
    }
  };

  const openEditModal = (inventory) => {
    setEditingInventory(inventory);
    setFormData({
      name: inventory.name,
      type: inventory.type,
      description: inventory.description || '',
      catalogEnabled: inventory.catalogEnabled || false
    });
    setError(null);
  };

  const getTypeIcon = (type) => {
    const icons = {
      RETAIL: Store,
      WHOLESALE: Warehouse,
      RESTAURANT: UtensilsCrossed,
      WAREHOUSE: Box,
      HELADERIA: IceCream,
      CAFETERIA: Coffee,
      FOODTRUCK: Truck,
      PANADERIA: CookingPot,
      OTHER: Package
    };
    return icons[type] || Package;
  };

  const getTypeLabel = (type) => {
    const labels = {
      RETAIL: 'Retail / Minimarket',
      WHOLESALE: 'Distribuidora / Mayorista',
      RESTAURANT: 'Restaurante / Cocina',
      WAREHOUSE: 'Bodega / Almacén',
      HELADERIA: 'Heladería / Repostería',
      CAFETERIA: 'Cafetería / Bar',
      FOODTRUCK: 'Food Truck',
      PANADERIA: 'Panadería / Pastelería',
      fashion: 'Tienda de Ropa / Fashion',
      OTHER: 'Otro'
    };
    return labels[type] || 'Otro';
  };

  // Tipos que usan productos elaborados con receta
  const isProductionType = (type) => {
    return ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'].includes(type);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2 flex items-center gap-3">
              <Package className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              Mis Inventarios
            </h1>
            <p className="text-sm sm:text-base text-slate-600">Crea y gestiona múltiples inventarios para tus negocios</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-lg self-start sm:self-auto"
          >
            <Plus className="w-5 h-5" />
            Nuevo Inventario
          </button>
        </div>

        {/* Lista de Inventarios */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : inventories.length === 0 && !hasLegacyInventory ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No tienes inventarios</h3>
            <p className="text-slate-600 mb-4">
              Crea tu primer inventario para comenzar a gestionar productos
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crear Primer Inventario
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Inventario Principal (legacy) */}
            {hasLegacyInventory && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer border-2 border-blue-200"
                onClick={() => navigate('/inventario')}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Package className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Inventario Principal</h3>
                        <p className="text-xs text-slate-500">Inventario original</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      Principal
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Productos</span>
                    <span className="text-lg font-bold text-slate-900">{legacyProductCount}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {inventories.map(inventory => {
              const TypeIcon = getTypeIcon(inventory.type);
              const productCount = productCounts[inventory.id] || 0;

              return (
                <motion.div
                  key={inventory.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100"
                >
                  {/* Header con color de acento */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <TypeIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight">{inventory.name}</h3>
                        <p className="text-blue-100 text-xs">{getTypeLabel(inventory.type)}</p>
                      </div>
                    </div>
                    {/* Toggle tienda con carrito */}
                    <button
                      onClick={(e) => toggleCatalog(e, inventory)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        inventory.catalogEnabled === true
                          ? 'bg-white text-blue-600'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                      title={inventory.catalogEnabled === true ? 'Desactivar tienda con carrito' : 'Activar tienda con carrito'}
                    >
                      {inventory.catalogEnabled === true ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {inventory.catalogEnabled === true ? 'Tienda activa' : 'Tienda off'}
                    </button>
                  </div>

                  <div className="p-5 space-y-3">
                    {/* Stat productos */}
                    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl">
                      <span className="text-sm text-slate-500 flex items-center gap-1.5"><Package className="w-4 h-4" /> Productos</span>
                      <span className="text-lg font-black text-slate-900">{productCount}</span>
                    </div>

                    {/* Aviso: tienda activada en un inventario sin nada
                        vendible (ej. "Insumos") -- cubre el caso de
                        inventarios que ya tenían catalogEnabled=true antes
                        de existir el guardrail en toggleCatalog/handleEdit,
                        que solo bloquea activaciones NUEVAS. */}
                    {inventory.catalogEnabled === true && sellableCounts[inventory.id] === 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Esta tienda no tiene productos a la venta</p>
                          <p className="text-xs text-amber-700">
                            "{inventory.name}" solo tiene insumos (o está vacío). Si es tu inventario de ingredientes, desactiva la tienda con el botón de arriba.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Catálogo público — siempre disponible */}
                    {companyId && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-bold text-blue-700">Catálogo público</span>
                            <span className="text-[9px] bg-blue-100 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-200">Sin carrito</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); window.open(getCatalogUrl(inventory.id), '_blank'); }} className="p-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg transition-all" title="Ver catálogo">
                              <Eye className="w-3 h-3 text-blue-600" />
                            </button>
                            <button onClick={(e) => copyCatalogLink(e, inventory.id)} className="p-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg transition-all" title="Copiar link">
                              {copiedId === `catalog-${inventory.id}` ? <Check className="w-3 h-3 text-blue-600" /> : <Copy className="w-3 h-3 text-blue-600" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-blue-400 font-mono truncate">{getCatalogUrl(inventory.id)}</p>
                      </div>
                    )}

                    {/* Tienda con carrito — addon */}
                    {inventory.catalogEnabled === true && companyId && (
                      <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-bold text-green-700">Tienda con carrito</span>
                            <span className="text-[9px] bg-green-100 text-green-400 px-1.5 py-0.5 rounded-full border border-green-200">Addon</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); window.open(getStoreUrl(inventory.id), '_blank'); }} className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-all" title="Abrir tienda">
                              <Eye className="w-3 h-3 text-green-600" />
                            </button>
                            <button onClick={(e) => copyStoreLink(e, inventory.id)} className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-all" title="Copiar link">
                              {copiedId === inventory.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-green-600" />}
                            </button>
                            <button onClick={(e) => downloadQRPdf(e, inventory)} className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-all" title="Descargar QR para imprimir">
                              <QrCode className="w-3 h-3 text-green-600" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-green-400 font-mono truncate">
                          {getStoreUrl(inventory.id)}
                        </p>
                      </div>
                    )}

                    {/* Description */}
                    {inventory.description && (
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                        {inventory.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => navigate(`/inventario/${inventory.id}`)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Abrir inventario
                      </button>
                      <button
                        onClick={(e) => openThemeModal(e, inventory)}
                        className="w-10 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl transition-all flex items-center justify-center"
                        title="Personalizar catálogo"
                      >
                        <Palette className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(inventory); }}
                        className="w-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all flex items-center justify-center"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(inventory); }}
                        className="w-10 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all flex items-center justify-center"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      <AnimatePresence>
        {(showCreateModal || editingInventory) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowCreateModal(false);
                setEditingInventory(null);
                resetForm();
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  {editingInventory ? 'Editar Inventario' : 'Nuevo Inventario'}
                </h2>

                {error && (
                  error.startsWith('Límite alcanzado') ? (
                    <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">🚀</span>
                        <div>
                          <p className="font-bold text-amber-800 text-sm">Plan alcanzado</p>
                          <p className="text-amber-700 text-sm mt-0.5">{error}</p>
                        </div>
                      </div>
                      <a
                        href="https://wa.me/56912345678?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20plan%20Profesional"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                      >
                        💬 Hablar con soporte para hacer upgrade
                      </a>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Nombre del Inventario <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Minimarket Centro, Distribuidora, Restaurante..."
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Tipo de Negocio
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <optgroup label="Venta directa (sin elaboración)">
                        <option value="RETAIL">🏪 Retail / Minimarket</option>
                        <option value="WHOLESALE">🏭 Distribuidora / Mayorista</option>
                        <option value="WAREHOUSE">📦 Bodega / Almacén</option>
                        <option value="fashion">👗 Tienda de Ropa / Fashion</option>
                      </optgroup>
                      <optgroup label="Con productos elaborados (receta)">
                        <option value="HELADERIA">🍦 Heladería / Repostería</option>
                        <option value="CAFETERIA">☕ Cafetería / Bar</option>
                        <option value="FOODTRUCK">🚚 Food Truck</option>
                        <option value="PANADERIA">🥐 Panadería / Pastelería</option>
                        <option value="RESTAURANT">🍽️ Restaurante / Cocina</option>
                      </optgroup>
                      <option value="OTHER">Otro</option>
                    </select>
                    {isProductionType(formData.type) && (
                      <p className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        ✨ Este tipo de negocio permite crear <strong>productos elaborados con receta</strong>. Al vender, los ingredientes se descuentan automáticamente del inventario.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descripción breve del inventario..."
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div
                    className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.catalogEnabled
                        ? 'bg-green-500/10 border-green-500/40'
                        : 'bg-white/[0.04] border-white/10'
                    }`}
                    onClick={() => setFormData({ ...formData, catalogEnabled: !formData.catalogEnabled })}
                  >
                    <div className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${
                      formData.catalogEnabled ? 'bg-green-500' : 'bg-white/20'
                    }`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        formData.catalogEnabled ? 'left-5' : 'left-1'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {formData.catalogEnabled ? '🛒 Tienda pública activada' : 'Activar tienda pública'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formData.catalogEnabled
                          ? 'Los clientes pueden ver productos y hacer pedidos online'
                          : 'Activa para generar un link público con carrito de compras'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingInventory(null);
                      resetForm();
                    }}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-lg transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={editingInventory ? handleEdit : handleCreate}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        {editingInventory ? 'Actualizar' : 'Crear Inventario'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal Personalizar Catálogo ── */}
      <AnimatePresence>
        {themeInventory && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setThemeInventory(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#111118] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-400" />
                    <div>
                      <h2 className="text-white font-bold text-base">Personalizar catálogo</h2>
                      <p className="text-gray-500 text-xs">{themeInventory.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setThemeInventory(null)} className="w-8 h-8 bg-white/[0.06] hover:bg-white/10 rounded-lg flex items-center justify-center transition-all">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Preview mini */}
                <div
                  className="mx-6 mt-5 rounded-xl overflow-hidden border border-white/[0.07] h-20 flex items-center justify-center relative"
                  style={{ background: themeForm.darkMode ? '#0a0a0f' : '#f8fafc' }}
                >
                  {themeForm.bannerUrl && (
                    <img src={themeForm.bannerUrl} alt="banner" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  )}
                  <div className="relative text-center flex flex-col items-center gap-1">
                    {themeForm.logoUrl && (
                      <img src={themeForm.logoUrl} alt="logo" className="w-8 h-8 rounded-lg object-cover" onError={e => e.target.style.display='none'} />
                    )}
                    <p className="font-bold text-sm" style={{ color: themeForm.darkMode ? '#fff' : '#0f172a' }}>
                      {themeInventory.name}
                    </p>
                    {themeForm.welcomeText && (
                      <p className="text-xs mt-0.5" style={{ color: themeForm.primaryColor }}>{themeForm.welcomeText}</p>
                    )}
                  </div>
                  <div
                    className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ background: themeForm.primaryColor }}
                  >Vista previa</div>
                </div>

                {/* Opciones */}
                <div className="px-6 py-5 space-y-5">

                  {/* Color primario */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Color primario</label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="color"
                          value={themeForm.primaryColor}
                          onChange={e => setThemeForm(f => ({ ...f, primaryColor: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <div
                          className="w-12 h-12 rounded-xl border-2 border-white/20 shadow-lg transition-transform group-hover:scale-105"
                          style={{ background: themeForm.primaryColor }}
                        />
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{themeForm.primaryColor.toUpperCase()}</p>
                        <p className="text-gray-500 text-xs">Toca para elegir cualquier color</p>
                      </div>
                    </label>
                  </div>

                  {/* Modo oscuro / claro */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Fondo del catálogo</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setThemeForm(f => ({ ...f, darkMode: false }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          !themeForm.darkMode ? 'bg-white text-slate-900 border-white' : 'bg-white/[0.04] text-gray-400 border-white/10'
                        }`}
                      >
                        <Sun className="w-4 h-4" /> Claro
                      </button>
                      <button
                        onClick={() => setThemeForm(f => ({ ...f, darkMode: true }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          themeForm.darkMode ? 'bg-[#0a0a0f] text-white border-white/20' : 'bg-white/[0.04] text-gray-400 border-white/10'
                        }`}
                      >
                        <Moon className="w-4 h-4" /> Oscuro
                      </button>
                    </div>
                  </div>

                  {/* Logo */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" /> Logo
                    </label>
                    <div className="flex items-center gap-3">
                      {themeForm.logoUrl
                        ? <img src={themeForm.logoUrl} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0" onError={e => e.target.style.display='none'} />
                        : <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Image className="w-5 h-5 text-gray-600" />
                          </div>
                      }
                      <label className="flex-1 cursor-pointer">
                        <div className="w-full py-2.5 px-4 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 text-center transition-all flex items-center justify-center gap-2">
                          {uploadingLogo
                            ? <><Loader className="w-4 h-4 animate-spin" /> Subiendo...</>
                            : <><Image className="w-4 h-4" /> {themeForm.logoUrl ? 'Cambiar logo' : 'Subir logo'}</>
                          }
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(file, `catalogs/${themeInventory.id}/logo_${Date.now()}`, setUploadingLogo, 'logoUrl');
                        }} />
                      </label>
                      {themeForm.logoUrl && (
                        <button onClick={() => setThemeForm(f => ({ ...f, logoUrl: '' }))} className="w-8 h-8 bg-red-500/20 hover:bg-red-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Banner portada */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" /> Imagen de portada
                    </label>
                    {themeForm.bannerUrl && (
                      <img src={themeForm.bannerUrl} alt="banner" className="w-full h-20 object-cover rounded-xl mb-2 border border-white/10" onError={e => e.target.style.display='none'} />
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <div className="w-full py-2.5 px-4 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 text-center transition-all flex items-center justify-center gap-2">
                          {uploadingBanner
                            ? <><Loader className="w-4 h-4 animate-spin" /> Subiendo...</>
                            : <><Image className="w-4 h-4" /> {themeForm.bannerUrl ? 'Cambiar portada' : 'Subir portada'}</>
                          }
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(file, `catalogs/${themeInventory.id}/banner_${Date.now()}`, setUploadingBanner, 'bannerUrl');
                        }} />
                      </label>
                      {themeForm.bannerUrl && (
                        <button onClick={() => setThemeForm(f => ({ ...f, bannerUrl: '' }))} className="w-10 bg-red-500/20 hover:bg-red-500/30 rounded-xl flex items-center justify-center">
                          <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Texto bienvenida */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" /> Texto de bienvenida
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Bienvenido a nuestra heladería"
                      value={themeForm.welcomeText}
                      onChange={e => setThemeForm(f => ({ ...f, welcomeText: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                    />
                  </div>

                  {/* Mostrar stock */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Mostrar stock disponible</p>
                      <p className="text-xs text-gray-500">Los clientes verán cuántas unidades quedan</p>
                    </div>
                    <button
                      onClick={() => setThemeForm(f => ({ ...f, showStock: !f.showStock }))}
                      className={`w-12 h-6 rounded-full transition-all relative ${themeForm.showStock ? 'bg-purple-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${themeForm.showStock ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Pago por transferencia -- junto a efectivo/tarjeta en
                      mostrador y Mercado Pago (ver canPayOnline en
                      PublicStore.jsx). Los datos bancarios se guardan en
                      catalogTheme (metadata del inventario) igual que el
                      resto de la personalización -- no son credenciales
                      secretas como el token de MP, solo info para que el
                      cliente transfiera. */}
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                          <Banknote className="w-4 h-4" /> Aceptar transferencia
                        </p>
                        <p className="text-xs text-gray-500">Muestra tus datos bancarios al cliente para que transfiera</p>
                      </div>
                      <button
                        onClick={() => setThemeForm(f => ({ ...f, bankTransferEnabled: !f.bankTransferEnabled }))}
                        className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${themeForm.bankTransferEnabled ? 'bg-purple-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${themeForm.bankTransferEnabled ? 'left-6' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {themeForm.bankTransferEnabled && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            placeholder="Banco (ej: BancoEstado)"
                            value={themeForm.bankName}
                            onChange={e => setThemeForm(f => ({ ...f, bankName: e.target.value }))}
                            className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                          />
                          <input
                            type="text"
                            placeholder="Tipo (ej: Cta. Corriente)"
                            value={themeForm.bankAccountType}
                            onChange={e => setThemeForm(f => ({ ...f, bankAccountType: e.target.value }))}
                            className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Número de cuenta"
                          value={themeForm.bankAccountNumber}
                          onChange={e => setThemeForm(f => ({ ...f, bankAccountNumber: e.target.value }))}
                          className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                        />
                        <div className="grid grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            placeholder="RUT titular"
                            value={themeForm.bankAccountRut}
                            onChange={e => setThemeForm(f => ({ ...f, bankAccountRut: e.target.value }))}
                            className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                          />
                          <input
                            type="text"
                            placeholder="Nombre titular"
                            value={themeForm.bankAccountHolder}
                            onChange={e => setThemeForm(f => ({ ...f, bankAccountHolder: e.target.value }))}
                            className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                          />
                        </div>
                        <input
                          type="email"
                          placeholder="Email para enviar comprobante (opcional)"
                          value={themeForm.bankAccountEmail}
                          onChange={e => setThemeForm(f => ({ ...f, bankAccountEmail: e.target.value }))}
                          className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex gap-3">
                  <button
                    onClick={() => setThemeInventory(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-gray-400 font-semibold text-sm transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveTheme}
                    disabled={savingTheme}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2"
                    style={{ background: themeForm.primaryColor }}
                  >
                    {savingTheme ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoriesManagement;
