// src/pages/InventoryExitsReport.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown,
  Calendar,
  User,
  Package,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Warehouse,
  X,
  Clock,
  Users,
  XCircle,
  Loader,
  AlertCircle,
  Trophy,
  Medal,
  Crown,
  BarChart3
} from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from '../services/companyService.js';
import { annulInventoryExit, annulInventoryExitItem, markCreditAsPaid } from '../services/inventory-exits-service.js';
import { getAllCustomers } from '../services/customers-service.js';
import { getCashRegisterHistory, getExitsByCashRegister, getCashMovements, PAYMENT_METHODS } from '../services/cash-register-service.js';
import { useToast, ToastContainer } from '../components/ui/Toast.jsx';
import { auth } from '../firebase/firebase.js';
import { getWorkerByEmail } from '../services/workers-service.js';
import { SUPER_ADMIN_EMAIL } from '../config/env.js';

const InventoryExitsReport = () => {
  const [exits, setExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerNameMap, setCustomerNameMap] = useState({}); // rut → nombre
  const [exitCustomerMap, setExitCustomerMap] = useState({}); // exitId → {nombre, rut}
  const [filteredExits, setFilteredExits] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const getDefaultDateRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d) => d.toISOString().split('T')[0];
    return { dateFrom: fmt(firstDay), dateTo: fmt(lastDay) };
  };

  const [filters, setFilters] = useState({
    ...getDefaultDateRange(),
    worker: '',
    warehouse: '',
    reason: '',
    status: 'all'
  });
  const [workers, setWorkers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [annullingId, setAnnullingId] = useState(null);
  const [showAnnulModal, setShowAnnulModal] = useState(false);
  const [exitToAnnul, setExitToAnnul] = useState(null);
  const [annulReason, setAnnulReason] = useState('');
  // Anulación parcial
  const [annulItemTarget, setAnnulItemTarget] = useState(null); // { exit, product }
  const [annullingItem, setAnnullingItem] = useState(false);
  const [activeTab, setActiveTab] = useState('historial'); // 'ranking' | 'historial' | 'fiados' | 'caja'
  const [cashRegisters, setCashRegisters] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [expandedRegister, setExpandedRegister] = useState(null);
  const [registerExits, setRegisterExits] = useState({}); // { registerId: [exits] }
  const [registerMovements, setRegisterMovements] = useState({}); // { registerId: [withdrawals] }
  const [cashWorkerFilter, setCashWorkerFilter] = useState(''); // filtro propio del tab Caja, no comparte state con el tab Historial
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [expandedCredits, setExpandedCredits] = useState({});
  // null = dueño (ve todo), array = inventarios asignados del trabajador
  const [assignedInventories, setAssignedInventories] = useState(null);
  const [currentWorker, setCurrentWorker] = useState(null);
  const [resolvedCompanyId, setResolvedCompanyId] = useState(null);
  const toast = useToast();

  const EXIT_REASONS = {
    SALE: { name: "Venta", color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400", icon: "💰" },
    WASTE: { name: "Merma", color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400", icon: "🗑️" },
    TRANSFER: { name: "Transferencia", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400", icon: "📦" },
    PRODUCTION: { name: "Producción", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400", icon: "🏭" },
    CONSUMPTION: { name: "Consumo", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400", icon: "🔧" },
    CREDIT: { name: "Fiado", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400", icon: "🤝" },
    OTHER: { name: "Otro", color: "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400", icon: "❓" }
  };

  const [reloading, setReloading] = useState(false);

  const reloadExits = async () => {
    setReloading(true);
    try {
      const companyId = await resolveCompanyId();
      if (!companyId) return;
      const exitsQuery = query(
        collection(db, `companies/${companyId}/inventory_exits`),
        orderBy('createdAt', 'desc'),
        limit(1000)
      );
      const snapshot = await getDocs(exitsQuery);
      let exitsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Date
            ? data.createdAt
            : data.createdAt?.toDate?.() || new Date()
        };
      });
      if (assignedInventories && assignedInventories.length > 0) {
        exitsData = exitsData.filter(e => assignedInventories.includes(e.inventoryId));
      }
      setExits(exitsData);
    } catch (e) {
      console.error('Error recargando exits:', e);
    } finally {
      setReloading(false);
    }
  };

  // Cargar datos iniciales + listener en tiempo real para salidas
  useEffect(() => {
    let unsubExits = null;

    const init = async () => {
      setLoading(true);
      try {
        // Determinar inventarios permitidos para este usuario
        let allowedInventories = null; // null = ver todo
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email !== SUPER_ADMIN_EMAIL) {
          try {
            // Si el token tiene role ADMIN, ve todo sin restricciones
            const tokenResult = await currentUser.getIdTokenResult();
            const roleFromClaims = tokenResult.claims.role;
            const isAdminRole = roleFromClaims === 'ADMIN' || roleFromClaims === 'SUPER_ADMIN' || !roleFromClaims;

            if (!isAdminRole) {
              // Solo buscar inventarios asignados para roles no-admin
              const workerData = await getWorkerByEmail(currentUser.email);
              if (workerData) {
                setCurrentWorker(workerData);
                if (Array.isArray(workerData.assignedInventories) && workerData.assignedInventories.length > 0) {
                  allowedInventories = workerData.assignedInventories;
                }
              }
            }
          } catch (e) {
            console.warn('No se pudo determinar inventarios asignados, mostrando todo:', e.message);
          }
        }
        setAssignedInventories(allowedInventories);

        // Resolver companyId una sola vez (funciona con impersonación)
        const cid = await resolveCompanyId();
        setResolvedCompanyId(cid);

        // Cargar mapa RUT → nombre  +  exitId → {nombre, rut}  desde clientes
        try {
          const allCustomers = await getAllCustomers();
          const rutMap = {};
          const exitMap = {};
          const normalize = (r) => String(r || '').replace(/\./g, '').toUpperCase().trim();
          allCustomers.forEach(c => {
            const nombre = c.razonSocial || c.nombre || c.name || '';
            if (c.rut) rutMap[normalize(c.rut)] = nombre;
            // Cruzar exitId → cliente desde el array documentos de cada cliente
            if (Array.isArray(c.documentos)) {
              c.documentos.forEach(d => {
                if (d.exitId) exitMap[d.exitId] = { nombre, rut: c.rut || '' };
              });
            }
          });
          setCustomerNameMap(rutMap);
          setExitCustomerMap(exitMap);
        } catch (e) {
          console.warn('No se pudo cargar mapa de clientes:', e.message);
        }

        await Promise.all([loadWorkers(), loadWarehouses(allowedInventories)]);
        unsubExits = await subscribeToExits(allowedInventories);
      } catch (error) {
        console.error('Error cargando datos:', error);
        toast.error('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => { if (unsubExits) unsubExits(); };
  }, []);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [exits, filters]);

  // Obtiene companyId — funciona tanto en modo normal como impersonando como SA
  const resolveCompanyId = async () => {
    // Si está impersonando, el companyId está en sessionStorage
    try {
      const raw = sessionStorage.getItem('impersonation');
      if (raw) {
        const imp = JSON.parse(raw);
        if (imp?.companyId) return imp.companyId;
      }
    } catch {}
    return await getUserCompanyId();
  };

  const subscribeToExits = async (allowedInventories = null) => {
    try {
      const companyId = await resolveCompanyId();
      if (!companyId) {
        toast.error('Error: No se pudo identificar la empresa');
        return null;
      }

      const exitsQuery = query(
        collection(db, `companies/${companyId}/inventory_exits`),
        orderBy('createdAt', 'desc'),
        limit(1000)
      );

      const processSnapshot = (snapshot) => {
        let exitsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt instanceof Date
              ? data.createdAt
              : data.createdAt?.toDate?.() || new Date()
          };
        });

        if (allowedInventories && allowedInventories.length > 0) {
          exitsData = exitsData.filter(exit => allowedInventories.includes(exit.inventoryId));
        }

        setExits(exitsData);
        console.log('📊 Total salidas:', exitsData.length);
      };

      // Intentar onSnapshot primero, fallback a getDocs si falla
      try {
        return onSnapshot(exitsQuery, processSnapshot, async (snapError) => {
          console.warn('⚠️ onSnapshot falló, usando getDocs:', snapError.message);
          try {
            const snapshot = await getDocs(exitsQuery);
            processSnapshot(snapshot);
          } catch (e) {
            console.error('getDocs también falló:', e);
          }
        });
      } catch {
        // Si onSnapshot ni siquiera arranca, usar getDocs
        const snapshot = await getDocs(exitsQuery);
        processSnapshot(snapshot);
        return null;
      }
    } catch (error) {
      console.error('Error cargando salidas:', error);
      toast.error('Error al cargar las salidas');
      return null;
    }
  };

  const loadWorkers = async () => {
    try {
      const companyId = await resolveCompanyId();
      if (!companyId) return;

      const workersQuery = query(collection(db, `companies/${companyId}/workers`));
      const snapshot = await getDocs(workersQuery);
      const workersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkers(workersData);
    } catch (error) {
      console.error('Error cargando trabajadores:', error);
    }
  };

  const loadWarehouses = async (allowedInventories = null) => {
    try {
      const companyId = await resolveCompanyId();
      if (!companyId) return;

      const allWarehouses = [];
      const inventoriesData = [];

      // 1. Cargar bodegas LEGACY (sistema principal) — solo si no tiene restricción de inventarios
      if (!allowedInventories || allowedInventories.length === 0) {
        try {
          const legacyWarehousesQuery = query(collection(db, `companies/${companyId}/warehouses`));
          const legacySnapshot = await getDocs(legacyWarehousesQuery);
          legacySnapshot.docs.forEach(doc => {
            allWarehouses.push({
              id: doc.id,
              ...doc.data(),
              inventoryId: 'legacy',
              inventoryName: '📦 Bodegas Principales'
            });
          });

          if (legacySnapshot.size > 0) {
            inventoriesData.push({
              id: 'legacy',
              name: '📦 Bodegas Principales'
            });
          }
        } catch (error) {
          console.warn('No hay bodegas legacy:', error);
        }
      }

      // 2. Cargar inventarios NUEVOS con sus bodegas
      try {
        const inventoriesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories`));

        for (const invDoc of inventoriesSnapshot.docs) {
          // Si tiene inventarios asignados, solo cargar los permitidos
          if (allowedInventories && allowedInventories.length > 0 && !allowedInventories.includes(invDoc.id)) {
            continue;
          }

          const invData = invDoc.data();
          const inventory = {
            id: invDoc.id,
            name: invData.name || invData.nombre || 'Sin nombre'
          };

          // Cargar bodegas de este inventario
          const warehousesSnapshot = await getDocs(
            collection(db, `companies/${companyId}/inventories/${invDoc.id}/warehouses`)
          );

          warehousesSnapshot.docs.forEach(whDoc => {
            allWarehouses.push({
              id: whDoc.id,
              ...whDoc.data(),
              inventoryId: invDoc.id,
              inventoryName: inventory.name
            });
          });

          if (warehousesSnapshot.size > 0) {
            inventoriesData.push(inventory);
          }
        }
      } catch (error) {
        console.warn('Error cargando inventarios:', error);
      }

      console.log('📦 Total bodegas cargadas:', allWarehouses.length);
      console.log('📦 Total inventarios:', inventoriesData.length);
      setWarehouses(allWarehouses);
      setInventories(inventoriesData);

    } catch (error) {
      console.error('Error cargando bodegas:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...exits];

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(exit => exit.createdAt >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59);
      filtered = filtered.filter(exit => exit.createdAt <= toDate);
    }

    if (filters.worker) {
      filtered = filtered.filter(exit =>
        exit.workerName?.toLowerCase().includes(filters.worker.toLowerCase()) ||
        exit.workerId === filters.worker
      );
    }

    if (filters.warehouse) {
      filtered = filtered.filter(exit =>
        exit.warehouseName?.toLowerCase().includes(filters.warehouse.toLowerCase()) ||
        exit.warehouseId === filters.warehouse
      );
    }

    if (filters.reason) {
      filtered = filtered.filter(exit => exit.reason === filters.reason);
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        filtered = filtered.filter(exit => exit.status !== 'cancelled');
      } else if (filters.status === 'cancelled') {
        filtered = filtered.filter(exit => exit.status === 'cancelled');
      }
    }

    setFilteredExits(filtered);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      ...getDefaultDateRange(),
      worker: '',
      warehouse: '',
      reason: '',
      status: 'all'
    });
  };

  // Anular venta o transferencia - Abrir modal
  const handleAnnulSale = (exit) => {
    if (exit.reason !== 'SALE' && exit.reason !== 'TRANSFER') {
      toast.addToast('Solo se pueden anular ventas y transferencias', 'error');
      return;
    }
    setExitToAnnul(exit);
    setAnnulReason('');
    setShowAnnulModal(true);
  };

  const handleAnnulItem = async () => {
    if (!annulItemTarget) return;
    setAnnullingItem(true);
    try {
      const userEmail = auth.currentUser?.email || 'unknown';
      await annulInventoryExitItem(annulItemTarget.exit.id, annulItemTarget.product.productId, userEmail);
      toast.addToast(`✅ Producto "${annulItemTarget.product.productName || annulItemTarget.product.name}" quitado. Stock restaurado.`, 'success');
      setAnnulItemTarget(null);
      // Refrescar datos
      await loadData();
    } catch (e) {
      toast.addToast(e.message || 'Error al anular el producto', 'error');
    } finally {
      setAnnullingItem(false);
    }
  };

  // Confirmar anulación
  const confirmAnnulSale = async () => {
    if (!annulReason.trim()) {
      toast.addToast('Por favor ingresa un motivo', 'error');
      return;
    }

    try {
      setAnnullingId(exitToAnnul.id);
      const userEmail = auth.currentUser?.email || 'unknown';

      await annulInventoryExit(exitToAnnul.id, userEmail, annulReason.trim());

      toast.addToast('✅ Venta anulada correctamente. Stock restaurado.', 'success');

      // Cerrar modal y limpiar
      setShowAnnulModal(false);
      setExitToAnnul(null);
      setAnnulReason('');

      // Datos se actualizan automáticamente via onSnapshot
    } catch (error) {
      console.error('Error anulando venta:', error);
      toast.addToast(`❌ Error: ${error.message}`, 'error');
    } finally {
      setAnnullingId(null);
    }
  };

  // Agrupar salidas por trabajador y fecha
  const groupExitsByWorkerAndDate = (exits, warehousesList) => {
    const grouped = {};

    exits.forEach(exit => {
      // Asegurar que createdAt sea un Date válido
      const createdAt = exit.createdAt instanceof Date
        ? exit.createdAt
        : exit.createdAt?.toDate?.() || new Date();
      const date = createdAt.toLocaleDateString('es-CL');
      const workerKey = `${exit.workerId || exit.workerName}-${date}`;

      if (!grouped[workerKey]) {
        grouped[workerKey] = {
          workerId: exit.workerId,
          workerName: exit.workerName,
          date: createdAt,
          dateString: date,
          exits: [],
          warehouses: new Set(),
          inventories: new Set(),
          totalExits: 0,
          productsWithUnits: {} // Para agrupar por unidad (Kg, L, etc.)
        };
      }

      grouped[workerKey].exits.push(exit);
      grouped[workerKey].totalExits++;

      // Agregar bodega al set (buscar nombre por ID si no existe warehouseName)
      let warehouseName = exit.warehouseName;

      // Si no tiene warehouseName pero tiene warehouseId, buscar el nombre
      if (!warehouseName && exit.warehouseId && warehousesList) {
        const warehouse = warehousesList.find(w => w.id === exit.warehouseId);
        warehouseName = warehouse?.name;
      }

      if (warehouseName) {
        grouped[workerKey].warehouses.add(warehouseName);
      }

      // Agregar inventario si existe
      if (exit.inventoryName) {
        grouped[workerKey].inventories.add(exit.inventoryName);
      }

      // Contar productos con sus unidades reales
      const itemsList = exit.products || exit.items || [];
      itemsList.forEach(product => {
        const qty = product.quantity || product.qty || 0;
        const unit = product.unit || 'unidades';

        if (!grouped[workerKey].productsWithUnits[unit]) {
          grouped[workerKey].productsWithUnits[unit] = 0;
        }
        grouped[workerKey].productsWithUnits[unit] += qty;
      });
    });

    // Convertir a array y ordenar por fecha (más reciente primero)
    return Object.values(grouped)
      .map(group => ({
        ...group,
        warehouses: Array.from(group.warehouses),
        inventories: Array.from(group.inventories)
      }))
      .sort((a, b) => b.date - a.date);
  };

  const groupedExits = groupExitsByWorkerAndDate(filteredExits, warehouses);

  const toggleGroup = (workerKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [workerKey]: !prev[workerKey]
    }));
  };

  const getTotalStats = () => {
    let totalProducts = 0;
    let totalSalesValue = 0;
    const uniqueWorkers = new Set();
    const valueByReason = {};
    let totalCreditPending = 0;

    filteredExits.forEach(exit => {
      uniqueWorkers.add(exit.workerId || exit.workerName);
      const itemsList = exit.items || exit.products;
      if (itemsList && Array.isArray(itemsList)) {
        totalProducts += itemsList.reduce((sum, product) => sum + (product.quantity || 0), 0);
      } else {
        totalProducts += exit.totalProducts || 0;
      }

      // Sumar valor por motivo (excluyendo canceladas)
      // Para CREDIT, solo contar los pendientes (no pagados)
      if (exit.status !== 'cancelled' && exit.totalValue) {
        if (exit.reason === 'CREDIT' && exit.creditStatus === 'paid') {
          // fiado ya pagado: no lo sumamos al desglose de "Fiado"
        } else {
          if (!valueByReason[exit.reason]) valueByReason[exit.reason] = 0;
          valueByReason[exit.reason] += exit.totalValue;
        }
      }

      // Sumar el valor total de VENTAS + fiados ya pagados (excluir anuladas)
      if (exit.status !== 'cancelled' && exit.reason === 'SALE' && exit.totalValue) {
        totalSalesValue += exit.totalValue;
      }
      if (exit.status !== 'cancelled' && exit.reason === 'CREDIT' && exit.creditStatus === 'paid' && exit.totalValue) {
        totalSalesValue += exit.totalValue;
      }

      // Sumar fiados pendientes
      if (exit.reason === 'CREDIT' && exit.creditStatus === 'pending' && exit.status !== 'cancelled') {
        totalCreditPending += exit.totalValue || 0;
      }
    });

    return {
      totalExits: filteredExits.length,
      totalProducts,
      averageProducts: filteredExits.length > 0 ? totalProducts / filteredExits.length : 0,
      uniqueWorkers: uniqueWorkers.size,
      groupedSessions: groupedExits.length,
      totalSalesValue,
      valueByReason,
      totalCreditPending
    };
  };

  const stats = getTotalStats();

  // ========== RANKING DE VENDEDORES ==========
  const getSellerRanking = () => {
    const sellerMap = {};

    filteredExits.forEach(exit => {
      if (exit.status === 'cancelled') return;

      const key = exit.workerId || exit.workerName || 'Desconocido';
      if (!sellerMap[key]) {
        sellerMap[key] = {
          name: exit.workerName || 'Sin nombre',
          totalSales: 0,
          totalAmount: 0,
          totalProducts: 0,
          totalWaste: 0,
          totalTransfers: 0,
          salesByDay: {},
          topProducts: {}
        };
      }

      const seller = sellerMap[key];
      const items = exit.products || exit.items || [];
      const qty = items.reduce((sum, p) => sum + (p.quantity || p.qty || 0), 0);

      if (exit.reason === 'SALE' || (exit.reason === 'CREDIT' && exit.creditStatus === 'paid')) {
        seller.totalSales++;
        seller.totalAmount += exit.totalValue || 0;
        seller.totalProducts += qty;

        // Ventas por día
        const day = exit.createdAt.toLocaleDateString('es-CL');
        seller.salesByDay[day] = (seller.salesByDay[day] || 0) + 1;

        // Top productos vendidos
        items.forEach(p => {
          const pName = p.productName || p.itemName || 'Producto';
          if (!seller.topProducts[pName]) seller.topProducts[pName] = 0;
          seller.topProducts[pName] += p.quantity || p.qty || 0;
        });
      } else if (exit.reason === 'WASTE') {
        seller.totalWaste += qty;
      } else if (exit.reason === 'TRANSFER') {
        seller.totalTransfers += qty;
      }
    });

    return Object.values(sellerMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .map((seller, index) => ({
        ...seller,
        rank: index + 1,
        avgPerSale: seller.totalSales > 0 ? seller.totalAmount / seller.totalSales : 0,
        daysActive: Object.keys(seller.salesByDay).length,
        avgSalesPerDay: Object.keys(seller.salesByDay).length > 0
          ? seller.totalSales / Object.keys(seller.salesByDay).length
          : 0,
        topProductsList: Object.entries(seller.topProducts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      }));
  };

  const sellerRanking = getSellerRanking();

  const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

  // Cargar historial de caja cuando se activa el tab
  useEffect(() => {
    if (activeTab !== 'caja') return;
    if (cashRegisters.length > 0) return; // ya cargado
    setCashLoading(true);
    getCashRegisterHistory({ limitCount: 100, companyId: resolvedCompanyId || undefined })
      .then(async (data) => {
        // Para cajas abiertas, calcular totalSales en tiempo real desde inventory_exits
        const enriched = await Promise.all(data.map(async (reg) => {
          if (reg.status !== 'open') return reg;
          try {
            const exits = await getExitsByCashRegister(reg.id, resolvedCompanyId || undefined);
            const liveTotal = exits.reduce((sum, e) => sum + (e.totalValue || 0), 0);
            const liveSalesCount = exits.length;
            let liveCash = 0, liveCard = 0, liveTransfer = 0, liveOther = 0;
            exits.forEach(e => {
              const amount = e.totalValue || 0;
              if (e.splitPayment && e.splitCashAmount > 0) {
                liveCash += e.splitCashAmount;
                const cardPart = amount - e.splitCashAmount;
                if (e.paymentMethod === 'CARD') liveCard += cardPart;
                else if (e.paymentMethod === 'TRANSFER') liveTransfer += cardPart;
                else liveOther += cardPart;
              } else {
                if (e.paymentMethod === 'CASH') liveCash += amount;
                else if (e.paymentMethod === 'CARD') liveCard += amount;
                else if (e.paymentMethod === 'TRANSFER') liveTransfer += amount;
                else liveOther += amount;
              }
            });
            // Si workerName está vacío, buscar por workerId en workers
            let workerName = reg.workerName;
            if (!workerName && reg.workerId) {
              try {
                const companyId = await resolveCompanyId();
                const { doc: firestoreDoc, getDoc: firestoreGetDoc } = await import('firebase/firestore');
                const { db: firestoreDb } = await import('../firebase/firebase.js');
                const wSnap = await firestoreGetDoc(firestoreDoc(firestoreDb, `companies/${companyId}/workers`, reg.workerId));
                if (wSnap.exists()) workerName = wSnap.data().name || workerName;
              } catch { /* silencioso */ }
            }
            return { ...reg, workerName, totalSales: liveTotal, salesCount: liveSalesCount, totalCash: liveCash, totalCard: liveCard, totalTransfer: liveTransfer, totalOther: liveOther };
          } catch {
            return reg;
          }
        }));
        setCashRegisters(enriched);
      })
      .catch(e => console.error('Error cargando historial de caja:', e))
      .finally(() => setCashLoading(false));
  }, [activeTab, resolvedCompanyId]);

  const loadRegisterExits = async (registerId) => {
    if (registerExits[registerId]) {
      setExpandedRegister(expandedRegister === registerId ? null : registerId);
      return;
    }
    try {
      const [exits, movements] = await Promise.all([
        getExitsByCashRegister(registerId, resolvedCompanyId || undefined),
        getCashMovements(registerId, resolvedCompanyId || undefined).catch(() => []),
      ]);
      setRegisterExits(prev => ({ ...prev, [registerId]: exits }));
      setRegisterMovements(prev => ({ ...prev, [registerId]: movements }));
      setExpandedRegister(registerId);
    } catch (e) {
      console.error('Error cargando ventas del turno:', e);
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-700" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">#{rank}</span>;
  };

  const getRankBorder = (rank) => {
    if (rank === 1) return 'border-yellow-400 dark:border-yellow-600 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-slate-800 dark:to-slate-800';
    if (rank === 2) return 'border-gray-300 dark:border-gray-600 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-slate-800 dark:to-slate-800';
    if (rank === 3) return 'border-amber-500 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800';
    return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
  };

  const exportToPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Salidas de Inventario', 20, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 20, 30);
      doc.text(`Total de sesiones: ${groupedExits.length}`, 20, 36);
      doc.text(`Total de salidas individuales: ${filteredExits.length}`, 20, 42);

      const tableData = groupedExits.map(group => {
        const unitsStr = Object.entries(group.productsWithUnits)
          .map(([unit, qty]) => `${qty} ${unit}`)
          .join(', ');

        return [
          group.dateString,
          group.workerName || 'N/A',
          group.inventories.join(', ') || 'Principal',
          group.warehouses.join(', ') || 'N/A',
          `${group.totalExits} salidas`,
          unitsStr
        ];
      });

      autoTable(doc, {
        head: [['Fecha', 'Trabajador', 'Inventario', 'Bodegas', 'Salidas', 'Productos']],
        body: tableData,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`reporte-salidas-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Reporte PDF generado correctamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      // Exportar por cada salida individual (más detallado)
      const excelData = [];
      filteredExits.forEach(exit => {
        const items = exit.products || exit.items || [];
        const _normRut = (r) => String(r || '').replace(/\./g, '').toUpperCase().trim();
        const _exRut = exit.customerRut || exit.customerInfo?.rut || exit.boleta?.receptor?.rut || exitCustomerMap[exit.id]?.rut;
        const _exCliente = exit.customerName || exit.customerInfo?.name || exit.customerInfo?.nombre || exit.boleta?.receptor?.razonSocial || exit.boleta?.receptor?.nombre || exit.fiadoNombre || exitCustomerMap[exit.id]?.nombre || (_exRut ? customerNameMap[_normRut(_exRut)] : null) || '';
        items.forEach(product => {
          const isElaborado = product.productType === 'ELABORADO';
          excelData.push({
            'Fecha': exit.createdAt?.toLocaleDateString('es-CL') || '',
            'Hora': exit.createdAt?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) || '',
            'Trabajador': exit.workerName || 'N/A',
            'Cliente': _exCliente,
            'Inventario': exit.inventoryName || 'Principal',
            'Motivo': EXIT_REASONS[exit.reason]?.name || exit.reason,
            'Producto': product.productName || product.itemName || 'Sin nombre',
            'Tipo': isElaborado ? 'Elaborado' : 'Simple',
            'Cantidad': product.quantity || product.qty || 0,
            'Unidad': product.unit || 'unidad',
            'Precio Unitario': product.unitValue || product.ppp || 0,
            'Total': product.totalValue || 0,
            'Ingredientes descontados': isElaborado && product.receta
              ? product.receta.map(i => `${i.insumoNombre}: ${Number(i.cantidad) * (product.quantity || 1)} ${i.unidad}`).join(' | ')
              : '',
            'Estado': exit.status === 'cancelled' ? 'Anulado' : 'Activo'
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Salidas de Inventario');

      XLSX.writeFile(wb, `reporte-salidas-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Reporte Excel generado correctamente');
    } catch (error) {
      console.error('Error generando Excel:', error);
      toast.error('Error al generar el Excel');
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando reportes...</p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 pb-safe-nav"
    >
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">Reportes</h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Ranking de vendedores e historial de salidas</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportToPDF}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportToExcel}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </motion.button>
              <div className="flex items-center gap-1 px-1 py-1 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-700 dark:text-green-400 font-medium px-1">En vivo</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('historial')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === 'historial'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">Historial</span>
            </button>
            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === 'ranking'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              <Trophy className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">Ranking</span>
            </button>
            <button
              onClick={() => setActiveTab('fiados')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === 'fiados'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              <span className="text-base leading-none">🤝</span>
              <span className="hidden xs:inline sm:inline">Fiados</span>
              {stats.totalCreditPending > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full leading-none border border-white/30">
                  {filteredExits.filter(e => e.reason === 'CREDIT' && e.creditStatus !== 'paid' && e.status !== 'cancelled').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('caja')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === 'caja'
                  ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-500/25'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-green-400 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-400'
              }`}
            >
              <span className="text-base leading-none">💵</span>
              <span className="hidden xs:inline sm:inline">Caja</span>
            </button>
            <button
              onClick={() => setActiveTab('comisiones')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === 'comisiones'
                  ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400'
              }`}
            >
              <span className="text-base leading-none">🛍️</span>
              <span className="hidden xs:inline sm:inline">Comis.</span>
            </button>
          </div>
        </motion.div>

        {/* Estadísticas - siempre visibles */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Sesiones</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.groupedSessions}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Salidas</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalExits}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Productos</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalProducts}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Trabajadores</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.uniqueWorkers}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-green-200 dark:border-green-700 p-4 bg-gradient-to-br from-green-50 dark:from-green-900/20 to-white dark:to-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Ventas</p>
                <p className="text-lg font-extrabold text-green-700 dark:text-green-400">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP'
                  }).format(stats.totalSalesValue || 0)}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Desglose por Motivo */}
        {Object.keys(stats.valueByReason || {}).length > 1 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            {Object.entries(stats.valueByReason).map(([reason, value]) => (
              <div
                key={reason}
                className={`rounded-lg p-3 text-center ${EXIT_REASONS[reason]?.color || 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400'}`}
              >
                <span className="text-lg">{EXIT_REASONS[reason]?.icon || '📦'}</span>
                <p className="text-xs font-semibold mt-1">{EXIT_REASONS[reason]?.name || reason}</p>
                <p className="text-sm font-bold">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ==================== RANKING TAB ==================== */}
        {activeTab === 'ranking' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 mb-6"
          >
            {sellerRanking.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
                <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No hay ventas registradas</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Las ventas aparecerán aquí con su ranking</p>
              </div>
            ) : (
              sellerRanking.map((seller, index) => (
                <motion.div
                  key={seller.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={`rounded-xl shadow-sm border-2 p-5 ${getRankBorder(seller.rank)}`}
                >
                  {/* Header del vendedor */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0">
                      {getRankIcon(seller.rank)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{seller.name}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{seller.daysActive} día{seller.daysActive !== 1 ? 's' : ''} activo{seller.daysActive !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-extrabold text-green-700 dark:text-emerald-400">{CLP(seller.totalAmount)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total vendido</p>
                    </div>
                  </div>

                  {/* Comisión si tiene configurada */}
                  {(() => {
                    const workerData = workers.find(w => w.name === seller.name || w.id === seller.name || w.email === seller.name);
                    if (!workerData || workerData.commissionPercent == null) return null;
                    const sinIva = seller.totalAmount / 1.19;
                    const comision = (sinIva * workerData.commissionPercent) / 100;
                    return (
                      <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/30 rounded-xl px-4 py-3 mb-4">
                        <div className="text-sm text-purple-700 dark:text-purple-300">
                          <span className="font-semibold">Comisión a pagar</span>
                          <span className="text-xs ml-2 opacity-70">({workerData.commissionPercent}% sobre {CLP(Math.round(sinIva))} sin IVA)</span>
                        </div>
                        <p className="text-xl font-extrabold text-purple-700 dark:text-purple-300">{CLP(Math.round(comision))}</p>
                      </div>
                    );
                  })()}

                  {/* Métricas en grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white dark:bg-slate-700 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-600">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{seller.totalSales}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ventas</p>
                    </div>
                    <div className="bg-white dark:bg-slate-700 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-600">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{seller.totalProducts.toFixed(0)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Productos</p>
                    </div>
                    <div className="bg-white dark:bg-slate-700 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-600">
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{CLP(seller.avgPerSale)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Promedio/venta</p>
                    </div>
                    <div className="bg-white dark:bg-slate-700 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-600">
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{seller.avgSalesPerDay.toFixed(1)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ventas/día</p>
                    </div>
                  </div>

                  {/* Merma y transferencias si hay */}
                  {(seller.totalWaste > 0 || seller.totalTransfers > 0) && (
                    <div className="flex gap-3 mb-4">
                      {seller.totalWaste > 0 && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-full font-medium">
                          Merma: {seller.totalWaste.toFixed(0)} productos
                        </span>
                      )}
                      {seller.totalTransfers > 0 && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                          Transferencias: {seller.totalTransfers.toFixed(0)} productos
                        </span>
                      )}
                    </div>
                  )}

                  {/* Top productos vendidos */}
                  {seller.topProductsList.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Top productos vendidos</p>
                      <div className="space-y-1.5">
                        {seller.topProductsList.map(([name, qty], i) => {
                          const maxQty = seller.topProductsList[0]?.[1] || 1;
                          const widthPercent = (qty / maxQty) * 100;
                          return (
                            <div key={name} className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 dark:text-slate-400 w-36 truncate flex-shrink-0" title={name}>{name}</span>
                              <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-5 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${widthPercent}%` }}
                                  transition={{ delay: index * 0.08 + i * 0.05, duration: 0.5 }}
                                  className={`h-full rounded-full ${
                                    i === 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                                    i === 1 ? 'bg-gradient-to-r from-blue-400 to-indigo-400' :
                                    'bg-blue-300'
                                  }`}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-12 text-right">{qty.toFixed(0)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* ==================== HISTORIAL TAB ==================== */}
        {activeTab === 'historial' && (<>
        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 mb-6"
        >
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
            Filtros
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Fecha desde</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Fecha hasta</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Trabajador</label>
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={filters.worker}
                onChange={(e) => handleFilterChange('worker', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bodega</label>
              <select
                value={filters.warehouse}
                onChange={(e) => handleFilterChange('warehouse', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Todas las bodegas</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Motivo</label>
              <select
                value={filters.reason}
                onChange={(e) => handleFilterChange('reason', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Todos los motivos</option>
                {Object.entries(EXIT_REASONS).map(([key, reason]) => (
                  <option key={key} value={key}>
                    {reason.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Estado</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">Todos</option>
                <option value="active">✅ Activas</option>
                <option value="cancelled">🚫 Anuladas</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm"
            >
              <X className="w-4 h-4" />
              Limpiar filtros
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={reloadExits}
              disabled={reloading}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
              Actualizar
            </motion.button>
          </div>
        </motion.div>

        {/* Lista de sesiones agrupadas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {groupedExits.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
              <TrendingDown className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No se encontraron salidas con los filtros aplicados</p>
            </div>
          ) : (
            groupedExits.map((group, index) => {
              const groupKey = `${group.workerId || group.workerName}-${group.dateString}`;
              const isExpanded = expandedGroups[groupKey];

              // Formatear texto de productos
              const productsText = Object.entries(group.productsWithUnits)
                .map(([unit, qty]) => `${qty.toFixed(1)} ${unit}`)
                .join(', ');

              return (
                <motion.div
                  key={groupKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all overflow-hidden"
                >
                  {/* Cabecera colapsable */}
                  <div
                    onClick={() => toggleGroup(groupKey)}
                    className="p-4 sm:p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                              {group.workerName || 'Trabajador sin nombre'}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {group.dateString}
                            </p>
                          </div>
                        </div>

                        {group.inventories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {group.inventories.map(inv => (
                              <span key={inv} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs rounded-full font-medium">
                                {inv}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingDown className="w-4 h-4 text-orange-500" />
                            <span className="text-slate-600 dark:text-slate-400">{group.totalExits} salida{group.totalExits !== 1 ? 's' : ''}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Package className="w-4 h-4 text-green-500" />
                            <span className="text-slate-600 dark:text-slate-400">{productsText}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Warehouse className="w-4 h-4 text-purple-500" />
                            <span className="text-slate-600 dark:text-slate-400 truncate">
                              {group.warehouses.length} bodega{group.warehouses.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <motion.button
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex-shrink-0"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        )}
                      </motion.button>
                    </div>
                  </div>

                  {/* Detalles expandidos */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-200 dark:border-slate-700"
                      >
                        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 space-y-4">
                          {group.exits.map((exit, exitIndex) => (
                            <motion.div
                              key={exit.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: exitIndex * 0.05 }}
                              className={`rounded-lg border p-4 ${
                                exit.status === 'cancelled'
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 opacity-75'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                      {exit.createdAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                      <Warehouse className="w-3 h-3" />
                                      {exit.warehouseName || 'Sin bodega'}
                                    </p>
                                    {exit.inventoryName && (
                                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                        Inventario: {exit.inventoryName}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    EXIT_REASONS[exit.reason]?.color || 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {EXIT_REASONS[exit.reason]?.icon} {EXIT_REASONS[exit.reason]?.name || exit.reason}
                                  </span>

                                  {exit.status === 'cancelled' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700">
                                      🚫 ANULADA
                                    </span>
                                  )}
                                  {(() => {
                                    const normalize = (r) => String(r || '').replace(/\./g, '').toUpperCase().trim();
                                    const rut = exit.customerRut || exit.customerInfo?.rut || exit.boleta?.receptor?.rut || exitCustomerMap[exit.id]?.rut;
                                    const rutNorm = rut ? normalize(rut) : null;
                                    const displayName = exit.customerName
                                      || exit.customerInfo?.name
                                      || exit.customerInfo?.nombre
                                      || exit.boleta?.receptor?.razonSocial
                                      || exit.boleta?.receptor?.nombre
                                      || exit.fiadoNombre
                                      || exitCustomerMap[exit.id]?.nombre
                                      || (rutNorm ? customerNameMap[rutNorm] : null)
                                      || rut;
                                    if (!displayName) return null;
                                    return (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        👤 {displayName}
                                        {exit.reason === 'CREDIT' && (exit.creditStatus === 'paid' ? ' ✅' : ' ⏳')}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>

                              <div className="space-y-2">
                                {(exit.products || exit.items || []).map((product, prodIndex) => (
                                  <div
                                    key={prodIndex}
                                    className="flex justify-between items-start text-sm bg-slate-50 dark:bg-slate-700/50 rounded px-3 py-2"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-slate-900 dark:text-white font-medium truncate">
                                          {product.productName || product.itemName || 'Producto sin nombre'}
                                        </span>
                                        {product.productType === 'ELABORADO' && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold rounded-full flex-shrink-0">
                                            🍳 Elaborado
                                          </span>
                                        )}
                                      </div>
                                      {/* Ingredientes descontados (solo elaborados) */}
                                      {product.productType === 'ELABORADO' && product.receta && product.receta.length > 0 && (
                                        <div className="mt-1 space-y-0.5">
                                          {product.receta.map((ing, i) => (
                                            <span key={i} className="text-xs text-slate-400 dark:text-slate-500 block">
                                              ↳ {ing.insumoNombre}: {Number(ing.cantidad) * (product.quantity || 1)} {ing.unidad}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {/* Campos personalizados */}
                                      {product.customFields && Object.keys(product.customFields).length > 0 && (
                                        <div className="mt-0.5 space-y-0">
                                          {Object.entries(product.customFields).map(([key, value]) =>
                                            value ? (
                                              <span key={key} className="text-xs text-slate-500 dark:text-slate-400 block">
                                                {key}: {String(value)}
                                              </span>
                                            ) : null
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
                                      <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                                        {(product.quantity || product.qty || 0).toFixed(1)} {product.unit || 'unidades'}
                                      </span>
                                      {(product.unitValue || product.ppp) > 0 && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                          {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(product.unitValue || product.ppp)}/u
                                        </span>
                                      )}
                                      {product.totalValue > 0 && (
                                        <span className="text-xs font-bold text-green-700 dark:text-green-400">
                                          = {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(product.totalValue)}
                                        </span>
                                      )}
                                      {/* Botón quitar producto — solo en ventas activas con más de 1 producto */}
                                      {exit.reason === 'SALE' && exit.status !== 'cancelled' && (exit.products?.length || 0) > 1 && product.productId && (
                                        <button
                                          onClick={() => setAnnulItemTarget({ exit, product })}
                                          className="w-5 h-5 flex items-center justify-center rounded-full text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                                          title="Quitar este producto de la venta"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Mostrar valor total si es una VENTA y tiene totalValue */}
                                {exit.reason === 'SALE' && exit.totalValue > 0 && (
                                  <div className="flex justify-between items-center text-sm bg-green-50 dark:bg-green-900/20 border-t-2 border-green-200 dark:border-green-700 rounded px-3 py-3 mt-2">
                                    <span className="text-green-900 dark:text-green-300 font-bold">
                                      💵 Valor Total de Venta
                                    </span>
                                    <span className="text-green-700 dark:text-green-400 font-extrabold text-base">
                                      {new Intl.NumberFormat('es-CL', {
                                        style: 'currency',
                                        currency: 'CLP'
                                      }).format(exit.totalValue)}
                                    </span>
                                  </div>
                                )}

                                {/* Botón Anular - Para ventas y transferencias activas */}
                                {(exit.reason === 'SALE' || exit.reason === 'TRANSFER') && exit.status !== 'cancelled' && (
                                  <motion.button
                                    onClick={() => handleAnnulSale(exit)}
                                    disabled={annullingId === exit.id}
                                    whileHover={{ scale: annullingId === exit.id ? 1 : 1.02 }}
                                    whileTap={{ scale: annullingId === exit.id ? 1 : 0.98 }}
                                    className="w-full mt-2 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded-lg transition-colors text-xs"
                                  >
                                    {annullingId === exit.id ? (
                                      <>
                                        <Loader className="w-3 h-3 animate-spin" />
                                        <span>Anulando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3" />
                                        <span>Anular Venta</span>
                                      </>
                                    )}
                                  </motion.button>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </motion.div>
        </>)}

        {/* ==================== FIADOS TAB ==================== */}
        {activeTab === 'fiados' && (() => {
          const creditExits = filteredExits.filter(e => e.reason === 'CREDIT' && e.status !== 'cancelled');
          if (creditExits.length === 0) return null;

          const creditByCustomer = {};
          let globalPending = 0;
          let globalPaid = 0;
          let globalTotal = 0;
          const normRut = (r) => String(r || '').replace(/\./g, '').toUpperCase().trim();
          creditExits.forEach(exit => {
            const rut = exit.customerRut || exit.customerInfo?.rut || exit.boleta?.receptor?.rut;
            const name = exit.customerName || exit.customerInfo?.name || exit.customerInfo?.nombre || exit.boleta?.receptor?.razonSocial || exit.fiadoNombre || (rut ? customerNameMap[normRut(rut)] : null) || 'Sin nombre';
            if (!creditByCustomer[name]) {
              creditByCustomer[name] = { pending: [], paid: [], totalPending: 0, totalPaid: 0 };
            }
            if (exit.creditStatus === 'paid') {
              creditByCustomer[name].paid.push(exit);
              creditByCustomer[name].totalPaid += exit.totalValue || 0;
              globalPaid += exit.totalValue || 0;
            } else {
              creditByCustomer[name].pending.push(exit);
              creditByCustomer[name].totalPending += exit.totalValue || 0;
              globalPending += exit.totalValue || 0;
            }
            globalTotal += exit.totalValue || 0;
          });

          const allCustomers = Object.entries(creditByCustomer).sort((a, b) => b[1].totalPending - a[1].totalPending);
          const customers = allCustomers.filter(([, data]) => data.totalPending > 0);
          const paidCustomers = allCustomers.filter(([, data]) => data.totalPending === 0);
          const CLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(v || 0);

          const [showPaidCredits, setShowPaidCreditsLocal] = [
            expandedCredits['__showPaid'] || false,
            (val) => setExpandedCredits(prev => ({ ...prev, '__showPaid': val }))
          ];

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              {/* Header de sección */}
              <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 rounded-2xl p-[1px] mb-6 shadow-lg shadow-amber-500/20">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <span className="text-2xl">🤝</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Fiados / Créditos</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {customers.length} cliente{customers.length !== 1 ? 's' : ''} con deuda · {creditExits.length} transacci{creditExits.length !== 1 ? 'ones' : 'ón'}
                        </p>
                      </div>
                    </div>

                    {/* Summary cards */}
                    <div className="flex gap-3">
                      {globalPending > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 text-center min-w-[120px]">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-red-400 dark:text-red-500">Por cobrar</p>
                          <p className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-0.5">{CLP(globalPending)}</p>
                        </div>
                      )}
                      {globalPaid > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-3 text-center min-w-[120px]">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 dark:text-emerald-500">Cobrado</p>
                          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{CLP(globalPaid)}</p>
                        </div>
                      )}
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-center min-w-[120px]">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Total fiado</p>
                        <p className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">{CLP(globalTotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customers list */}
              <div className="space-y-3">
                {customers.length === 0 && (
                  <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                    <span className="text-4xl block mb-3">🎉</span>
                    <p className="font-semibold text-slate-600 dark:text-slate-300">¡Todo al día!</p>
                    <p className="text-sm mt-1">No hay fiados pendientes de cobro</p>
                  </div>
                )}
                {customers.map(([name, data]) => {
                  const isExpanded = expandedCredits[name] || false;
                  const hasPending = data.pending.length > 0;

                  return (
                    <motion.div
                      key={name}
                      layout
                      className={`rounded-2xl overflow-hidden border transition-all ${
                        hasPending
                          ? 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800/40 shadow-sm hover:shadow-md hover:shadow-amber-500/10'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {/* Customer row */}
                      <button
                        onClick={() => setExpandedCredits(prev => ({ ...prev, [name]: !prev[name] }))}
                        className="w-full flex items-center gap-4 p-4 transition-colors"
                      >
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                          hasPending
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {hasPending ? name.charAt(0).toUpperCase() : '✓'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {data.pending.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                {data.pending.length} pendiente{data.pending.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {data.paid.length > 0 && (
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {data.paid.length} pagado{data.paid.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          {data.totalPending > 0 ? (
                            <>
                              <p className="text-lg font-extrabold text-red-600 dark:text-red-400">{CLP(data.totalPending)}</p>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-red-400">debe</p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{CLP(data.totalPaid)}</p>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">pagado</p>
                            </>
                          )}
                        </div>

                        {/* Chevron */}
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        </motion.div>
                      </button>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-slate-200 dark:border-slate-700 px-4 pb-4 pt-3 space-y-2">
                              {/* Pendientes */}
                              {data.pending.map(exit => (
                                <div key={exit.id} className="group flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-red-100 dark:border-red-800/50">
                                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                      {(exit.products || exit.items || []).map(p => `${p.productName || p.itemName} x${p.quantity}`).join(', ')}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                      {exit.createdAt?.toLocaleDateString?.('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) || 'Sin fecha'}
                                      {exit.workerName && ` · ${exit.workerName}`}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-600 dark:text-red-400 shrink-0">{CLP(exit.totalValue)}</span>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        setMarkingPaidId(exit.id);
                                        await markCreditAsPaid(exit.id);
                                        toast.addToast('✅ Fiado marcado como pagado', 'success');
                                      } catch (err) {
                                        console.error('Error marcando fiado:', err);
                                        toast.addToast('❌ Error al marcar como pagado', 'error');
                                      } finally {
                                        setMarkingPaidId(null);
                                      }
                                    }}
                                    disabled={markingPaidId === exit.id}
                                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-emerald-300 disabled:to-green-400 text-white rounded-xl shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
                                  >
                                    {markingPaidId === exit.id ? (
                                      <Loader className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                        Cobrar
                                      </>
                                    )}
                                  </button>
                                </div>
                              ))}

                              {/* Pagados (colapsables) */}
                              {data.paid.length > 0 && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedCredits(prev => ({ ...prev, [`${name}_paid`]: !prev[`${name}_paid`] })); }}
                                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mt-2"
                                  >
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                    <span className="font-medium">{data.paid.length} pagado{data.paid.length !== 1 ? 's' : ''}</span>
                                    <motion.div animate={{ rotate: expandedCredits[`${name}_paid`] ? 180 : 0 }}>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </motion.div>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                  </button>
                                  <AnimatePresence>
                                    {expandedCredits[`${name}_paid`] && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="space-y-2 overflow-hidden"
                                      >
                                        {data.paid.map(exit => (
                                          <div key={exit.id} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20 opacity-60">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {(exit.products || exit.items || []).map(p => `${p.productName || p.itemName} x${p.quantity}`).join(', ')}
                                              </p>
                                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                Pagado {exit.paidAt?.toDate?.()?.toLocaleDateString?.('es-CL', { day: '2-digit', month: 'short' }) || ''}
                                              </p>
                                            </div>
                                            <span className="font-bold text-emerald-500 dark:text-emerald-400 line-through shrink-0">{CLP(exit.totalValue)}</span>
                                          </div>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {/* Clientes totalmente saldados (colapsables) */}
                {paidCustomers.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowPaidCreditsLocal(!showPaidCredits)}
                      className="flex items-center gap-2 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-2"
                    >
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                      <span className="font-medium whitespace-nowrap">
                        {paidCustomers.length} cliente{paidCustomers.length !== 1 ? 's' : ''} saldado{paidCustomers.length !== 1 ? 's' : ''}
                      </span>
                      <motion.div animate={{ rotate: showPaidCredits ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.div>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                    </button>
                    <AnimatePresence>
                      {showPaidCredits && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-3 mt-2"
                        >
                          {paidCustomers.map(([name, data]) => {
                            const isExpanded = expandedCredits[name] || false;
                            return (
                              <motion.div
                                key={name}
                                layout
                                className="rounded-2xl overflow-hidden border bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70"
                              >
                                <button
                                  onClick={() => setExpandedCredits(prev => ({ ...prev, [name]: !prev[name] }))}
                                  className="w-full flex items-center gap-4 p-4 transition-colors"
                                >
                                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                    ✓
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className="font-bold text-slate-700 dark:text-slate-300 truncate">{name}</p>
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                      {data.paid.length} pagado{data.paid.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{CLP(data.totalPaid)}</p>
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">saldado</p>
                                  </div>
                                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                  </motion.div>
                                </button>
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="border-t border-slate-200 dark:border-slate-700 px-4 pb-4 pt-3 space-y-2">
                                        {data.paid.map(exit => (
                                          <div key={exit.id} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20 opacity-70">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {(exit.products || exit.items || []).map(p => `${p.productName || p.itemName} x${p.quantity}`).join(', ')}
                                              </p>
                                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                Pagado {exit.paidAt?.toDate?.()?.toLocaleDateString?.('es-CL', { day: '2-digit', month: 'short' }) || ''}
                                              </p>
                                            </div>
                                            <span className="font-bold text-emerald-500 dark:text-emerald-400 line-through shrink-0">{CLP(exit.totalValue)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}

      </div>


      {/* Modal de Anulación Parcial (producto específico) */}
      <AnimatePresence>
        {annulItemTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAnnulItemTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">¿Quitar producto de la venta?</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">El stock se restaurará automáticamente</p>
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 mb-4 border border-orange-200 dark:border-orange-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {annulItemTarget.product.productName || annulItemTarget.product.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  x{annulItemTarget.product.quantity} · {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(annulItemTarget.product.totalValue || 0)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAnnulItemTarget(null)}
                  disabled={annullingItem}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAnnulItem}
                  disabled={annullingItem}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {annullingItem ? 'Quitando...' : 'Sí, quitar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación de Anulación */}
      <AnimatePresence>
        {showAnnulModal && exitToAnnul && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAnnulModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Anular Venta</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                  <strong>⚠️ Al anular esta venta:</strong>
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 ml-4 list-disc space-y-1">
                  <li>Se restaurará el stock de los productos</li>
                  <li>Se revertirán los límites diarios del trabajador</li>
                  <li>La venta quedará marcada como anulada</li>
                </ul>
              </div>

              {/* Info de la venta */}
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{exitToAnnul.reason === 'TRANSFER' ? 'Transferencia a anular:' : 'Venta a anular:'}</p>
                <div className="text-sm text-slate-900 dark:text-white">
                  <p><strong>Trabajador:</strong> {exitToAnnul.workerName}</p>
                  <p><strong>Fecha:</strong> {exitToAnnul.createdAt?.toLocaleString('es-CL')}</p>
                  {exitToAnnul.totalValue > 0 && (
                    <p><strong>Valor:</strong> {new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP'
                    }).format(exitToAnnul.totalValue)}</p>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Motivo de la anulación *
                </label>
                <textarea
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  placeholder="Ej: Error en el registro, devolución del cliente, etc."
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAnnulModal(false)}
                  disabled={annullingId}
                  className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAnnulSale}
                  disabled={annullingId || !annulReason.trim()}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {annullingId ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Anulando...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Anular Venta</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CAJA TAB ==================== */}
      {activeTab === 'caja' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mt-4">
          {/* Filtro por trabajador -- los últimos 100 turnos ya vienen
              ordenados por fecha de apertura (getCashRegisterHistory), este
              filtro solo acota por cajero sin pegarle otra vez a Firestore */}
          {cashRegisters.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3">
              <input
                type="text"
                placeholder="Filtrar por nombre de cajero/a..."
                value={cashWorkerFilter}
                onChange={(e) => setCashWorkerFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          )}

          {cashLoading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
              Cargando historial de caja...
            </div>
          ) : cashRegisters.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <span className="text-4xl mb-3 block">💵</span>
              <p className="font-medium">No hay turnos de caja registrados</p>
              <p className="text-sm mt-1">Los turnos aparecerán aquí cuando las cajeras abran y cierren su caja.</p>
            </div>
          ) : (
            cashRegisters
              .filter(reg => !cashWorkerFilter.trim() || (reg.workerName || '').toLowerCase().includes(cashWorkerFilter.trim().toLowerCase()))
              .map(reg => {
              const isOpen = reg.status === 'open';
              const expectedCash = (reg.initialCash || 0) + (reg.totalCash || 0) - (reg.totalWithdrawals || 0);
              const diff = isOpen ? null : (reg.physicalCash ?? null) !== null ? reg.physicalCash - expectedCash : null;
              const isExpanded = expandedRegister === reg.id;

              return (
                <div key={reg.id} className={`rounded-2xl border overflow-hidden shadow-sm ${
                  isOpen
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}>
                  {/* Cabecera del turno */}
                  <button
                    onClick={() => loadRegisterExits(reg.id)}
                    className="w-full text-left p-4 flex items-start gap-3 text-slate-900 dark:text-white"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                      isOpen ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      {isOpen ? '🔓' : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${isOpen ? 'text-green-900 dark:text-green-300' : 'text-slate-900 dark:text-white'}`}>{reg.workerName || 'Cajera'}</span>
                        {isOpen && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full">ABIERTO</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {reg.openedAt ? reg.openedAt.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        {reg.closedAt ? ` → ${reg.closedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                        <span className={isOpen ? 'text-green-900 dark:text-green-300' : 'text-slate-700 dark:text-slate-200'}>
                          Fondo: <span className="font-semibold">{CLP(reg.initialCash || 0)}</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-300">
                          Ventas: <span className="font-semibold">{CLP(reg.totalSales || 0)}</span>
                        </span>
                        {reg.salesCount !== undefined && (
                          <span className="text-slate-500 dark:text-slate-300">{reg.salesCount} venta(s)</span>
                        )}
                        {reg.totalWithdrawals > 0 && (
                          <span className="text-red-500 dark:text-red-400">
                            🔻 Retiros: <span className="font-semibold">{CLP(reg.totalWithdrawals)}</span>
                          </span>
                        )}
                      </div>
                      {/* Métodos de pago */}
                      {(reg.totalCash > 0 || reg.totalCard > 0 || reg.totalTransfer > 0) && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {reg.totalCash > 0 && <span className="text-xs text-slate-500">💵 {CLP(reg.totalCash)}</span>}
                          {reg.totalCard > 0 && <span className="text-xs text-slate-500">💳 {CLP(reg.totalCard)}</span>}
                          {reg.totalTransfer > 0 && <span className="text-xs text-slate-500">🏦 {CLP(reg.totalTransfer)}</span>}
                          {reg.totalOther > 0 && <span className="text-xs text-slate-500">💰 {CLP(reg.totalOther)}</span>}
                        </div>
                      )}
                      {/* Diferencia */}
                      {!isOpen && diff !== null && (
                        <div className={`mt-1.5 text-xs font-semibold ${
                          diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {diff === 0 ? '✓ Sin diferencia' : diff > 0 ? `▲ Sobrante: ${CLP(diff)}` : `▼ Faltante: ${CLP(Math.abs(diff))}`}
                        </div>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Ventas y retiros del turno (expandible) */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3 space-y-3">
                      {/* Retiros de efectivo del turno */}
                      {registerMovements[reg.id]?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 mb-1.5">🔻 Retiros de efectivo</p>
                          <div className="space-y-1.5">
                            {registerMovements[reg.id].map(m => (
                              <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                <div>
                                  <span className="text-slate-700 dark:text-slate-200">{m.reason}</span>
                                  <span className="text-slate-400 ml-2">
                                    {m.createdAt?.toLocaleTimeString?.('es-CL', { hour: '2-digit', minute: '2-digit' }) || '—'}
                                  </span>
                                </div>
                                <span className="font-bold text-red-600 dark:text-red-400">-{CLP(m.amount || 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ventas del turno */}
                      {!registerExits[reg.id] ? (
                        <p className="text-xs text-slate-400 text-center py-2">Cargando...</p>
                      ) : registerExits[reg.id].length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">Sin ventas en este turno</p>
                      ) : (
                        <div className="space-y-1.5">
                          {registerExits[reg.id].map(exit => (
                            <div key={exit.id} className="flex items-center justify-between text-xs py-1 px-2 bg-white dark:bg-slate-800 rounded-lg">
                              <div>
                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                  {exit.products?.length || 0} producto(s)
                                </span>
                                <span className="text-slate-400 ml-2">
                                  {exit.createdAt?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) || '—'}
                                </span>
                                {exit.paymentMethod && (
                                  <span className="ml-2 text-slate-400">
                                    {PAYMENT_METHODS[exit.paymentMethod]?.icon} {PAYMENT_METHODS[exit.paymentMethod]?.label}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{CLP(exit.totalValue || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </motion.div>
      )}

      {/* ==================== COMISIONES TAB ==================== */}
      {activeTab === 'comisiones' && (() => {
        // Si es VENDEDORA: mostrar solo sus propias ventas y comisión
        const isVendedora = currentWorker?.role === 'VENDEDORA' || currentWorker?.role === 'VENDEDOR';
        const myEmail = auth.currentUser?.email;

        // Filtrar ventas tipo SALE activas (respeta filtros de fecha activos)
        const salesExits = (filters.dateFrom || filters.dateTo ? filteredExits : exits).filter(e => e.reason === 'SALE' && e.status !== 'cancelled');

        if (isVendedora) {
          // Vista del vendedor: solo sus ventas
          const myExits = salesExits.filter(e =>
            e.workerId === myEmail ||
            e.workerId === currentWorker?.id ||
            e.workerName === currentWorker?.name
          );
          const totalSales = myExits.reduce((sum, e) => sum + (e.totalValue || 0), 0);
          const totalSinIva = totalSales / 1.19;
          const pct = currentWorker?.commissionPercent ?? null;
          const commission = pct != null ? (totalSinIva * pct) / 100 : null;

          return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  🛍️ Mi comisión
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ventas totales</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{totalSales.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ventas sin IVA (÷1.19)</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{Math.round(totalSinIva).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</p>
                  </div>
                </div>
                {pct != null ? (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700/40">
                    <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Comisión a cobrar ({pct}% sobre ventas sin IVA)</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{Math.round(commission).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Tu administrador aún no ha configurado tu porcentaje de comisión.</p>
                )}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Mis ventas ({myExits.length})</h4>
                {myExits.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Sin ventas registradas</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {myExits.map(exit => (
                      <div key={exit.id} className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{exit.products?.length || 0} producto(s)</span>
                          <span className="text-slate-400 ml-2 text-xs">
                            {exit.createdAt instanceof Date
                              ? exit.createdAt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                              : '—'}
                          </span>
                        </div>
                        <span className="font-semibold text-green-600 dark:text-green-400">{(exit.totalValue || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        }

        // Vista del ADMIN/DUEÑO: resumen por vendedor
        const vendedores = workers.filter(w => (w.role === 'VENDEDORA' || w.role === 'VENDEDOR') && w.isActive !== false);

        const vendedorStats = vendedores.map(v => {
          const vExits = salesExits.filter(e =>
            e.workerId === v.email ||
            e.workerId === v.id ||
            e.workerName === v.name
          );
          const totalVentas = vExits.reduce((sum, e) => sum + (e.totalValue || 0), 0);
          const sinIva = totalVentas / 1.19;
          const pct = v.commissionPercent ?? null;
          const commission = pct != null ? (sinIva * pct) / 100 : null;
          return { ...v, totalVentas, sinIva, commission, ventasCount: vExits.length };
        });

        // También incluir trabajadores sin rol VENDEDORA que hayan hecho ventas
        const vendedorKeys = new Set(vendedores.flatMap(v => [v.email, v.id, v.name]));
        const otherSellers = {};
        salesExits.forEach(e => {
          const key = e.workerName || e.workerId || 'Desconocido';
          const alreadyCounted = vendedorKeys.has(e.workerId) || vendedorKeys.has(e.workerName);
          if (!alreadyCounted) {
            if (!otherSellers[key]) otherSellers[key] = { name: e.workerName || e.workerId || key, totalVentas: 0, ventasCount: 0 };
            otherSellers[key].totalVentas += e.totalValue || 0;
            otherSellers[key].ventasCount++;
          }
        });

        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            {vendedorStats.length === 0 && Object.keys(otherSellers).length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <p className="text-slate-400 dark:text-slate-500 text-sm">No hay vendedores activos registrados.</p>
                <p className="text-xs text-slate-400 mt-1">Asigna el rol <strong>Vendedor</strong> a un trabajador para ver sus comisiones aquí.</p>
              </div>
            )}
            {vendedorStats.map(v => (
              <div key={v.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{v.name}</h3>
                    <p className="text-xs text-slate-400">{v.email}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${v.commissionPercent != null ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    {v.commissionPercent != null ? `${v.commissionPercent}% comisión` : 'Sin comisión'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Ventas ({v.ventasCount})</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{v.totalVentas.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Sin IVA</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{Math.round(v.sinIva).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${v.commission != null ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/30' : 'bg-slate-50 dark:bg-slate-700/40'}`}>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">A pagar</p>
                    <p className={`font-bold text-sm mt-0.5 ${v.commission != null ? 'text-purple-700 dark:text-purple-300' : 'text-slate-400'}`}>
                      {v.commission != null ? Math.round(v.commission).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        );
      })()}

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </motion.div>
  );
};

export default InventoryExitsReport;
