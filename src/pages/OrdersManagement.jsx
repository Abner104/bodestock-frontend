// src/pages/OrdersManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  Loader,
  AlertCircle,
  Receipt,
  CreditCard,
  Pencil,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowLeft,
  UserPlus,
  Bike,
  PackageCheck,
  Volume2,
  VolumeX,
  Landmark
} from 'lucide-react';
import { playBeep } from '../utils/notificationSound';
import {
  getAllOrders,
  listenToPendingOrders,
  approveOrder,
  rejectOrder,
  markAsInvoiced,
  markAsDelivering,
  markAsDelivered,
  deleteOrder,
  updateOrderItems
} from '../services/orders-service';
import { emitirBoleta, getLibreDTEConfig } from '../services/libredte-service';
import { saveOrUpdateFromEmission } from '../services/customers-service';
import { auth } from '../firebase/firebase';
import { useTheme } from '../contexts/ThemeContext';
import { ToastContainer, useToast } from '../components/ui/Toast';
import PendingOrdersCarousel from '../components/orders/PendingOrdersCarousel';

const OrdersManagement = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const filtroRut = searchParams.get('rut') || '';
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 12;

  // Estados para el modal de rechazo
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState(null);

  // Estados para el modal de edición de pedido
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para emisión de boleta
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [invoiceError, setInvoiceError] = useState(null);
  const [saveCustomer, setSaveCustomer] = useState(true);

  // "Emitir Boleta / Factura" emite un documento REAL ante el SII -- sin
  // las credenciales de SimpleFactura configuradas (Configuración →
  // Facturación) no hay forma de emitir nada legal, solo quedaría una
  // pre-cuenta interna. El botón solo se muestra si la config está
  // completa (mismo criterio que isConfigComplete en LibreDTESettings.jsx).
  const [canEmitirDocumentos, setCanEmitirDocumentos] = useState(false);

  // Alerta sonora de pedido nuevo -- mismo patrón que KitchenDisplay.jsx.
  // Se persiste en localStorage para que no vuelva a sonar "sin querer" si
  // el negocio lo apagó porque la pantalla queda abierta en un mostrador.
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('bodestock:pedidos:sound') !== 'off'; } catch { return true; }
  });
  // setupRealtimeListener se suscribe una sola vez (useEffect con deps
  // vacías) -- su closure quedaría con el soundOn de ese primer render para
  // siempre, sin ver cambios posteriores del toggle. Un ref sí lee el valor
  // actual en cada evento del listener sin tener que resuscribirlo.
  const soundOnRef = useRef(soundOn);
  const knownPendingIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  const toggleSound = () => {
    setSoundOn(v => {
      const next = !v;
      try { localStorage.setItem('bodestock:pedidos:sound', next ? 'on' : 'off'); } catch {}
      soundOnRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    loadOrders();
    setupRealtimeListener();
    getLibreDTEConfig().then((config) => {
      setCanEmitirDocumentos(Boolean(config?.sfEmail && config?.sfPassword && config?.rutEmisor && config?.razonSocial));
    });
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, statusFilter, searchQuery, filtroRut]);

  // Al cambiar de filtro o búsqueda, volver a la página 1 -- si no, se
  // puede quedar "varado" en una página que ya no existe para el nuevo filtro.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, filtroRut]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const allOrders = await getAllOrders();
      setOrders(allOrders);
    } catch (error) {
      console.error('Error cargando pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListener = async () => {
    try {
      const unsubscribe = await listenToPendingOrders((pendingOrders) => {
        console.log('Nuevos pedidos pendientes:', pendingOrders.length);

        // Alerta de pedido nuevo: compara contra los IDs ya vistos, no
        // contra el conteo -- un pedido que se aprueba y otro que entra al
        // mismo tiempo no cambian el total, pero sí hay uno nuevo real. La
        // primera carga nunca suena (isFirstLoad), si no, sonaría apenas se
        // abre la pantalla con pedidos pendientes ya existentes.
        const newIds = pendingOrders.map(o => o.id).filter(id => !knownPendingIds.current.has(id));
        if (!isFirstLoad.current && newIds.length > 0 && soundOnRef.current) {
          playBeep(newIds.length > 1 ? 3 : 2);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
        knownPendingIds.current = new Set(pendingOrders.map(o => o.id));
        isFirstLoad.current = false;

        // Actualizar solo los pedidos pendientes en tiempo real
        setOrders(prevOrders => {
          const nonPending = prevOrders.filter(o => o.status !== 'PENDING');
          return [...pendingOrders, ...nonPending].sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
          });
        });
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error configurando listener:', error);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Filtrar por cliente específico (viene desde Clientes)
    if (filtroRut) {
      filtered = filtered.filter(order => order.customerInfo?.rut === filtroRut);
    }

    // Filtrar por estado
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(order => order.status === statusFilter);
    } else {
      // Con "Todos" seleccionado, los pendientes no se duplican acá abajo
      // -- ya viven en el carrusel de comandas de arriba (ver
      // PendingOrdersCarousel), que es donde se aprueban/rechazan. Si el
      // dueño filtra explícitamente por "Pendiente" sí los ve en la lista
      // (statusFilter === 'PENDING' cae en la rama de arriba, sin este filtro).
      filtered = filtered.filter(order => order.status !== 'PENDING');
    }

    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.customerInfo?.nombre?.toLowerCase().includes(query) ||
        order.customerInfo?.telefono?.includes(query) ||
        order.customerInfo?.email?.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  // Confirmar entrega de un pedido pendiente: lleva a la pantalla de venta
  // con los productos pre-cargados, para elegir Contado/Crédito y descontar stock recién ahí
  const handleConfirmarEntrega = (order) => {
    const preSelected = (order.items || [])
      .filter(i => i.productId)
      .map(i => ({ id: i.productId, quantity: i.quantity }));

    const params = new URLSearchParams({
      clienteRut: order.customerInfo?.rut || '',
      clienteNombre: order.customerInfo?.nombre || '',
      clienteDireccion: order.customerInfo?.direccion || '',
      clienteComuna: order.customerInfo?.comuna || '',
      orderId: order.id,
    });
    if (preSelected.length > 0) {
      params.set('preSelected', encodeURIComponent(JSON.stringify(preSelected)));
    }
    navigate(`/mis-bodegas?${params.toString()}`);
  };

  const handleApprove = async (orderId) => {
    try {
      setProcessingOrderId(orderId);
      await approveOrder(orderId, auth.currentUser?.uid);
      await loadOrders();
    } catch (error) {
      console.error('Error aprobando pedido:', error);
      toast.error('Error al aprobar el pedido: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleMarkDelivering = async (orderId) => {
    try {
      setProcessingOrderId(orderId);
      await markAsDelivering(orderId);
      await loadOrders();
    } catch (error) {
      console.error('Error marcando pedido en camino:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      setProcessingOrderId(orderId);
      await markAsDelivered(orderId);
      await loadOrders();
    } catch (error) {
      console.error('Error marcando pedido entregado:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedOrder || !rejectReason.trim()) {
      toast.warning('Debes proporcionar un motivo de rechazo');
      return;
    }

    try {
      setProcessingOrderId(selectedOrder.id);
      await rejectOrder(selectedOrder.id, rejectReason, auth.currentUser?.uid);
      await loadOrders();
      setShowRejectModal(false);
      setSelectedOrder(null);
      setRejectReason('');
    } catch (error) {
      console.error('Error rechazando pedido:', error);
      toast.error('Error al rechazar el pedido: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleOpenEdit = (order) => {
    setEditOrder(order);
    setEditItems((order.items || []).map(i => ({ ...i })));
    setShowEditModal(true);
  };

  const cambiarCantidadEdit = (idx, delta) => {
    setEditItems(prev => prev
      .map((it, i) => i === idx
        ? { ...it, quantity: Math.max(0, (it.quantity || 0) + delta), totalPrice: Math.max(0, (it.quantity || 0) + delta) * (it.unitPrice || 0) }
        : it)
      .filter(it => it.quantity > 0)
    );
  };

  const quitarItemEdit = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    setSavingEdit(true);
    try {
      const total = editItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
      await updateOrderItems(editOrder.id, editItems, total);
      await loadOrders();
      setShowEditModal(false);
      setEditOrder(null);
      setEditItems([]);
    } catch (error) {
      console.error('Error editando pedido:', error);
      toast.error('Error al editar el pedido: ' + error.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Modal de confirmación propio en vez de window.confirm() -- el popup
  // nativo del navegador se ve fuera de lugar en un panel ya con su propio
  // diseño claro/oscuro, y no se puede estilizar ni traducir su botón.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDelete = async (orderId) => {
    try {
      await deleteOrder(orderId);
      await loadOrders();
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error eliminando pedido:', error);
      toast.error('Error al eliminar el pedido: ' + error.message);
    }
  };

  // Estado del tipo de documento y datos fiscales para el modal
  const [emisionTipo, setEmisionTipo] = useState('boleta'); // 'boleta' o 'factura'
  const [datosFiscales, setDatosFiscales] = useState({
    rut: '',
    razonSocial: '',
    giro: '',
    direccion: '',
    comuna: '',
    email: ''
  });
  const [customerDirecciones, setCustomerDirecciones] = useState([]); // direcciones del cliente si tiene múltiples

  // Abrir modal de emisión
  const openInvoiceModal = (order) => {
    setInvoiceOrder(order);
    setInvoiceResult(null);
    setInvoiceError(null);
    setEmisionTipo('boleta');
    setSaveCustomer(true);

    // Detectar si el cliente tiene múltiples direcciones guardadas
    const dirs = order.customerInfo?.direcciones;
    if (dirs && dirs.length > 0) {
      setCustomerDirecciones(dirs);
      setDatosFiscales({
        rut: order.customerInfo?.rut || '',
        razonSocial: order.customerInfo?.nombre || '',
        giro: '',
        direccion: dirs[0].direccion || '',
        comuna: dirs[0].comuna || '',
        email: order.customerInfo?.email || ''
      });
    } else {
      setCustomerDirecciones([]);
      setDatosFiscales({
        rut: order.customerInfo?.rut || '',
        razonSocial: order.customerInfo?.nombre || '',
        giro: '',
        direccion: order.customerInfo?.direccion || '',
        comuna: order.customerInfo?.comuna || '',
        email: order.customerInfo?.email || ''
      });
    }
    setShowInvoiceModal(true);
  };

  // Validar datos para factura
  const validateFacturaData = () => {
    if (!datosFiscales.rut.trim()) return 'El RUT es obligatorio para factura';
    if (!datosFiscales.razonSocial.trim()) return 'La razón social es obligatoria para factura';
    if (!datosFiscales.giro.trim()) return 'El giro es obligatorio para factura';
    if (!datosFiscales.direccion.trim()) return 'La dirección es obligatoria para factura';
    if (!datosFiscales.comuna.trim()) return 'La comuna es obligatoria para factura';
    return null;
  };

  // Emitir boleta
  const handleEmitirDocumento = async () => {
    if (!invoiceOrder) return;

    // Validar si es factura
    if (emisionTipo === 'factura') {
      const validationError = validateFacturaData();
      if (validationError) {
        setInvoiceError(validationError);
        return;
      }
    }

    setInvoiceLoading(true);
    setInvoiceError(null);
    setInvoiceResult(null);

    try {
      // Preparar datos para el servicio de facturación
      const exitData = {
        totalValue: invoiceOrder.totalAmount,
        products: invoiceOrder.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          unitValue: item.unitPrice,
          ppp: item.unitPrice
        }))
      };

      let result;

      if (emisionTipo === 'factura') {
        // Factura (DTE 33) con datos fiscales del formulario
        result = await emitirBoleta(exitData, {
          tipoDTE: 33,
          receptorData: {
            rut: datosFiscales.rut,
            razonSocial: datosFiscales.razonSocial,
            giro: datosFiscales.giro,
            direccion: datosFiscales.direccion,
            comuna: datosFiscales.comuna
          }
        });
      } else {
        // Boleta (DTE 39)
        result = await emitirBoleta(exitData, { tipoDTE: 39 });
      }

      if (result.success) {
        setInvoiceResult(result);

        // Guardar cliente si tiene RUT y la opción está activa
        if (saveCustomer && datosFiscales.rut.trim()) {
          try {
            await saveOrUpdateFromEmission({
              rut: datosFiscales.rut,
              razonSocial: datosFiscales.razonSocial || invoiceOrder.customerInfo?.nombre,
              nombre: invoiceOrder.customerInfo?.nombre,
              giro: datosFiscales.giro || '',
              direccion: datosFiscales.direccion || invoiceOrder.customerInfo?.direccion || '',
              comuna: datosFiscales.comuna || invoiceOrder.customerInfo?.comuna || '',
              email: datosFiscales.email || invoiceOrder.customerInfo?.email || '',
              telefono: invoiceOrder.customerInfo?.telefono || ''
            });
            console.log('Cliente guardado/actualizado');
          } catch (err) {
            console.error('Error guardando cliente:', err);
          }
        }

        // Marcar pedido como facturado
        await markAsInvoiced(invoiceOrder.id, {
          tipoDTE: emisionTipo === 'factura' ? 33 : 39,
          tipoDocumento: emisionTipo === 'factura' ? 'Factura Electrónica' : 'Boleta Electrónica',
          folio: result.folio,
          trackId: result.trackId,
          emitidoPor: auth.currentUser?.uid,
          emitidoAt: new Date().toISOString(),
          ...(emisionTipo === 'factura' && { datosFiscales })
        });
        await loadOrders();
      } else {
        setInvoiceError(result.error || 'Error al emitir el documento');
      }
    } catch (error) {
      console.error('Error emitiendo documento:', error);
      setInvoiceError(error.message || 'Error inesperado al emitir el documento');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        border: 'border-amber-300',
        icon: Clock,
        label: 'Pendiente'
      },
      APPROVED: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-300',
        icon: CheckCircle,
        label: 'Aprobado'
      },
      INVOICED: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
        icon: FileText,
        label: 'Facturado'
      },
      DELIVERING: {
        bg: 'bg-indigo-100',
        text: 'text-indigo-800',
        border: 'border-indigo-300',
        icon: Bike,
        label: 'En camino'
      },
      DELIVERED: {
        bg: 'bg-teal-100',
        text: 'text-teal-800',
        border: 'border-teal-300',
        icon: PackageCheck,
        label: 'Entregado'
      },
      REJECTED: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
        icon: XCircle,
        label: 'Rechazado'
      },
      CANCELLED: {
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        border: 'border-slate-300',
        icon: XCircle,
        label: 'Cancelado'
      }
    };

    const badge = badges[status] || badges.PENDING;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getDocumentBadge = (order) => {
    if (!order.invoice) return null;
    const isFactura = order.invoice.tipoDTE === 33;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        isFactura
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-green-50 text-green-700 border border-green-200'
      }`}>
        {isFactura ? <FileText className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
        {isFactura ? 'Factura' : 'Boleta'}
      </span>
    );
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    approved: orders.filter(o => o.status === 'APPROVED').length,
    delivering: orders.filter(o => o.status === 'DELIVERING').length,
    invoiced: orders.filter(o => o.status === 'INVOICED').length,
    rejected: orders.filter(o => o.status === 'REJECTED').length
  };

  // Clase repetida en todos los inputs del formulario de datos fiscales
  // (modal de emisión) -- un solo lugar para la variante clara/oscura.
  const fiscalInputCls = `w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'border-slate-200 bg-white'}`;
  const fiscalLabelCls = `block text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-slate-600'}`;

  return (
    <div className={`min-h-screen p-4 md:p-8 ${isDark ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-50 to-slate-100'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              onClick={() => navigate(-1)}
              className={`flex items-center gap-1.5 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <button
              onClick={toggleSound}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                soundOn
                  ? (isDark ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600')
                  : (isDark ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-slate-100 border-slate-200 text-slate-400')
              }`}
              title={soundOn ? 'Silenciar alerta de pedido nuevo' : 'Activar alerta de pedido nuevo'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundOn ? 'Sonido activo' : 'Sonido silenciado'}</span>
            </button>
          </div>
          <h1 className={`text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <ShoppingBag className="w-7 h-7 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
            Gestión de Pedidos
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-slate-600'}>Administra los pedidos de tu catálogo público</p>

          {filtroRut && (
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
              <span className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                Filtrando por cliente: {filteredOrders[0]?.customerInfo?.nombre || filtroRut}
              </span>
              <button onClick={() => navigate('/pedidos')} className={isDark ? 'text-blue-400 hover:text-blue-200' : 'text-blue-400 hover:text-blue-600'}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards -- 3 columnas en mobile (en vez de 2) para que quepan
            sin que las cards queden tan altas/angostas con el pulgar
            encima; padding y texto más compactos en pantallas chicas. */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4 mb-6">
          <div className={`rounded-xl shadow-md p-2.5 md:p-4 border-l-4 border-slate-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <p className={`text-[11px] md:text-xs font-semibold mb-0.5 md:mb-1 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Total</p>
            <p className={`text-lg md:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.total}</p>
          </div>
          <div className={`rounded-xl shadow-md p-2.5 md:p-4 border-l-4 border-amber-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <p className={`text-[11px] md:text-xs font-semibold mb-0.5 md:mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Pendientes</p>
            <p className={`text-lg md:text-2xl font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{stats.pending}</p>
          </div>
          <div className={`rounded-xl shadow-md p-2.5 md:p-4 border-l-4 border-blue-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <p className={`text-[11px] md:text-xs font-semibold mb-0.5 md:mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Aprobados</p>
            <p className={`text-lg md:text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.approved}</p>
          </div>
          <div className={`rounded-xl shadow-md p-2.5 md:p-4 border-l-4 border-indigo-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <p className={`text-[11px] md:text-xs font-semibold mb-0.5 md:mb-1 ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>En camino</p>
            <p className={`text-lg md:text-2xl font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{stats.delivering}</p>
          </div>
          <div className={`rounded-xl shadow-md p-2.5 md:p-4 border-l-4 border-green-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <p className={`text-[11px] md:text-xs font-semibold mb-0.5 md:mb-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>Facturados</p>
            <p className={`text-lg md:text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{stats.invoiced}</p>
          </div>
          <div className={`rounded-xl shadow-md p-2.5 md:p-4 border-l-4 border-red-500 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <p className={`text-[11px] md:text-xs font-semibold mb-0.5 md:mb-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Rechazados</p>
            <p className={`text-lg md:text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{stats.rejected}</p>
          </div>
        </div>

        {/* Carrusel de comandas (ticket térmico) -- SOLO pedidos PENDING,
            uno a la vez, pensado para decidir aprobar/rechazar rápido sin
            escanear la lista completa. Usa `orders` (no `filteredOrders`):
            no debe depender de lo que el dueño haya tipeado en el buscador
            o del filtro de estado elegido abajo -- "lo urgente" siempre se
            ve completo acá arriba. */}
        <PendingOrdersCarousel
          orders={orders.filter(o => o.status === 'PENDING')}
          onApprove={handleApprove}
          onReject={(order) => { setSelectedOrder(order); setShowRejectModal(true); }}
          processingOrderId={processingOrderId}
        />

        {/* Filters */}
        <div className={`rounded-xl shadow-md p-3 md:p-4 mb-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 md:py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base md:text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'border-slate-200'}`}
              />
            </div>

            {/* Status Filter -- scroll horizontal con snap para que en
                mobile se sienta como un carrusel de chips, no una fila
                cortada a la mitad. */}
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 snap-x snap-mandatory -mx-1 px-1 md:mx-0 md:px-0">
              {['ALL', 'PENDING', 'APPROVED', 'DELIVERING', 'DELIVERED', 'INVOICED', 'REJECTED'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2.5 md:py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all snap-start ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-lg'
                      : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status === 'ALL' ? 'Todos' : getStatusBadge(status).props.children[1]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
          const safePage = Math.min(currentPage, totalPages);
          const paginatedOrders = filteredOrders.slice((safePage - 1) * ORDERS_PER_PAGE, safePage * ORDERS_PER_PAGE);
          return loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={`rounded-xl shadow-md p-12 text-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <Package className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-700' : 'text-slate-300'}`} />
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No hay pedidos</h3>
            <p className={isDark ? 'text-gray-400' : 'text-slate-600'}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'No se encontraron pedidos con los filtros seleccionados'
                : 'Los pedidos de tu catálogo aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedOrders.map(order => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}
              >
                {/* Franja de estado -- mismo espíritu "ticket" del carrusel
                    de pendientes, pero compacta: una vez procesado el pedido
                    ya no compite por atención, solo necesita ser legible y
                    archivado prolijamente en la lista. */}
                <div className={`px-4 py-2 flex items-center justify-between border-b ${isDark ? 'border-gray-800' : 'border-slate-100'}`} style={{ fontFamily: "'Courier New', monospace" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(order.status)}
                    {getDocumentBadge(order)}
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                    #{order.id.slice(-6).toUpperCase()}
                  </span>
                </div>

                <div className="p-4 md:p-5" style={{ fontFamily: "'Courier New', monospace" }}>
                  {/* Header: cliente + fecha + total */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-bold truncate uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {order.customerInfo?.nombre || 'Cliente'}
                      </h3>
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        {formatCLP(order.totalAmount)}
                      </p>
                      <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                        {order.items?.length || 0} producto{order.items?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className={`border-t border-dashed mb-3 ${isDark ? 'border-gray-700' : 'border-slate-300'}`} />

                  {/* Items -- lo central del ticket, igual criterio que el carrusel */}
                  <div className="mb-3 space-y-1.5">
                    {order.items?.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>
                            {item.quantity}x {(item.productName || '').toUpperCase()}
                          </span>
                          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {formatCLP(item.totalPrice)}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-xs font-semibold text-red-500 pl-3">↳ {item.note}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.paymentMethod === 'transferencia' && (
                    <div className={`flex items-center gap-2 rounded px-2.5 py-1.5 mb-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                      <Landmark className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                      <span className={`text-[11px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>PAGA POR TRANSFERENCIA</span>
                    </div>
                  )}

                  <div className={`border-t border-dashed mb-3 ${isDark ? 'border-gray-700' : 'border-slate-300'}`} />

                  {/* Contacto + despacho -- info secundaria, tipografía normal (no ticket) para no competir con los items */}
                  <div className="space-y-1.5 mb-1" style={{ fontFamily: 'inherit' }}>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{order.customerInfo?.telefono}</span>
                    </div>
                    {order.customerInfo?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{order.customerInfo.email}</span>
                      </div>
                    )}
                    {order.customerInfo?.direccion && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                          {order.customerInfo.direccion}, {order.customerInfo.comuna}
                        </span>
                      </div>
                    )}
                    {order.customerInfo?.rut && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>RUT: {order.customerInfo.rut}</span>
                      </div>
                    )}
                  </div>

                  {/* Despacho -- pedidos de la tienda pública con
                      deliveryMethod: 'delivery' (ver PublicStore.jsx).
                      Destacado aparte de Customer Info porque es la
                      instrucción operativa más importante del pedido: a
                      dónde hay que llevarlo. */}
                  {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
                    <div className={`flex items-start gap-2.5 mt-3 p-3 border rounded-lg ${isDark ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`} style={{ fontFamily: 'inherit' }}>
                      <Bike className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>Despacho a domicilio</p>
                        <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>{order.deliveryAddress}</p>
                        <a
                          href={order.deliveryCoords
                            ? `https://www.google.com/maps/search/?api=1&query=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs underline mt-1 inline-block ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                        >
                          Ver en Google Maps →
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Datos fiscales si fue facturado con factura */}
                  {order.invoice?.datosFiscales && (
                    <div className={`mt-3 p-3 border rounded-lg ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`} style={{ fontFamily: 'inherit' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>Datos de Facturación</span>
                      </div>
                      <div className={`grid grid-cols-1 md:grid-cols-2 gap-1 text-sm ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>
                        <p><strong>Razón Social:</strong> {order.invoice.datosFiscales.razonSocial}</p>
                        <p><strong>RUT:</strong> {order.invoice.datosFiscales.rut}</p>
                        <p><strong>Giro:</strong> {order.invoice.datosFiscales.giro}</p>
                        <p><strong>Dirección:</strong> {order.invoice.datosFiscales.direccion}, {order.invoice.datosFiscales.comuna}</p>
                      </div>
                    </div>
                  )}

                  {/* Facturación info si ya fue facturado */}
                  {order.status === 'INVOICED' && order.invoice && (
                    <div className={`mb-4 p-3 border rounded-lg ${isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className={`text-sm font-bold ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                          {order.invoice.tipoDocumento || 'Documento'} emitido
                        </span>
                      </div>
                      <div className={`text-sm ${isDark ? 'text-green-200' : 'text-green-900'}`}>
                        {order.invoice.folio && <p>Folio: #{order.invoice.folio}</p>}
                        {order.invoice.emitidoAt && <p>Fecha: {new Date(order.invoice.emitidoAt).toLocaleString('es-CL')}</p>}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {order.status === 'PENDING' && (
                    <div className={`flex flex-wrap gap-2 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
                      {order.source === 'VENDOR_ASSISTED' ? (
                        <>
                          <button
                            onClick={() => handleConfirmarEntrega(order)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Package className="w-4 h-4" />
                            Confirmar entrega
                          </button>
                          <button
                            onClick={() => handleOpenEdit(order)}
                            className={`font-semibold py-3 md:py-2 px-3 rounded-lg transition-all flex items-center justify-center ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            title="Editar pedido"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleApprove(order.id)}
                          disabled={processingOrderId === order.id}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {processingOrderId === order.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Aprobar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowRejectModal(true);
                        }}
                        disabled={processingOrderId === order.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar
                      </button>
                    </div>
                  )}

                  {order.status === 'APPROVED' && (
                    <div className={`pt-4 border-t space-y-2 ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
                      {order.deliveryMethod === 'delivery' && (
                        <button
                          onClick={() => handleMarkDelivering(order.id)}
                          disabled={processingOrderId === order.id}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {processingOrderId === order.id ? <Loader className="w-4 h-4 animate-spin" /> : <Bike className="w-4 h-4" />}
                          Marcar en camino
                        </button>
                      )}
                      {canEmitirDocumentos ? (
                        <button
                          onClick={() => openInvoiceModal(order)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <Receipt className="w-4 h-4" />
                          Emitir Boleta / Factura
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/settings')}
                          className={`w-full border font-medium py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm ${isDark ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'}`}
                          title="Conecta SimpleFactura en Configuración para emitir documentos válidos ante el SII"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Pre-cuenta · falta conectar Facturación
                        </button>
                      )}
                    </div>
                  )}

                  {order.status === 'DELIVERING' && (
                    <div className={`pt-4 border-t ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
                      <button
                        onClick={() => handleMarkDelivered(order.id)}
                        disabled={processingOrderId === order.id}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 md:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {processingOrderId === order.id ? <Loader className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                        Marcar entregado
                      </button>
                    </div>
                  )}

                  {(order.status === 'REJECTED' || order.status === 'CANCELLED') && (
                    <div className={`pt-4 border-t ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
                      <button
                        onClick={() => setConfirmDeleteId(order.id)}
                        className={`text-sm underline ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}
                      >
                        Eliminar pedido
                      </button>
                      {order.rejectionReason && (
                        <p className={`text-sm mt-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                          <strong>Motivo:</strong> {order.rejectionReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        );
        })()}

        {/* Paginación -- solo se muestra si hay más de una página para el filtro actual */}
        {!loading && (() => {
          const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
          const safePage = Math.min(currentPage, totalPages);
          if (totalPages <= 1) return null;
          return (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className={`px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 transition-all ${isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Anterior
              </button>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Página {safePage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className={`px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 transition-all ${isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Siguiente
              </button>
            </div>
          );
        })()}
      </div>

      {/* Modal de confirmación para eliminar pedido -- reemplaza
          window.confirm() nativo, mismo patrón visual que el resto de los
          modales de esta pantalla. */}
      <AnimatePresence>
        {confirmDeleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`rounded-2xl shadow-2xl w-full max-w-sm p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-red-500/15' : 'bg-red-50'}`}>
                  <Trash2 className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <h2 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>¿Eliminar este pedido?</h2>
                <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Esta acción no se puede deshacer.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className={`flex-1 font-semibold py-2 px-4 rounded-lg transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDeleteId)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de Rechazo */}
      <AnimatePresence>
        {showRejectModal && selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRejectModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`rounded-2xl shadow-2xl w-full max-w-md p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Rechazar Pedido</h2>
                <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  Pedido de <strong className={isDark ? 'text-gray-200' : undefined}>{selectedOrder.customerInfo?.nombre}</strong>
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Motivo del rechazo (ej: Producto agotado, fuera de zona de entrega, etc.)"
                  rows={4}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none mb-4 ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'border-slate-200'}`}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                    className={`flex-1 font-semibold py-2 px-4 rounded-lg transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || processingOrderId}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingOrderId ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Rechazar Pedido
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Modal de edición de pedido */}
        {showEditModal && editOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-gray-800' : 'border-slate-100'}`}>
                  <div>
                    <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Editar Pedido</h2>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>{editOrder.customerInfo?.nombre}</p>
                  </div>
                  <button onClick={() => setShowEditModal(false)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-slate-100 text-slate-400'}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {editItems.length === 0 ? (
                    <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Sin productos — el pedido quedará vacío</p>
                  ) : (
                    <div className="space-y-2">
                      {editItems.map((item, idx) => (
                        <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-lg ${isDark ? 'bg-gray-800/60' : 'bg-slate-50'}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.productName}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>${(item.unitPrice || 0).toLocaleString('es-CL')} c/u</p>
                            {item.note && (
                              <p className="text-xs font-semibold text-red-500 truncate">↳ {item.note}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => cambiarCantidadEdit(idx, -1)} className={`w-6 h-6 rounded-md flex items-center justify-center ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className={`text-sm font-bold w-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.quantity}</span>
                            <button onClick={() => cambiarCantidadEdit(idx, 1)} className={`w-6 h-6 rounded-md flex items-center justify-center ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <p className={`text-sm font-bold w-16 text-right shrink-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>${(item.totalPrice || 0).toLocaleString('es-CL')}</p>
                          <button onClick={() => quitarItemEdit(idx)} className="text-red-400 hover:text-red-500 shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`px-6 py-4 border-t shrink-0 ${isDark ? 'border-gray-800' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>Total</span>
                    <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ${editItems.reduce((s, i) => s + (i.totalPrice || 0), 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className={`flex-1 font-semibold py-2.5 px-4 rounded-lg transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingEdit ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Guardar cambios
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de Emisión Boleta/Factura */}
      <AnimatePresence>
        {showInvoiceModal && invoiceOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !invoiceLoading && setShowInvoiceModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex items-center gap-3">
                  <Receipt className="w-7 h-7" />
                  <div>
                    <h2 className="text-xl font-bold">Emitir Documento</h2>
                    <p className="text-blue-100 text-sm">
                      Pedido de {invoiceOrder.customerInfo?.nombre} - {formatCLP(invoiceOrder.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {/* Resultado exitoso */}
                  {invoiceResult && (
                    <div>
                      <div className={`border-2 rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                          {invoiceResult.tipoDocumento} Emitida
                        </h3>
                        {invoiceResult.folio && (
                          <p className={isDark ? 'text-green-200' : 'text-green-700'}>Folio: <strong>#{invoiceResult.folio}</strong></p>
                        )}
                        <p className={`text-sm mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>{invoiceResult.mensaje}</p>
                        {saveCustomer && datosFiscales.rut && (
                          <p className={`text-xs mt-2 flex items-center justify-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                            <UserPlus className="w-3 h-3" />
                            Cliente guardado para futuras emisiones
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowInvoiceModal(false)}
                        className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}

                  {/* Formulario antes de emitir */}
                  {!invoiceResult && (
                    <div className="space-y-4">
                      {/* Error */}
                      {invoiceError && (
                        <div className={`border-2 rounded-lg p-3 flex items-start gap-2 ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-800'}`}>{invoiceError}</p>
                        </div>
                      )}

                      {/* Selector Boleta / Factura */}
                      <div>
                        <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Tipo de documento</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setEmisionTipo('boleta')}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                              emisionTipo === 'boleta'
                                ? isDark ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/30' : 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                : isDark ? 'border-gray-700 bg-gray-800 hover:border-gray-600' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <Receipt className={`w-5 h-5 ${emisionTipo === 'boleta' ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                            <div className="text-left">
                              <p className={`font-bold text-sm ${emisionTipo === 'boleta' ? (isDark ? 'text-green-300' : 'text-green-700') : (isDark ? 'text-gray-300' : 'text-slate-700')}`}>Boleta</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>DTE 39</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmisionTipo('factura')}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                              emisionTipo === 'factura'
                                ? isDark ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30' : 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                : isDark ? 'border-gray-700 bg-gray-800 hover:border-gray-600' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <FileText className={`w-5 h-5 ${emisionTipo === 'factura' ? 'text-blue-500' : isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                            <div className="text-left">
                              <p className={`font-bold text-sm ${emisionTipo === 'factura' ? (isDark ? 'text-blue-300' : 'text-blue-700') : (isDark ? 'text-gray-300' : 'text-slate-700')}`}>Factura</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>DTE 33</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Datos fiscales para factura */}
                      {emisionTipo === 'factura' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={`space-y-3 p-4 border-2 rounded-xl ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}
                        >
                          <p className={`font-bold text-sm flex items-center gap-2 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                            <FileText className="w-4 h-4" />
                            Datos obligatorios para factura
                          </p>
                          <div>
                            <label className={fiscalLabelCls}>RUT <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={datosFiscales.rut}
                              onChange={(e) => setDatosFiscales({ ...datosFiscales, rut: e.target.value })}
                              placeholder="76.123.456-7"
                              className={fiscalInputCls}
                            />
                          </div>
                          <div>
                            <label className={fiscalLabelCls}>Razón Social <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={datosFiscales.razonSocial}
                              onChange={(e) => setDatosFiscales({ ...datosFiscales, razonSocial: e.target.value })}
                              placeholder="Empresa SpA"
                              className={fiscalInputCls}
                            />
                          </div>
                          <div>
                            <label className={fiscalLabelCls}>Giro <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={datosFiscales.giro}
                              onChange={(e) => setDatosFiscales({ ...datosFiscales, giro: e.target.value })}
                              placeholder="Venta al por mayor"
                              className={fiscalInputCls}
                            />
                          </div>
                          {/* Selector de dirección si el cliente tiene múltiples */}
                          {customerDirecciones.length > 1 && (
                            <div>
                              <label className={fiscalLabelCls}>
                                <MapPin className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
                                Dirección de entrega <span className="text-red-500">*</span>
                              </label>
                              <select
                                onChange={(e) => {
                                  const idx = parseInt(e.target.value);
                                  const d = customerDirecciones[idx];
                                  setDatosFiscales(prev => ({ ...prev, direccion: d.direccion, comuna: d.comuna }));
                                }}
                                className={fiscalInputCls}
                              >
                                {customerDirecciones.map((d, i) => (
                                  <option key={i} value={i}>
                                    {d.label ? `${d.label}: ` : ''}{d.direccion}{d.comuna ? `, ${d.comuna}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={fiscalLabelCls}>Dirección <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                value={datosFiscales.direccion}
                                onChange={(e) => setDatosFiscales({ ...datosFiscales, direccion: e.target.value })}
                                placeholder="Calle 123"
                                className={fiscalInputCls}
                              />
                            </div>
                            <div>
                              <label className={fiscalLabelCls}>Comuna <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                value={datosFiscales.comuna}
                                onChange={(e) => setDatosFiscales({ ...datosFiscales, comuna: e.target.value })}
                                placeholder="Santiago"
                                className={fiscalInputCls}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Detalle del pedido */}
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/60' : 'bg-slate-50'}`}>
                        <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Detalle:</p>
                        {invoiceOrder.items?.map((item, idx) => (
                          <div key={idx} className={`flex justify-between text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            <span>{item.quantity}x {item.productName}</span>
                            <span className="font-semibold">{formatCLP(item.totalPrice)}</span>
                          </div>
                        ))}
                        {emisionTipo === 'factura' && (
                          <div className={`mt-2 pt-2 border-t space-y-1 ${isDark ? 'border-gray-700' : 'border-slate-200'}`}>
                            <div className={`flex justify-between text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                              <span>Neto:</span>
                              <span>{formatCLP(Math.round(invoiceOrder.totalAmount / 1.19))}</span>
                            </div>
                            <div className={`flex justify-between text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                              <span>IVA (19%):</span>
                              <span>{formatCLP(Math.round(invoiceOrder.totalAmount - invoiceOrder.totalAmount / 1.19))}</span>
                            </div>
                          </div>
                        )}
                        <div className={`flex justify-between mt-2 pt-2 border-t font-bold ${isDark ? 'border-gray-700 text-white' : 'border-slate-300 text-slate-900'}`}>
                          <span>Total:</span>
                          <span className="text-green-500">{formatCLP(invoiceOrder.totalAmount)}</span>
                        </div>
                      </div>

                      {/* Guardar cliente */}
                      <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                        <input
                          type="checkbox"
                          checked={saveCustomer}
                          onChange={(e) => setSaveCustomer(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div>
                          <p className={`text-sm font-semibold flex items-center gap-1 ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                            <UserPlus className="w-4 h-4" />
                            Guardar cliente
                          </p>
                          <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                            Guarda los datos para autocompletar en futuras compras desde el catálogo
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {/* Footer con botones */}
                {!invoiceResult && (
                  <div className={`border-t p-4 flex gap-3 ${isDark ? 'border-gray-800 bg-gray-800/60' : 'border-slate-200 bg-slate-50'}`}>
                    <button
                      onClick={() => setShowInvoiceModal(false)}
                      disabled={invoiceLoading}
                      className={`flex-1 font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleEmitirDocumento}
                      disabled={invoiceLoading}
                      className={`flex-1 font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white ${
                        emisionTipo === 'factura'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {invoiceLoading ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Emitiendo...
                        </>
                      ) : (
                        <>
                          {emisionTipo === 'factura' ? <FileText className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                          Emitir {emisionTipo === 'factura' ? 'Factura' : 'Boleta'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
};

export default OrdersManagement;
