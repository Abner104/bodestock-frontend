// src/components/inventory/modals/ImportExcelModal.jsx
import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download } from "lucide-react";

const ImportExcelModal = ({ isOpen, onClose, onImport, warehouses }) => {
  const [step, setStep] = useState(1); // 1: upload, 2: map, 3: preview
  const [file, setFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    stock: '',
    ppp: '',
    salePrice: '',
    provider: '',
    warehouseId: '',
  });
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const systemFields = [
    { key: 'name', label: 'Nombre *', required: true },
    { key: 'sku', label: 'SKU', required: false },
    { key: 'category', label: 'Categoría', required: false },
    { key: 'unit', label: 'Unidad', required: false },
    { key: 'stock', label: 'Stock', required: false },
    { key: 'ppp', label: 'Precio Costo', required: false },
    { key: 'salePrice', label: 'Precio Venta', required: false },
    { key: 'provider', label: 'Proveedor', required: false },
  ];

  // Sugerencias inteligentes para mapeo automático
  const getSuggestedMapping = (header) => {
    const h = header.toLowerCase().trim();

    // Nombre
    if (h.includes('nombre') || h.includes('producto') || h.includes('item') || h.includes('descripcion') || h === 'name' || h === 'product') {
      return 'name';
    }
    // SKU
    if (h.includes('sku') || h.includes('codigo') || h.includes('code') || h.includes('ref')) {
      return 'sku';
    }
    // Categoría
    if (h.includes('categoria') || h.includes('category') || h.includes('tipo') || h.includes('type')) {
      return 'category';
    }
    // Unidad
    if (h.includes('unidad') || h.includes('unit') || h.includes('medida')) {
      return 'unit';
    }
    // Stock
    if (h.includes('stock') || h.includes('cantidad') || h.includes('qty') || h.includes('existencia') || h.includes('inventory')) {
      return 'stock';
    }
    // Precio venta (revisar antes que costo — "precio venta"/"precio de venta" también contiene "precio")
    if (h.includes('venta') || h.includes('sale') || h.includes('pvp')) {
      return 'salePrice';
    }
    // PPP / costo
    if (h.includes('precio') || h.includes('price') || h.includes('ppp') || h.includes('costo') || h.includes('cost') || h.includes('valor')) {
      return 'ppp';
    }
    // Proveedor
    if (h.includes('proveedor') || h.includes('supplier') || h.includes('vendor')) {
      return 'provider';
    }

    return '';
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Leer primera hoja
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (jsonData.length < 2) {
          alert('El archivo debe tener al menos una fila de encabezados y una fila de datos.');
          return;
        }

        // Primera fila son los headers
        const headers = jsonData[0].map(h => String(h || '').trim()).filter(h => h);

        // Resto son los datos
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

        setExcelHeaders(headers);
        setExcelData(rows);

        // Mapeo automático inteligente
        const autoMapping = {};
        headers.forEach(header => {
          const suggestion = getSuggestedMapping(header);
          if (suggestion) {
            autoMapping[suggestion] = header;
          }
        });

        setColumnMapping({ ...columnMapping, ...autoMapping });
        setStep(2);
      } catch (error) {
        console.error('Error leyendo archivo:', error);
        alert('Error al leer el archivo Excel. Verifica que sea un formato válido.');
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleMappingChange = (systemField, excelColumn) => {
    setColumnMapping(prev => ({
      ...prev,
      [systemField]: excelColumn
    }));
  };

  const validateAndPreview = () => {
    // Validar que el campo obligatorio esté mapeado
    if (!columnMapping.name) {
      alert('Debes mapear al menos el campo "Nombre" que es obligatorio.');
      return;
    }

    // Validar que se seleccione una bodega
    if (!selectedWarehouse) {
      alert('Debes seleccionar una bodega para importar los productos.');
      return;
    }

    setStep(3);
  };

  const getMappedData = () => {
    return excelData.map((row, index) => {
      const mappedRow = { rowIndex: index + 2 }; // +2 porque Excel empieza en 1 y hay header

      Object.keys(columnMapping).forEach(systemField => {
        const excelColumn = columnMapping[systemField];
        if (excelColumn) {
          const columnIndex = excelHeaders.indexOf(excelColumn);
          if (columnIndex !== -1) {
            mappedRow[systemField] = row[columnIndex];
          }
        }
      });

      return mappedRow;
    }).filter(row => row.name); // Solo filas con nombre
  };

  const validateData = () => {
    const mappedData = getMappedData();
    const validationErrors = [];

    mappedData.forEach((row, idx) => {
      // Validar nombre (obligatorio)
      if (!row.name || String(row.name).trim() === '') {
        validationErrors.push(`Fila ${row.rowIndex}: Nombre vacío o inválido`);
      }

      // Validar stock (debe ser número si está presente)
      if (row.stock !== undefined && row.stock !== '' && isNaN(Number(row.stock))) {
        validationErrors.push(`Fila ${row.rowIndex}: Stock debe ser un número`);
      }

      // Validar PPP (debe ser número si está presente)
      if (row.ppp !== undefined && row.ppp !== '' && isNaN(Number(row.ppp))) {
        validationErrors.push(`Fila ${row.rowIndex}: PPP debe ser un número`);
      }

      // Validar precio de venta (debe ser número si está presente)
      if (row.salePrice !== undefined && row.salePrice !== '' && isNaN(Number(row.salePrice))) {
        validationErrors.push(`Fila ${row.rowIndex}: Precio Venta debe ser un número`);
      }
    });

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleImport = () => {
    if (!validateData()) {
      alert('Hay errores en los datos. Revisa la lista de errores.');
      return;
    }

    const mappedData = getMappedData();

    // Transformar a formato del sistema
    const productsToImport = mappedData.map(row => ({
      name: String(row.name || '').trim(),
      sku: row.sku ? String(row.sku).trim() : '',
      category: row.category ? String(row.category).trim() : 'Insumo',
      unit: row.unit ? String(row.unit).trim() : 'unidad',
      stock: row.stock ? Number(row.stock) : 0,
      ppp: row.ppp ? Number(row.ppp) : 0,
      ...(row.salePrice ? { salePrice: Number(row.salePrice) } : {}),
      provider: row.provider ? String(row.provider).trim() : '',
      warehouseId: selectedWarehouse,
    }));

    onImport(productsToImport);
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setExcelData([]);
    setExcelHeaders([]);
    setColumnMapping({
      name: '',
      sku: '',
      category: '',
      unit: '',
      stock: '',
      ppp: '',
      salePrice: '',
      provider: '',
      warehouseId: '',
    });
    setSelectedWarehouse('');
    setErrors([]);
    onClose();
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const template = [
      ['Nombre', 'SKU', 'Categoría', 'Unidad', 'Stock', 'Precio Costo', 'Precio Venta', 'Proveedor'],
      ['Producto Ejemplo 1', 'PRD001', 'Insumo', 'unidad', 10, 1500, '', 'Proveedor A'],
      ['Producto Ejemplo 2', 'PRD002', 'Producto', 'kg', 5, 2500, 3990, 'Proveedor B'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
    XLSX.writeFile(workbook, 'plantilla-inventario.xlsx');
  };

  if (!isOpen) {
    console.log('⚪ ImportExcelModal: Modal cerrado (isOpen=false)');
    return null;
  }

  console.log('🟢 ImportExcelModal: Renderizando modal (isOpen=true, step=', step, ')');

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 99999 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Importar desde Excel</h3>
              <p className="text-sm text-slate-600 mt-1">
                {step === 1 && 'Sube tu archivo Excel'}
                {step === 2 && 'Mapea las columnas de tu archivo'}
                {step === 3 && 'Revisa y confirma los datos'}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Steps indicator */}
          <div className="px-6 py-4 border-b bg-slate-50">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  1
                </div>
                <span className="text-sm font-medium text-slate-700">Subir</span>
              </div>
              <div className="flex-1 h-0.5 bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  2
                </div>
                <span className="text-sm font-medium text-slate-700">Mapear</span>
              </div>
              <div className="flex-1 h-0.5 bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 3 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  3
                </div>
                <span className="text-sm font-medium text-slate-700">Confirmar</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Upload */}
            {step === 1 && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="p-4 bg-slate-100 rounded-full">
                      <FileSpreadsheet className="w-12 h-12 text-slate-600" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">
                    Sube tu archivo de Excel
                  </h4>
                  <p className="text-sm text-slate-600 mb-6">
                    Formatos soportados: .xlsx, .xls
                  </p>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium mb-2">
                    Haz clic para seleccionar un archivo
                  </p>
                  <p className="text-sm text-slate-500">
                    o arrastra y suelta aquí
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {file && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-900">{file.name}</p>
                      <p className="text-xs text-emerald-700">
                        {excelHeaders.length} columnas, {excelData.length} filas
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <button
                    onClick={downloadTemplate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Descargar plantilla de ejemplo
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Map columns */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        Mapea las columnas de tu Excel a los campos del sistema
                      </p>
                      <p className="text-xs text-blue-700">
                        Ya hemos detectado automáticamente algunas columnas. Puedes ajustarlas si es necesario.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selección de bodega */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Bodega de destino *
                  </label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <option value="">Seleccionar bodega...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.location && `(${w.location})`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Todos los productos se importarán a esta bodega
                  </p>
                </div>

                {/* Mapeo de columnas */}
                <div className="space-y-4">
                  <h5 className="text-sm font-semibold text-slate-900">Mapeo de columnas</h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {systemFields.map(field => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">
                          {field.label}
                        </label>
                        <select
                          value={columnMapping[field.key] || ''}
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                          <option value="">-- No mapear --</option>
                          {excelHeaders.map(header => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview de primera fila */}
                {excelData.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h6 className="text-xs font-semibold text-slate-700 mb-3">Vista previa (primera fila):</h6>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {Object.entries(columnMapping).filter(([_, col]) => col).map(([field, col]) => {
                        const columnIndex = excelHeaders.indexOf(col);
                        const value = excelData[0]?.[columnIndex];
                        return (
                          <div key={field} className="flex gap-2">
                            <span className="font-medium text-slate-600 min-w-24">{field}:</span>
                            <span className="text-slate-900">{value || '(vacío)'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Preview and confirm */}
            {step === 3 && (
              <div className="space-y-6">
                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900 mb-2">
                          Se encontraron {errors.length} errores:
                        </p>
                        <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                          {errors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {errors.length === 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-900">
                          ¡Todo listo para importar!
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          Se importarán {getMappedData().length} productos
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">Fila</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">Nombre</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">SKU</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">Stock</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">PPP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getMappedData().slice(0, 50).map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600">{row.rowIndex}</td>
                            <td className="px-3 py-2 text-slate-900">{row.name || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.sku || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.stock ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.ppp ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {getMappedData().length > 50 && (
                    <div className="px-4 py-2 bg-slate-50 text-xs text-slate-600 text-center border-t">
                      Mostrando 50 de {getMappedData().length} productos
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-white rounded-lg transition"
                >
                  Atrás
                </button>
              )}
              {step < 3 && (
                <button
                  onClick={() => {
                    if (step === 1 && !file) {
                      alert('Primero debes subir un archivo');
                      return;
                    }
                    if (step === 2) {
                      validateAndPreview();
                    } else {
                      setStep(step + 1);
                    }
                  }}
                  disabled={step === 1 && !file}
                  className="px-6 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={handleImport}
                  disabled={errors.length > 0}
                  className="px-6 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Importar {getMappedData().length} productos
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImportExcelModal;
