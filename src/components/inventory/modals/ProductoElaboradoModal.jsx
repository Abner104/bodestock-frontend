// src/components/inventory/modals/ProductoElaboradoModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChefHat, Plus, Trash2, Search, Package, AlertCircle, Calculator, Camera, Star } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { getUserCompanyId } from '../../../services/companyService';
import { detectUnitType, convertUnit, convertPrice, formatUnitName } from '../../../utils/unitConversions';

// Unidades de uso que tiene sentido ofrecer en una receta -- getCompatibleUnits
// devuelve TODAS las unidades del mismo tipo (ej. para peso: g, kg, lb, oz,
// mg, ton...), pero en una receta de cocina solo importan g/kg (o ml/l para
// líquidos). Limitar a estas evita un selector con 8+ opciones irrelevantes.
const RECIPE_UNIT_CHOICES = {
  weight: ['g', 'kg'],
  volume: ['ml', 'l'],
};

// Redimensiona y convierte imagen a base64 (máx 300x300px)
const resizeImageToBase64 = (file, maxSize = 300) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = e.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const CATEGORIES_BY_TYPE = {
  RESTAURANT: ['Entradas', 'Platos de fondo', 'Pastas', 'Ensaladas', 'Sandwiches', 'Postres', 'Bebidas', 'Otros'],
  default: ['Bebidas calientes', 'Bebidas frías', 'Helados', 'Postres', 'Sandwiches', 'Comidas', 'Snacks', 'Otros'],
};
const UNITS = ['unidad', 'porción', 'vaso', 'taza', 'plato', 'kg', 'g', 'ml', 'l'];

export default function ProductoElaboradoModal({ isOpen, onClose, onSubmit, product = null, inventoryId, warehouses = [], mode = 'create', defaultWarehouseId = null, existingItems = [], inventoryType = null }) {
  const defaultSuggestions = CATEGORIES_BY_TYPE[inventoryType] || CATEGORIES_BY_TYPE.default;
  const existingCategories = [...new Set(existingItems.map(p => p.category).filter(Boolean))].sort();
  const categorySuggestions = [...new Set([...existingCategories, ...defaultSuggestions])];
  const defaultCategory = defaultSuggestions[0];

  const [formData, setFormData] = useState({
    name: '', category: defaultCategory, unit: 'unidad', precioVenta: '', description: '', receta: [], extras: [], presentations: []
  });
  const [insumos, setInsumos] = useState([]);
  const [searchInsumo, setSearchInsumo] = useState('');
  const [showInsumoSearch, setShowInsumoSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadingInsumos, setLoadingInsumos] = useState(false);
  // Multi-foto (hasta 4, mismo límite que ProductWizardModal/StepExtras.jsx
  // para productos simples) -- antes este modal solo permitía UNA foto,
  // mientras que el flujo de producto simple ya soportaba varias. photos =
  // URLs ya guardadas (modo edit) o recién subidas en esta sesión; newFiles
  // = File objects pendientes de convertir a base64 al guardar.
  const [photos, setPhotos] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const MAX_PHOTOS = 4;

  const costoTotal = formData.receta.reduce((sum, item) =>
    sum + (Number(item.costoUnitario) * Number(item.cantidad) || 0), 0);

  // Margen de ganancia -- antes no se calculaba ni se mostraba en ningún
  // punto de este modal (a diferencia del wizard de Costeo viejo, que sí lo
  // tenía), así que no había forma de saber si el precio de venta ingresado
  // era rentable hasta hacer la cuenta a mano. Mismo signo/fórmula que usa
  // ElaboradosGrid.jsx para listar productos ya guardados.
  const precioVentaNum = Number(formData.precioVenta) || 0;
  const margenPorcentaje = precioVentaNum > 0 ? ((precioVentaNum - costoTotal) / precioVentaNum) * 100 : null;


  const loadInsumos = useCallback(async () => {
    if (!inventoryId) return;
    try {
      setLoadingInsumos(true);
      const companyId = await getUserCompanyId();
      let snap = await getDocs(collection(db, `companies/${companyId}/inventories/${inventoryId}/products`));
      let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (items.length === 0) {
        snap = await getDocs(collection(db, `companies/${companyId}/inventory`));
        items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setInsumos(items.filter(i => i.productType !== 'ELABORADO' && !(Array.isArray(i.receta) && i.receta.length > 0)));
    } catch (err) {
      console.error('Error cargando insumos:', err);
    } finally {
      setLoadingInsumos(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    if (!isOpen) return;
    loadInsumos();
    if (mode === 'edit' && product) {
      setFormData({
        name: product.name || '',
        category: product.category || defaultCategory,
        unit: product.unit || 'unidad',
        precioVenta: product.precioVenta || '',
        description: product.description || '',
        receta: product.receta || [],
        extras: product.extras || [],
        presentations: product.presentations || []
      });
      // Compat hacia atrás: productos viejos guardaron una sola foto en
      // photoURL; productos nuevos (o editados desde acá en adelante)
      // guardan el array photos. Mismo patrón que ProductWizardModal ya usa.
      setPhotos(product.photos?.length ? product.photos : (product.photoURL ? [product.photoURL] : []));
    } else {
      setFormData({ name: '', category: defaultCategory, unit: 'unidad', precioVenta: '', description: '', receta: [], extras: [], presentations: [] });
      setPhotos([]);
    }
    setNewFiles([]);
    setError(null);
    setSearchInsumo('');
    setShowInsumoSearch(false);
  }, [isOpen, product, mode, loadInsumos]);

  const insumosFiltrados = insumos.filter(i =>
    i.name?.toLowerCase().includes(searchInsumo.toLowerCase()) &&
    !formData.receta.some(r => r.insumoId === i.id)
  );

  const agregarInsumo = (insumo) => {
    const stockUnit = insumo.unit || 'unidad';
    // Si el insumo se guarda en kg/l, por defecto conviene pedir la receta
    // en la unidad chica (g/ml) -- las cantidades de una receta de cocina
    // casi siempre son fracciones de un kilo o litro (ej. 250g, no 0.25kg),
    // y escribir "0.25" en un campo que dice "kg" es justo la confusión que
    // se está arreglando acá. Insumos ya en g/ml/unidad quedan como están.
    const tipo = detectUnitType(stockUnit);
    const unidadInicial = (stockUnit.toLowerCase() === 'kg' && tipo === 'weight') ? 'g'
      : (stockUnit.toLowerCase() === 'l' && tipo === 'volume') ? 'ml'
      : stockUnit;
    setFormData(prev => ({
      ...prev,
      receta: [...prev.receta, {
        insumoId: insumo.id,
        insumoNombre: insumo.name,
        cantidad: '',
        unidad: unidadInicial,
        // unidadStock se conserva para poder re-convertir el costo si el
        // usuario cambia de unidad después (cambiarUnidadReceta) -- sin
        // esto no hay forma de saber desde qué unidad partió la conversión.
        unidadStock: stockUnit,
        costoUnitario: convertPrice(insumo.ppp || 0, stockUnit, unidadInicial)
      }]
    }));
    setSearchInsumo('');
    setShowInsumoSearch(false);
  };

  // Cambia la unidad en que se expresa ESTE ingrediente dentro de la receta
  // (ej. de "g" a "kg") sin tocar el insumo original en inventario -- solo
  // re-convierte costoUnitario desde unidadStock, la cantidad que el
  // usuario ya escribió se mantiene tal cual (cambiar de g a kg no debería
  // multiplicar/dividir lo que ya tipeó, solo el precio por unidad).
  const cambiarUnidadReceta = (idx, nuevaUnidad) => {
    setFormData(prev => {
      const receta = [...prev.receta];
      const item = receta[idx];
      const insumoOriginal = insumos.find(i => i.id === item.insumoId);
      const baseUnit = item.unidadStock || insumoOriginal?.unit || item.unidad;
      const basePpp = insumoOriginal?.ppp ?? convertPrice(item.costoUnitario, item.unidad, baseUnit);
      receta[idx] = {
        ...item,
        unidad: nuevaUnidad,
        costoUnitario: convertPrice(basePpp, baseUnit, nuevaUnidad)
      };
      return { ...prev, receta };
    });
  };

  const actualizarCantidad = (idx, cantidad) => {
    setFormData(prev => {
      const receta = [...prev.receta];
      receta[idx] = { ...receta[idx], cantidad };
      return { ...prev, receta };
    });
  };

  const quitarInsumo = (idx) => {
    setFormData(prev => ({ ...prev, receta: prev.receta.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) { setError('El nombre del producto es obligatorio'); return; }
    if (formData.receta.length > 0 && formData.receta.some(r => !r.cantidad || Number(r.cantidad) <= 0)) {
      setError('Todos los ingredientes necesitan una cantidad válida'); return;
    }
    if (saving) return;
    setSaving(true);
    try {
      // Convertir las fotos nuevas a base64 (evita problemas de CORS con
      // Storage, mismo truco que ya usaba la versión de una sola foto) y
      // componer el array final: fotos ya guardadas que no se quitaron +
      // las recién subidas, tope 4.
      const newPhotoURLs = await Promise.all(newFiles.map(f => resizeImageToBase64(f)));
      const allPhotos = [...photos, ...newPhotoURLs].slice(0, MAX_PHOTOS);

      // Usar la bodega activa si se pasó, si no buscar "Mostrador", si no la primera
      const mostrador = warehouses.find(w => w.name?.toLowerCase() === 'mostrador');
      const warehouseId = defaultWarehouseId || mostrador?.id || warehouses[0]?.id || '';
      const stockValue = mode === 'edit' ? (product?.stock ?? 0) : 0;
      // Limpiar extras: convertir price a número, filtrar los sin nombre
      const extrasClean = (formData.extras || [])
        .filter(e => e.name?.trim())
        .map(e => ({ id: e.id, name: e.name.trim(), price: Number(e.price) || 0 }));

      // Limpiar presentaciones: filtrar las sin nombre, convertir valores a número
      const presentationsClean = (formData.presentations || [])
        .filter(p => p.name?.trim())
        .map(p => ({ id: p.id, name: p.name.trim(), salePrice: Number(p.salePrice) || 0, factor: Number(p.factor) || 1 }));

      // photoURL se mantiene (primera foto) por compatibilidad hacia atrás
      // con cualquier pantalla que todavía lea solo ese campo en vez de
      // photos[] (ej. ProductCard.jsx, el thumbnail chico de Inventario).
      await onSubmit({ ...formData, description: formData.description.trim(), extras: extrasClean, presentations: presentationsClean, photos: allPhotos, photoURL: allPhotos[0] || '', productType: 'ELABORADO', costoProduccion: costoTotal, stock: stockValue, ppp: costoTotal, margenPorcentaje: margenPorcentaje ?? 0, warehouseId });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4 pb-safe sm:pb-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — colores Bodestock */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <ChefHat className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {mode === 'edit' ? 'Editar Producto Elaborado' : 'Nuevo Producto Elaborado'}
                  </h3>
                  <p className="text-blue-100 text-xs">Los ingredientes se descontarán automáticamente al vender</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Info básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre del producto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Café Latte, Helado de Frutilla, Sandwich de Pollo..."
                    className="w-full px-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Fotos -- hasta 4, mismo límite que productos simples.
                    Antes este modal solo permitía una sola foto. */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fotos <span className="text-slate-400 font-normal">({photos.length + newFiles.length}/{MAX_PHOTOS})</span>
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {photos.map((url, i) => (
                      <div key={`saved-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-600 flex-shrink-0">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {newFiles.map((file, i) => (
                      <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-blue-300 dark:border-blue-600 flex-shrink-0">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {(photos.length + newFiles.length) < MAX_PHOTOS && (
                      <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-700 hover:border-blue-400 transition cursor-pointer flex-shrink-0">
                        <Camera className="w-7 h-7 text-slate-400" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return; }
                          setNewFiles(prev => [...prev, file]);
                          e.target.value = '';
                        }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Descripción -- antes no existía en ningún modal de
                    producto; PublicStore.jsx ya leía este campo pero nunca
                    había forma de llenarlo. */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Descripción <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ej: Jugoso lomo salteado con cebolla, tomate y papas fritas..."
                    rows={2}
                    maxLength={300}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                  <input
                    type="text"
                    list="elaborado-category-suggestions"
                    value={formData.category}
                    onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                    placeholder="Ej: Entradas, Platos de fondo, Postres..."
                    className="w-full px-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <datalist id="elaborado-category-suggestions">
                    {categorySuggestions.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Unidad de venta</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio de venta</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number" min="0"
                      value={formData.precioVenta}
                      onChange={(e) => setFormData(p => ({ ...p, precioVenta: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Receta */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Receta / Ingredientes
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowInsumoSearch(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                {/* Buscador */}
                <AnimatePresence>
                  {showInsumoSearch && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 overflow-hidden"
                    >
                      <div className="border-2 border-blue-300 dark:border-blue-600 rounded-xl overflow-hidden">
                        {/* Search input */}
                        <div className="p-3 bg-blue-50 dark:bg-slate-700 border-b border-blue-200 dark:border-blue-600">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              autoFocus
                              type="text"
                              value={searchInsumo}
                              onChange={(e) => setSearchInsumo(e.target.value)}
                              placeholder="Buscar insumo..."
                              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-600 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {/* Resultados */}
                        <div className="bg-white dark:bg-slate-800 max-h-44 overflow-y-auto">
                          {loadingInsumos ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">Cargando insumos...</p>
                          ) : insumosFiltrados.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                              {searchInsumo ? 'No se encontró ese insumo' : 'No hay insumos disponibles'}
                            </p>
                          ) : (
                            insumosFiltrados.slice(0, 20).map(insumo => (
                              <button
                                key={insumo.id}
                                type="button"
                                onClick={() => agregarInsumo(insumo)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-between border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer group"
                              >
                                <div className="flex items-center gap-2">
                                  <Plus className="w-3.5 h-3.5 text-blue-500 group-hover:text-white flex-shrink-0" />
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-white">{insumo.name}</span>
                                </div>
                                <span className="text-xs text-slate-400 group-hover:text-blue-100 ml-2 flex-shrink-0">
                                  {insumo.stock || 0} {insumo.unit}
                                </span>
                              </button>
                            ))
                          )}
                        </div>

                        <div className="p-2 bg-slate-50 dark:bg-slate-700 border-t border-slate-200 dark:border-slate-600">
                          <button
                            type="button"
                            onClick={() => setShowInsumoSearch(false)}
                            className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1 transition"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Lista ingredientes */}
                {formData.receta.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl">
                    <ChefHat className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 dark:text-slate-500">Sin receta — opcional</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Déjalo vacío si el producto no se prepara con insumos (ej: bebida envasada)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-1 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <span className="col-span-5">Ingrediente</span>
                      <span className="col-span-4 text-center">Cantidad</span>
                      <span className="col-span-3 text-right">Total</span>
                    </div>

                    {formData.receta.map((item, idx) => {
                      const tipoUnidad = detectUnitType(item.unidadStock || item.unidad);
                      const opcionesUnidad = RECIPE_UNIT_CHOICES[tipoUnidad];
                      const insumoStock = insumos.find(i => i.id === item.insumoId)?.stock;

                      return (
                      <motion.div
                        key={item.insumoId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-12 gap-1 items-center p-2 bg-slate-50 dark:bg-slate-700/60 rounded-lg border border-slate-100 dark:border-slate-600"
                      >
                        <div className="col-span-5 flex items-center gap-1">
                          <button type="button" onClick={() => quitarInsumo(idx)} className="text-red-400 hover:text-red-600 transition flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.insumoNombre}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              ${Number(item.costoUnitario).toLocaleString('es-CL', { maximumFractionDigits: 2 })}/{item.unidad}
                              {insumoStock != null && ` · stock: ${insumoStock} ${item.unidadStock || item.unidad}`}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-4 flex items-center gap-1">
                          <input
                            type="number" min="0" step="any"
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(idx, e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm text-center border border-slate-200 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-600 text-slate-900 dark:text-white"
                          />
                          {/* Selector de unidad -- solo para insumos de peso/volumen
                              (g/kg, ml/l), donde escribir la cantidad en la unidad de
                              stock (kg) obliga a decimales confusos para cantidades
                              chicas de receta (250g = "0.25" en un campo que dice kg).
                              Insumos por unidad (ej. "huevo") no tienen conversión que
                              ofrecer, se quedan con el texto fijo de antes. */}
                          {opcionesUnidad ? (
                            <select
                              value={item.unidad}
                              onChange={(e) => cambiarUnidadReceta(idx, e.target.value)}
                              className="text-xs flex-shrink-0 border border-slate-200 dark:border-slate-500 rounded-lg px-1 py-1 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {opcionesUnidad.map(u => <option key={u} value={u}>{formatUnitName(u)}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400 flex-shrink-0">{item.unidad}</span>
                          )}
                        </div>
                        <div className="col-span-3 text-right text-xs text-slate-600 dark:text-slate-300 font-bold">
                          {item.cantidad && item.costoUnitario
                            ? `$${Math.round(Number(item.cantidad) * Number(item.costoUnitario)).toLocaleString('es-CL')}`
                            : '-'}
                        </div>
                      </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Extras / Toppings opcionales al vender */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Extras / Toppings
                    <span className="text-xs font-normal text-slate-400">(opcionales al vender)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const id = `extra_${Date.now()}`;
                      setFormData(prev => ({
                        ...prev,
                        extras: [...(prev.extras || []), { id, name: '', price: '' }]
                      }));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                {(!formData.extras || formData.extras.length === 0) ? (
                  <div className="text-center py-5 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl">
                    <Star className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                    <p className="text-xs text-slate-400 dark:text-slate-500">Sin extras — ej: Oreo, M&M, Crema chantilly</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.extras.map((extra, idx) => (
                      <div key={extra.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={extra.name}
                          onChange={(e) => {
                            const extras = [...formData.extras];
                            extras[idx] = { ...extra, name: e.target.value };
                            setFormData(prev => ({ ...prev, extras }));
                          }}
                          placeholder="Ej: Oreo, Crema, M&M..."
                          className="flex-1 px-3 py-2 text-sm border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        <div className="relative w-28 flex-shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                          <input
                            type="number" min="0"
                            value={extra.price}
                            onChange={(e) => {
                              const extras = [...formData.extras];
                              extras[idx] = { ...extra, price: e.target.value };
                              setFormData(prev => ({ ...prev, extras }));
                            }}
                            placeholder="0"
                            className="w-full pl-7 pr-2 py-2 text-sm border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, extras: prev.extras.filter((_, i) => i !== idx) }))}
                          className="text-red-400 hover:text-red-600 transition flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Presentaciones / Tamaños */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-500" />
                    Tamaños / Presentaciones
                    <span className="text-xs font-normal text-slate-400">(opcional — ej: Chico, Grande)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const id = `pres_${Date.now()}`;
                      setFormData(prev => ({
                        ...prev,
                        presentations: [...(prev.presentations || []), { id, name: '', salePrice: '', factor: 1 }]
                      }));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                {(!formData.presentations || formData.presentations.length === 0) ? (
                  <div className="text-center py-5 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl">
                    <Package className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                    <p className="text-xs text-slate-400 dark:text-slate-500">Sin tamaños — el producto tiene un solo precio</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-1 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <span className="col-span-4">Nombre</span>
                      <span className="col-span-4 text-center">Precio venta</span>
                      <span className="col-span-3 text-center">Factor porción</span>
                      <span className="col-span-1"></span>
                    </div>
                    {formData.presentations.map((pres, idx) => (
                      <div key={pres.id} className="grid grid-cols-12 gap-1 items-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={pres.name}
                            onChange={(e) => {
                              const presentations = [...formData.presentations];
                              presentations[idx] = { ...pres, name: e.target.value };
                              setFormData(prev => ({ ...prev, presentations }));
                            }}
                            placeholder="Ej: Chico, Grande..."
                            className="w-full px-2 py-1.5 text-sm border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="col-span-4 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                          <input
                            type="number" min="0"
                            value={pres.salePrice}
                            onChange={(e) => {
                              const presentations = [...formData.presentations];
                              presentations[idx] = { ...pres, salePrice: e.target.value };
                              setFormData(prev => ({ ...prev, presentations }));
                            }}
                            placeholder="0"
                            className="w-full pl-7 pr-2 py-1.5 text-sm border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number" min="0.01" step="0.01"
                            value={pres.factor}
                            onChange={(e) => {
                              const presentations = [...formData.presentations];
                              presentations[idx] = { ...pres, factor: e.target.value };
                              setFormData(prev => ({ ...prev, presentations }));
                            }}
                            placeholder="1"
                            title="Multiplicador de receta vs tamaño base (ej: Grande = 1.5)"
                            className="w-full px-2 py-1.5 text-sm text-center border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, presentations: prev.presentations.filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
                      Factor porción: multiplica los ingredientes de la receta (ej: Grande = 1.5 usa 1.5x más insumos). Déjalo en 1 si todos los tamaños usan la misma cantidad.
                    </p>
                  </div>
                )}
              </div>

              {/* Resumen costos */}
              {formData.receta.length > 0 && (
                <div className="p-4 bg-blue-600 dark:bg-blue-900/40 border border-blue-500 dark:border-blue-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-white dark:text-blue-400" />
                    <h5 className="font-bold text-white dark:text-blue-300 text-sm">Resumen</h5>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-100 dark:text-slate-400">Costo de producción:</span>
                      <span className="font-bold text-white dark:text-slate-200">${Math.round(costoTotal).toLocaleString('es-CL')}</span>
                    </div>
                    {formData.precioVenta && (
                      <div className="flex justify-between">
                        <span className="text-blue-100 dark:text-slate-400">Precio de venta:</span>
                        <span className="font-bold text-white dark:text-slate-200">${Number(formData.precioVenta).toLocaleString('es-CL')}</span>
                      </div>
                    )}
                    {margenPorcentaje !== null && (
                      <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-blue-500/40 dark:border-blue-700/60">
                        <span className="text-blue-100 dark:text-slate-400">Margen de ganancia:</span>
                        <span className={`font-bold ${margenPorcentaje >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {margenPorcentaje >= 0 ? '+' : ''}{margenPorcentaje.toFixed(0)}%
                          <span className="font-normal text-xs ml-1">
                            (${Math.round(precioVentaNum - costoTotal).toLocaleString('es-CL')})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button" onClick={onClose}
                  className="px-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '⏳ Guardando...' : mode === 'edit' ? '✓ Guardar cambios' : '✓ Crear producto elaborado'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
