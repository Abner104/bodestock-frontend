// src/pages/InventoryExit.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Package,
  DollarSign,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  LogOut,
  Search,
  Zap,
  Camera,
  ChevronLeft,
  Minus,
  Plus,
  Trash2,
  ScanBarcode,
  ChevronUp,
  ChevronDown,
  MapPin,
  BarChart3,
  Video,
  VideoOff,
  Tag
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase.js';
import { registerInventoryExit, canWorkerMakeExit, getWorkerDailyUsage, annulInventoryExit } from '../services/inventory-exits-service.js';
import { getActiveCashRegister, PAYMENT_METHODS as PAYMENT_METHODS_BASE } from '../services/cash-register-service.js';
import { useRegionContext } from '../contexts/RegionContext.jsx';
import { useOfflineContext } from '../contexts/OfflineContext.jsx';
import { getWorkerByEmail } from '../services/workers-service.js';
import { getUserCompanyId, getCompanyInfo } from '../services/companyService.js';
import { useToast, ToastContainer } from '../components/ui/Toast.jsx';
import ImprovedBarcodeScanner from '../components/inventory/ImprovedBarcodeScanner.jsx';
import ExitReceiptModal from '../components/ExitReceiptModal.jsx';
import WorkerDrawerMenu from '../components/WorkerDrawerMenu.jsx';
import ProductPickerSheet from '../components/pos/ProductPickerSheet.jsx';
import { DEFAULT_ROLES } from '../config/database-schema.js';
import { emitirBoleta, emitirGuiaDespacho, getLibreDTEConfig } from '../services/libredte-service.js';
import VoiceSaleButton from '../components/inventory/VoiceSaleButton.jsx';
import { saveDocumentoToCustomer, getAllCustomers } from '../services/customers-service.js';
import { doc, updateDoc } from 'firebase/firestore';
import { Scale } from 'lucide-react';
import ComboSaleModal from '../components/pos/ComboSaleModal.jsx';
import VitrinaGrid from '../components/vitrina/VitrinaGrid.jsx';
import VitrinaSuggest from '../components/vitrina/VitrinaSuggest.jsx';
import { usePresence } from '../hooks/usePresence';

// Helper: determinar si una unidad es de peso/volumen (requiere cantidad decimal)
const WEIGHT_UNITS = ['kg', 'g', 'gr', 'mg', 'ml', 'l', 'lt', 'lb', 'oz', 'cc'];
const isWeightUnit = (unit) => {
  if (!unit) return false;
  return WEIGHT_UNITS.includes(unit.toLowerCase().trim());
};

const InventoryExit = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { paymentMethods: regionPaymentMethods, vocab, formatPrice, isVE } = useRegionContext();
  const { isOnline, enqueue } = useOfflineContext();
  // Usar métodos de pago de la región activa, con fallback al base
  // Si la región define sus propios métodos, usarlos exclusivamente; si no, usar los base (CL por defecto)
  const PAYMENT_METHODS = Object.keys(regionPaymentMethods).length > 0 ? regionPaymentMethods : PAYMENT_METHODS_BASE;
  const { isDark } = useTheme();

  // Estados principales
  const [currentUser, setCurrentUser] = useState(null);
  const [currentWorker, setCurrentWorker] = useState(null);
  const [dailyUsage, setDailyUsage] = useState({ usedAmountMoney: 0, usedAmountUnits: 0 });
  const [warehouseProducts, setWarehouseProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(() => {
    // Recuperar carrito del localStorage al iniciar
    const savedCart = localStorage.getItem('inventoryExitCart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [selectedReason, setSelectedReason] = useState('SALE');
  const [showReasonSelector, setShowReasonSelector] = useState(false);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCartFloating, setShowCartFloating] = useState(false);
  const [showScanner, setShowScanner] = useState(false); // camera scanner inline
  const [cartExpanded, setCartExpanded] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState(null); // { type: 'success'|'error', message }
  const [scannerMode, setScannerMode] = useState(false); // modo escáner continuo (móvil)
  const [lastScannedItem, setLastScannedItem] = useState(null); // último producto escaneado para feedback
  const [weightModal, setWeightModal] = useState({ open: false, product: null }); // modal para ingresar peso
  const [weightInput, setWeightInput] = useState('');
  const barcodeBufferRef = useRef('');
  const barcodeTimerRef = useRef(null);
  const scannerBeepRef = useRef(null);
  const selectedProductsRef = useRef([]);
  const topbarRef = useRef(null); // vitrina: mide la topbar sticky para pegar el buscador justo debajo
  const searchbarRef = useRef(null); // vitrina: mide el buscador sticky para el scroll-margin-top de las categorías
  const searchInputRef = useRef(null); // vitrina: input de búsqueda
  const [suggestOpen, setSuggestOpen] = useState(false); // dropdown de sugerencias (solo atajo de texto)
  // Formato de venta seleccionado por producto: { [productId]: presentationId | null }
  // null = unidad base
  const [selectedFormatByProduct, setSelectedFormatByProduct] = useState({});
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastExitData, setLastExitData] = useState(null);
  const [pendingExitData, setPendingExitData] = useState(null); // datos listos para registrar, esperando factura
  const [companyInfo, setCompanyInfo] = useState(null);
  const [dteHabilitado, setDteHabilitado] = useState(false); // facturación electrónica SII configurada (LibreDTE)
  const [emitiendoBoleta, setEmitiendoBoleta] = useState(false);
  const emitiendoRef = React.useRef(false); // lock para evitar doble emisión
  const [customerName, setCustomerName] = useState('');
  // Cliente seleccionado para asociar la venta a su historial
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]); // cargados al inicio
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null); // método de pago — null = no elegido
  const [fiadoNombre, setFiadoNombre] = useState(''); // nombre cliente para fiado
  const [cashReceived, setCashReceived] = useState(''); // monto recibido en efectivo
  const [splitPayment, setSplitPayment] = useState(false); // pago mixto
  const [splitCashAmount, setSplitCashAmount] = useState(''); // efectivo en pago mixto
  const [cashRegisterId, setCashRegisterId] = useState(null); // turno de caja activo
  const [pickerProduct, setPickerProduct] = useState(null); // producto seleccionado para el picker de tamaño/extras
  const [allInventoryProducts, setAllInventoryProducts] = useState([]); // todos los productos del inventario (para cálculo de stock de insumos)
  const [showComboModal, setShowComboModal] = useState(false);
  const [inventoryType, setInventoryType] = useState(null);
  const [descuentoModo, setDescuentoModo] = useState('porcentaje'); // 'porcentaje' | 'fijo'
  const [descuentoValor, setDescuentoValor] = useState('');

  // Presencia en línea — reporta actividad del vendedor
  usePresence(currentWorker?.name || null);

  // Datos de la bodega desde URL params
  const warehouseData = {
    id: searchParams.get('warehouseId'),
    name: searchParams.get('name'),
    location: searchParams.get('location')
  };

  // Datos del inventario desde URL params (si viene de un inventario específico)
  const inventoryData = {
    id: searchParams.get('inventoryId') || null,
    name: searchParams.get('inventoryName') || null
  };

  // Cliente preseleccionado desde URL params (viene de CustomersManagement)
  const preSelectedClienteRut = searchParams.get('clienteRut') || null;
  const preSelectedClienteNombre = searchParams.get('clienteNombre') || null;
  const preSelectedTipoVenta = searchParams.get('tipoVenta') || null; // 'contado' | 'credito'

  // Productos pre-seleccionados desde URL params
  const getPreSelectedProducts = () => {
    try {
      const preSelectedParam = searchParams.get('preSelected');
      if (preSelectedParam) {
        return JSON.parse(decodeURIComponent(preSelectedParam));
      }
      return [];
    } catch (error) {
      console.error('Error parsing preSelected products:', error);
      return [];
    }
  };

  // Motivos de salida
  const EXIT_REASONS = {
    SALE: { name: "Venta", color: "bg-green-100 text-green-800", icon: "💰" },
    WASTE: { name: "Merma", color: "bg-red-100 text-red-800", icon: "🗑️" },
    TRANSFER: { name: "Transferencia", color: "bg-blue-100 text-blue-800", icon: "📦" },
    PRODUCTION: { name: "Producción", color: "bg-orange-100 text-orange-800", icon: "🏭" },
    CONSUMPTION: { name: "Consumo", color: "bg-purple-100 text-purple-800", icon: "🔧" },
    CREDIT: { name: vocab?.credit ? vocab.credit.charAt(0).toUpperCase() + vocab.credit.slice(1) : "Fiado", color: "bg-yellow-100 text-yellow-800", icon: "🤝" },
    OTHER: { name: "Otro", color: "bg-gray-100 text-gray-800", icon: "❓" }
  };

  // ===== EFECTOS =====
  // Cargar información de la empresa
  useEffect(() => {
    const loadCompanyInfo = async () => {
      try {
        const info = await getCompanyInfo();
        if (info) {
          setCompanyInfo(info);
          console.log('🏢 Información de empresa cargada:', info.name);
        }
      } catch (error) {
        console.error('Error cargando info de empresa:', error);
      }
    };

    // ¿El cliente tiene facturación electrónica (SII / LibreDTE) configurada?
    // Mismo criterio que emitirBoleta(): config con credenciales + rutEmisor.
    const checkDTE = async () => {
      try {
        const cfg = await getLibreDTEConfig();
        const proveedor = cfg?.proveedor || 'simplefactura';
        const tieneCredenciales = proveedor === 'simplefactura'
          ? !!(cfg?.sfEmail && cfg?.sfPassword)
          : !!cfg?.apiKey;
        setDteHabilitado(!!cfg && tieneCredenciales && !!cfg.rutEmisor);
      } catch {
        setDteHabilitado(false);
      }
    };

    loadCompanyInfo();
    if (!isVE) checkDTE();

    // Cargar clientes para el selector de venta
    getAllCustomers().then(list => {
      setAllCustomers(list.sort((a, b) => (a.razonSocial || '').localeCompare(b.razonSocial || '')));
    }).catch(() => {});
  }, []);

  // Guardar carrito en localStorage cuando cambie y mantener ref actualizada
  useEffect(() => {
    selectedProductsRef.current = selectedProducts;
    if (selectedProducts.length > 0) {
      localStorage.setItem('inventoryExitCart', JSON.stringify(selectedProducts));
    } else {
      localStorage.removeItem('inventoryExitCart');
    }
  }, [selectedProducts]);

  // Mide la altura real de la topbar sticky (cambia según breakpoint/contenido) para que el
  // buscador quede pegado justo debajo de ella y no se lo tape. También mide el buscador
  // sticky para sumar ambas alturas en --vt-sticky-h: eso alimenta el scroll-margin-top de
  // las secciones de categoría en vitrina.css, para que scrollIntoView (nativo del navegador)
  // nunca deje una categoría tapada detrás de las 2 barras fijas.
  useEffect(() => {
    const topEl = topbarRef.current;
    const searchEl = searchbarRef.current;
    if (!topEl || typeof ResizeObserver === 'undefined') return undefined;
    const setVars = () => {
      const topH = topEl.offsetHeight;
      const searchH = searchEl?.offsetHeight || 0;
      document.documentElement.style.setProperty('--vt-topbar-h', `${topH}px`);
      document.documentElement.style.setProperty('--vt-sticky-h', `${topH + searchH}px`);
    };
    setVars();
    const ro = new ResizeObserver(setVars);
    ro.observe(topEl);
    if (searchEl) ro.observe(searchEl);
    return () => ro.disconnect();
  }, []);

  // Cargar productos cuando el componente se monta
  useEffect(() => {
    if (!warehouseData.id || !warehouseData.name) {
      console.log('❌ InventoryExit - Parámetros de bodega inválidos');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      try {
        console.log('🏭 InventoryExit - Iniciando carga para:', warehouseData.name);

        // Firebase Auth ya está inicializado por ProtectedRoute — sin delay

        if (!isMounted) return;

        // Los productos no dependen del worker/permisos para cargarse (solo de
        // warehouseData/inventoryData/companyId) — se disparan ya mismo en paralelo
        // con la cadena de permisos, en vez de esperar a que esta termine primero.
        console.log('📦 Cargando productos (en paralelo)...');
        const productsPromise = loadWarehouseProducts(false);

        const user = auth.currentUser;
        console.log('👤 Usuario actual:', user?.email || 'No autenticado');

        if (!user) {
          console.log('⚠️ No hay usuario - ProtectedRoute debería manejar esto');
          if (isMounted) setLoading(false);
          return;
        }

        // SUPER_ADMIN y ADMIN pueden registrar salidas
        const SUPER_ADMIN_EMAIL = 'abnerdariomedina@gmail.com';
        const worker = await getWorkerByEmail(user.email);
        console.log('👷 Trabajador:', worker?.name || 'No encontrado');

        if (!isMounted) return;

        if (!worker) {
          // Si no es worker, verificar si es SUPER_ADMIN o ADMIN
          if (user.email === SUPER_ADMIN_EMAIL) {
            console.log('👑 SUPER_ADMIN registrando salida');
            setCurrentUser(user);
            const superAdminWorker = {
              name: 'Super Admin',
              role: 'SUPER_ADMIN',
              email: user.email,
              permissions: DEFAULT_ROLES['ADMIN']?.permissions || [] // SUPER_ADMIN tiene todos los permisos de ADMIN
            };
            setCurrentWorker(superAdminWorker);
            setDailyUsage({ usedAmountMoney: 0, usedAmountUnits: 0 });
          } else {
            // Usuario ADMIN sin restricciones
            console.log('✅ Usuario ADMIN registrando salida');
            setCurrentUser(user);
            const adminWorker = {
              id: user.uid,
              name: user.displayName || 'Administrador',
              role: 'ADMIN',
              email: user.email,
              permissions: DEFAULT_ROLES['ADMIN']?.permissions || []
            };
            setCurrentWorker(adminWorker);
            setDailyUsage({ usedAmountMoney: 0, usedAmountUnits: 0 });
          }
        } else {
          // Es un worker registrado - expandir con permissions desde DEFAULT_ROLES
          setCurrentUser(user);
          const workerWithPermissions = {
            ...worker,
            permissions: DEFAULT_ROLES[worker.role]?.permissions || []
          };
          console.log('👷 Worker con permisos expandidos:', workerWithPermissions);
          setCurrentWorker(workerWithPermissions);

          // Cargar uso diario del trabajador (solo para WORKER con límites)
          if (worker.id && worker.role === 'WORKER') {
            console.log('📊 Cargando uso diario del trabajador...');
            const usage = await getWorkerDailyUsage(worker.id);
            setDailyUsage(usage);
            console.log('✅ Uso diario cargado:', usage);
          } else {
            // ADMIN y SUPERVISOR sin límites
            setDailyUsage({ usedAmountMoney: 0, usedAmountUnits: 0 });
          }
        }

        // Esperar la carga de productos que ya se disparó en paralelo al inicio del efecto
        await productsPromise;

        // Si viene con tipoVenta=credito desde Clientes, pre-seleccionar Fiado y poner nombre
        if (preSelectedTipoVenta === 'credito') {
          setSelectedReason('CREDIT');
          if (preSelectedClienteNombre) setCustomerName(preSelectedClienteNombre);
        } else if (worker?.role === 'CAJERA' || worker?.role === 'VENDEDORA') {
          // Auto-seleccionar motivo "VENTA" para CAJERA y VENDEDORA
          setSelectedReason('SALE');
        }

        // Cargar turno de caja activo si es CAJERA o ADMIN
        if (['CAJERA', 'ADMIN'].includes(worker?.role) && worker?.id) {
          try {
            const activeRegister = await getActiveCashRegister(worker.id);
            if (activeRegister) {
              setCashRegisterId(activeRegister.id);
              console.log('💵 Turno de caja activo:', activeRegister.id);
            }
          } catch (err) {
            console.warn('⚠️ No se pudo cargar turno de caja:', err.message);
          }
        }

        if (isMounted) {
          toast.addToast(`✅ Bienvenido a ${warehouseData.name}`, 'success');
          setLoading(false);
        }

      } catch (error) {
        console.error('❌ Error cargando datos:', error);
        if (isMounted) {
          toast.addToast('Error al cargar la bodega', 'error');
          setLoading(false);
        }
      }
    };

    setLoading(true);
    loadData();

    return () => {
      isMounted = false;
    };
  }, [warehouseData.id, warehouseData.name]);

  // Keyboard shortcuts para experiencia rápida
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Solo procesar si no estamos escribiendo en un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Ctrl/Cmd + K para enfocar buscador
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Buscar"]');
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Escape para limpiar búsqueda
      if (e.key === 'Escape' && searchTerm) {
        setSearchTerm('');
      }

      // Enter para registrar salida si hay productos seleccionados
      if (e.key === 'Enter' && selectedProducts.length > 0 && !submitting) {
        e.preventDefault();
        // Trigger el submit
        const submitButton = document.querySelector('button[title*="Registrar"]');
        if (submitButton && !submitButton.disabled) {
          submitButton.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [searchTerm, selectedProducts.length, submitting]);

  // ===== FUNCIONES DE AUTENTICACIÓN =====
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // ===== FUNCIONES DE DATOS =====
  const canAccessWarehouse = (worker, warehouseId) => {
    if (worker.role === 'ADMIN' || worker.role === 'SUPERVISOR') return true;
    return worker.assignedWarehouses && worker.assignedWarehouses.includes(warehouseId);
  };

  const loadWarehouseProducts = async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setLoading(true);
      }

      // Si no hay internet, servir desde caché
      if (!navigator.onLine) {
        try {
          const cacheKey = `bodestock_products_${warehouseData.id || inventoryData.id}`;
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (cached?.products?.length > 0) {
            setWarehouseProducts(cached.products);
            setAllInventoryProducts(cached.products);
            if (!skipLoadingState) setLoading(false);
            return;
          }
        } catch {}
        if (!skipLoadingState) setLoading(false);
        return;
      }

      // Obtener companyId para acceder a la colección correcta
      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('❌ No se pudo obtener el companyId');
        toast.addToast('Error: No se pudo identificar la empresa', 'error');
        return;
      }
      setCompanyId(companyId);

      // Cargar tipo de inventario (ej: 'fashion')
      try {
        let invType = null;
        if (inventoryData.id) {
          // Si viene inventoryId en la URL, leer directo
          const invDoc = await getDoc(doc(db, `companies/${companyId}/inventories/${inventoryData.id}`));
          if (invDoc.exists()) invType = invDoc.data().type || null;
          // Si el doc raíz no tiene type, buscar en metadata
          if (!invType) {
            const { getDocs: _getDocs, collection: _col } = await import('firebase/firestore');
            const metaSnap = await _getDocs(_col(db, `companies/${companyId}/inventories/${inventoryData.id}/metadata`));
            if (!metaSnap.empty) invType = metaSnap.docs[0].data().type || null;
          }
        } else if (warehouseData.id) {
          // Sin inventoryId: buscar la bodega en todos los inventarios para encontrar el type
          const { getDocs: _getDocs, collection: _col } = await import('firebase/firestore');
          const invsSnap = await _getDocs(_col(db, `companies/${companyId}/inventories`));
          for (const invDoc of invsSnap.docs) {
            const wSnap = await _getDocs(_col(db, `companies/${companyId}/inventories/${invDoc.id}/warehouses`));
            const found = wSnap.docs.find(w => w.id === warehouseData.id);
            if (found) {
              invType = invDoc.data().type || null;
              // Si no está en doc raíz, buscar en metadata
              if (!invType) {
                const metaSnap = await _getDocs(_col(db, `companies/${companyId}/inventories/${invDoc.id}/metadata`));
                if (!metaSnap.empty) invType = metaSnap.docs[0].data().type || null;
              }
              break;
            }
          }
        }
        if (invType) setInventoryType(invType);
      } catch {}


      // Intentar cargar productos de ambas rutas:
      // 1. Legacy: companies/{companyId}/inventory (filtrado por warehouseId)
      // 2. New: companies/{companyId}/inventories/{inventoryId}/products (filtrado por warehouseId)
      const products = [];

      // Helper para mapear documento de producto
      const mapProduct = (docSnap, invId = null) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Sin nombre',
          code: data.sku || `INV${docSnap.id.substring(0, 6)}`,
          category: data.category || 'Producto',
          stock: data.stock || 0,
          unit: data.unit || 'unidad',
          ppp: data.ppp || 0,
          salePrice: data.salePrice || 0,
          precioVenta: data.precioVenta || 0,
          customFields: data.customFields || {},
          presentations: data.presentations || [],
          extras: data.extras || [],
          productType: data.productType || 'SIMPLE',
          receta: data.receta || [],
          photoURL: data.photoURL || null,
          inventoryId: invId,
          promociones: data.promociones || [],
          aliases: data.aliases || [],
        };
      };

      // Si hay inventoryId, buscar en la ruta nueva primero.
      // Las 3 consultas (bodega, elaborados, inventario completo) son independientes entre sí
      // en Firestore — se lanzan en paralelo con Promise.all en vez de encadenarlas con await
      // secuencial, que era lo que hacía tan lenta la carga inicial de Salidas.
      if (inventoryData.id) {
        console.log('📦 Buscando productos en inventario:', inventoryData.id, 'bodega:', warehouseData.id);

        const productsCol = collection(db, `companies/${companyId}/inventories/${inventoryData.id}/products`);
        const newQ = query(productsCol, where("warehouseId", "==", warehouseData.id));
        const elaboradosQ = query(productsCol, where("productType", "==", "ELABORADO"));

        const [newSnapshot, elaboradosSnapshot, allSnapshot] = await Promise.all([
          getDocs(newQ),
          getDocs(elaboradosQ),
          getDocs(productsCol),
        ]);

        // Productos simples (con bodega)
        newSnapshot.forEach((doc) => products.push(mapProduct(doc, inventoryData.id)));

        // Productos elaborados (sin bodega, tipo ELABORADO) — evitar duplicados
        const elaboradosIds = new Set(products.map(p => p.id));
        elaboradosSnapshot.forEach((doc) => {
          if (!elaboradosIds.has(doc.id)) {
            products.push(mapProduct(doc, inventoryData.id));
          }
        });

        console.log(`📦 Encontrados ${products.length} productos en inventario nuevo (incluyendo elaborados)`);

        // Todos los productos del inventario, para calcular stock de insumos en cards de elaborados
        const allProds = [];
        allSnapshot.forEach((doc) => allProds.push(mapProduct(doc, inventoryData.id)));
        setAllInventoryProducts(allProds);
      }

      // Si no se encontraron productos en la ruta nueva, buscar en legacy
      if (products.length === 0) {
        console.log('📦 Buscando productos en colección legacy...');
        const legacyQ = query(
          collection(db, `companies/${companyId}/inventory`),
          where("warehouseId", "==", warehouseData.id)
        );
        const legacySnapshot = await getDocs(legacyQ);
        legacySnapshot.forEach((doc) => products.push(mapProduct(doc, null)));
        console.log(`📦 Encontrados ${products.length} productos en legacy`);
        // Solo pisar allInventoryProducts si no vino ya seteado desde el bloque de inventario nuevo
        if (!inventoryData.id) setAllInventoryProducts(products);
      }

      setWarehouseProducts(products);
      // Guardar en caché para modo offline
      try {
        const cacheKey = `bodestock_products_${warehouseData.id || inventoryData.id}`;
        localStorage.setItem(cacheKey, JSON.stringify({ products, ts: Date.now() }));
      } catch {}

      // Limpiar carrito de productos que ya no existen en el inventario
      const productIds = new Set(products.map(p => p.id));
      setSelectedProducts(prev => {
        const filtered = prev.filter(p => productIds.has(p.id));
        if (filtered.length < prev.length) {
          console.log(`🧹 Carrito limpiado: ${prev.length - filtered.length} productos eliminados que ya no existen`);
          if (filtered.length === 0) {
            localStorage.removeItem('inventoryExitCart');
          }
        }
        return filtered;
      });

      // Aplicar productos pre-seleccionados si existen
      const preSelectedProducts = getPreSelectedProducts();
      if (preSelectedProducts.length > 0) {
        console.log('🎯 Aplicando productos pre-seleccionados:', preSelectedProducts.length);

        const preSelectedWithData = [];

        preSelectedProducts.forEach(preSelected => {
          const product = warehouseProducts.find(p => p.id === preSelected.id);
          if (product && preSelected.quantity > 0 && preSelected.quantity <= product.stock) {
            preSelectedWithData.push({
              ...product,
              quantity: preSelected.quantity,
              totalValue: preSelected.quantity * (product.salePrice > 0 ? product.salePrice : (product.ppp || 0))
            });
          }
        });

        setSelectedProducts(preSelectedWithData);

        if (preSelectedWithData.length > 0) {
          toast.addToast(`✅ ${preSelectedWithData.length} productos pre-seleccionados aplicados`, 'success');
          // Pre-seleccionar motivo según el rol del trabajador
          if (currentWorker?.role === 'WORKER') {
            setSelectedReason('PRODUCTION');
          } else {
            setSelectedReason('CONSUMPTION');
          }
        }
      }

    } catch (error) {
      console.error('Error cargando productos:', error);
      toast.addToast('Error al cargar productos de la bodega', 'error');
    } finally {
      if (!skipLoadingState) {
        setLoading(false);
      }
    }
  };

  // ===== FUNCIONES DE MANEJO DE PRODUCTOS =====
  const updateProductQuantity = (productId, quantity) => {
    let qty = parseFloat(quantity) || 0;
    const product = warehouseProducts.find(p => p.id === productId);

    if (!product) return;

    // CONVERSIÓN: Usar el formato seleccionado desde el estado selectedFormatByProduct
    const activePresentationId = selectedFormatByProduct[productId] ?? null;
    let quantityInBaseUnit = qty;
    let activePresentationName = null;
    let activePresentationSalePrice = null;

    if (activePresentationId && product.presentations && product.presentations.length > 0) {
      const presentation = product.presentations.find(p => p.id === activePresentationId);
      if (presentation) {
        quantityInBaseUnit = qty * parseFloat(presentation.factor);
        activePresentationName = presentation.name;
        activePresentationSalePrice = presentation.salePrice ?? null;
      }
    }

    // Remover producto si cantidad es 0
    if (qty <= 0) {
      setSelectedProducts(prev => prev.filter(p => p.id !== productId));
      return;
    }

    // Validar que no exceda el stock (validar en unidad base)
    // Los elaborados del mostrador no tienen stock físico — se producen al momento
    const isElaborado = product.productType === 'ELABORADO' || (Array.isArray(product.receta) && product.receta.length > 0);
    const stockDisponible = parseFloat(product.stock) || 0;
    if (!isElaborado && quantityInBaseUnit > stockDisponible) {
      toast.addToast(`Stock insuficiente. Disponible: ${stockDisponible} ${product.unit}`, 'warning');
      return;
    }

    // 🚫 BLOQUEO CON USO DIARIO REAL: Verificar límite de productos para trabajadores
    if (currentWorker?.limitType === 'UNITS' && currentWorker?.role === 'WORKER') {
      // Uso diario YA registrado en Firebase
      const usedToday = dailyUsage.usedAmountUnits || 0;

      // Unidades en el carrito actual (excluyendo el producto que estamos editando)
      // IMPORTANTE: Usar quantityInBaseUnit para validar límites
      const currentCartUnits = selectedProducts.reduce((sum, p) => p.id !== productId ? sum + (p.quantityInBaseUnit || p.quantity) : sum, 0);

      // Total que tendría si se aprueba este cambio
      const totalUnitsWithThisChange = usedToday + currentCartUnits + quantityInBaseUnit;

      const limit = (currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0;
      const available = Math.max(0, limit - usedToday);

      console.log('🔍 Verificación de límite:', {
        usedToday,
        currentCartUnits,
        qty,
        quantityInBaseUnit,
        totalUnitsWithThisChange,
        limit,
        available,
        excedeLimite: totalUnitsWithThisChange > limit
      });

      if (totalUnitsWithThisChange > limit) {
        toast.addToast(`🚫 Límite diario excedido`, 'error');
        toast.addToast(`⚖️ Límite: ${limit} - Ya usaste hoy: ${usedToday.toFixed(2)} - Disponible: ${available.toFixed(2)}`, 'warning');
        return;
      }
    }

    // Calcular totalValue: si el formato tiene salePrice propio, usarlo;
    // si es elaborado usar precioVenta; si tiene salePrice usar ese; si no, usar ppp (costo)
    const precioUnitario = product.productType === 'ELABORADO' && product.precioVenta
      ? product.precioVenta
      : (product.salePrice > 0 ? product.salePrice : product.ppp);

    // Aplicar promoción por volumen si corresponde
    const aplicarPromoVolumen = (precio, cantidad, promociones = []) => {
      if (!promociones.length) return precio;
      const promoAplicable = [...promociones]
        .filter(p => p.desde > 0 && p.precioUnitario > 0 && cantidad >= p.desde)
        .sort((a, b) => b.desde - a.desde)[0];
      return promoAplicable ? promoAplicable.precioUnitario : precio;
    };

    const precioConPromo = activePresentationSalePrice
      ? activePresentationSalePrice
      : aplicarPromoVolumen(precioUnitario, quantityInBaseUnit, product.promociones);

    const itemTotalValue = activePresentationSalePrice
      ? qty * activePresentationSalePrice
      : quantityInBaseUnit * precioConPromo;

    // Actualizar o agregar producto
    setSelectedProducts(prev => {
      const existingIndex = prev.findIndex(p => p.id === productId);

      const cartItem = {
        ...product,
        quantity: qty,
        quantityInBaseUnit,
        selectedPresentationId: activePresentationId,
        selectedPresentationName: activePresentationName,
        totalValue: itemTotalValue,
        precioUnitarioAplicado: precioConPromo,
        tienePromoActiva: precioConPromo < precioUnitario,
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = cartItem;
        return updated;
      } else {
        const newSelection = [
          ...prev,
          cartItem
        ];

        // Auto-seleccionar motivo para trabajadores cuando agreguen su primer producto
        if (currentWorker?.role === 'WORKER' && prev.length === 0 && !selectedReason) {
          setSelectedReason('PRODUCTION');
        }

        return newSelection;
      }
    });
  };

  // Actualizar cantidad de un item con cartKey (extras/presentaciones)
  const updateCartKeyQuantity = (cartKey, newQty) => {
    if (newQty <= 0) {
      setSelectedProducts(prev => prev.filter(p => (p.cartKey || p.id) !== cartKey));
      return;
    }
    setSelectedProducts(prev => prev.map(p => {
      if ((p.cartKey || p.id) !== cartKey) return p;
      const unitTotal = p.totalValue / p.quantity;
      const extrasPerUnit = p.extrasTotal / p.quantity;
      return {
        ...p,
        quantity: newQty,
        quantityInBaseUnit: newQty * (p.selectedPresentationFactor || 1),
        extrasTotal: extrasPerUnit * newQty,
        totalValue: unitTotal * newQty,
      };
    }));
  };

  // Función para remover producto del carrito (por cartKey si existe, sino por id)
  const removeProductFromCart = (productId, cartKey) => {
    setSelectedProducts(prev => {
      if (cartKey) return prev.filter(p => (p.cartKey || p.id) !== cartKey);
      return prev.filter(p => p.id !== productId);
    });
  };

  // ===== COMBO SALE =====
  const handleAddCombo = (items, totalCombo) => {
    items.forEach(item => {
      const productData = warehouseProducts.find(p => p.id === item.id);
      if (!productData) return;
      setSelectedProducts(prev => {
        const existing = prev.findIndex(p => p.id === item.id);
        const cartItem = {
          ...productData,
          ...item,
          totalValue: item.totalValue,
        };
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            quantity: updated[existing].quantity + item.quantity,
            quantityInBaseUnit: updated[existing].quantity + item.quantity,
            totalValue: updated[existing].totalValue + item.totalValue,
          };
          return updated;
        }
        return [...prev, cartItem];
      });
    });
    toast.addToast(`🏷️ Combo agregado al carrito`, 'success');
  };

  // ===== VENTA POR VOZ =====
  const handleVoiceProducts = useCallback((voiceItems) => {
    voiceItems.forEach(item => {
      const producto = warehouseProducts.find(p => p.id === item.id);
      if (!producto) return;
      updateProductQuantity(item.id, item.cantidadVoz || 1);
    });
    toast.addToast(`🎤 ${voiceItems.length} producto${voiceItems.length > 1 ? 's' : ''} agregado${voiceItems.length > 1 ? 's' : ''} al carrito`, 'success');
  }, [warehouseProducts]);

  // ===== BARCODE GUN LISTENER =====
  // Las pistolas láser envían caracteres rápido como teclado y terminan con Enter
  const handleBarcodeFromGun = useCallback((barcode) => {
    const trimmed = barcode.trim();
    if (!trimmed || trimmed.length < 3) return;

    console.log('🔫 Código de pistola láser:', trimmed);

    const product = warehouseProducts.find(p =>
      p.code === trimmed ||
      p.sku === trimmed ||
      p.barcode === trimmed ||
      p.ean === trimmed
    );

    if (product) {
      // Si es producto por peso, abrir modal
      if (isWeightUnit(product.unit)) {
        if (navigator.vibrate) navigator.vibrate(200);
        setWeightInput('');
        setWeightModal({ open: true, product });
        return;
      }

      // Producto encontrado - agregar al carrito (usar ref para evitar stale closure)
      const existing = selectedProductsRef.current.find(p => p.id === product.id);
      const newQty = existing ? Math.min(product.stock, existing.quantity + 1) : 1;
      updateProductQuantity(product.id, newQty);

      if (navigator.vibrate) navigator.vibrate(200);
      setScannerFeedback({ type: 'success', message: `${product.name} (${newQty})` });
      setTimeout(() => setScannerFeedback(null), 2000);
    } else {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setScannerFeedback({ type: 'error', message: `Código "${trimmed}" no encontrado` });
      setTimeout(() => setScannerFeedback(null), 3000);
    }
  }, [warehouseProducts, updateProductQuantity]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si estamos enfocados en un input de texto
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
      const isSearchInput = isInput && e.target.placeholder?.includes('Buscar');

      // Si es Enter y tenemos buffer, procesar el barcode
      if (e.key === 'Enter' && barcodeBufferRef.current.length >= 3) {
        e.preventDefault();
        handleBarcodeFromGun(barcodeBufferRef.current);
        barcodeBufferRef.current = '';
        clearTimeout(barcodeTimerRef.current);
        return;
      }

      // Si es un caracter imprimible y NO estamos en el search input
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !isSearchInput) {
        barcodeBufferRef.current += e.key;

        // Reset timer - la pistola envía todos los chars en <100ms
        clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = '';
        }, 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(barcodeTimerRef.current);
    };
  }, [handleBarcodeFromGun]);

  // Reproducir sonido de beep del escáner
  const playScannerBeep = () => {
    try {
      if (!scannerBeepRef.current) {
        scannerBeepRef.current = new Audio('/scanner-beep.mp3');
        scannerBeepRef.current.volume = 0.7;
      }
      scannerBeepRef.current.currentTime = 0;
      scannerBeepRef.current.play().catch(() => {});
    } catch (e) {
      // Silenciar error si no puede reproducir
    }
  };

  // Función para manejar escaneo de código de barras exitoso (cámara)
  const handleScanSuccess = useCallback((product) => {
    console.log('📷 Producto escaneado:', product.name);

    // Sonido de beep
    playScannerBeep();

    // Si es producto por peso, abrir modal para ingresar cantidad
    if (isWeightUnit(product.unit)) {
      setWeightInput('');
      setWeightModal({ open: true, product });
      return;
    }

    // Leer estado actual del carrito via ref para evitar stale closure
    const existingProduct = selectedProductsRef.current.find(p => p.id === product.id);
    const newQuantity = existingProduct
      ? Math.min(product.stock, existingProduct.quantity + 1)
      : 1;

    updateProductQuantity(product.id, newQuantity);

    if (!scannerMode) {
      if (existingProduct) {
        toast.addToast(`${product.name}: ${newQuantity} ${product.unit}`, 'success');
      } else {
        toast.addToast(`✅ ${product.name} agregado`, 'success');
      }
    }
    setLastScannedItem({ name: product.name, qty: newQuantity, unit: product.unit, isNew: !existingProduct });
    setTimeout(() => setLastScannedItem(null), 2000);
  }, [updateProductQuantity, scannerMode]);

  // Confirmar peso ingresado en el modal
  const handleWeightConfirm = () => {
    const rawValue = parseFloat(weightInput);
    if (!rawValue || rawValue <= 0) {
      toast.addToast('Ingresa un peso válido', 'warning');
      return;
    }
    const product = weightModal.product;
    const isKg = product.unit?.toLowerCase().trim() === 'kg';
    // Si la unidad es kg, el usuario ingresó en gramos → convertir
    const weight = isKg ? rawValue / 1000 : rawValue;
    const isElabWM = product.productType === 'ELABORADO' || (Array.isArray(product.receta) && product.receta.length > 0);
    const stockDisponible = parseFloat(product.stock) || 0;
    if (!isElabWM && weight > stockDisponible) {
      toast.addToast(`Stock insuficiente. Disponible: ${stockDisponible} ${product.unit}`, 'warning');
      return;
    }

    const existingProduct = selectedProducts.find(p => p.id === product.id);
    const newQty = existingProduct ? existingProduct.quantity + weight : weight;

    if (!isElabWM && newQty > stockDisponible) {
      toast.addToast(`Stock insuficiente. Disponible: ${stockDisponible} ${product.unit}`, 'warning');
      return;
    }

    updateProductQuantity(product.id, newQty);
    setLastScannedItem({ name: product.name, qty: newQty, unit: product.unit, isNew: !existingProduct });
    setTimeout(() => setLastScannedItem(null), 2000);

    setWeightModal({ open: false, product: null });
    setWeightInput('');
  };

  // Abrir/cerrar modo escáner continuo (móvil)
  const toggleScannerMode = () => {
    if (scannerMode) {
      setScannerMode(false);
      setShowScanner(false);
    } else {
      setScannerMode(true);
      setShowScanner(true);
    }
  };

  // ===== FUNCIÓN DE DEBUG TEMPORAL =====
  const debugWorkerLimits = async () => {
    console.log('🧪 DEBUG: Verificando trabajador directamente');
    console.log('🧪 currentWorker completo:', currentWorker);
    console.log('🧪 selectedProducts array completo:', selectedProducts);
    console.log('🧪 selectedProducts.length:', selectedProducts.length);

    if (!currentWorker?.id) {
      console.log('❌ No hay currentWorker.id');
      return;
    }

    // Usar datos REALES de los productos seleccionados
    const realTotalValue = selectedProducts.reduce((sum, p) => sum + p.totalValue, 0);
    const realTotalProducts = selectedProducts.length;

    const testExitData = {
      totalValue: realTotalValue,
      totalProducts: realTotalProducts,
      warehouseId: warehouseData.id,
      warehouseName: warehouseData.name,
      products: selectedProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        quantity: p.quantity,
        unit: p.unit,
        unitValue: p.ppp,
        totalValue: p.totalValue
      })),
      reason: 'TEST',
      reasonName: 'Prueba de límites',
      notes: ''
    };

    console.log('🧪 Productos seleccionados en UI:', selectedProducts.length);
    console.log('🧪 Lista de productos:', selectedProducts.map(p => p.name));

    console.log('🧪 Datos de prueba:', testExitData);

    try {
      const result = await canWorkerMakeExit(currentWorker.id, testExitData, false);
      console.log('🧪 Resultado de prueba:', result);
    } catch (error) {
      console.error('🧪 Error en prueba:', error);
    }
  };

  // ===== FUNCIONES DE ENVÍO =====
  // Buscar clientes por nombre o RUT (usa lista ya cargada)
  const searchCustomers = (term) => {
    setCustomerSearch(term);
    if (!term.trim()) {
      // Sin texto: mostrar los primeros 8
      setCustomerResults(allCustomers.slice(0, 8));
      return;
    }
    const filtered = allCustomers.filter(c =>
      c.razonSocial?.toLowerCase().includes(term.toLowerCase()) ||
      c.rut?.includes(term)
    ).slice(0, 8);
    setCustomerResults(filtered);
  };

  const handleSubmitExit = async () => {
    if (selectedProducts.length === 0) {
      toast.addToast('Selecciona al menos un producto antes de continuar', 'error');
      return;
    }

    // Validar que se haya seleccionado un motivo
    if (!selectedReason) {
      toast.addToast('⚠️ Selecciona un motivo de salida antes de continuar', 'error');
      setCartExpanded(true); // Expandir carrito para mostrar selector
      return;
    }

    const finalReason = selectedReason;

    // Validar método de pago para ventas
    if ((finalReason === 'SALE' || finalReason === 'CREDIT') && !paymentMethod) {
      toast.addToast('⚠️ Selecciona un método de pago antes de continuar', 'error');
      setCartExpanded(true);
      return;
    }

    // Validar nombre del cliente para fiado
    if (finalReason === 'CREDIT' && !customerName.trim()) {
      toast.addToast(`⚠️ Ingresa el nombre del cliente para ventas al ${vocab?.credit || 'fiado'}`, 'error');
      setCartExpanded(true);
      return;
    }

    // Pedido para entregar después: NO descuenta stock, solo guarda el pedido pendiente
    if (preSelectedTipoVenta === 'pedido') {
      setSubmitting(true);
      try {
        const { createOrder } = await import('../services/orders-service');
        await createOrder({
          customerInfo: {
            nombre: preSelectedClienteNombre || '',
            telefono: '',
            rut: preSelectedClienteRut || '',
            direccion: searchParams.get('clienteDireccion') || '',
            comuna: searchParams.get('clienteComuna') || '',
          },
          items: selectedProducts.map(p => ({
            productId: p.id,
            productName: p.name,
            quantity: p.quantity,
            unit: p.unit,
            unitPrice: p.salePrice > 0 ? p.salePrice : (p.ppp || 0),
            totalPrice: p.totalValue,
          })),
          totalAmount: selectedProducts.reduce((s, p) => s + p.totalValue, 0),
          notes: '',
          source: 'VENDOR_ASSISTED',
        });
        toast.addToast('📦 Pedido creado — queda pendiente de entrega', 'success');
        navigate('/clientes');
      } catch (e) {
        console.error('Error creando pedido:', e);
        toast.addToast('Error al crear el pedido', 'error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    console.log('🚀 handleSubmitExit - INICIANDO proceso de salida');

    try {
      const totalValueBruto = selectedProducts.reduce((sum, p) => sum + p.totalValue, 0);
      const totalValue = totalConDescuento; // aplica descuento fashion si corresponde
      const totalProducts = selectedProducts.length;
      const totalUnits = totalQuantity;

      // Debug: Mostrar información del trabajador
      console.log('🔍 Datos del trabajador desde UI:', {
        id: currentWorker.id,
        name: currentWorker.name,
        email: currentWorker.email,
        role: currentWorker.role,
        limitType: currentWorker.limitType,
        dailyLimitMoney: currentWorker.dailyLimitMoney,
        dailyLimitProducts: (currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts),
        isActive: currentWorker.isActive
      });

      console.log('🔍 Datos de la salida:', {
        totalValue,
        totalProducts,
        totalUnits,
        warehouse: warehouseData.name
      });

      // Verificar límites del trabajador (solo para WORKER, ADMIN y SUPERVISOR sin límites)
      console.log('🔍 Verificando límites para rol:', currentWorker.role);

      if (currentWorker.role === 'WORKER') {
        console.log('🔍 Llamando canWorkerMakeExit con workerId:', currentWorker.id);

        if (!currentWorker.id) {
          console.log('❌ ERROR: currentWorker.id es undefined/null');
          toast.addToast('Error: ID de trabajador no válido', 'error');
          setSubmitting(false);
          return;
        }

        const canExit = await canWorkerMakeExit(currentWorker.id, {
          totalValue,
          totalProducts,
          totalUnits,
          warehouseId: warehouseData.id,
          warehouseName: warehouseData.name,
          products: selectedProducts.map(p => ({
            productId: p.id,
            productName: p.name,
            quantity: p.quantity,
            unit: p.unit,
            unitValue: p.salePrice > 0 ? p.salePrice : p.ppp,
            totalValue: p.totalValue
          })),
          reason: finalReason,
          reasonName: EXIT_REASONS[finalReason]?.name || 'Producción',
          notes: ''
        }, true); // true = crear solicitud de permiso automáticamente

        console.log('🔍 Resultado de verificación de límites:', canExit);
        console.log('🔍 ¿Puede hacer salida?', canExit.canExit);
        console.log('🔍 Razón:', canExit.reason);

        if (!canExit.canExit) {
          console.log('❌ LÍMITE EXCEDIDO - Bloqueando salida');
          if (canExit.requiresPermission) {
            // Solicitud de permiso creada, mostrar mensaje especial
            toast.addToast(canExit.reason, 'warning');
            toast.addToast('Podrás continuar una vez que se apruebe tu solicitud', 'info');
          } else {
            // Error normal de límite
            toast.addToast(canExit.reason, 'error');
          }
          setSubmitting(false);
          return;
        }

        console.log('✅ LÍMITES OK - Continuando con salida');
      } else {
        console.log('✅ ADMIN/SUPERVISOR/SUPER_ADMIN - Sin límites, continuando con salida');
      }

      // Preparar datos de salida
      const exitData = {
        workerId: currentWorker.id || currentWorker.email, // Usar email si no tiene id (ADMIN/SUPERVISOR)
        workerName: currentWorker.name,
        warehouseId: warehouseData.id,
        warehouseName: warehouseData.name,
        inventoryId: inventoryData.id || null,
        inventoryName: inventoryData.name || null,
        products: selectedProducts.map(p => ({
          productId: p.id,
          productName: p.name,
          quantity: p.quantityInBaseUnit || p.quantity,
          displayQuantity: p.quantity,
          presentationId: p.selectedPresentationId || null,
          presentationName: p.selectedPresentationName || null,
          unit: p.unit,
          unitValue: p.productType === 'ELABORADO' ? (p.precioVenta || p.ppp) : (p.salePrice > 0 ? p.salePrice : p.ppp),
          totalValue: p.totalValue,
          customFields: p.customFields || {},
          productType: p.productType || 'SIMPLE',
          ...(p.selectedExtras && p.selectedExtras.length > 0 ? {
            extras: p.selectedExtras,
            extrasTotal: p.extrasTotal || 0,
          } : {}),
          ...(p.productType === 'ELABORADO' ? { receta: p.receta || [] } : {})
        })),
        totalValue,
        totalProducts,
        totalUnits,
        ...(descuentoMonto > 0 ? { descuentoMonto, descuentoModo, totalValueBruto } : {}),
        reason: finalReason,
        reasonName: EXIT_REASONS[finalReason]?.name || 'Producción',
        notes: '',
        status: 'COMPLETED',
        paymentMethod: finalReason === 'SALE' ? paymentMethod : null,
        paymentMethodLabel: finalReason === 'SALE' ? (PAYMENT_METHODS[paymentMethod]?.label || paymentMethod) : null,
        ...(finalReason === 'SALE' && paymentMethod === 'CREDIT' && fiadoNombre.trim() ? { fiadoNombre: fiadoNombre.trim() } : {}),
        ...(finalReason === 'SALE' && splitPayment && paymentMethod !== 'CASH' ? {
          splitPayment: true,
          splitCashAmount: Number(splitCashAmount) || 0,
          splitCardAmount: totalValue - (Number(splitCashAmount) || 0),
        } : {}),
        ...(cashRegisterId ? { cashRegisterId } : {}),
        ...(finalReason === 'CREDIT' ? {
          customerName: customerName.trim(),
          creditStatus: 'pending'
        } : {}),
        // Si viene de Clientes, guardar el RUT para el historial
        ...(preSelectedClienteRut ? {
          customerRut: preSelectedClienteRut,
          ...(preSelectedClienteNombre ? { customerName: preSelectedClienteNombre } : {}),
        } : selectedCustomer ? {
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.razonSocial,
          customerRut: selectedCustomer.rut,
        } : {}),
      };

      // Si viene de Clientes: guardar datos y abrir modal para facturar PRIMERO
      if (preSelectedClienteRut) {
        setPendingExitData(exitData);
        setLastExitData({ id: null, ...exitData, createdAt: new Date() });
        setShowReceipt(true);
        setSubmitting(false);
        return;
      }

      // Flujo normal: registrar salida directamente (o encolar si no hay internet)
      if (!isOnline) {
        await enqueue(exitData);
        localStorage.removeItem('inventoryExitCart');
        setSelectedProducts([]);
        setSelectedReason(null);
        setCustomerName('');
        setFiadoNombre('');
        setSelectedCustomer(null);
        setPaymentMethod(null);
        setSplitPayment(false);
        setSplitCashAmount('');
        setCashReceived('');
        setSubmitting(false);
        toast.addToast('📦 Venta guardada — se registrará cuando vuelva la conexión', 'info');
        return;
      }
      const registeredExit = await registerInventoryExit(exitData);

      // Si esta venta viene de confirmar un pedido pendiente, eliminar el pedido original
      const orderIdParam = searchParams.get('orderId');
      if (orderIdParam) {
        try {
          const { deleteOrder } = await import('../services/orders-service');
          await deleteOrder(orderIdParam);
        } catch (e) {
          console.warn('No se pudo eliminar el pedido original:', e.message);
        }
      }

      // Si hay cliente seleccionado, agregar la venta a su historial
      if (selectedCustomer?.rut && registeredExit?.id) {
        try {
          await saveDocumentoToCustomer(selectedCustomer.rut, {
            tipoDTE: 0, // 0 = venta sin documento tributario
            tipoDocumento: 'Venta directa',
            folio: null,
            total: totalValue,
            exitId: registeredExit.id,
            emitidoAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('No se pudo guardar en historial del cliente:', e.message);
        }
        setSelectedCustomer(null);
        setCustomerSearch('');
      }

      // Guardar datos de la salida para el comprobante
      setLastExitData({
        id: registeredExit.id,
        ...exitData,
        createdAt: new Date()
      });

      // Limpiar carrito del localStorage
      localStorage.removeItem('inventoryExitCart');

      // Mostrar comprobante
      setShowReceipt(true);

      // Limpiar carrito y todos los estados de cliente
      setSelectedProducts([]);
      setSelectedReason(null);
      setCustomerName('');
      setFiadoNombre('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setCustomerResults([]);
      setPaymentMethod('CASH');
      setSplitPayment(false);
      setSplitCashAmount('');
      setDescuentoValor('');
      setCashReceived('');

      // ✨ RECARGAR PRODUCTOS para reflejar nuevo stock en tiempo real
      await loadWarehouseProducts(true);

      toast.addToast('✅ Salida registrada correctamente', 'success');

    } catch (error) {
      console.error('Error registrando salida:', error);
      toast.addToast('Error al registrar la salida: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== FUNCIÓN PARA EMITIR BOLETA/FACTURA/GUÍA DE DESPACHO ELECTRÓNICA =====
  const handleEmitirBoleta = async (exitData, options = {}) => {
    if (emitiendoRef.current) return; // prevenir doble click
    emitiendoRef.current = true;
    setEmitiendoBoleta(true);
    try {
      // Determinar tipo de documento
      const tipoDoc =
        options.tipoDTE === 33 ? 'Factura' :
        options.tipoDTE === 52 ? 'Guía de Despacho' :
        'Boleta';

      console.log(`🧾 Emitiendo ${tipoDoc} electrónica para salida:`, exitData.id, options);

      // Llamar al servicio correspondiente
      let resultado;
      if (options.tipoDTE === 52) {
        // Guía de Despacho - usar servicio específico
        resultado = await emitirGuiaDespacho(exitData, options.transportData);
      } else {
        // Boleta o Factura - usar servicio genérico
        resultado = await emitirBoleta(exitData, {
          ...options,
          onSplitNotice: (cantidadDocs, totalProductos) => {
            toast.addToast({
              type: 'info',
              title: 'Venta dividida automáticamente',
              message: `Esta venta tiene ${totalProductos} productos. El SII permite máx. 24 por documento, se emitirán ${cantidadDocs} ${tipoDoc}s una tras otra.`
            });
          }
        });
      }

      if (resultado.success) {
        // Si venía de Clientes: registrar la salida ahora que la factura fue emitida
        let exitId = lastExitData?.id;
        if (pendingExitData) {
          const registeredExit = await registerInventoryExit(pendingExitData);
          exitId = registeredExit.id;
          setLastExitData(prev => ({ ...prev, id: registeredExit.id }));
          setPendingExitData(null);
          localStorage.removeItem('inventoryExitCart');
          setSelectedProducts([]);
          setSelectedReason(null);
          setCustomerName('');
          setFiadoNombre('');
          setSelectedCustomer(null);
          setCustomerSearch('');
          setCustomerResults([]);
          setPaymentMethod(null);
          setSplitPayment(false);
          setSplitCashAmount('');
          setCashReceived('');
          await loadWarehouseProducts(true);
          toast.addToast('✅ Salida registrada y factura emitida', 'success');
        }

        // Actualizar el documento de inventory_exits con los datos del documento tributario
        if (!exitId) return; // no hay salida registrada aún (no debería pasar)
        const companyId = await getUserCompanyId();
        const exitRef = doc(db, `companies/${companyId}/inventory_exits`, exitId);

        const documentoData = Object.fromEntries(
          Object.entries({
            tipoDTE: resultado.tipoDTE,
            tipoDocumento: resultado.tipoDocumento,
            folio: resultado.folio,
            folios: resultado.folios, // array de folios si hubo split
            documentosEmitidos: resultado.documentosEmitidos,
            trackId: resultado.trackId,
            pdf: resultado.pdf,
            xml: resultado.xml,
            estado: resultado.estado,
            mensaje: resultado.mensaje,
            emitidaAt: new Date()
          }).filter(([, v]) => v !== undefined)
        );

        // Agregar datos específicos según tipo de documento
        if (options.tipoDTE === 33 && options.receptorData) {
          // Factura: datos del receptor
          documentoData.receptor = options.receptorData;
        } else if (options.tipoDTE === 52 && options.transportData) {
          // Guía de Despacho: datos del transporte y receptor
          documentoData.transporte = options.transportData;
        }

        const exitUpdate = { boleta: documentoData };
        // Siempre guardar nombre/rut del cliente en campos raíz para que el reporte lo encuentre
        if (options.receptorData?.razonSocial) {
          exitUpdate.customerName = options.receptorData.razonSocial;
          if (options.receptorData?.rut) exitUpdate.customerRut = options.receptorData.rut;
        } else if (preSelectedClienteNombre) {
          exitUpdate.customerName = preSelectedClienteNombre;
          if (preSelectedClienteRut) exitUpdate.customerRut = preSelectedClienteRut;
        }
        await updateDoc(exitRef, exitUpdate);

        // Actualizar lastExitData para reflejar el documento emitido
        setLastExitData({
          ...lastExitData,
          boleta: documentoData
        });

        // Guardar referencia del documento en el cliente (uno por folio si hubo split)
        if (options.receptorData?.rut && resultado.folio) {
          const allFolios = resultado.folios || [resultado.folio];
          for (const folio of allFolios) {
            saveDocumentoToCustomer(options.receptorData.rut, {
              tipoDTE: resultado.tipoDTE,
              tipoDocumento: resultado.tipoDocumento,
              folio,
              total: Math.round(exitData.totalValue / allFolios.length), // distribuir total
              exitId: exitId,
              ...(resultado.pdf ? { pdfUrl: resultado.pdf } : {})
            });
          }
        }

        const mensajeExito = resultado.folios
          ? `✅ ${resultado.documentosEmitidos} ${tipoDoc}s emitidas. Folios: ${resultado.folios.join(', ')}`
          : `✅ ${tipoDoc} electrónica emitida correctamente. Folio: ${resultado.folio}`;
        toast.addToast(mensajeExito, 'success');

        // Si vino del flujo Clientes → redirigir de vuelta a clientes tras emitir
        if (preSelectedClienteRut) {
          setTimeout(() => navigate('/clientes'), 1500);
        }
      } else {
        throw new Error(resultado.error || `Error desconocido al emitir ${tipoDoc.toLowerCase()}`);
      }
    } catch (error) {
      const tipoDoc =
        options.tipoDTE === 33 ? 'factura' :
        options.tipoDTE === 52 ? 'guía de despacho' :
        'boleta';
      console.error(`❌ Error emitiendo ${tipoDoc} electrónica:`, error);
      toast.addToast(`❌ Error al emitir ${tipoDoc}: ${error.message}`, 'error');
    } finally {
      setEmitiendoBoleta(false);
      emitiendoRef.current = false;
    }
  };

  const handleAnnulSale = async (exitId, reason) => {
    try {
      console.log('🚫 Anulando venta:', exitId, reason);

      // Obtener email del usuario actual
      const userEmail = currentUser?.email || 'unknown';

      await annulInventoryExit(exitId, userEmail, reason);

      toast.addToast('✅ Venta anulada correctamente. Stock restaurado.', 'success');

      // Recargar productos para reflejar el stock actualizado
      fetchData();

    } catch (error) {
      console.error('❌ Error anulando venta:', error);
      throw error; // Re-lanzar para que el modal lo maneje
    }
  };

  // ===== UTILIDADES =====
  const formatCLP = (amount) => {
    if (isVE) return formatPrice(amount);
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getRoleName = (role) => {
    const roleNames = {
      'ADMIN': 'Administrador',
      'SUPERVISOR': 'Supervisor',
      'WORKER': 'Trabajador'
    };
    return roleNames[role] || role;
  };

  const getLimitDisplay = (worker) => {
    if (!worker) return 'Cargando...';

    if (worker.limitType === 'NONE') {
      return <span className="text-green-600 font-medium">∞ Sin límites</span>;
    } else if (worker.limitType === 'MONEY') {
      return <span className="text-blue-600 font-medium">💰 {formatCLP(worker.dailyLimitMoney || 0)} / día</span>;
    } else if (worker.limitType === 'UNITS') {
      return <span className="text-purple-600 font-medium">⚖️ {(worker.dailyLimitUnits || worker.dailyLimitProducts) || 0} cantidad total / día</span>;
    }
    return 'No configurado';
  };

  // ===== FILTRADO DE PRODUCTOS =====
  // Obtener categorías únicas
  const categories = useMemo(
    () => ['all', ...new Set(warehouseProducts.map(p => p.category))],
    [warehouseProducts]
  );

  // Se filtra por categoría Y por texto de búsqueda — la grilla de productos (VitrinaGrid,
  // sin carrusel) se filtra en vivo mientras se escribe. useMemo evita que este .filter()
  // corra en CADA render del componente (que tiene muchísimo estado y re-renderiza seguido):
  // sin memoizar, se le pasaba un array NUEVO a la grilla en cada render aunque el resultado
  // fuera idéntico, forzando recalcular las cards de más — esa era la causa de la lentitud
  // al escribir y el parpadeo de "Agotado" que había con el carrusel viejo.
  const filteredProducts = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return warehouseProducts.filter(product => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;
      if (!search) return true;
      const basicMatch = (
        product.name.toLowerCase().includes(search) ||
        product.code.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search) ||
        (product.sku && product.sku.toLowerCase().includes(search))
      );
      const customFieldsMatch = product.customFields && Object.entries(product.customFields).some(
        ([key, value]) => key.toLowerCase().includes(search) || String(value).toLowerCase().includes(search)
      );
      return basicMatch || customFieldsMatch;
    });
  }, [warehouseProducts, selectedCategory, searchTerm]);

  // ===== RENDERS CONDICIONALES =====
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-slate-600">Cargando sistema de salidas...</p>
        </motion.div>
      </div>
    );
  }

  // Sin bodega seleccionada → redirigir directo a Mis Bodegas
  if (!warehouseData.id || !warehouseData.name) {
    navigate('/mis-bodegas', { replace: true });
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-slate-600">Cargando sistema de salidas...</p>
        </motion.div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full"
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring", damping: 25 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5, type: "spring", damping: 10 }}
          >
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          </motion.div>
          <motion.h2
            className="text-2xl font-bold text-slate-900 mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            ¡Salida Registrada!
          </motion.h2>
          <motion.p
            className="text-slate-600 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            La salida ha sido registrada correctamente y el stock ha sido actualizado.
          </motion.p>
          <motion.button
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition shadow-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Nueva Salida
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Ya no necesitamos showLogin - ProtectedRoute maneja la autenticación

  // Función para agregar producto rápidamente con cantidad específica
  const quickAddProduct = (product, quantity = 1) => {
    // Si es producto por peso, abrir modal para ingresar cantidad
    if (isWeightUnit(product.unit)) {
      setWeightInput('');
      setWeightModal({ open: true, product });
      return;
    }
    // Si es elaborado con presentaciones o extras → abrir picker
    const isElaborado = product.productType === 'ELABORADO' || (Array.isArray(product.receta) && product.receta.length > 0);
    const hasPresentations = product.presentations && product.presentations.length > 0;
    const hasExtras = product.extras && product.extras.length > 0;
    if (isElaborado && (hasPresentations || hasExtras)) {
      setPickerProduct(product);
      return;
    }
    updateProductQuantity(product.id, quantity);
  };

  // Vitrina · onAdd(product, delta): SUMA `delta` unidades a lo que ya hay en el carrito.
  const handleVitrinaAdd = (product, delta = 1) => {
    const isElaborado = product.productType === 'ELABORADO' || (Array.isArray(product.receta) && product.receta.length > 0);
    const hasPresentations = product.presentations && product.presentations.length > 0;
    const hasExtras = product.extras && product.extras.length > 0;
    // peso o elaborado con variantes → delega en quickAddProduct (abre modal / picker)
    if (isWeightUnit(product.unit) || (isElaborado && (hasPresentations || hasExtras))) {
      quickAddProduct(product, delta);
      return;
    }
    const existing = selectedProductsRef.current.find(p => p.id === product.id);
    const base = existing ? existing.quantity : 0;
    const newQty = isElaborado ? base + delta : Math.min(product.stock, base + delta);
    updateProductQuantity(product.id, newQty);
  };

  // Vitrina · onSetQty(product, qty): FIJA la cantidad exacta en el carrito (stepper −, quitar).
  const handleVitrinaSetQty = (product, qty) => {
    updateProductQuantity(product.id, Math.max(0, qty));
  };

  // Handler cuando el picker confirma selección
  const handlePickerConfirm = ({ presentationId, presentationName, presentationSalePrice, presentationFactor, extras, extrasTotal, quantity, unitTotal, grandTotal }) => {
    const product = pickerProduct;
    setPickerProduct(null);

    // Setear formato seleccionado
    if (presentationId) {
      setSelectedFormatByProduct(prev => ({ ...prev, [product.id]: presentationId }));
    }

    // Calcular item del carrito con extras
    const quantityInBaseUnit = quantity * (presentationFactor || 1);

    setSelectedProducts(prev => {
      // Si ya existe el mismo producto con la misma presentación, sumamos cantidad
      const existingIndex = prev.findIndex(p =>
        p.id === product.id && p.selectedPresentationId === (presentationId || null)
      );

      // cartKey único por producto + presentación + extras combinados
      const extrasKey = (extras || []).map(e => e.id).sort().join('_');
      const cartKey = `${product.id}__${presentationId || 'base'}__${extrasKey || 'noextras'}`;

      const cartItem = {
        ...product,
        cartKey,
        quantity,
        quantityInBaseUnit,
        selectedPresentationId: presentationId || null,
        selectedPresentationName: presentationName || null,
        selectedPresentationFactor: presentationFactor || 1,
        selectedExtras: extras || [],
        extrasTotal: extrasTotal || 0,
        totalValue: grandTotal,
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + quantity;
        updated[existingIndex] = {
          ...cartItem,
          quantity: newQty,
          quantityInBaseUnit: newQty * (presentationFactor || 1),
          extrasTotal: (extrasTotal / quantity) * newQty,
          totalValue: unitTotal * newQty,
        };
        return updated;
      }
      return [...prev, cartItem];
    });

    if (navigator.vibrate) navigator.vibrate(50);
  };


  // ===== RENDER PRINCIPAL =====
  const totalValue = selectedProducts.reduce((sum, p) => sum + p.totalValue, 0);
  const totalQuantity = selectedProducts.reduce((sum, p) => sum + (p.quantityInBaseUnit || p.quantity), 0);

  // Descuento fashion (solo inventarios tipo 'fashion')
  const isFashionInventory = inventoryType === 'fashion';
  const descuentoMonto = (() => {
    if (!isFashionInventory || !descuentoValor) return 0;
    const val = Number(descuentoValor);
    if (isNaN(val) || val <= 0) return 0;
    if (descuentoModo === 'porcentaje') return isVE ? totalValue * val / 100 : Math.round(totalValue * val / 100);
    return Math.min(val, totalValue);
  })();
  const totalConDescuento = totalValue - descuentoMonto;

  // Helper: render motivo selector (colapsable, SALE por defecto)
  const renderReasonSelector = () => (
    <div>
      <button
        onClick={() => setShowReasonSelector(!showReasonSelector)}
        className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
          isDark ? 'border-slate-700 hover:border-slate-600' : 'border-gray-200 hover:border-blue-300'
        }`}
      >
        <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Motivo: {EXIT_REASONS[selectedReason]?.icon} {EXIT_REASONS[selectedReason]?.name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReasonSelector ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
      </button>
      {showReasonSelector && (
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {Object.entries(EXIT_REASONS)
            .filter(([key]) => {
              if (currentWorker?.role === 'CAJERA') return key === 'SALE' || key === 'CREDIT';
              if (currentWorker?.role === 'VENDEDORA') return key === 'SALE' || key === 'TRANSFER' || key === 'CREDIT';
              return true;
            })
            .map(([key, reason]) => (
              <button
                key={key}
                onClick={() => { setSelectedReason(key); setShowReasonSelector(false); setPaymentMethod(null); }}
                className={`p-2 rounded-lg border transition-all text-center ${
                  selectedReason === key
                    ? isDark ? 'border-blue-500 bg-blue-500/15' : 'border-blue-500 bg-blue-50'
                    : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <span className="text-base">{reason.icon}</span>
                <span className={`block text-[10px] font-medium mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {reason.name}
                </span>
              </button>
            ))}
        </div>
      )}
      {/* Campo nombre del cliente para Fiado */}
      {selectedReason === 'CREDIT' && (
        <div className="mt-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre del cliente *"
            className={`w-full p-2 rounded-lg border text-sm transition-all ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-yellow-500'
                : 'bg-white border-gray-200 text-slate-900 placeholder-gray-400 focus:border-yellow-500'
            }`}
          />
        </div>
      )}
    </div>
  );

  // Helper: render cart item
  const renderCartItem = (product) => {
    const isWeight = isWeightUnit(product.unit);
    const step = isWeight ? 0.1 : 1;

    return (
      <motion.div
        key={product.cartKey || product.id}
        layout
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`flex items-center gap-3 p-3 rounded-xl ${
          isDark ? 'bg-slate-700/50' : 'bg-gray-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isWeight && <Scale className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />}
            <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {product.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {formatCLP(product.salePrice > 0 ? product.salePrice : product.ppp)}/{product.unit}
              </p>
              {product.tienePromoActiva && (
                <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 border border-orange-500/30 rounded-full px-1.5 py-0.5">
                  🏷️ Promo
                </span>
              )}
            </div>
            {product.selectedPresentationName && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                {product.selectedPresentationName}
              </span>
            )}
          </div>
          <p className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {product.quantity} {product.unit} · {formatCLP(product.totalValue)}
          </p>
          {product.selectedExtras && product.selectedExtras.length > 0 && (
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              + {product.selectedExtras.map(e => e.name).join(', ')}
            </p>
          )}
          {product.customFields && Object.keys(product.customFields).length > 0 && (
            <div className="mt-0.5">
              {Object.entries(product.customFields).map(([key, value]) =>
                value ? (
                  <p key={key} className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {key}: {String(value)}
                  </p>
                ) : null
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              const newQty = isWeight
                ? Math.max(0, Math.round((product.quantity - step) * 100) / 100)
                : Math.max(0, product.quantity - 1);
              if (product.cartKey) updateCartKeyQuantity(product.cartKey, newQty);
              else updateProductQuantity(product.id, newQty);
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              isDark ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            step={isWeight ? '0.01' : '1'}
            min="0"
            max={product.stock || 9999}
            value={product.quantity}
            onChange={(e) => {
              const newQty = parseFloat(e.target.value) || 0;
              if (product.cartKey) updateCartKeyQuantity(product.cartKey, newQty);
              else updateProductQuantity(product.id, newQty);
            }}
            onFocus={(e) => e.target.select()}
            className={`w-16 text-center text-sm font-bold rounded-md py-0.5 border ${
              isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => {
              const newQty = isWeight
                ? Math.round((product.quantity + step) * 100) / 100
                : product.quantity + 1;
              if (product.cartKey) updateCartKeyQuantity(product.cartKey, newQty);
              else updateProductQuantity(product.id, newQty);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => removeProductFromCart(product.id, product.cartKey)}
          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </motion.div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>

      {/* ===== TOP BAR ===== */}
      <div ref={topbarRef} className={`sticky top-0 z-30 border-b backdrop-blur-xl ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-gray-200'
      }`}>
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: warehouse info */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className={`text-base sm:text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {warehouseData.name}
                </h1>
                <div className="flex items-center gap-2">
                  {warehouseData.location && (
                    <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      <MapPin className="w-3 h-3" />
                      {warehouseData.location}
                    </span>
                  )}
                  {currentWorker && (
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {currentWorker.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Scanner + worker info */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Worker limit badge */}
              {currentWorker?.limitType === 'UNITS' && currentWorker?.role === 'WORKER' && (
                <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  (dailyUsage.usedAmountUnits + totalQuantity) > ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0)
                    ? 'bg-red-500/15 text-red-500'
                    : 'bg-blue-500/15 text-blue-500'
                }`}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  {(dailyUsage.usedAmountUnits + totalQuantity).toFixed(1)} / {(currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0}
                </div>
              )}

              {/* Escáner de cámara — solo móvil/tablet (en PC se usa la pistola láser) */}
              <motion.button
                onClick={() => {
                  // En móvil: abrir modo escáner continuo
                  if (window.innerWidth < 1024) {
                    toggleScannerMode();
                  } else {
                    setShowScanner(!showScanner);
                  }
                }}
                className={`lg:hidden p-2.5 rounded-xl shadow-lg transition-colors ${
                  showScanner || scannerMode
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25'
                }`}
                whileTap={{ scale: 0.95 }}
                title={showScanner ? 'Cerrar cámara' : 'Modo escáner'}
              >
                {showScanner || scannerMode ? <VideoOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
              </motion.button>
              {['WORKER', 'CAJERA', 'VENDEDORA'].includes(currentWorker?.role) && (
                <WorkerDrawerMenu workerRole={currentWorker?.role} workerName={currentWorker?.name} dark={isDark} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MAIN LAYOUT: Products Left + Cart Right (desktop) ===== */}
      <div className="max-w-[1800px] mx-auto flex">

        {/* ===== LEFT: Products Panel ===== */}
        <div className={`flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-4 ${selectedProducts.length > 0 ? 'pb-48 lg:pb-4 lg:mr-[400px]' : ''}`}>

          {/* Search bar + Scanner toggle */}
          <div className="mb-4 space-y-3">
            {/* Buscador pegado arriba (debajo de la topbar): al elegir una sugerencia la
                página puede bajar bastante para mostrar el producto (categorías más abajo en
                la lista) — si el buscador no fuera sticky, quedaría fuera de vista y habría
                que volver a subir manualmente para buscar el siguiente producto. */}
            <div ref={searchbarRef} className={`sticky z-20 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 pt-2 pb-1 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`} style={{ top: 'var(--vt-topbar-h, 56px)' }}>
            {/* En móvil: buscador ocupa toda la fila; Combos/Voz bajan a su propia fila.
                En sm+: todo en una sola fila como antes. */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <div className="relative w-full sm:w-auto sm:flex-1 vt">
                <div className={`relative rounded-xl overflow-hidden ${
                  isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar producto por nombre, SKU..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setSuggestOpen(true); }}
                    onFocus={() => setSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setSuggestOpen(false), 200)}
                    className={`w-full pl-11 pr-10 py-3 text-sm font-medium bg-transparent outline-none ${
                      isDark ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'
                    }`}
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={() => { setSearchTerm(''); setSuggestOpen(false); }}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {suggestOpen && (
                  <VitrinaSuggest
                    query={searchTerm}
                    products={warehouseProducts}
                    inputRef={searchInputRef}
                    onPick={(p) => {
                      // solo completa el buscador con el nombre exacto — la grilla se filtra
                      // sola por searchTerm, como si el usuario lo hubiera escrito a mano.
                      setSearchTerm(p.name);
                      setSuggestOpen(false);
                    }}
                  />
                )}
              </div>

              {/* Combos + Voz: en móvil bajan a su propia fila (el buscador va arriba a todo el ancho) */}
              <div className="flex gap-2 w-full sm:w-auto sm:contents">
                {/* Botón combos — solo Distribuidora L&N */}
                {companyId === 'ypruiRJ9fKijEptCIyHb' && (
                  <button
                    onClick={() => setShowComboModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold shadow-lg shadow-emerald-600/20 transition-colors border-none cursor-pointer shrink-0"
                    title="Ver combos disponibles"
                  >
                    <Tag className="w-4 h-4" />
                    <span className="hidden sm:inline">Combos</span>
                  </button>
                )}

                {companyId && (
                  <VoiceSaleButton
                    companyId={companyId}
                    inventoryId={inventoryData.id}
                    warehouseId={warehouseData.id}
                    onAddProducts={handleVoiceProducts}
                    isDark={isDark}
                    productos={warehouseProducts}
                  />
                )}
              </div>
            </div>
            </div>

            {/* Inline Camera Scanner */}
            <AnimatePresence>
              {showScanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="overflow-hidden"
                >
                  <div className={`rounded-xl overflow-hidden border ${
                    isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-opacity-50"
                      style={{ borderColor: isDark ? 'rgb(51 65 85)' : 'rgb(229 231 235)' }}
                    >
                      <div className="flex items-center gap-2">
                        <Camera className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                          Cámara activa - apunta al código
                        </span>
                      </div>
                      <button
                        onClick={() => setShowScanner(false)}
                        className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="relative aspect-[16/7] bg-slate-900">
                      <ImprovedBarcodeScanner
                        onScanSuccess={handleScanSuccess}
                        onClose={() => setShowScanner(false)}
                        products={warehouseProducts}
                        inline={true}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Barcode gun hint */}
            {!showScanner && (
              <div className={`flex items-center gap-2 px-1 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                <ScanBarcode className="w-3.5 h-3.5" />
                <span className="text-[10px]">Pistola láser lista - escanea directamente</span>
              </div>
            )}
          </div>

          {/* Category filters */}
          {categories.length > 1 && (
            <div className="mb-4 overflow-x-auto pb-1 scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {categories.map((category) => {
                  const isActive = selectedCategory === category;
                  const count = category === 'all'
                    ? warehouseProducts.length
                    : warehouseProducts.filter(p => p.category === category).length;

                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                          : isDark
                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {category === 'all' ? 'Todos' : category} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products grid — grilla simple, sin carrusel: navbar/buscador/chips quedan fijos
              arriba y solo esta grilla scrollea con la página. */}
          <VitrinaGrid
            items={filteredProducts}
            mode="salida"
            loading={loading}
            emptyText="Esta bodega está vacía"
            noResultsText={searchTerm ? `No se encontró "${searchTerm}"` : 'Sin resultados'}
            canSeePrice={['ADMIN', 'ENCARGADA', 'VENDEDORA', 'SUPERVISOR', 'GERENTE'].includes(currentWorker?.role) || !currentWorker}
            cartQtyOf={(pid) => {
              const it = selectedProducts.find((p) => p.id === pid);
              return it ? (it.quantity || 0) : 0;
            }}
            onAdd={handleVitrinaAdd}
            onSetQty={handleVitrinaSetQty}
            onNotify={(msg) => toast.addToast(msg, 'warning')}
          />
        </div>

        {/* ===== RIGHT: Cart Panel (Desktop - fixed sidebar) ===== */}
        {selectedProducts.length > 0 && (
          <div className="hidden lg:flex fixed right-0 top-0 bottom-0 w-[400px] flex-col border-l z-10 transition-colors"
            style={{
              backgroundColor: isDark ? 'rgb(15 23 42)' : 'white',
              borderColor: isDark ? 'rgb(30 41 59)' : 'rgb(229 231 235)'
            }}
          >
            {/* Spacer to push content below the sticky topbar (~56px) */}
            <div className="flex-shrink-0 h-22" />
            {/* Cart header */}
            <div className={`px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-blue-500/15' : 'bg-blue-50'
                  }`}>
                    <ShoppingCart className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Carrito</h3>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProducts([])}
                  className={`text-xs font-medium px-2 py-1 rounded-md transition ${
                    isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  Vaciar
                </button>
              </div>
            </div>

            {/* Indicador de cliente cuando viene preseleccionado desde Clientes */}
            {preSelectedClienteRut && (
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${
                preSelectedTipoVenta === 'pedido'
                  ? isDark ? 'border-slate-800 bg-blue-900/10' : 'border-blue-100 bg-blue-50'
                  : preSelectedTipoVenta === 'credito'
                    ? isDark ? 'border-slate-800 bg-amber-900/10' : 'border-amber-100 bg-amber-50'
                    : isDark ? 'border-slate-800 bg-blue-900/10' : 'border-gray-100 bg-blue-50'
              }`}>
                <span className="text-base">{preSelectedTipoVenta === 'pedido' ? '📦' : preSelectedTipoVenta === 'credito' ? '🤝' : '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${
                    preSelectedTipoVenta === 'pedido'
                      ? isDark ? 'text-blue-300' : 'text-blue-700'
                      : preSelectedTipoVenta === 'credito'
                        ? isDark ? 'text-amber-400' : 'text-amber-700'
                        : isDark ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    {preSelectedTipoVenta === 'pedido' ? '📦 PEDIDO' : preSelectedTipoVenta === 'credito' ? '🤝 CRÉDITO' : '👤 CONTADO'} — {preSelectedClienteNombre || preSelectedClienteRut}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {preSelectedClienteRut && `RUT: ${preSelectedClienteRut} · `}
                    {preSelectedTipoVenta === 'pedido'
                      ? 'No descuenta stock — se confirma cuando se entregue'
                      : preSelectedTipoVenta === 'credito'
                        ? 'Motivo: Fiado — quedará pendiente de cobro'
                        : 'Motivo: Venta — pago al contado'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Cart items + summary + pago — todo scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                <AnimatePresence>
                  {selectedProducts.map(renderCartItem)}
                </AnimatePresence>
              </div>

              {/* Reason selector */}
              <div className="mt-4">
                {preSelectedTipoVenta !== 'pedido' && renderReasonSelector()}
              </div>

              {/* Worker limit bar */}
              {currentWorker?.limitType === 'UNITS' && currentWorker?.role === 'WORKER' && (
                <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Límite diario</span>
                    <span className={`font-bold ${
                      (dailyUsage.usedAmountUnits + totalQuantity) > ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0)
                        ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {(dailyUsage.usedAmountUnits + totalQuantity).toFixed(1)} / {(currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0}
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        (dailyUsage.usedAmountUnits + totalQuantity) > ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0)
                          ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          ((dailyUsage.usedAmountUnits + totalQuantity) / Math.max((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 1, 1)) * 100,
                          100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Descuento por volumen — solo inventario fashion */}
              {isFashionInventory && selectedProducts.length >= 1 && selectedReason === 'SALE' && (
                <div className={`mt-3 p-3 rounded-xl border ${isDark ? 'bg-violet-900/20 border-violet-700/40' : 'bg-violet-50 border-violet-200'}`}>
                  <p className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                    🏷️ Descuento
                  </p>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => { setDescuentoModo('porcentaje'); setDescuentoValor(''); }}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-all ${descuentoModo === 'porcentaje' ? 'bg-violet-600 border-violet-600 text-white' : isDark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'}`}
                    >% Porcentaje</button>
                    <button
                      onClick={() => { setDescuentoModo('fijo'); setDescuentoValor(''); }}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-all ${descuentoModo === 'fijo' ? 'bg-violet-600 border-violet-600 text-white' : isDark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'}`}
                    >$ Monto fijo</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={descuentoModo === 'porcentaje' ? 100 : undefined}
                      value={descuentoValor}
                      onChange={e => setDescuentoValor(e.target.value)}
                      placeholder={descuentoModo === 'porcentaje' ? 'Ej: 10' : 'Ej: 5000'}
                      className={`flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                    {descuentoValor && (
                      <button onClick={() => setDescuentoValor('')} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
                    )}
                  </div>
                  {descuentoMonto > 0 && (
                    <p className={`text-xs mt-1.5 ${isDark ? 'text-violet-300' : 'text-violet-600'}`}>
                      Descuento: -{formatCLP(descuentoMonto)}
                    </p>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className={`mt-4 p-3 rounded-xl space-y-1.5 ${isDark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <div className="flex justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Unidades</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalQuantity.toFixed(1)}</span>
                </div>
                {(currentWorker?.role === 'ADMIN' || currentWorker?.role === 'ENCARGADA' || currentWorker?.role === 'VENDEDORA') && (
                  <div className="flex flex-col gap-0.5">
                    {descuentoMonto > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Subtotal</span>
                        <span className={`font-medium line-through ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{formatCLP(totalValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Total</span>
                      <span className={`text-lg font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {formatCLP(totalConDescuento)}
                      </span>
                    </div>
                  </div>
                )}
                {selectedReason && preSelectedTipoVenta !== 'pedido' && (
                  <div className="flex justify-between text-xs">
                    <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Motivo</span>
                    <span className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      {EXIT_REASONS[selectedReason]?.icon} {EXIT_REASONS[selectedReason]?.name}
                    </span>
                  </div>
                )}
                {selectedReason === 'CREDIT' && customerName.trim() && (
                  <div className="flex justify-between text-xs">
                    <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Cliente</span>
                    <span className={`font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      🤝 {customerName.trim()}
                    </span>
                  </div>
                )}
              </div>

              {/* Método de pago - solo para ventas */}
              {selectedReason === 'SALE' && preSelectedTipoVenta !== 'pedido' && (
                <div className="mt-4">
                  <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Método de pago</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(PAYMENT_METHODS).map(([key, pm]) => (
                      <button
                        key={key}
                        onClick={() => { setPaymentMethod(key); setCashReceived(''); setSplitPayment(false); setSplitCashAmount(''); }}
                        className={`text-xs py-1.5 px-2 rounded-lg border font-medium transition-all flex items-center gap-1 ${
                          paymentMethod === key
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : isDark
                              ? 'border-slate-700 text-slate-300 hover:border-blue-500'
                              : 'border-gray-200 text-gray-600 hover:border-blue-400'
                        }`}
                      >
                        <span>{pm.icon}</span>
                        <span>{pm.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Efectivo parcial — visible directamente cuando el método NO es CASH */}
                  {paymentMethod !== 'CASH' && (
                    <div className="mt-2 space-y-1.5">
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>💵 Efectivo adicional (opcional)</p>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>$</span>
                        <input
                          type="number" min="0" step="100"
                          value={splitCashAmount}
                          onChange={(e) => { setSplitCashAmount(e.target.value); setSplitPayment(!!e.target.value); }}
                          onFocus={(e) => e.target.select()}
                          placeholder="0 si paga todo con tarjeta/transferencia"
                          className={`w-full pl-7 pr-3 py-2 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                        />
                      </div>
                      {splitCashAmount && Number(splitCashAmount) > 0 && Number(splitCashAmount) < totalValue && (
                        <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                          <div className={`flex justify-between items-center px-3 py-1.5 ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>💵 Efectivo</span>
                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCLP(Number(splitCashAmount))}</span>
                          </div>
                          <div className={`flex justify-between items-center px-3 py-1.5 ${isDark ? 'bg-slate-800/50' : 'bg-white'}`}>
                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{PAYMENT_METHODS[paymentMethod]?.icon} {PAYMENT_METHODS[paymentMethod]?.label}</span>
                            <span className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{formatCLP(totalValue - Number(splitCashAmount))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vuelto — solo efectivo puro */}
                  {paymentMethod === 'CASH' && (
                    <div className="mt-2 space-y-1.5">
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>$</span>
                        <input
                          type="number" min="0" step="100"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="¿Con cuánto paga?"
                          className={`w-full pl-7 pr-3 py-2 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                        />
                      </div>
                      {cashReceived && Number(cashReceived) >= totalValue && (
                        <div className={`flex justify-between items-center px-3 py-2 rounded-lg ${isDark ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-emerald-50 border border-emerald-200'}`}>
                          <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Vuelto</span>
                          <span className={`text-base font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCLP(Number(cashReceived) - totalValue)}</span>
                        </div>
                      )}
                      {cashReceived && Number(cashReceived) < totalValue && (
                        <div className={`flex justify-between items-center px-3 py-2 rounded-lg ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                          <span className={`text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>Falta</span>
                          <span className={`text-base font-black ${isDark ? 'text-red-400' : 'text-red-600'}`}>{formatCLP(totalValue - Number(cashReceived))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Espacio inferior para que no quede pegado al borde */}
              <div className="h-4" />
            </div>

            {/* Validation banner — muestra qué falta antes de registrar */}
            {selectedProducts.length > 0 && (() => {
              const pending = [];
              if (!selectedReason) pending.push('Elegí un motivo de salida');
              if (selectedReason === 'SALE' && !paymentMethod) pending.push('Elegí un método de pago');
              if (selectedReason === 'CREDIT' && !paymentMethod) pending.push('Elegí un método de pago');
              if (selectedReason === 'CREDIT' && !customerName.trim()) pending.push(`Ingresá el nombre del cliente (${vocab?.credit || 'fiado'})`);
              if (pending.length === 0) return null;
              return (
                <div className={`mx-5 mb-2 px-3 py-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Falta completar:
                  </p>
                  {pending.map((msg, i) => (
                    <p key={i} className={`text-xs pl-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>• {msg}</p>
                  ))}
                </div>
              );
            })()}

            {/* Cart footer - solo botón */}
            <div className={`border-t px-5 py-4 flex-shrink-0 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
              <motion.button
                onClick={handleSubmitExit}
                disabled={submitting || !selectedReason || (['SALE','CREDIT'].includes(selectedReason) && !paymentMethod) || (selectedReason === 'CREDIT' && !customerName.trim())}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/25 transition-colors flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                {submitting ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {preSelectedTipoVenta === 'pedido' ? '📦 Crear Pedido' : preSelectedClienteRut ? 'Facturar Venta' : selectedReason === 'SALE' ? 'Registrar Venta' : 'Registrar Salida'}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* ===== MOBILE: Bottom Cart Sheet ===== */}
      <AnimatePresence>
        {selectedProducts.length > 0 && (
          <motion.div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: cartExpanded ? 0 : "calc(100% - 130px)" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > 80 || velocity.y > 400) setCartExpanded(false);
              else if (offset.y < -80 || velocity.y < -400) setCartExpanded(true);
            }}
          >
            <div className={`rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh] ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}>
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 cursor-pointer flex-shrink-0" onClick={() => setCartExpanded(!cartExpanded)}>
                <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`} />
              </div>

              {/* Collapsed cart bar */}
              {!cartExpanded && (
                <div className="px-4 pb-4 flex-shrink-0">
                  <div className={`flex items-center gap-3 p-3 rounded-2xl ${
                    isDark ? 'bg-blue-600/15 border border-blue-500/20' : 'bg-blue-600'
                  }`}>
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        isDark ? 'bg-blue-500/20' : 'bg-white/20'
                      }`}>
                        <ShoppingCart className="w-5 h-5 text-white" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                        {selectedProducts.length}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-white'}`}>
                        {selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''}
                      </p>
                      {(currentWorker?.role === 'ADMIN' || currentWorker?.role === 'ENCARGADA' || currentWorker?.role === 'VENDEDORA') && (
                        <p className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-100'}`}>
                          {formatCLP(totalValue)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCartExpanded(true); }}
                      className={`px-4 py-2 rounded-lg font-bold text-sm flex-shrink-0 ${
                        isDark ? 'bg-blue-500 text-white' : 'bg-white text-blue-600'
                      }`}
                    >
                      Ver
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded cart */}
              {cartExpanded && (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  {/* Header */}
                  <div className={`px-5 py-3 border-b flex items-center justify-between flex-shrink-0 ${
                    isDark ? 'border-slate-800' : 'border-gray-100'
                  }`}>
                    <div>
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Tu Carrito</h3>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setCartExpanded(false)}
                      className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                    >
                      <ChevronDown className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
                    </button>
                  </div>

                  {/* Indicador cliente mobile */}
                  {preSelectedClienteRut && (
                    <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${isDark ? 'border-slate-800 bg-blue-900/10' : 'border-gray-100 bg-blue-50'}`}>
                      <span>👤</span>
                      <p className={`text-xs font-bold truncate ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                        RUT {preSelectedClienteRut} · quedará en historial
                      </p>
                    </div>
                  )}

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    <div className="space-y-2">
                      <AnimatePresence>
                        {selectedProducts.map(renderCartItem)}
                      </AnimatePresence>
                    </div>

                    {/* Reason selector */}
                    <div className="mt-4">
                      {preSelectedTipoVenta !== 'pedido' && renderReasonSelector()}
                    </div>

                    {/* Descuento fashion — mobile */}
                    {isFashionInventory && selectedProducts.length >= 1 && selectedReason === 'SALE' && (
                      <div className={`mt-3 p-3 rounded-xl border ${isDark ? 'bg-violet-900/20 border-violet-700/40' : 'bg-violet-50 border-violet-200'}`}>
                        <p className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                          🏷️ Descuento
                        </p>
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => { setDescuentoModo('porcentaje'); setDescuentoValor(''); }}
                            className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-all ${descuentoModo === 'porcentaje' ? 'bg-violet-600 border-violet-600 text-white' : isDark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'}`}
                          >% Porcentaje</button>
                          <button
                            onClick={() => { setDescuentoModo('fijo'); setDescuentoValor(''); }}
                            className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-all ${descuentoModo === 'fijo' ? 'bg-violet-600 border-violet-600 text-white' : isDark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'}`}
                          >$ Monto fijo</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0"
                            max={descuentoModo === 'porcentaje' ? 100 : undefined}
                            value={descuentoValor}
                            onChange={e => setDescuentoValor(e.target.value)}
                            placeholder={descuentoModo === 'porcentaje' ? 'Ej: 10' : 'Ej: 5000'}
                            className={`flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                          />
                          {descuentoValor && (
                            <button onClick={() => setDescuentoValor('')} className="text-xs text-red-400 px-1">✕</button>
                          )}
                        </div>
                        {descuentoMonto > 0 && (
                          <p className={`text-xs mt-1.5 ${isDark ? 'text-violet-300' : 'text-violet-600'}`}>
                            Descuento: -{formatCLP(descuentoMonto)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Unidades totales</span>
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalQuantity.toFixed(1)}</span>
                        </div>
                        {(currentWorker?.role === 'ADMIN' || currentWorker?.role === 'ENCARGADA' || currentWorker?.role === 'VENDEDORA') && (
                          <div className="flex flex-col gap-0.5">
                            {descuentoMonto > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Subtotal</span>
                                <span className={`font-medium line-through ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{formatCLP(totalValue)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Valor total</span>
                              <span className={`text-base font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                {formatCLP(totalConDescuento)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Método de pago mobile - solo ventas */}
                    {selectedReason === 'SALE' && preSelectedTipoVenta !== 'pedido' && (
                      <div className="mt-4">
                        <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Método de pago</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.entries(PAYMENT_METHODS).map(([key, pm]) => (
                            <button
                              key={key}
                              onClick={() => { setPaymentMethod(key); setCashReceived(''); setSplitPayment(false); setSplitCashAmount(''); }}
                              className={`text-xs py-2 px-2 rounded-lg border font-medium transition-all flex items-center gap-1 ${
                                paymentMethod === key
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : isDark
                                    ? 'border-slate-700 text-slate-300 hover:border-blue-500'
                                    : 'border-gray-200 text-gray-600 hover:border-blue-400'
                              }`}
                            >
                              <span>{pm.icon}</span>
                              <span>{pm.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Efectivo parcial mobile — visible directamente */}
                        {paymentMethod !== 'CASH' && (
                          <div className="mt-2 space-y-1.5">
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>💵 Efectivo adicional (opcional)</p>
                            <div className="relative">
                              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>$</span>
                              <input
                                type="number" min="0" step="100"
                                value={splitCashAmount}
                                onChange={(e) => { setSplitCashAmount(e.target.value); setSplitPayment(!!e.target.value); }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0 si paga todo con tarjeta/transferencia"
                                className={`w-full pl-7 pr-3 py-2.5 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                              />
                            </div>
                            {splitCashAmount && Number(splitCashAmount) > 0 && Number(splitCashAmount) < totalValue && (
                              <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                <div className={`flex justify-between items-center px-3 py-2 ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>💵 Efectivo</span>
                                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCLP(Number(splitCashAmount))}</span>
                                </div>
                                <div className={`flex justify-between items-center px-3 py-2 ${isDark ? 'bg-slate-800/50' : 'bg-white'}`}>
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{PAYMENT_METHODS[paymentMethod]?.icon} {PAYMENT_METHODS[paymentMethod]?.label}</span>
                                  <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{formatCLP(totalValue - Number(splitCashAmount))}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Vuelto — solo efectivo puro */}
                        {paymentMethod === 'CASH' && (
                          <div className="mt-2 space-y-1.5">
                            <div className="relative">
                              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>$</span>
                              <input
                                type="number" min="0" step="100"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="¿Con cuánto paga?"
                                className={`w-full pl-7 pr-3 py-2.5 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                              />
                            </div>
                            {cashReceived && Number(cashReceived) >= totalValue && (
                              <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl ${isDark ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-emerald-50 border border-emerald-200'}`}>
                                <span className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Vuelto</span>
                                <span className={`text-xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCLP(Number(cashReceived) - totalValue)}</span>
                              </div>
                            )}
                            {cashReceived && Number(cashReceived) < totalValue && (
                              <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                                <span className={`text-sm font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>Falta</span>
                                <span className={`text-xl font-black ${isDark ? 'text-red-400' : 'text-red-600'}`}>{formatCLP(totalValue - Number(cashReceived))}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="h-3" />
                  </div>

                  {/* Validation banner — muestra qué falta antes de registrar */}
                  {selectedProducts.length > 0 && (() => {
                    const pending = [];
                    if (!selectedReason) pending.push('Elegí un motivo de salida');
                    if (selectedReason === 'SALE' && !paymentMethod) pending.push('Elegí un método de pago');
                    if (selectedReason === 'CREDIT' && !paymentMethod) pending.push('Elegí un método de pago');
                    if (selectedReason === 'CREDIT' && !customerName.trim()) pending.push(`Ingresá el nombre del cliente (${vocab?.credit || 'fiado'})`);
                    if (pending.length === 0) return null;
                    return (
                      <div className={`mx-4 mb-2 px-3 py-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'}`}>
                        <p className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          Falta completar:
                        </p>
                        {pending.map((msg, i) => (
                          <p key={i} className={`text-xs pl-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>• {msg}</p>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Submit button */}
                  <div className={`px-4 py-4 border-t flex-shrink-0 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
                    <button
                      onClick={handleSubmitExit}
                      disabled={submitting || !selectedReason || (['SALE','CREDIT'].includes(selectedReason) && !paymentMethod) || (selectedReason === 'CREDIT' && !customerName.trim())}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-600/25 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          {preSelectedTipoVenta === 'pedido' ? '📦 Crear Pedido' : preSelectedClienteRut ? 'Facturar Venta' : selectedReason === 'SALE' ? 'Registrar Venta' : 'Registrar Salida'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner Feedback Toast (para pistola láser) */}
      <AnimatePresence>
        {scannerFeedback && (
          <motion.div
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 ${
              scannerFeedback.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
          >
            {scannerFeedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-semibold text-sm">{scannerFeedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Picker Sheet — variantes + extras */}
      <ProductPickerSheet
        product={pickerProduct}
        isOpen={!!pickerProduct}
        onClose={() => setPickerProduct(null)}
        onConfirm={handlePickerConfirm}
        existingCartItem={pickerProduct ? selectedProducts.find(p => p.id === pickerProduct.id) : null}
      />

      {/* Receipt Modal */}
      <ExitReceiptModal
        isOpen={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          setLastExitData(null);
          setPendingExitData(null); // cancelar sin registrar si estaba pendiente
        }}
        exitData={lastExitData}
        workerName={currentWorker?.name}
        warehouseName={warehouseData.name}
        companyInfo={companyInfo}
        onEmitBoleta={dteHabilitado ? handleEmitirBoleta : null}
        emitiendo={emitiendoBoleta}
        currentWorker={currentWorker}
        onAnnul={handleAnnulSale}
        initialClienteRut={preSelectedClienteRut}
        isPending={!!pendingExitData}
      />

      {/* ===== MOBILE: Modo Escáner Continuo ===== */}
      <AnimatePresence>
        {scannerMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-[80] flex flex-col"
            style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}
          >
            {/* Header del modo escáner */}
            <div className={`flex items-center justify-between px-4 py-3 flex-shrink-0 ${
              isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-white border-b border-gray-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Modo Escáner
                  </h3>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    Apunta la cámara al código de barras
                  </p>
                </div>
              </div>
              <button
                onClick={toggleScannerMode}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>

            {/* Cámara - parte superior */}
            <div className="flex-shrink-0 relative" style={{ height: '35vh' }}>
              <div className="w-full h-full bg-slate-900">
                <ImprovedBarcodeScanner
                  onScanSuccess={handleScanSuccess}
                  onClose={toggleScannerMode}
                  products={warehouseProducts}
                  inline={true}
                />
              </div>

              {/* Feedback de último escaneo sobre la cámara */}
              <AnimatePresence>
                {lastScannedItem && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="absolute bottom-3 left-3 right-3"
                  >
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl ${
                      lastScannedItem.isNew
                        ? 'bg-emerald-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}>
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{lastScannedItem.name}</p>
                        <p className="text-[10px] opacity-80">
                          {lastScannedItem.isNew ? 'Agregado' : 'Actualizado'} · {lastScannedItem.qty} {lastScannedItem.unit}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Carrito - parte inferior scrollable */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Resumen rápido */}
              <div className={`px-4 py-2.5 flex items-center justify-between flex-shrink-0 ${
                isDark ? 'bg-slate-800/50 border-b border-slate-700/50' : 'bg-gray-50 border-b border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  <ShoppingCart className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {(currentWorker?.role === 'ADMIN' || currentWorker?.role === 'ENCARGADA' || currentWorker?.role === 'VENDEDORA') && totalValue > 0 && (
                  <span className={`text-sm font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {formatCLP(totalValue)}
                  </span>
                )}
              </div>

              {/* Lista de productos del carrito */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {selectedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <ScanBarcode className={`w-10 h-10 mb-2 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
                    <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      Escanea productos para agregarlos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <AnimatePresence>
                      {selectedProducts.map(renderCartItem)}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Motivo + botón registrar */}
              {selectedProducts.length > 0 && (
                <div className={`px-4 py-3 flex-shrink-0 space-y-2.5 ${
                  isDark ? 'border-t border-slate-800 bg-slate-900' : 'border-t border-gray-200 bg-white'
                }`}>
                  {/* Cajera/Vendedora: solo método de pago */}
                  {(currentWorker?.role === 'CAJERA' || currentWorker?.role === 'VENDEDORA') ? (
                    <>
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                        {Object.entries(PAYMENT_METHODS).map(([key, pm]) => (
                          <button
                            key={key}
                            onClick={() => { setPaymentMethod(key); setSelectedReason('SALE'); if (key !== 'CREDIT') setFiadoNombre(''); }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors ${
                              paymentMethod === key
                                ? key === 'CREDIT'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-emerald-600 text-white'
                                : isDark
                                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <span>{pm.icon}</span>
                            {pm.label}
                          </button>
                        ))}
                      </div>
                      {paymentMethod === 'CREDIT' && (
                        <input
                          type="text"
                          value={fiadoNombre}
                          onChange={e => setFiadoNombre(e.target.value)}
                          placeholder="Nombre del cliente (requerido)"
                          className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none ${
                            isDark
                              ? 'bg-slate-800 border-orange-500/50 text-white placeholder-slate-500 focus:border-orange-400'
                              : 'bg-orange-50 border-orange-300 text-gray-800 placeholder-gray-400 focus:border-orange-400'
                          }`}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Motivos — scroll horizontal */}
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                        {[
                          { value: 'SALE',      label: 'Venta',      icon: '💰' },
                          { value: 'CREDIT',    label: EXIT_REASONS.CREDIT?.name || 'Fiado', icon: '🤝' },
                          { value: 'PRODUCTION',label: 'Producción', icon: '🏭' },
                          { value: 'WASTE',     label: 'Merma',      icon: '🗑️' },
                          { value: 'TRANSFER',  label: 'Traslado',   icon: '📦' },
                        ].map(reason => (
                          <button
                            key={reason.value}
                            onClick={() => { setSelectedReason(reason.value); setPaymentMethod(null); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                              selectedReason === reason.value
                                ? 'bg-blue-600 text-white'
                                : isDark
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <span>{reason.icon}</span>
                            {reason.label}
                          </button>
                        ))}
                      </div>
                      {/* Métodos de pago — scroll horizontal, solo si es venta */}
                      {(selectedReason === 'SALE' || selectedReason === 'CREDIT') && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                          {Object.entries(PAYMENT_METHODS)
                            .filter(([key]) => selectedReason === 'CREDIT' ? key === 'CREDIT' : key !== 'CREDIT')
                            .map(([key, pm]) => (
                              <button
                                key={key}
                                onClick={() => setPaymentMethod(key)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors ${
                                  paymentMethod === key
                                    ? 'bg-emerald-600 text-white'
                                    : isDark
                                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}
                              >
                                <span>{pm.icon}</span>
                                {pm.label}
                              </button>
                            ))}
                        </div>
                      )}
                      {/* Campo nombre para fiado */}
                      {selectedReason === 'CREDIT' && (
                        <input
                          type="text"
                          value={fiadoNombre}
                          onChange={e => setFiadoNombre(e.target.value)}
                          placeholder="Nombre del cliente (requerido)"
                          className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none ${
                            isDark
                              ? 'bg-slate-800 border-orange-500/50 text-white placeholder-slate-500 focus:border-orange-400'
                              : 'bg-orange-50 border-orange-300 text-gray-800 placeholder-gray-400 focus:border-orange-400'
                          }`}
                        />
                      )}
                    </>
                  )}

                  {/* Validation banner — muestra qué falta antes de registrar */}
                  {selectedProducts.length > 0 && (() => {
                    const pending = [];
                    if (!selectedReason) pending.push('Elegí un motivo de salida');
                    if (selectedReason === 'SALE' && !paymentMethod) pending.push('Elegí un método de pago');
                    if (selectedReason === 'CREDIT' && !paymentMethod) pending.push('Elegí un método de pago');
                    if (selectedReason === 'CREDIT' && !fiadoNombre.trim()) pending.push(`Ingresá el nombre del cliente (${vocab?.credit || 'fiado'})`);
                    if (pending.length === 0) return null;
                    return (
                      <div className={`px-3 py-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'}`}>
                        <p className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          Falta completar:
                        </p>
                        {pending.map((msg, i) => (
                          <p key={i} className={`text-xs pl-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>• {msg}</p>
                        ))}
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => {
                      setScannerMode(false);
                      setShowScanner(false);
                      handleSubmitExit();
                    }}
                    disabled={submitting || !selectedReason || (['SALE','CREDIT'].includes(selectedReason) && !paymentMethod) || (selectedReason === 'CREDIT' && !fiadoNombre.trim())}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/25 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {preSelectedTipoVenta === 'pedido' ? '📦 Crear Pedido' : preSelectedClienteRut ? 'Facturar Venta' : selectedReason === 'SALE' ? 'Registrar Venta' : 'Registrar Salida'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MODAL: Ingresar peso ===== */}
      <AnimatePresence>
        {weightModal.open && weightModal.product && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setWeightModal({ open: false, product: null })}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${
                isDark ? 'bg-slate-800' : 'bg-white'
              }`}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
                <div className="flex items-center gap-2.5">
                  <Scale className="w-5 h-5" />
                  <div>
                    <h3 className="font-bold text-base">Ingresar peso</h3>
                    <p className="text-xs opacity-80 truncate">{weightModal.product.name}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {(() => {
                  const isKg = weightModal.product.unit?.toLowerCase().trim() === 'kg';
                  const stockKg = parseFloat(weightModal.product.stock) || 0;
                  const quickVals = isKg ? [100, 250, 500, 1000] : [0.25, 0.5, 1, 2, 5];
                  return (
                    <>
                      <div className={`flex items-center justify-between text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        <span>Stock disponible:</span>
                        <span className="font-bold">
                          {isKg ? `${(stockKg * 1000).toFixed(0)} g (${stockKg} kg)` : `${stockKg} ${weightModal.product.unit}`}
                        </span>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                          {isKg ? 'Cantidad (gramos)' : `Cantidad (${weightModal.product.unit})`}
                        </label>
                        <input
                          type="number"
                          step={isKg ? '1' : '0.01'}
                          min={isKg ? '1' : '0.01'}
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleWeightConfirm(); }}
                          autoFocus
                          placeholder={isKg ? 'Ej: 140' : 'Ej: 0.350'}
                          className={`w-full px-4 py-3 text-xl font-bold text-center rounded-xl border-2 transition focus:outline-none ${
                            isDark
                              ? 'bg-slate-700 border-slate-600 text-white focus:border-amber-500 placeholder-slate-500'
                              : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500 placeholder-gray-400'
                          }`}
                        />
                        {isKg && weightInput && parseFloat(weightInput) > 0 && (
                          <p className={`text-xs text-center mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                            = {(parseFloat(weightInput) / 1000).toFixed(3)} kg
                          </p>
                        )}
                      </div>

                      {/* Quick weight buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {quickVals.filter(v => isKg ? (v / 1000) <= stockKg : v <= stockKg).map(val => (
                          <button
                            key={val}
                            onClick={() => setWeightInput(String(val))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            {isKg ? `${val} g` : `${val} ${weightModal.product.unit}`}
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setWeightModal({ open: false, product: null })}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition ${
                      isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleWeightConfirm}
                    disabled={!weightInput || parseFloat(weightInput) <= 0}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {/* Modal Combos */}
      {showComboModal && (
        <ComboSaleModal
          onClose={() => setShowComboModal(false)}
          onAddCombo={handleAddCombo}
          warehouseProducts={warehouseProducts}
        />
      )}
    </div>
  );
};

export default InventoryExit;