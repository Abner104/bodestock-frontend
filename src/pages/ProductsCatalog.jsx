// src/pages/ProductsCatalog.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Search, FileText, FileSpreadsheet, RefreshCw, Package } from 'lucide-react';
import { db } from '../firebase/firebase.js';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';

const ProductsCatalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ===== Cargar productos desde Firestore =====
  const loadProducts = async () => {
    try {
      setLoading(true);

      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('No se pudo obtener companyId');
        alert('Error: No se pudo identificar la empresa del usuario');
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, `companies/${companyId}/productos_terminados`),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => {
        const data = doc.data();

        // Manejar tanto Timestamps de Firebase como strings ISO
        let createdAt = new Date();
        if (data.createdAt) {
          if (typeof data.createdAt === 'string') {
            // Es un string ISO (formato antiguo)
            createdAt = new Date(data.createdAt);
          } else if (data.createdAt.toDate) {
            // Es un Timestamp de Firebase (formato nuevo)
            createdAt = data.createdAt.toDate();
          }
        }

        let updatedAt = new Date();
        if (data.updatedAt) {
          if (typeof data.updatedAt === 'string') {
            updatedAt = new Date(data.updatedAt);
          } else if (data.updatedAt.toDate) {
            updatedAt = data.updatedAt.toDate();
          }
        }

        // Normalizar campos para soportar AMBAS versiones del wizard
        // Versión ANTIGUA: costoFinal, precioVenta, seDividePorPorciones, numeroPorciones
        // Versión NUEVA: costoTotal, precioSugerido, seDivide, cantidadDivisiones
        const normalized = {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
          // Normalizar costo
          costoFinal: data.costoFinal || data.costoTotal || 0,
          // Normalizar precio
          precioVenta: data.precioVenta || data.precioSugerido || 0,
          // Normalizar división
          seDividePorPorciones: data.seDividePorPorciones ?? data.seDivide ?? false,
          // Normalizar número de porciones
          numeroPorciones: data.numeroPorciones || data.cantidadDivisiones || 1,
          // Calcular precio por porción si no existe
          precioPorPorcion: data.precioPorPorcion || (
            (data.seDivide && data.cantidadDivisiones > 0)
              ? (data.precioSugerido || 0) / data.cantidadDivisiones
              : (data.precioVenta || data.precioSugerido || 0)
          )
        };

        return normalized;
      });

      setProducts(productsData);
    } catch (error) {
      console.error('Error cargando productos:', error);
      alert('Error al cargar los productos. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // ===== Filtrado de productos =====
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase().trim();
    return products.filter(product =>
      product.nombre?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query) ||
      product.id.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  // ===== Formateo de moneda =====
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(Number(amount) || 0);

  // ===== Formateo de fecha =====
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-CL');
  };

  // ===== Exportación a PDF =====
  const exportToPDF = async () => {
    try {
      console.log('Iniciando generación de PDF...');

      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();

      // Título simple
      doc.setFontSize(16);
      doc.text('Catalogo de Productos', 20, 20);

      // Fecha
      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 30);
      doc.text(`Total productos: ${filteredProducts.length}`, 20, 35);

      // Datos simplificados
      const tableData = filteredProducts.map(product => [
        product.nombre || 'Sin nombre',
        product.sku || 'N/A',
        `$${Math.round(product.costoFinal || 0).toLocaleString()}`,
        `$${Math.round(product.precioVenta || 0).toLocaleString()}`,
        product.seDividePorPorciones ? product.numeroPorciones : '1'
      ]);

      // Tabla simple
      autoTable(doc, {
        startY: 45,
        head: [['Producto', 'SKU', 'Costo', 'Precio', 'Porciones']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] }
      });

      // Descargar
      doc.save(`catalogo-${Date.now()}.pdf`);
      console.log('PDF generado exitosamente');

    } catch (error) {
      console.error('Error completo:', error);
      alert(`Error al generar PDF: ${error.message}`);
    }
  };

  // ===== Función para formatear números para Excel =====
  const formatNumberForExcel = (number) => {
    return Math.round(Number(number) || 0);
  };

  // ===== Exportación a Excel =====
  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const excelData = filteredProducts.map((product, index) => ({
        'N°': index + 1,
        'Producto': product.nombre || 'Sin nombre',
        'Código SKU': product.sku || 'Sin SKU',
        'Cantidad Producida': product.cantidad || 1,
        'Unidad': product.unidad || 'unidades',
        'Costo Total ($)': formatNumberForExcel(product.costoFinal),
        'Precio Venta ($)': formatNumberForExcel(product.precioVenta),
        'Se Divide en Porciones': product.seDividePorPorciones ? 'SÍ' : 'NO',
        'Número de Porciones': product.seDividePorPorciones ? product.numeroPorciones : 1,
        'Precio por Porción ($)': formatNumberForExcel(
          product.seDividePorPorciones ? product.precioPorPorcion : product.precioVenta
        ),
        'Ganancia por Unidad ($)': formatNumberForExcel(
          (product.seDividePorPorciones ? product.precioPorPorcion : product.precioVenta) -
          (product.costoFinal / (product.seDividePorPorciones ? product.numeroPorciones : 1))
        ),
        'Fecha de Creación': formatDate(product.createdAt),
        'Estado': product.activo ? 'ACTIVO' : 'INACTIVO'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();

      // Configurar anchos de columna optimizados
      const colWidths = [
        { wch: 5 },  // N°
        { wch: 30 }, // Producto
        { wch: 15 }, // SKU
        { wch: 12 }, // Cantidad
        { wch: 12 }, // Unidad
        { wch: 15 }, // Costo Total
        { wch: 15 }, // Precio Venta
        { wch: 20 }, // Se Divide
        { wch: 15 }, // Num Porciones
        { wch: 18 }, // Precio Porción
        { wch: 18 }, // Ganancia
        { wch: 15 }, // Fecha
        { wch: 10 }  // Estado
      ];

      worksheet['!cols'] = colWidths;

      // Formatear celdas numéricas como moneda
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        // Columnas de dinero: F, G, J, K (Costo, Precio, Precio Porción, Ganancia)
        ['F', 'G', 'J', 'K'].forEach(col => {
          const cellAddress = col + (R + 1);
          if (worksheet[cellAddress] && worksheet[cellAddress].v) {
            worksheet[cellAddress].z = '"$"#,##0';
          }
        });
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo de Productos');

      const fileName = `catalogo-productos-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      console.log('Excel generado correctamente:', fileName);

    } catch (error) {
      console.error('Error generando Excel:', error);
      alert('Error al generar el archivo Excel. Por favor, intenta nuevamente.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header simplificado */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Productos Costeados
                </h1>
                <p className="text-sm text-slate-600">
                  {filteredProducts.length} productos encontrados
                </p>
              </div>

              {/* Botones de exportación modernos */}
              <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
                <button
                  onClick={exportToPDF}
                  disabled={filteredProducts.length === 0}
                  className="group relative flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF Catálogo</span>
                  <span className="sm:hidden">PDF</span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-lg transition-opacity"></div>
                </button>

                <button
                  onClick={exportToExcel}
                  disabled={filteredProducts.length === 0}
                  className="group relative flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg shadow-lg hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">Excel</span>
                  <span className="sm:hidden">Excel</span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-lg transition-opacity"></div>
                </button>

                <button
                  onClick={loadProducts}
                  className="group relative flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-500 to-slate-600 text-white text-sm font-medium rounded-lg shadow-lg hover:from-slate-600 hover:to-slate-700 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                >
                  <RefreshCw className="w-4 h-4 group-hover:animate-spin" />
                  <span className="hidden sm:inline">Actualizar</span>
                  <span className="sm:hidden">↻</span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-lg transition-opacity"></div>
                </button>
              </div>
            </div>

            {/* Búsqueda integrada en header */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o ID..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Lista/Tabla de productos - Responsive */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-600 text-sm">Cargando productos...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">No hay productos</h3>
              <p className="text-slate-600 text-sm">
                {searchQuery ? 'No se encontraron productos' : 'No hay productos costeados aún'}
              </p>
            </div>
          ) : (
            <>
              {/* Vista móvil - Lista de cards */}
              <div className="block sm:hidden">
                <div className="divide-y divide-slate-200">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="p-4 hover:bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-slate-900 text-sm">{product.nombre}</h3>
                        <span className="text-lg font-bold text-slate-900">
                          {formatCurrency(product.precioVenta)}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        {product.sku && (
                          <div className="flex justify-between">
                            <span>SKU:</span>
                            <span className="font-mono">{product.sku}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Costo:</span>
                          <span>{formatCurrency(product.costoFinal)}</span>
                        </div>
                        {product.seDividePorPorciones && (
                          <div className="flex justify-between">
                            <span>Porciones:</span>
                            <span>{product.numeroPorciones} × {formatCurrency(product.precioPorPorcion)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Creado:</span>
                          <span>{formatDate(product.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vista desktop - Tabla */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Costo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Precio</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Porciones</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{product.nombre}</div>
                            {product.sku && (
                              <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-900 text-sm">
                            {formatCurrency(product.costoFinal)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-900 text-sm">
                            {formatCurrency(product.precioVenta)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {product.seDividePorPorciones ? (
                            <div className="text-sm">
                              <div className="font-medium text-slate-900">
                                {product.numeroPorciones}
                              </div>
                              <div className="text-xs text-slate-600">
                                {formatCurrency(product.precioPorPorcion)} c/u
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">Unitario</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs text-slate-600">
                            {formatDate(product.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsCatalog;