// src/components/ExitReceiptModal.jsx
import React, { useState, useEffect } from 'react';
import { useRegionContext } from '../contexts/RegionContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, CheckCircle, Printer, FileText, Loader, Trash2, Search, Save, XCircle, AlertCircle } from 'lucide-react';
import { searchCustomers, saveOrUpdateFromEmission, getCustomerByRut, getCustomersByRut } from '../services/customers-service';
import { obtenerPdfDTE } from '../services/libredte-service';

// LocalStorage Keys
const LAST_RECEPTOR_KEY = 'bodestock_last_receptor_data';
const LAST_TRANSPORT_KEY = 'bodestock_last_transport_data';

const ExitReceiptModal = ({
  isOpen,
  onClose,
  exitData,
  workerName,
  warehouseName,
  companyInfo = null,
  onEmitBoleta = null,
  emitiendo = false,
  currentWorker = null,
  onAnnul = null,
  initialClienteRut = null,
  isPending = false
}) => {
  const { isVE } = useRegionContext();

  const loadLastReceptorData = () => {
    try {
      const saved = localStorage.getItem(LAST_RECEPTOR_KEY);
      return saved ? JSON.parse(saved) : { rut: '', razonSocial: '', giro: '', direccion: '', comuna: '' };
    } catch (error) {
      return { rut: '', razonSocial: '', giro: '', direccion: '', comuna: '' };
    }
  };

  const loadLastTransportData = () => {
    try {
      const saved = localStorage.getItem(LAST_TRANSPORT_KEY);
      return saved ? JSON.parse(saved) : { patente: '', rutTransportista: '', rutChofer: '', nombreChofer: '', direccionDestino: '', comunaDestino: '', tipoTraslado: 1 };
    } catch (error) {
      return { patente: '', rutTransportista: '', rutChofer: '', nombreChofer: '', direccionDestino: '', comunaDestino: '', tipoTraslado: 1 };
    }
  };

  const [showBoletaInfo, setShowBoletaInfo] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState('boleta');
  const [receptorData, setReceptorData] = useState({ rut: '', razonSocial: '', giro: '', direccion: '', comuna: '' });
  const [customerDirecciones, setCustomerDirecciones] = useState([]);
  const [transportData, setTransportData] = useState(loadLastTransportData());
  const [showReceptorForm, setShowReceptorForm] = useState(false);
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerExists, setCustomerExists] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [multiRutCustomers, setMultiRutCustomers] = useState([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showAnnulConfirm, setShowAnnulConfirm] = useState(false);
  const [annulReason, setAnnulReason] = useState('');
  const [annulling, setAnnulling] = useState(false);

  useEffect(() => {
    if (!initialClienteRut || !isOpen) return;
    const autoLoadCliente = async () => {
      try {
        const customers = await getCustomersByRut(initialClienteRut);
        if (customers.length > 1) {
          setMultiRutCustomers(customers);
          setCustomerExists(false);
          setTipoDocumento('factura');
        } else if (customers.length === 1) {
          const customer = customers[0];
          const dirs = customer.direcciones?.length > 0 ? customer.direcciones : null;
          setCustomerDirecciones(dirs || []);
          setReceptorData({ rut: customer.rut || '', razonSocial: customer.razonSocial || '', giro: customer.giro || '', direccion: dirs ? dirs[0].direccion : (customer.direccion || ''), comuna: dirs ? dirs[0].comuna : (customer.comuna || '') });
          setCustomerExists(true);
          setTipoDocumento('factura');
        }
      } catch (e) {
        console.error('Error auto-cargando cliente:', e);
      }
    };
    autoLoadCliente();
  }, [initialClienteRut, isOpen]);

  useEffect(() => {
    const searchByRut = async () => {
      const rut = receptorData.rut?.trim();
      if (!rut || rut.length < 8) { setCustomerExists(false); setSearchingCustomer(false); return; }
      setSearchingCustomer(true);
      setMultiRutCustomers([]);
      try {
        const customers = await getCustomersByRut(rut);
        if (customers.length > 1) {
          setMultiRutCustomers(customers);
          setCustomerExists(false);
        } else if (customers.length === 1) {
          const customer = customers[0];
          setCustomerExists(true);
          setMultiRutCustomers([]);
          const dirs = customer.direcciones?.length > 0 ? customer.direcciones : null;
          setCustomerDirecciones(dirs || []);
          setReceptorData({ rut: customer.rut, razonSocial: customer.razonSocial, giro: customer.giro || '', direccion: dirs ? dirs[0].direccion : (customer.direccion || ''), comuna: dirs ? dirs[0].comuna : (customer.comuna || '') });
        } else {
          setCustomerExists(false);
        }
      } catch (error) {
        setCustomerExists(false);
      } finally {
        setSearchingCustomer(false);
      }
    };
    const timeoutId = setTimeout(searchByRut, 500);
    return () => clearTimeout(timeoutId);
  }, [receptorData.rut]);

  useEffect(() => {
    if (receptorData.rut || receptorData.razonSocial) localStorage.setItem(LAST_RECEPTOR_KEY, JSON.stringify(receptorData));
  }, [receptorData]);

  useEffect(() => {
    if (transportData.patente || transportData.nombreChofer) localStorage.setItem(LAST_TRANSPORT_KEY, JSON.stringify(transportData));
  }, [transportData]);

  if (!exitData) return null;

  const clearSavedData = () => {
    if (window.confirm('¿Estás seguro de que deseas borrar los datos guardados?')) {
      localStorage.removeItem(LAST_RECEPTOR_KEY);
      localStorage.removeItem(LAST_TRANSPORT_KEY);
      setReceptorData({ rut: '', razonSocial: '', giro: '', direccion: '', comuna: '' });
      setTransportData({ patente: '', rutTransportista: '', rutChofer: '', nombreChofer: '', direccionDestino: '', comunaDestino: '', tipoTraslado: 1 });
      alert('✅ Datos guardados eliminados');
    }
  };

  const handleCustomerSearch = async (searchText) => {
    setCustomerSearch(searchText);
    if (searchText.length < 3) { setCustomerResults([]); setShowCustomerResults(false); return; }
    try {
      const results = await searchCustomers(searchText);
      setCustomerResults(results);
      setShowCustomerResults(results.length > 0);
    } catch (error) {
      setCustomerResults([]);
      setShowCustomerResults(false);
    }
  };

  const selectCustomer = (customer) => {
    setReceptorData({ rut: customer.rut, razonSocial: customer.razonSocial, giro: customer.giro || '', direccion: customer.direccion || '', comuna: customer.comuna || '' });
    setCustomerSearch('');
    setShowCustomerResults(false);
  };

  const handleSaveCustomer = async () => {
    if (!receptorData.rut || !receptorData.razonSocial) { alert('⚠️ Necesitas completar al menos RUT y Razón Social'); return; }
    setSavingCustomer(true);
    try {
      await saveOrUpdateFromEmission(receptorData);
      alert('✅ Cliente guardado en tu base de datos');
    } catch (error) {
      alert(`❌ Error guardando cliente: ${error.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const isSale = exitData.reason === 'SALE' || exitData.reason === 'CREDIT';
  const hasBoletaEmitida = exitData.boleta && exitData.boleta.folio;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const EXIT_REASONS = {
    PRODUCTION: { name: 'PRODUCCION' }, MAINTENANCE: { name: 'MANTENCION' }, SALE: { name: 'VENTA' },
    DAMAGE: { name: 'DAÑO/PERDIDA' }, WASTE: { name: 'MERMA' }, TRANSFER: { name: 'TRANSFERENCIA' },
    CONSUMPTION: { name: 'CONSUMO' }, CREDIT: { name: 'FIADO/CREDITO' }, OTHER: { name: 'OTRO' }
  };
  const reasonInfo = EXIT_REASONS[exitData.reason] || EXIT_REASONS.OTHER;

  const formatCLP = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount || 0);

  const calculateTotals = () => {
    if (!isSale) return null;
    const products = exitData.products || exitData.items || [];
    const total = products.reduce((sum, product) => {
      const price = product.unitValue || product.ppp || 0;
      const quantity = product.quantity || product.qty || 0;
      return sum + (price * quantity);
    }, 0);
    const neto = Math.round(total / 1.19);
    const iva = Math.round(total) - neto;
    return { subtotal: neto, iva, total: Math.round(total) };
  };

  const totals = calculateTotals();

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ format: [80, 200], unit: 'mm' });
    let yPos = 10;
    const centerX = 40;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('COMPROBANTE DE SALIDA', centerX, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('================================', centerX, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`Fecha: ${formatDate(exitData.createdAt)}`, 5, yPos); yPos += 4;
    doc.text(`Hora: ${formatTime(exitData.createdAt)}`, 5, yPos); yPos += 4;
    doc.text(`ID: ${exitData.id || 'N/A'}`, 5, yPos); yPos += 5;
    doc.text('================================', centerX, yPos, { align: 'center' }); yPos += 5;
    if (exitData.customerName) { doc.setFont(undefined, 'bold'); doc.text('CLIENTE:', 5, yPos); yPos += 4; doc.setFont(undefined, 'normal'); doc.text(exitData.customerName, 5, yPos); yPos += 5; }
    if (exitData.reason === 'CREDIT') { doc.setFont(undefined, 'bold'); doc.text('** PENDIENTE DE PAGO **', centerX, yPos, { align: 'center' }); yPos += 5; }
    doc.text('================================', centerX, yPos, { align: 'center' }); yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('PRODUCTOS', centerX, yPos, { align: 'center' }); yPos += 5;
    doc.setFont(undefined, 'normal');
    (exitData.products || exitData.items || []).forEach((product, index) => {
      const productName = product.productName || product.itemName || 'N/A';
      const quantity = (product.quantity || product.qty || 0).toFixed(2);
      const unit = product.unit || 'unidades';
      const lines = doc.splitTextToSize(productName, 70);
      lines.forEach(line => { doc.text(line, 5, yPos); yPos += 4; });
      doc.text(`  ${quantity} ${unit}`, 5, yPos); yPos += 5;
      if (index < (exitData.products || exitData.items || []).length - 1) { doc.text('- - - - - - - - - - - - - - - -', centerX, yPos, { align: 'center' }); yPos += 4; }
    });
    yPos += 2;
    doc.text('================================', centerX, yPos, { align: 'center' }); yPos += 5;
    if (exitData.notes) { doc.setFont(undefined, 'bold'); doc.text('NOTAS:', 5, yPos); yPos += 4; doc.setFont(undefined, 'normal'); doc.splitTextToSize(exitData.notes, 70).forEach(line => { doc.text(line, 5, yPos); yPos += 4; }); yPos += 3; }
    doc.setFontSize(7);
    doc.text('Gracias', centerX, yPos, { align: 'center' }); yPos += 4;
    doc.text(new Date().toLocaleString('es-CL'), centerX, yPos, { align: 'center' });
    doc.save(`comprobante_${exitData.id || Date.now()}.pdf`);
  };

  const handleDownloadDtePdf = async () => {
    if (!exitData?.boleta?.folio || !exitData?.boleta?.tipoDTE) return;
    setDownloadingPdf(true);
    try {
      const result = await obtenerPdfDTE(exitData.boleta.folio, exitData.boleta.tipoDTE);
      if (result.success && result.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DTE_${exitData.boleta.tipoDTE}_Folio_${exitData.boleta.folio}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(`Error descargando PDF: ${result.error}`);
      }
    } catch (error) {
      alert(`Error descargando PDF: ${error.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Comprobante de Salida', text: `Salida de inventario - ${workerName} - ${formatDate(exitData.createdAt)}` }); }
      catch (error) { console.log('Error compartiendo:', error); }
    } else {
      navigator.clipboard.writeText(`Comprobante de Salida\nID: ${exitData.id}\nTrabajador: ${workerName}\nFecha: ${formatDate(exitData.createdAt)}`);
      alert('Información copiada al portapapeles');
    }
  };

  const handleAnnul = async () => {
    if (!annulReason.trim()) { alert('Por favor ingresa un motivo para la anulación'); return; }
    try {
      setAnnulling(true);
      await onAnnul(exitData.id, annulReason);
      setShowAnnulConfirm(false);
      setAnnulReason('');
      onClose();
    } catch (error) {
      alert('Error al anular la venta: ' + error.message);
    } finally {
      setAnnulling(false);
    }
  };

  const products = exitData.products || exitData.items || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm flex flex-col max-h-[95vh]"
            >
              {/* Header */}
              <div className={`px-5 py-4 rounded-t-3xl sm:rounded-t-2xl flex items-center justify-between flex-shrink-0 ${isPending ? 'bg-blue-600' : 'bg-emerald-500'}`}>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold text-base">
                    {isPending ? 'Confirmar y Facturar' : '¡Venta registrada!'}
                  </span>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/20 text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt body */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-4 space-y-4">

                  {/* Company info */}
                  <div className="text-center">
                    {companyInfo?.name && (
                      <p className="font-bold text-slate-900 text-base">{companyInfo.name}</p>
                    )}
                    {companyInfo?.address && (
                      <p className="text-xs text-slate-400">{companyInfo.address}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(exitData.createdAt)} · {formatTime(exitData.createdAt)}
                    </p>
                    {!isVE && hasBoletaEmitida && (
                      <p className="text-xs font-semibold text-emerald-600 mt-1">
                        {exitData.boleta.tipoDTE === 33 ? 'Factura Electrónica' : exitData.boleta.tipoDTE === 52 ? 'Guía de Despacho' : 'Boleta Electrónica'} · Folio N° {exitData.boleta.folio}
                      </p>
                    )}
                  </div>

                  {/* Customer / Credit */}
                  {(exitData.customerName || exitData.reason === 'CREDIT') && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {exitData.customerName && (
                        <span className="text-sm text-slate-600">👤 {exitData.customerName}</span>
                      )}
                      {exitData.reason === 'CREDIT' && (
                        <span className="ml-auto text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          ⚠️ Pendiente de pago
                        </span>
                      )}
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-200" />

                  {/* Product list */}
                  <div className="space-y-3">
                    {products.map((product, index) => {
                      const qty = product.quantity || product.qty || 0;
                      const unitPrice = product.unitValue || product.ppp || 0;
                      const lineTotal = qty * unitPrice;
                      const name = product.productName || product.itemName || 'Producto';
                      return (
                        <div key={index}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 text-sm leading-snug">{name}</p>
                              {product.selectedPresentationName && (
                                <span className="inline-block text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md mt-0.5">{product.selectedPresentationName}</span>
                              )}
                              {isSale && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {qty % 1 === 0 ? qty : qty.toFixed(2)} {product.unit || 'u'} × {formatCLP(unitPrice)}
                                </p>
                              )}
                              {product.selectedExtras && product.selectedExtras.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {product.selectedExtras.map((ex, ei) => (
                                    <p key={ei} className="text-xs text-slate-400 pl-2">+ {ex.name}{ex.price > 0 ? ` · ${formatCLP(ex.price)}` : ''}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isSale && (
                              <p className="font-bold text-slate-900 text-sm flex-shrink-0">{formatCLP(lineTotal)}</p>
                            )}
                          </div>
                          {index < products.length - 1 && (
                            <div className="border-t border-slate-100 mt-3" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-dashed border-slate-200" />

                  {/* Totals */}
                  {isSale && totals && (
                    onEmitBoleta ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>Subtotal neto</span>
                          <span>{formatCLP(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>IVA (19%)</span>
                          <span>{formatCLP(totals.iva)}</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                          <span>Total</span>
                          <span>{formatCLP(totals.total)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <p className="text-4xl font-black text-slate-900">{formatCLP(totals.total)}</p>
                        <p className="text-xs text-slate-400 mt-1">IVA incluido</p>
                      </div>
                    )
                  )}

                  {/* Payment method */}
                  {exitData.paymentMethodLabel && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Método de pago</span>
                      <span className="text-slate-700 font-medium">{exitData.paymentMethodLabel}</span>
                    </div>
                  )}

                  {/* Cancelled */}
                  {exitData.status === 'cancelled' && (
                    <div className="flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-bold text-sm">
                      <XCircle className="w-4 h-4" />
                      VENTA ANULADA
                      {exitData.cancellationReason && (
                        <span className="font-normal text-red-400 text-xs">· {exitData.cancellationReason}</span>
                      )}
                    </div>
                  )}

                  <div className="text-center pt-1 pb-3 space-y-1">
                    <p className="text-sm font-semibold text-slate-300">¡Gracias por tu compra! 🙏</p>
                    <p className="text-[11px] text-slate-500 tracking-wide">Powered by <span className="font-bold text-slate-400">Bodestock.cl</span></p>
                  </div>
                </div>

                {/* SII section — solo Chile, solo si tiene onEmitBoleta */}
                {!isVE && isSale && onEmitBoleta && !hasBoletaEmitida && (
                  <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Emitir documento tributario</p>

                    {/* Tabs */}
                    <div className="flex gap-2">
                      {[
                        { value: 'boleta', label: 'Boleta', icon: '🧾' },
                        { value: 'factura', label: 'Factura', icon: '📄' },
                        { value: 'guia', label: 'Guía', icon: '🚚' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setTipoDocumento(opt.value);
                            setShowReceptorForm(opt.value === 'factura' || opt.value === 'guia');
                            setShowTransportForm(opt.value === 'guia');
                          }}
                          className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all ${
                            tipoDocumento === opt.value
                              ? opt.value === 'boleta' ? 'bg-emerald-600 text-white border-emerald-600'
                                : opt.value === 'factura' ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Buscador factura */}
                    {tipoDocumento === 'factura' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar cliente por nombre o RUT..."
                            value={customerSearch}
                            onChange={(e) => handleCustomerSearch(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            autoFocus
                          />
                          {showCustomerResults && customerResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto">
                              {customerResults.map(customer => (
                                <button key={customer.id} onClick={() => selectCustomer(customer)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors">
                                  <p className="text-sm font-bold text-slate-900">{customer.razonSocial}</p>
                                  <p className="text-xs text-slate-400">RUT: {customer.rut}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {customerExists && receptorData.razonSocial && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-emerald-900 truncate">{receptorData.razonSocial}</p>
                                <p className="text-xs text-emerald-600">{receptorData.rut}</p>
                              </div>
                              <button onClick={() => { setReceptorData({ rut: '', razonSocial: '', giro: '', direccion: '', comuna: '' }); setCustomerExists(false); setCustomerSearch(''); setCustomerDirecciones([]); }}
                                className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                            {customerDirecciones.length > 1 && (
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                  Dirección de facturación
                                </label>
                                <select
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                  defaultValue={0}
                                  onChange={(e) => {
                                    const idx = parseInt(e.target.value);
                                    const d = customerDirecciones[idx];
                                    setReceptorData(prev => ({ ...prev, direccion: d.direccion, comuna: d.comuna }));
                                  }}
                                >
                                  {customerDirecciones.map((d, i) => (
                                    <option key={i} value={i}>
                                      {d.label ? `${d.label} — ` : ''}{d.direccion}, {d.comuna}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                        {multiRutCustomers.length > 1 && !customerExists && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-xs font-semibold text-amber-800 mb-2">Este RUT tiene varios giros. ¿Cuál es el receptor?</p>
                            <div className="space-y-1">
                              {multiRutCustomers.map((c, i) => (
                                <button key={c.id || i} type="button"
                                  onClick={() => {
                                    const dirs = c.direcciones?.length > 0 ? c.direcciones : null;
                                    setCustomerDirecciones(dirs || []);
                                    setReceptorData({ rut: c.rut, razonSocial: c.razonSocial, giro: c.giro || '', direccion: dirs ? dirs[0].direccion : (c.direccion || ''), comuna: dirs ? dirs[0].comuna : (c.comuna || '') });
                                    setCustomerExists(true);
                                    setMultiRutCustomers([]);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 transition-colors">
                                  <p className="text-sm font-semibold text-slate-800">{c.razonSocial}</p>
                                  {c.giro && <p className="text-xs text-slate-400">{c.giro}</p>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {!customerExists && !receptorData.razonSocial && multiRutCustomers.length === 0 && (
                          <p className="text-xs text-slate-400 text-center">Busca un cliente de tu cartera para emitir la factura</p>
                        )}
                      </div>
                    )}

                    {/* Datos transporte guía */}
                    {tipoDocumento === 'guia' && showTransportForm && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-orange-800">🚚 Datos de Transporte</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Patente" value={transportData.patente}
                            onChange={(e) => setTransportData({ ...transportData, patente: e.target.value.toUpperCase() })}
                            maxLength={6} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase bg-white" />
                          <input type="text" placeholder="RUT Transportista" value={transportData.rutTransportista}
                            onChange={(e) => setTransportData({ ...transportData, rutTransportista: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                        </div>
                        <input type="text" placeholder="Nombre del Chofer" value={transportData.nombreChofer}
                          onChange={(e) => setTransportData({ ...transportData, nombreChofer: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                        <input type="text" placeholder="Dirección de Destino" value={transportData.direccionDestino}
                          onChange={(e) => setTransportData({ ...transportData, direccionDestino: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                        <input type="text" placeholder="Comuna de Destino" value={transportData.comunaDestino}
                          onChange={(e) => setTransportData({ ...transportData, comunaDestino: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                        <select value={transportData.tipoTraslado}
                          onChange={(e) => setTransportData({ ...transportData, tipoTraslado: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                          <option value={1}>Operación constituye venta</option>
                          <option value={2}>Venta por efectuar a terceros</option>
                          <option value={3}>Consignación</option>
                          <option value={4}>Entrega gratuita</option>
                          <option value={5}>Traslado interno</option>
                          <option value={6}>Otros traslados no venta</option>
                        </select>
                      </div>
                    )}

                    {/* Botón emitir */}
                    <button
                      onClick={async () => {
                        if (tipoDocumento === 'factura') {
                          if (!customerExists) { alert('❌ El cliente debe estar registrado en la cartera.'); return; }
                          if (!receptorData.rut || !receptorData.razonSocial) { alert('Completa el RUT y Razón Social del receptor'); return; }
                          onEmitBoleta(exitData, { tipoDTE: 33, receptorData });
                        } else if (tipoDocumento === 'guia') {
                          if (!receptorData.rut || !receptorData.razonSocial) { alert('Completa el RUT y Razón Social del destinatario'); return; }
                          if (!transportData.patente && !transportData.nombreChofer) { alert('Completa al menos la patente o el nombre del chofer'); return; }
                          try { await saveOrUpdateFromEmission(receptorData); } catch (e) { console.warn(e); }
                          onEmitBoleta(exitData, { tipoDTE: 52, transportData: { ...receptorData, ...transportData } });
                        } else {
                          onEmitBoleta(exitData, { tipoDTE: 39 });
                        }
                      }}
                      disabled={emitiendo || (tipoDocumento === 'factura' && !customerExists) || (tipoDocumento === 'guia' && !customerExists)}
                      className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        tipoDocumento === 'factura' ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : tipoDocumento === 'guia' ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {emitiendo
                        ? <><Loader className="w-4 h-4 animate-spin" /> Emitiendo...</>
                        : <><FileText className="w-4 h-4" /> Emitir {tipoDocumento === 'factura' ? 'Factura' : tipoDocumento === 'guia' ? 'Guía' : 'Boleta'} (SII)</>
                      }
                    </button>
                  </div>
                )}

                {/* Boleta ya emitida — solo Chile */}
                {!isVE && isSale && hasBoletaEmitida && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-800">
                          {exitData.boleta.tipoDTE === 33 ? 'Factura' : exitData.boleta.tipoDTE === 52 ? 'Guía' : 'Boleta'} emitida · Folio {exitData.boleta.folio}
                        </span>
                      </div>
                      <button onClick={handleDownloadDtePdf} disabled={downloadingPdf}
                        className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-800 disabled:opacity-50">
                        {downloadingPdf ? <Loader className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        PDF SII
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0 space-y-2">
                <div className="flex gap-2">
                  <button onClick={handlePrint}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </button>
                  <button onClick={downloadPDF}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition">
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                  <button onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">
                    <Share2 className="w-4 h-4" />
                    Compartir
                  </button>
                </div>

                {exitData.status !== 'cancelled' && onAnnul && isSale && (
                  <button onClick={() => setShowAnnulConfirm(true)}
                    className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition flex items-center justify-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    Anular venta
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Confirm Annul Modal */}
          <AnimatePresence>
            {showAnnulConfirm && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-slate-900">Anular venta</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">Esta acción devolverá el stock. Ingresa el motivo:</p>
                  <textarea
                    value={annulReason}
                    onChange={(e) => setAnnulReason(e.target.value)}
                    placeholder="Motivo de anulación..."
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAnnulConfirm(false)} disabled={annulling}
                      className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">
                      Cancelar
                    </button>
                    <button onClick={handleAnnul} disabled={annulling || !annulReason.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-1.5">
                      {annulling ? <><Loader className="w-4 h-4 animate-spin" />Anulando...</> : <><XCircle className="w-4 h-4" />Anular</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExitReceiptModal;
