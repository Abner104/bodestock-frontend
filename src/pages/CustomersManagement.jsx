// src/pages/CustomersManagement.jsx
/**
 * Módulo de Cartera de Clientes
 * - Ver lista de clientes
 * - Crear/Editar/Eliminar clientes
 * - Importar desde Excel
 * - Exportar a Excel
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Search,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader,
  FileText,
  ChevronDown,
  RotateCcw,
  ShoppingCart,
  MapPin
} from 'lucide-react';
import { collection, query, where, getDocs, getDoc, doc as doc2, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';
import { useToast, ToastContainer } from '../components/ui/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { textClasses, bgClasses, cardClasses, buttonClasses, inputClasses } from '../utils/themeUtils';
import { obtenerPdfDTE, emitirNotaCredito } from '../services/libredte-service';
import {
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  markDocumentoWithNC,
  addNotaCreditoToCustomer
} from '../services/customers-service';
import { annulInventoryExit } from '../services/inventory-exits-service';

const CustomersManagement = () => {
  const { isDark } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  // Estados
  const location = useLocation();
  const modoVender = new URLSearchParams(location.search).get('modo') === 'vender';

  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [pedidosPendientesPorRut, setPedidosPendientesPorRut] = useState({}); // { rut: count }
  const [fiadosPendientesPorRut, setFiadosPendientesPorRut] = useState({}); // { rut: monto }
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [exitsMap, setExitsMap] = useState({}); // { exitId: exit completo }
  const [loadingDocProducts, setLoadingDocProducts] = useState(null); // exitId cargando
  const [showNCModal, setShowNCModal] = useState(false);
  const [ncDocumento, setNcDocumento] = useState(null); // documento seleccionado para NC
  const [ncCustomer, setNcCustomer] = useState(null); // cliente del documento
  const [ncMotivo, setNcMotivo] = useState('Devolución de productos');
  const [emittingNC, setEmittingNC] = useState(false);

  // Modal selector de dirección para pedido
  const [showDirModal, setShowDirModal] = useState(false);
  const [dirModalCustomer, setDirModalCustomer] = useState(null);
  // Modal tipo de venta (contado/crédito)
  const [showTipoVentaModal, setShowTipoVentaModal] = useState(false);
  const [tipoVentaCustomer, setTipoVentaCustomer] = useState(null);
  const [selectedDirIdx, setSelectedDirIdx] = useState(0);

  const navegarAPedido = (customer, tipoVenta) => {
    const dirs = customer.direcciones?.length > 0
      ? customer.direcciones
      : customer.direccion
        ? [{ label: 'Principal', direccion: customer.direccion, comuna: customer.comuna || '' }]
        : [];

    const buildParams = (d) => new URLSearchParams({
      clienteRut: customer.rut || '',
      clienteNombre: customer.razonSocial || customer.nombre || '',
      clienteDireccion: d?.direccion || '',
      clienteComuna: d?.comuna || '',
      tipoVenta: tipoVenta,
    });

    if (dirs.length > 1) {
      setDirModalCustomer({ ...customer, _dirs: dirs, _tipoVenta: tipoVenta });
      setSelectedDirIdx(0);
      setShowDirModal(true);
    } else {
      const d = dirs[0] || {};
      navigate(`/mis-bodegas?${buildParams(d).toString()}`);
    }
  };

  const handlePedidoClick = (customer) => {
    // Mostrar modal contado/crédito primero
    setTipoVentaCustomer(customer);
    setShowTipoVentaModal(true);
  };

  const handlePedidoClickLegacy = (customer) => {
    const dirs = customer.direcciones?.length > 0
      ? customer.direcciones
      : customer.direccion
        ? [{ label: 'Principal', direccion: customer.direccion, comuna: customer.comuna || '' }]
        : [];

    if (dirs.length > 1) {
      setDirModalCustomer({ ...customer, _dirs: dirs });
      setSelectedDirIdx(0);
      setShowDirModal(true);
    } else {
      const d = dirs[0] || { direccion: '', comuna: '' };
      const params = new URLSearchParams({
        clienteRut: customer.rut || '',
        clienteNombre: customer.razonSocial || customer.nombre || '',
        clienteDireccion: d.direccion || '',
        clienteComuna: d.comuna || '',
      });
      navigate(`/mis-bodegas?${params.toString()}`);
    }
  };

  const handleConfirmDir = () => {
    const d = dirModalCustomer._dirs[selectedDirIdx];
    const params = new URLSearchParams({
      clienteRut: dirModalCustomer.rut || '',
      clienteNombre: dirModalCustomer.razonSocial || dirModalCustomer.nombre || '',
      clienteDireccion: d.direccion || '',
      clienteComuna: d.comuna || '',
      tipoVenta: dirModalCustomer._tipoVenta || 'contado',
    });
    if (dirModalCustomer._warehouseId) params.set('warehouseId', dirModalCustomer._warehouseId);
    if (dirModalCustomer._warehouseName) params.set('name', dirModalCustomer._warehouseName);
    if (dirModalCustomer._inventoryId) params.set('inventoryId', dirModalCustomer._inventoryId);
    setShowDirModal(false);
    navigate(`/salida-inventario?${params.toString()}`);
  };

  const handleDownloadPdf = async (doc) => {
    const key = `${doc.tipoDTE}-${doc.folio}`;
    setDownloadingPdf(key);
    try {
      const fileName = `DTE_${doc.tipoDTE}_Folio_${doc.folio}.pdf`;

      // Opción 1: URL de Firebase Storage (guardada al emitir, es pública y directa)
      const directUrl = doc.pdfUrl || doc.pdf;
      if (directUrl && directUrl.includes('storage.googleapis.com')) {
        try {
          const response = await fetch(directUrl);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return;
          }
        } catch { /* fallback al endpoint CF */ }
      }

      // Opción 2: Obtener PDF via Cloud Function (autentica con SimpleFactura server-side)
      const result = await obtenerPdfDTE(doc.folio, doc.tipoDTE);
      if (result.success && result.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.addToast(`No se pudo descargar el PDF: ${result.error || 'Error desconocido'}`, 'error');
      }
    } catch (error) {
      toast.addToast(`Error al descargar el PDF: ${error.message}`, 'error');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleOpenNCModal = (doc, customer) => {
    setNcDocumento(doc);
    setNcCustomer(customer);
    setNcMotivo('Devolución de productos');
    setShowNCModal(true);
  };

  const handleCloseNCModal = () => {
    setShowNCModal(false);
    setNcDocumento(null);
    setNcCustomer(null);
    setNcMotivo('Devolución de productos');
  };

  const handleEmitirNC = async () => {
    if (!ncDocumento || !ncCustomer) return;

    setEmittingNC(true);
    try {
      // 1. Construir datos del documento original para la NC
      const docOriginal = {
        tipoDTE: ncDocumento.tipoDTE,
        folio: ncDocumento.folio,
        fechaEmision: ncDocumento.emitidoAt
          ? new Date(ncDocumento.emitidoAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        receptor: {
          rut: ncCustomer.rut,
          razonSocial: ncCustomer.razonSocial,
          giro: ncCustomer.giro || 'Sin giro',
          direccion: ncCustomer.direccion || 'Sin dirección',
          comuna: ncCustomer.comuna || 'Santiago'
        },
        total: ncDocumento.total || 0,
        items: ncDocumento.items || []
      };

      // 2. Emitir NC al SII
      const result = await emitirNotaCredito(docOriginal, ncMotivo);

      if (!result.success) {
        throw new Error(result.error || 'Error al emitir Nota de Crédito');
      }

      // 3. Marcar documento original con NC
      await markDocumentoWithNC(
        ncCustomer.rut,
        ncDocumento.folio,
        ncDocumento.tipoDTE,
        {
          folio: result.folio,
          fecha: new Date().toISOString(),
          total: ncDocumento.total || 0,
          fechaOriginal: ncDocumento.emitidoAt || null,
        }
      );

      // 4. Agregar NC como nuevo documento del cliente
      await addNotaCreditoToCustomer(ncCustomer.rut, {
        tipoDTE: 61,
        folio: result.folio,
        total: ncDocumento.total || 0,
        folioRef: ncDocumento.folio,
        tipoDTERef: ncDocumento.tipoDTE
      });

      // 5. Restaurar stock si tiene exitId
      if (ncDocumento.exitId) {
        try {
          await annulInventoryExit(ncDocumento.exitId);
          toast.addToast(
            `Nota de Crédito Folio ${result.folio} emitida y stock restaurado`,
            'success'
          );
        } catch (stockErr) {
          console.warn('⚠️ NC emitida pero error restaurando stock:', stockErr);
          toast.addToast(
            `NC Folio ${result.folio} emitida, pero hubo un error restaurando stock`,
            'warning'
          );
        }
      } else {
        toast.addToast(
          `Nota de Crédito Folio ${result.folio} emitida correctamente`,
          'success'
        );
      }

      handleCloseNCModal();
      loadCustomers(); // Recargar para ver cambios
    } catch (error) {
      console.error('❌ Error emitiendo NC:', error);
      toast.addToast(`Error: ${error.message}`, 'error');
    } finally {
      setEmittingNC(false);
    }
  };

  // Estado del formulario
  const [formData, setFormData] = useState({
    rut: '',
    razonSocial: '',
    giro: '',
    direcciones: [{ label: 'Principal', direccion: '', comuna: '' }],
    telefono: '',
    email: ''
  });

  // Cargar clientes al montar
  useEffect(() => {
    loadCustomers();
    loadPedidosPendientes();
  }, []);

  const loadPedidosPendientes = async () => {
    try {
      const normalizeRut = (r) => String(r || '').replace(/\./g, '').toUpperCase().trim();

      // Pedidos pendientes (orders collection)
      const { getAllOrders } = await import('../services/orders-service');
      const orders = await getAllOrders({ status: 'PENDING' });
      const counts = {};
      orders.forEach(o => {
        const rut = normalizeRut(o.customerInfo?.rut);
        if (rut) counts[rut] = (counts[rut] || 0) + 1;
      });
      setPedidosPendientesPorRut(counts);

      // Fiados pendientes (inventory_exits con CREDIT+pending)
      const companyId = await getUserCompanyId();
      if (companyId) {
        const { collection: col, query: q, where, getDocs } = await import('firebase/firestore');
        const { db: firestoreDb } = await import('../firebase/firebase');
        const snap = await getDocs(q(
          col(firestoreDb, `companies/${companyId}/inventory_exits`),
          where('reason', '==', 'CREDIT'),
          where('creditStatus', '==', 'pending')
        ));
        const montos = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.status === 'cancelled') return;
          const rut = normalizeRut(data.customerRut || data.customerInfo?.rut);
          if (rut) montos[rut] = (montos[rut] || 0) + (data.totalValue || 0);
        });
        setFiadosPendientesPorRut(montos);
      }
    } catch (e) {
      console.error('Error cargando pedidos/fiados pendientes:', e);
    }
  };

  // Filtrar clientes cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredCustomers(
        customers.filter(c =>
          c.rut?.toLowerCase().includes(term) ||
          c.razonSocial?.toLowerCase().includes(term) ||
          c.giro?.toLowerCase().includes(term) ||
          c.comuna?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getAllCustomers();

      // Cargar ventas desde inventory_exits y cruzar con clientes
      try {
        const companyId = await getUserCompanyId();
        if (companyId) {
          // Query 1: exits con boleta emitida (factura/boleta SII)
          const boletaQuery = query(
            collection(db, `companies/${companyId}/inventory_exits`),
            where('boleta.folio', '!=', null),
            orderBy('boleta.folio', 'desc'),
            limit(200)
          );
          // Query 2: exits con customerRut directo (ventas desde pantalla de salida)
          const directQuery = query(
            collection(db, `companies/${companyId}/inventory_exits`),
            where('customerRut', '!=', null),
            orderBy('customerRut', 'desc'),
            limit(300)
          );

          const [boletaSnap, directSnap] = await Promise.all([
            getDocs(boletaQuery).catch(() => ({ forEach: () => {}, docs: [] })),
            getDocs(directQuery).catch(() => ({ forEach: () => {}, docs: [] })),
          ]);

          // Guardar exits completos para mostrar productos
          const newExitsMap = {};
          [...(boletaSnap.docs || []), ...(directSnap.docs || [])].forEach(d => {
            newExitsMap[d.id] = d.data();
          });
          setExitsMap(newExitsMap);

          const exitDocs = [];

          // Exits con boleta/factura
          boletaSnap.forEach(d => {
            const ex = d.data();
            if (ex.boleta?.folio && ex.boleta?.receptor?.rut) {
              const rut = ex.boleta.receptor.rut;
              const emitidoAt = ex.boleta.emitidaAt?.toDate?.()?.toISOString() || ex.boleta.emitidaAt || '';
              const allFolios = ex.boleta.folios || [ex.boleta.folio];
              const totalPorFolio = Math.round((ex.totalValue || 0) / allFolios.length);
              allFolios.forEach(folio => {
                exitDocs.push({ rut, tipoDTE: ex.boleta.tipoDTE, tipoDocumento: ex.boleta.tipoDocumento, folio, total: totalPorFolio, emitidoAt, exitId: d.id });
              });
            }
          });

          // Exits con customerRut directo (venta asociada a cliente sin documento)
          directSnap.forEach(d => {
            const ex = d.data();
            if (ex.customerRut && ex.status !== 'cancelled') {
              const emitidoAt = ex.createdAt?.toDate?.()?.toISOString() || '';
              exitDocs.push({
                rut: ex.customerRut,
                tipoDTE: 999, // tipo especial "venta directa"
                tipoDocumento: 'Venta directa',
                folio: null,
                total: ex.totalValue || 0,
                emitidoAt,
                exitId: d.id,
                esVentaDirecta: true,
                productos: ex.products?.length || 0,
              });
            }
          });

          // Asociar documentos a clientes por RUT
          data.forEach(customer => {
            const fromExits = exitDocs.filter(doc => doc.rut === customer.rut);
            const fromArray = customer.documentos || [];
            const allDocs = [...fromArray];
            const existingKeys = new Set(allDocs.map(d => `${d.tipoDTE}-${d.folio}-${d.exitId}`));
            fromExits.forEach(doc => {
              const key = `${doc.tipoDTE}-${doc.folio}-${doc.exitId}`;
              if (!existingKeys.has(key)) allDocs.push(doc);
            });
            customer.documentos = allDocs.sort((a, b) => new Date(b.emitidoAt || 0) - new Date(a.emitidoAt || 0));
          });
        }
      } catch (err) {
        console.warn('⚠️ Error cargando documentos de exits:', err);
      }

      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      toast.addToast('Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      // Retrocompatibilidad: si tiene el campo antiguo (direccion/comuna), convertirlo
      let direcciones = customer.direcciones;
      if (!direcciones || direcciones.length === 0) {
        direcciones = [{ label: 'Principal', direccion: customer.direccion || '', comuna: customer.comuna || '' }];
      }
      setFormData({
        rut: customer.rut || '',
        razonSocial: customer.razonSocial || '',
        giro: customer.giro || '',
        direcciones,
        telefono: customer.telefono || '',
        email: customer.email || ''
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        rut: '',
        razonSocial: '',
        giro: '',
        direcciones: [{ label: 'Principal', direccion: '', comuna: '' }],
        telefono: '',
        email: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({
      rut: '',
      razonSocial: '',
      giro: '',
      direcciones: [{ label: 'Principal', direccion: '', comuna: '' }],
      telefono: '',
      email: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.rut.trim() || !formData.razonSocial.trim()) {
      toast.addToast('RUT y Razón Social son obligatorios', 'error');
      return;
    }

    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
        toast.addToast('Cliente actualizado correctamente', 'success');
      } else {
        await createCustomer(formData);
        toast.addToast('Cliente creado correctamente', 'success');
      }
      handleCloseModal();
      loadCustomers();
    } catch (error) {
      console.error('Error guardando cliente:', error);
      toast.addToast(error.message || 'Error al guardar cliente', 'error');
    }
  };

  const handleDelete = async (customerId, customerName) => {
    if (!window.confirm(`¿Estás seguro de eliminar al cliente "${customerName}"?`)) {
      return;
    }

    try {
      await deleteCustomer(customerId);
      toast.addToast('Cliente eliminado correctamente', 'success');
      loadCustomers();
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      toast.addToast('Error al eliminar cliente', 'error');
    }
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    if (customers.length === 0) {
      toast.addToast('No hay clientes para exportar', 'error');
      return;
    }

    const XLSX = await import('xlsx');
    // Preparar datos para Excel
    const excelData = customers.map(c => {
      const dirs = c.direcciones?.length > 0
        ? c.direcciones
        : [{ label: 'Principal', direccion: c.direccion || '', comuna: c.comuna || '' }];
      return {
        RUT: c.rut || '',
        'Razón Social': c.razonSocial || '',
        Giro: c.giro || '',
        Direcciones: dirs.map(d => `${d.label ? d.label + ': ' : ''}${d.direccion}${d.comuna ? ', ' + d.comuna : ''}`).join(' | '),
        Teléfono: c.telefono || '',
        Email: c.email || ''
      };
    });

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, // RUT
      { wch: 30 }, // Razón Social
      { wch: 25 }, // Giro
      { wch: 30 }, // Dirección
      { wch: 20 }, // Comuna
      { wch: 15 }, // Teléfono
      { wch: 25 }  // Email
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `cartera-clientes-${fecha}.xlsx`);

    toast.addToast(`${customers.length} clientes exportados correctamente`, 'success');
  };

  // Importar desde Excel
  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          toast.addToast('El archivo Excel está vacío', 'error');
          setImporting(false);
          return;
        }

        // Validar y procesar cada fila
        let created = 0;
        let errors = 0;

        for (const row of jsonData) {
          try {
            const customerData = {
              rut: row.RUT || row.rut || '',
              razonSocial: row['Razón Social'] || row.razonSocial || row['Razon Social'] || '',
              giro: row.Giro || row.giro || '',
              direccion: row.Dirección || row.direccion || row.Direccion || '',
              comuna: row.Comuna || row.comuna || '',
              telefono: row.Teléfono || row.telefono || row.Telefono || '',
              email: row.Email || row.email || ''
            };

            if (!customerData.rut || !customerData.razonSocial) {
              console.warn('Fila omitida por falta de RUT o Razón Social:', row);
              errors++;
              continue;
            }

            await createCustomer(customerData);
            created++;
          } catch (error) {
            console.error('Error procesando fila:', row, error);
            errors++;
          }
        }

        loadCustomers();
        toast.addToast(
          `Importación completa: ${created} creados, ${errors} errores`,
          errors > 0 ? 'warning' : 'success'
        );
      } catch (error) {
        console.error('Error importando Excel:', error);
        toast.addToast('Error al procesar el archivo Excel', 'error');
      } finally {
        setImporting(false);
        e.target.value = ''; // Resetear input
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Descargar plantilla Excel
  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const templateData = [
      {
        RUT: '12345678-9',
        'Razón Social': 'Empresa Ejemplo S.A.',
        Giro: 'Comercio al por mayor',
        Dirección: 'Av. Principal 123',
        Comuna: 'Santiago',
        Teléfono: '+56912345678',
        Email: 'contacto@ejemplo.cl'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla-clientes.xlsx');

    toast.addToast('Plantilla descargada correctamente', 'success');
  };

  return (
    <div className={`min-h-screen ${bgClasses.secondary(isDark)} p-4 md:p-6 pb-safe-nav md:pb-6`}>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 ${bgClasses.accent(isDark)} rounded-xl`}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl md:text-3xl font-bold ${textClasses.primary(isDark)}`}>
                {modoVender ? 'Selecciona un Cliente' : 'Cartera de Clientes'}
              </h1>
              <p className={`text-sm ${textClasses.secondary(isDark)}`}>
                {modoVender ? 'Toca un cliente para iniciar la venta' : 'Gestiona tus clientes para facturación electrónica'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Barra de acciones */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardClasses(isDark)} p-4 mb-6`}
        >
          <div className="flex flex-col md:flex-row gap-3">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${textClasses.tertiary(isDark)}`} />
                <input
                  type="text"
                  placeholder="Buscar por RUT, nombre, giro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${inputClasses(isDark)} pl-10 w-full`}
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleOpenModal()}
                className={`${buttonClasses.primary(isDark)} px-4 py-2 rounded-lg flex items-center gap-2 text-sm`}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo Cliente</span>
                <span className="sm:hidden">Nuevo</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={customers.length === 0}
                className={`${buttonClasses.secondary(isDark)} px-4 py-2 rounded-lg flex items-center gap-2 text-sm disabled:opacity-50`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar Excel</span>
                <span className="sm:hidden">Exportar</span>
              </button>

              <label className={`${buttonClasses.secondary(isDark)} px-4 py-2 rounded-lg flex items-center gap-2 text-sm cursor-pointer`}>
                {importing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Importar Excel</span>
                    <span className="sm:hidden">Importar</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                  disabled={importing}
                />
              </label>

              <button
                onClick={handleDownloadTemplate}
                className={`${buttonClasses.ghost(isDark)} px-4 py-2 rounded-lg flex items-center gap-2 text-sm`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Plantilla</span>
              </button>
            </div>
          </div>

          {/* Contador */}
          <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-sm ${textClasses.secondary(isDark)}`}>
              Mostrando <strong className={textClasses.primary(isDark)}>{filteredCustomers.length}</strong> de <strong className={textClasses.primary(isDark)}>{customers.length}</strong> clientes
            </p>
          </div>
        </motion.div>

        {/* Lista de clientes */}
        {loading ? (
          <div className={`${cardClasses(isDark)} p-12 text-center`}>
            <Loader className={`w-8 h-8 ${textClasses.primary(isDark)} animate-spin mx-auto mb-4`} />
            <p className={textClasses.secondary(isDark)}>Cargando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${cardClasses(isDark)} p-12 text-center`}
          >
            <Users className={`w-16 h-16 ${textClasses.tertiary(isDark)} mx-auto mb-4`} />
            <h3 className={`text-lg font-semibold ${textClasses.primary(isDark)} mb-2`}>
              {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </h3>
            <p className={`${textClasses.secondary(isDark)} mb-4`}>
              {searchTerm
                ? 'Intenta con otro término de búsqueda'
                : 'Comienza agregando tu primer cliente o importa desde Excel'}
            </p>
            {!searchTerm && (
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  onClick={() => handleOpenModal()}
                  className={`${buttonClasses.primary(isDark)} px-4 py-2 rounded-lg flex items-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  Crear primer cliente
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className={`${buttonClasses.secondary(isDark)} px-4 py-2 rounded-lg flex items-center gap-2`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Descargar plantilla
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`${cardClasses(isDark)} overflow-hidden ${modoVender ? 'cursor-pointer' : ''}`}
                onClick={modoVender ? () => handlePedidoClick(customer) : undefined}
              >
                {/* ── Cabecera de la card ── */}
                <div className={`flex items-center gap-4 px-4 py-3.5 ${customer.documentos?.length > 0 ? `border-b ${isDark ? 'border-slate-700/60' : 'border-slate-100'}` : ''}`}>
                  {/* Avatar inicial */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${
                    isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {(customer.razonSocial || 'C').charAt(0).toUpperCase()}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-sm leading-tight truncate ${textClasses.primary(isDark)}`}>
                        {customer.razonSocial}
                      </h3>
                      {pedidosPendientesPorRut[String(customer.rut || '').replace(/\./g, '').toUpperCase().trim()] > 0 && (
                        <button
                          onClick={() => navigate(`/pedidos?rut=${encodeURIComponent(customer.rut)}`)}
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          📦 {pedidosPendientesPorRut[String(customer.rut || '').replace(/\./g, '').toUpperCase().trim()]} pendiente{pedidosPendientesPorRut[String(customer.rut || '').replace(/\./g, '').toUpperCase().trim()] > 1 ? 's' : ''}
                        </button>
                      )}
                      {fiadosPendientesPorRut[String(customer.rut || '').replace(/\./g, '').toUpperCase().trim()] > 0 && (
                        <button
                          onClick={() => navigate(`/reportes?tab=fiados`)}
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
                        >
                          🤝 Debe {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(fiadosPendientesPorRut[String(customer.rut || '').replace(/\./g, '').toUpperCase().trim()])}
                        </button>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 mt-0.5 flex-wrap text-xs ${textClasses.secondary(isDark)}`}>
                      <span className="font-mono">{customer.rut}</span>
                      {customer.giro && <>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
                        <span className="truncate">{customer.giro}</span>
                      </>}
                      {customer.telefono && <>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
                        <span>{customer.telefono}</span>
                      </>}
                    </div>
                    {/* Direcciones — todas */}
                    {(() => {
                      const dirs = customer.direcciones?.length > 0
                        ? customer.direcciones
                        : customer.direccion
                          ? [{ label: 'Principal', direccion: customer.direccion, comuna: customer.comuna }]
                          : [];
                      return dirs.map((d, i) => (
                        <p key={i} className={`text-xs mt-0.5 truncate ${textClasses.secondary(isDark)}`}>
                          📍 <span className={`font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{d.label}</span>
                          {' '}{d.direccion}{d.comuna ? `, ${d.comuna}` : ''}
                        </p>
                      ));
                    })()}
                  </div>

                  {/* Total comprado */}
                  {customer.documentos?.length > 0 && (
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className={`text-xs ${textClasses.secondary(isDark)}`}>Total comprado</p>
                      <p className={`text-sm font-bold tabular-nums ${textClasses.primary(isDark)}`}>
                        ${customer.documentos.filter(d => !d.ncEmitida).reduce((s, d) => s + (d.total || 0), 0).toLocaleString('es-CL')}
                      </p>
                      <p className={`text-[10px] ${textClasses.secondary(isDark)}`}>
                        {customer.documentos.length} doc{customer.documentos.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handlePedidoClick(customer)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pedido</span>
                    </button>
                    <button onClick={() => handleOpenModal(customer)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} transition-colors`}>
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(customer.id, customer.razonSocial)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-900/20 text-red-400/60 hover:text-red-400' : 'hover:bg-red-50 text-red-300 hover:text-red-500'} transition-colors`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Historial de compras — lista compacta */}
                {customer.documentos && customer.documentos.length > 0 && (
                  <div className="px-4 py-2 max-h-56 overflow-y-auto">
                    <div className="space-y-0.5">
                      {customer.documentos.map((doc, i) => {
                        const docKey = `${customer.id}-${doc.exitId || i}`;
                        const isExpanded = expandedDoc === docKey;
                        const exitData = doc.exitId ? exitsMap[doc.exitId] : null;
                        const products = exitData?.products || [];
                        const hasProducts = !!doc.exitId; // tiene exitId = puede tener productos
                        const isLoadingProducts = loadingDocProducts === doc.exitId;
                        const fecha = doc.emitidoAt ? new Date(doc.emitidoAt) : null;
                        const diasAtras = fecha ? Math.floor((new Date() - fecha) / (1000*60*60*24)) : null;

                        const badgeColor = doc.tipoDTE === 61 ? 'bg-orange-500/15 text-orange-400' :
                          doc.tipoDTE === 33 ? 'bg-blue-500/15 text-blue-400' :
                          doc.tipoDTE === 52 ? 'bg-purple-500/15 text-purple-400' :
                          doc.tipoDTE === 999 ? 'bg-violet-500/15 text-violet-400' :
                          'bg-emerald-500/15 text-emerald-400';
                        const badgeLabel = doc.tipoDTE === 61 ? 'NC' : doc.tipoDTE === 33 ? 'FAC' : doc.tipoDTE === 52 ? 'GDD' : doc.tipoDTE === 999 ? 'VENTA' : 'BOL';

                        return (
                          <div key={docKey}>
                            {/* Fila compacta */}
                            <div
                              className={`flex items-center gap-2 py-1.5 px-1 rounded-lg transition-colors ${doc.exitId ? 'cursor-pointer' : ''} ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}
                              onClick={async () => {
                                if (!doc.exitId) return;
                                if (isExpanded) { setExpandedDoc(null); return; }
                                setExpandedDoc(docKey);
                                // Si no tenemos el exit en el map, cargarlo
                                if (!exitsMap[doc.exitId]) {
                                  setLoadingDocProducts(doc.exitId);
                                  try {
                                    const companyId = await getUserCompanyId();
                                    const exitDoc = await getDoc(doc2(db, `companies/${companyId}/inventory_exits/${doc.exitId}`));
                                    if (exitDoc.exists()) {
                                      setExitsMap(prev => ({ ...prev, [doc.exitId]: exitDoc.data() }));
                                    }
                                  } catch (e) { console.warn('Error cargando exit:', e); }
                                  finally { setLoadingDocProducts(null); }
                                }
                              }}
                            >
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeColor}`}>{badgeLabel}</span>
                              <span className={`text-xs flex-1 truncate ${doc.ncEmitida ? 'line-through opacity-50' : textClasses.primary(isDark)}`}>
                                {doc.tipoDTE === 999 ? `${doc.productos || products.length} productos` : doc.tipoDTE === 61 && doc.folioRef ? `Anula ${doc.folioRef}` : `Folio ${doc.folio}`}
                              </span>
                              {fecha && <span className={`text-[10px] shrink-0 ${textClasses.secondary(isDark)}`}>{fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</span>}
                              {doc.total > 0 && <span className={`text-xs font-bold tabular-nums shrink-0 ${doc.ncEmitida ? 'line-through opacity-50' : textClasses.primary(isDark)}`}>${doc.total.toLocaleString('es-CL')}</span>}
                              {hasProducts && <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isDark ? 'text-slate-600' : 'text-gray-300'} ${isExpanded ? 'rotate-180' : ''}`} />}
                              {doc.folio && doc.tipoDTE !== 999 && (
                                <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleDownloadPdf(doc)} disabled={downloadingPdf === `${doc.tipoDTE}-${doc.folio}`} className={`p-1 rounded ${isDark ? 'text-slate-500 hover:text-blue-400' : 'text-gray-300 hover:text-blue-500'} transition-colors`}>
                                    {downloadingPdf === `${doc.tipoDTE}-${doc.folio}` ? <Loader className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                  </button>
                                  {(doc.tipoDTE === 33 || doc.tipoDTE === 39) && !doc.ncEmitida && (
                                    <button onClick={() => handleOpenNCModal(doc, customer)} className={`p-1 rounded ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-300 hover:text-red-500'} transition-colors`}>
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Productos expandidos */}
                            {isExpanded && (
                              <div className={`ml-7 mb-1 pl-2 border-l ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                {isLoadingProducts ? (
                                  <div className="flex items-center gap-1.5 py-1.5">
                                    <Loader className="w-3 h-3 animate-spin text-blue-400" />
                                    <span className={`text-[11px] ${textClasses.secondary(isDark)}`}>Cargando productos...</span>
                                  </div>
                                ) : products.length > 0 ? (
                                  <div className="space-y-0.5 py-1">
                                    {products.map((p, j) => (
                                      <div key={j} className="flex items-center justify-between text-[11px] py-0.5">
                                        <span className={`truncate flex-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{p.productName || p.name}</span>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                          <span className={isDark ? 'text-slate-600' : 'text-gray-300'}>×{p.quantity}</span>
                                          <span className={`tabular-nums font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>${(p.totalValue || 0).toLocaleString('es-CL')}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className={`text-[11px] py-1 ${textClasses.secondary(isDark)}`}>Sin detalle de productos</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Crear/Editar */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`${bgClasses.primary(isDark)} rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}
            >
              <div className={`sticky top-0 ${bgClasses.primary(isDark)} border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} p-6 z-10`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${textClasses.primary(isDark)}`}>
                    {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}
                  >
                    <X className={`w-5 h-5 ${textClasses.primary(isDark)}`} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-semibold ${textClasses.primary(isDark)} mb-2`}>
                      RUT <span className={textClasses.error(isDark)}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.rut}
                      onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                      placeholder="12345678-9"
                      className={inputClasses(isDark)}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold ${textClasses.primary(isDark)} mb-2`}>
                      Razón Social <span className={textClasses.error(isDark)}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                      placeholder="Empresa S.A."
                      className={inputClasses(isDark)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${textClasses.primary(isDark)} mb-2`}>
                    Giro
                  </label>
                  <input
                    type="text"
                    value={formData.giro}
                    onChange={(e) => setFormData({ ...formData, giro: e.target.value })}
                    placeholder="Ej: Restaurante, Distribución, Minimarket..."
                    className={inputClasses(isDark)}
                  />
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    El mismo RUT puede tener distintos giros (ej: distribuidora y restaurante). Crea un cliente por cada giro.
                  </p>
                </div>

                {/* Múltiples direcciones */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-sm font-semibold ${textClasses.primary(isDark)}`}>
                      Direcciones de entrega
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, direcciones: [...prev.direcciones, { label: '', direccion: '', comuna: '' }] }))}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar dirección
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.direcciones.map((d, i) => (
                      <div key={i} className={`rounded-xl border p-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={d.label}
                            onChange={(e) => {
                              const dirs = [...formData.direcciones];
                              dirs[i] = { ...dirs[i], label: e.target.value };
                              setFormData(prev => ({ ...prev, direcciones: dirs }));
                            }}
                            placeholder="Etiqueta (ej: Casa, Oficina, Bodega...)"
                            className={`flex-1 text-sm font-semibold bg-transparent focus:outline-none ${textClasses.primary(isDark)}`}
                          />
                          {formData.direcciones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, direcciones: prev.direcciones.filter((_, idx) => idx !== i) }))}
                              className="text-red-400 hover:text-red-300 p-0.5"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={d.direccion}
                            onChange={(e) => {
                              const dirs = [...formData.direcciones];
                              dirs[i] = { ...dirs[i], direccion: e.target.value };
                              setFormData(prev => ({ ...prev, direcciones: dirs }));
                            }}
                            placeholder="Av. Principal 123"
                            className={inputClasses(isDark)}
                          />
                          <input
                            type="text"
                            value={d.comuna}
                            onChange={(e) => {
                              const dirs = [...formData.direcciones];
                              dirs[i] = { ...dirs[i], comuna: e.target.value };
                              setFormData(prev => ({ ...prev, direcciones: dirs }));
                            }}
                            placeholder="Comuna"
                            className={inputClasses(isDark)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-semibold ${textClasses.primary(isDark)} mb-2`}>
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+56912345678"
                      className={inputClasses(isDark)}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold ${textClasses.primary(isDark)} mb-2`}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contacto@empresa.cl"
                      className={inputClasses(isDark)}
                    />
                  </div>
                </div>

                <div className={`flex gap-3 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className={`flex-1 ${buttonClasses.secondary(isDark)} px-4 py-2.5 rounded-lg`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 ${buttonClasses.primary(isDark)} px-4 py-2.5 rounded-lg flex items-center justify-center gap-2`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Nota de Crédito */}
      <AnimatePresence>
        {showNCModal && ncDocumento && ncCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseNCModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`${bgClasses.primary(isDark)} rounded-2xl shadow-2xl max-w-lg w-full`}
            >
              {/* Header */}
              <div className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} p-6`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-xl">
                      <RotateCcw className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className={`text-lg font-bold ${textClasses.primary(isDark)}`}>
                      Emitir Nota de Crédito
                    </h2>
                  </div>
                  <button
                    onClick={handleCloseNCModal}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}
                  >
                    <X className={`w-5 h-5 ${textClasses.primary(isDark)}`} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Info del documento original */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${textClasses.secondary(isDark)}`}>
                    Documento Original
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className={textClasses.secondary(isDark)}>Tipo</p>
                      <p className={`font-semibold ${textClasses.primary(isDark)}`}>
                        {ncDocumento.tipoDTE === 33 ? 'Factura Electrónica' : 'Boleta Electrónica'}
                      </p>
                    </div>
                    <div>
                      <p className={textClasses.secondary(isDark)}>Folio</p>
                      <p className={`font-semibold ${textClasses.primary(isDark)}`}>
                        {ncDocumento.folio}
                      </p>
                    </div>
                    <div>
                      <p className={textClasses.secondary(isDark)}>Total</p>
                      <p className={`font-semibold ${textClasses.primary(isDark)}`}>
                        ${(ncDocumento.total || 0).toLocaleString('es-CL')}
                      </p>
                    </div>
                    <div>
                      <p className={textClasses.secondary(isDark)}>Fecha</p>
                      <p className={`font-semibold ${textClasses.primary(isDark)}`}>
                        {ncDocumento.emitidoAt ? new Date(ncDocumento.emitidoAt).toLocaleDateString('es-CL') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                    <p className={textClasses.secondary(isDark)}>Cliente</p>
                    <p className={`font-semibold ${textClasses.primary(isDark)}`}>
                      {ncCustomer.razonSocial} ({ncCustomer.rut})
                    </p>
                  </div>
                </div>

                {/* Motivo */}
                <div>
                  <label className={`block text-sm font-semibold ${textClasses.primary(isDark)} mb-2`}>
                    Motivo de la Nota de Crédito
                  </label>
                  <input
                    type="text"
                    value={ncMotivo}
                    onChange={(e) => setNcMotivo(e.target.value)}
                    placeholder="Ej: Devolución de productos"
                    className={inputClasses(isDark)}
                  />
                </div>

                {/* Aviso stock */}
                {ncDocumento.exitId && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg ${isDark ? 'bg-amber-900/30 border border-amber-700' : 'bg-amber-50 border border-amber-200'}`}>
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      Se restaurará el stock de los productos asociados a esta venta automáticamente.
                    </p>
                  </div>
                )}

                {/* Warning */}
                <div className={`flex items-start gap-2 p-3 rounded-lg ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                    Esta acción emitirá una Nota de Crédito al SII anulando el documento original. Esta operación no se puede deshacer.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} p-6 flex gap-3`}>
                <button
                  onClick={handleCloseNCModal}
                  disabled={emittingNC}
                  className={`flex-1 ${buttonClasses.secondary(isDark)} px-4 py-2.5 rounded-lg disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEmitirNC}
                  disabled={emittingNC || !ncMotivo.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold disabled:opacity-50 transition-colors"
                >
                  {emittingNC ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Emitiendo al SII...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Emitir Nota de Crédito
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: elegir dirección para pedido */}
      <AnimatePresence>
        {/* Modal tipo de venta — Contado o Crédito */}
        {showTipoVentaModal && tipoVentaCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTipoVentaModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="text-center mb-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                  <ShoppingCart className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className={`text-base font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Pedido para {tipoVentaCustomer.razonSocial}
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ¿Es una venta ahora o un pedido para entregar después?
                </p>
              </div>

              {/* Opciones */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Contado */}
                <button
                  onClick={() => {
                    setShowTipoVentaModal(false);
                    navegarAPedido(tipoVentaCustomer, 'contado');
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95 ${
                    isDark
                      ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  <span className="text-xl">💵</span>
                  <div className="text-center">
                    <p className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Contado</p>
                    <p className={`text-[9px] mt-0.5 ${isDark ? 'text-emerald-500/70' : 'text-emerald-600/70'}`}>Paga ahora</p>
                  </div>
                </button>

                {/* Crédito */}
                <button
                  onClick={() => {
                    setShowTipoVentaModal(false);
                    navegarAPedido(tipoVentaCustomer, 'credito');
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95 ${
                    isDark
                      ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                  }`}
                >
                  <span className="text-xl">🤝</span>
                  <div className="text-center">
                    <p className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Crédito</p>
                    <p className={`text-[9px] mt-0.5 ${isDark ? 'text-amber-500/70' : 'text-amber-600/70'}`}>Paga después</p>
                  </div>
                </button>

                {/* Pedido para entregar después */}
                <button
                  onClick={() => {
                    setShowTipoVentaModal(false);
                    navegarAPedido(tipoVentaCustomer, 'pedido');
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95 ${
                    isDark
                      ? 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20'
                      : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <span className="text-xl">📦</span>
                  <div className="text-center">
                    <p className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Pedido</p>
                    <p className={`text-[9px] mt-0.5 ${isDark ? 'text-blue-500/70' : 'text-blue-600/70'}`}>Entrega después</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowTipoVentaModal(false)}
                className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}

        {showDirModal && dirModalCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowDirModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-bold">¿A qué dirección?</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dirModalCustomer.razonSocial}</p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {dirModalCustomer._dirs.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDirIdx(i)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      selectedDirIdx === i
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDark ? 'border-slate-600 hover:border-slate-500' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-semibold text-sm">{d.label || `Dirección ${i + 1}`}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {d.direccion}{d.comuna ? `, ${d.comuna}` : ''}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDirModal(false)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDir}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomersManagement;
