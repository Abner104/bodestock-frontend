// src/components/inventory/modals/ProductWizardModal/StepExtras.jsx
/**
 * Step 3: Información adicional (opcional)
 * Campos: Proveedor, SKU, Fecha de vencimiento, Campos personalizados
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X as IconX, Camera, ImagePlus, Mic, Plus, Printer, Download } from 'lucide-react';
import PromoVolumenEditor from '../PromoVolumenEditor';

// ── Preview de código de barras CODE-128 ─────────────
function BarcodePreview({ sku, name, price }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sku || !canvasRef.current) return;
    setReady(false);
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(canvasRef.current, sku, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          text: sku,
          fontSize: 13,
          fontOptions: 'bold',
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
        setReady(true);
      } catch (e) {
        console.warn('Error generando barcode:', e);
      }
    });
  }, [sku]);

  const downloadLabel = async () => {
    const JsBarcode = (await import('jsbarcode')).default;
    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [62, 38] });

    // Generar barcode en canvas temporal
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, sku, {
      format: 'CODE128',
      width: 2.5,
      height: 50,
      displayValue: false,
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000',
    });

    const pw = pdf.internal.pageSize.getWidth();

    // Nombre del producto
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(20, 20, 20);
    const lines = pdf.splitTextToSize(name || 'Producto', pw - 4);
    pdf.text(lines.slice(0, 2), pw / 2, 6, { align: 'center' });

    // Código de barras
    const img = canvas.toDataURL('image/png');
    const bW = pw - 6;
    const bH = 16;
    const bY = lines.length > 1 ? 10 : 8;
    pdf.addImage(img, 'PNG', 3, bY, bW, bH);

    // SKU en texto
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(60, 60, 60);
    pdf.text(sku, pw / 2, bY + bH + 3, { align: 'center' });

    // Precio si existe
    if (price > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(20, 20, 20);
      const priceCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price);
      pdf.text(priceCLP, pw - 2, bY + bH + 3, { align: 'right' });
    }

    pdf.save(`etiqueta-${sku}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 p-3 bg-white dark:bg-slate-800 border-2 border-violet-300 dark:border-violet-600 rounded-xl"
    >
      <p className="text-xs font-bold text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-1.5">
        <Printer className="w-3.5 h-3.5" />
        Vista previa de etiqueta
      </p>

      {/* Canvas con el código de barras real CODE-128 */}
      <div className="flex justify-center bg-white rounded-lg p-2 border border-slate-200 dark:border-slate-600 mb-3">
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-800 mb-1 truncate max-w-[200px]">{name}</p>
          <canvas ref={canvasRef} className="max-w-full" />
          {price > 0 && (
            <p className="text-[10px] font-bold text-slate-700 mt-1">
              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price)}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={downloadLabel}
        disabled={!ready}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Descargar etiqueta (62×38mm)
      </button>
      <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center mt-1">
        Formato CODE-128 · Compatible con pistola láser y cámara
      </p>
    </motion.div>
  );
}

const CATEGORY_PREFIXES = {
  'Licores': 'LIC',
  'Insumo': 'INS',
  'Bebidas': 'BEB',
  'Producto': 'PRD',
  'Alimentos': 'ALI',
  'Limpieza': 'LIM',
};

export default function StepExtras({
  formData,
  updateFormData,
  newFieldKey,
  setNewFieldKey,
  newFieldValue,
  setNewFieldValue,
  onOpenBarcodeScanner,
  existingItems = []
}) {
  const [nuevoAlias, setNuevoAlias] = useState('');

  const precioBase = parseFloat(
    formData._tempUnitPrice ||
    formData.salePrice ||
    formData.precioVenta ||
    0
  );

  const agregarAlias = () => {
    const alias = nuevoAlias.trim().toLowerCase();
    if (!alias) return;
    const aliases = formData.aliases || [];
    if (aliases.includes(alias)) { setNuevoAlias(''); return; }
    updateFormData({ aliases: [...aliases, alias] });
    setNuevoAlias('');
  };

  const quitarAlias = (a) => {
    updateFormData({ aliases: (formData.aliases || []).filter(x => x !== a) });
  };

  const generateSKU = () => {
    const category = formData.category || 'PRD';
    const prefix = CATEGORY_PREFIXES[category] || category.substring(0, 3).toUpperCase();
    const existingWithPrefix = existingItems.filter(
      item => item.sku && item.sku.startsWith(prefix + '-')
    ).length;
    const nextNum = String(existingWithPrefix + 1).padStart(3, '0');
    updateFormData({ sku: `${prefix}-${nextNum}` });
  };

  const handleAddCustomField = () => {
    if (newFieldKey.trim() && newFieldValue.trim()) {
      updateFormData({
        customFields: {
          ...formData.customFields,
          [newFieldKey.trim()]: newFieldValue.trim()
        }
      });
      setNewFieldKey('');
      setNewFieldValue('');
    }
  };

  const handleRemoveCustomField = (key) => {
    const newCustomFields = { ...formData.customFields };
    delete newCustomFields[key];
    updateFormData({ customFields: newCustomFields });
  };

  return (
    <motion.div
      className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs">
          3
        </span>
        Extras (Opcional)
      </h4>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
        SKU, proveedor, fecha de vencimiento, etc.
      </p>

      <div className="space-y-3">
        {/* Fotos del producto (hasta 4) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            📷 Fotos del producto
            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              (Opcional - hasta 4, max 5MB c/u)
            </span>
          </label>
          {(() => {
            // Fotos ya guardadas (URLs) — compatible con productos viejos de una sola foto
            const existingPhotos = formData.photos || (formData.photoURL ? [formData.photoURL] : []);
            // Archivos nuevos elegidos en esta sesión, aún no subidos
            const newFiles = formData.photoFiles || [];
            const totalCount = existingPhotos.length + newFiles.length;

            const removeExisting = (url) => {
              updateFormData({ photos: existingPhotos.filter(p => p !== url) });
            };
            const removeNewFile = (index) => {
              updateFormData({ photoFiles: newFiles.filter((_, i) => i !== index) });
            };
            const addFile = (file) => {
              if (file.size > 5 * 1024 * 1024) {
                alert('La imagen no puede superar 5MB');
                return;
              }
              updateFormData({ photoFiles: [...newFiles, file] });
            };

            return (
              <div className="flex items-center gap-3 flex-wrap">
                {existingPhotos.map((url) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt="Foto del producto"
                      className="w-20 h-20 rounded-lg object-cover border-2 border-slate-300 dark:border-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeExisting(url)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                    >
                      <IconX className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {newFiles.map((file, index) => (
                  <div key={`new-${index}`} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      className="w-20 h-20 rounded-lg object-cover border-2 border-blue-400 dark:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewFile(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                    >
                      <IconX className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {totalCount < 4 && (
                  <label className="w-20 h-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition bg-white dark:bg-slate-700">
                    <ImagePlus className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Subir</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) addFile(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })()}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Se mostrarán en el catálogo{' '}
            {(formData.photos?.length || (formData.photoURL ? 1 : 0)) + (formData.photoFiles?.length || 0) > 1
              ? 'como galería'
              : ''}
          </p>
        </div>

        {/* Proveedor */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            🏢 Proveedor
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            value={formData.provider}
            onChange={(e) => updateFormData({ provider: e.target.value })}
            placeholder="Nombre del proveedor"
          />
        </div>

        {/* SKU / Código de barras */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            🏷️ Código de Barras / SKU
          </label>

          {/* Indicador visual de modo */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🔫</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-purple-900 dark:text-purple-100">Pistola Láser USB</p>
                <p className="text-xs text-purple-700 dark:text-purple-300">Conecta la pistola, haz clic en el campo de abajo y escanea el código</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-3 border-2 border-purple-300 dark:border-purple-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              value={formData.sku}
              onChange={(e) => updateFormData({ sku: e.target.value.toUpperCase() })}
              placeholder="Haz clic aquí y escanea con la pistola..."
              autoComplete="off"
            />
            {onOpenBarcodeScanner && (
              <button
                type="button"
                onClick={onOpenBarcodeScanner}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex-shrink-0"
                title="Escanear con cámara del celular"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600"></div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">o si no tiene código</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600"></div>
          </div>

          {/* Botón Auto SKU */}
          <button
            type="button"
            onClick={generateSKU}
            className="w-full px-4 py-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition text-sm font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-lg">✨</span>
            Generar SKU Interno (sin código de barras)
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 ml-1">
            El Auto SKU genera códigos internos tipo <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">LIC-001</span>, <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">BEB-002</span>, etc.
          </p>

          {/* Preview de etiqueta cuando hay SKU */}
          {formData.sku && (
            <BarcodePreview
              sku={formData.sku}
              name={formData.name}
              price={formData.precioVenta || formData.salePrice || formData.price || 0}
            />
          )}
        </div>

        {/* Fecha de vencimiento */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            📅 Fecha de Vencimiento
            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              (Opcional)
            </span>
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={formData.expiryDate}
            onChange={(e) => updateFormData({ expiryDate: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-1">
            ⏰ Te avisaremos cuando el producto esté por vencer
          </p>
        </div>

        {/* Alias de voz — nombres alternativos para reconocimiento por voz */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
          <div className="border-2 border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-violet-50 dark:bg-violet-950/40">
              <div className="w-6 h-6 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
                <Mic className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-violet-900 dark:text-violet-200">Alias de voz</p>
                <p className="text-[11px] text-violet-600/70 dark:text-violet-400/70">Nombres cortos para dictar más rápido</p>
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800/50">
              {/* Chips de alias existentes */}
              {(formData.aliases || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(formData.aliases || []).map(a => (
                    <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 text-xs font-semibold rounded-full">
                      "{a}"
                      <button type="button" onClick={() => quitarAlias(a)} className="text-violet-500 hover:text-violet-700 ml-0.5">
                        <IconX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Input nuevo alias */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoAlias}
                  onChange={e => setNuevoAlias(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarAlias())}
                  placeholder='Ej: "coca chica", "la grande", "roja"'
                  className="flex-1 px-3 py-2 border border-violet-200 dark:border-violet-700 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={agregarAlias}
                  disabled={!nuevoAlias.trim()}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Promociones por volumen */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
          <PromoVolumenEditor
            promociones={formData.promociones || []}
            onChange={(nuevas) => updateFormData({ promociones: nuevas })}
            precioBase={precioBase}
          />
        </div>

        {/* Campos personalizados */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-900 dark:text-white">
              ✨ Campos personalizados
            </label>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Color, Talla, Material, etc.
            </span>
          </div>

          {/* Lista de campos existentes */}
          {Object.keys(formData.customFields).length > 0 && (
            <div className="mb-3 space-y-2">
              {Object.entries(formData.customFields).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                >
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {key}:
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {value}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(key)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar nuevo campo */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nombre (ej: Color)"
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              className="px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Valor (ej: Rojo)"
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
              className="px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomField}
            className="w-full mt-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium"
          >
            + Agregar Campo
          </button>
        </div>
      </div>
    </motion.div>
  );
}
