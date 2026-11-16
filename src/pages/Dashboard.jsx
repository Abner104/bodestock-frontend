// src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Eye,
  ChevronRight,
  Award,
  Bell,
  BoxIcon,
  LogOut,
  Warehouse,
  Zap,
  BarChart3,
  Users,
  Calendar,
  PackagePlus,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase.js';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';
import { getWorkerByEmail } from '../services/workers-service.js';
import { auth } from '../firebase/firebase.js';
import { SensitiveInfoGuard } from '../components/PermissionGuard';
import { useUserPermissions } from '../hooks/useUserPermissions';
import DashboardLiveFeed from '../components/DashboardLiveFeed';
import DashboardOrdersSummary from '../components/DashboardOrdersSummary';
import { convertUnit } from '../utils/unitConversions';
import { useTheme } from '../contexts/ThemeContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const { hasPermission } = useUserPermissions();
  const { isDark } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [inventoryExits, setInventoryExits] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movModal, setMovModal] = useState(null); // null | 'ingresos' | 'mermas'
  const [inventories, setInventories] = useState([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState('all');
  // El selector de inventario ofrecía "Inventario Principal" (el legacy,
  // companies/{id}/inventory) siempre, aunque esté vacío -- un negocio que
  // nunca usó esa estructura (todo cargado en inventarios nuevos) veía una
  // opción fantasma sin productos reales detrás. Solo se muestra si
  // realmente tiene algo.
  const [hasLegacyInventory, setHasLegacyInventory] = useState(false);
  // null = dueño (ve todo), array = inventarios asignados
  const [assignedInventories, setAssignedInventories] = useState(null);

  // Selector de mes
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const availableMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar lista de inventarios disponibles (filtrada por asignación)
  useEffect(() => {
    const loadInventories = async () => {
      const companyId = await getUserCompanyId();
      if (!companyId) return;

      // Detectar si tiene inventarios asignados (sucursales)
      let allowed = null;
      const currentUser = auth.currentUser;
      if (currentUser) {
        const workerData = await getWorkerByEmail(currentUser.email);
        if (workerData && workerData.assignedInventories && workerData.assignedInventories.length > 0) {
          allowed = workerData.assignedInventories;
          setAssignedInventories(allowed);
        }
      }

      const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
      const snapshot = await getDocs(inventoriesRef);
      const invList = [];

      for (const invDoc of snapshot.docs) {
        // Si tiene restricción, saltarse inventarios no asignados
        if (allowed && !allowed.includes(invDoc.id)) continue;

        const metaSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/metadata`));
        const meta = metaSnap.docs[0]?.data() || {};
        invList.push({
          id: invDoc.id,
          name: meta.name || invDoc.id,
          type: meta.type || 'OTHER'
        });
      }

      setInventories(invList);

      // Si tiene asignación, fijar automáticamente el primer inventario asignado
      if (allowed && invList.length > 0) {
        setSelectedInventoryId(invList[0].id);
      }
    };

    loadInventories();
  }, []);

  // Cargar VENTAS reales desde inventory_exits
  useEffect(() => {
    let unsubscribe;

    const loadSales = async () => {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('No se pudo obtener companyId');
        setLoading(false);
        return;
      }

      // Detectar inventarios asignados para filtrar ventas
      let allowedForSales = null;
      const currentUser = auth.currentUser;
      if (currentUser) {
        const workerData = await getWorkerByEmail(currentUser.email);
        if (workerData && workerData.assignedInventories && workerData.assignedInventories.length > 0) {
          allowedForSales = workerData.assignedInventories;
        }
      }

      const q = query(
        collection(db, `companies/${companyId}/inventory_exits`),
        orderBy('createdAt', 'desc'),
        limit(1500)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        let exits = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
          }))
          .filter(exit => exit.status !== 'cancelled' && (exit.reason === 'SALE' || (exit.reason === 'CREDIT' && exit.creditStatus === 'paid')));

        // Filtrar por inventarios asignados si aplica
        if (allowedForSales && allowedForSales.length > 0) {
          exits = exits.filter(exit => allowedForSales.includes(exit.inventoryId));
        }

        setInventoryExits(exits);
        setLoading(false);
      }, (error) => {
        console.error('Error cargando ventas:', error);
        setLoading(false);
      });
    };

    loadSales();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Cargar inventario para calcular stock y valor
  useEffect(() => {
    const unsubscribes = [];

    const loadInventory = async () => {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('No se pudo obtener companyId');
        setLoading(false);
        return;
      }

      if (selectedInventoryId === 'all') {
        const legacyQ = query(
          collection(db, `companies/${companyId}/inventory`),
          orderBy('name', 'asc')
        );
        const legacyUnsub = onSnapshot(legacyQ, (snapshot) => {
          const legacyItems = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            stock: Number(doc.data().stock) || 0,
            ppp: Number(doc.data().ppp) || 0,
            minStock: Number(doc.data().minStock) || 10,
            category: doc.data().category || '',
            unit: doc.data().unit || 'unidades',
            history: doc.data().history || [],
            productType: doc.data().productType || 'SIMPLE',
            receta: doc.data().receta || []
          }));
          setHasLegacyInventory(legacyItems.length > 0);

            // One-time fetch para inventarios adicionales — evita N listeners simultáneos
          const newInventoryPromises = inventories.map(inv =>
            getDocs(query(
              collection(db, `companies/${companyId}/inventories/${inv.id}/products`),
              orderBy('name', 'asc')
            )).then(snapshot => snapshot.docs.map(doc => ({
              id: doc.id,
              name: doc.data().name || '',
              stock: Number(doc.data().stock) || 0,
              ppp: Number(doc.data().ppp) || 0,
              minStock: Number(doc.data().minStock) || 10,
              category: doc.data().category || '',
              unit: doc.data().unit || 'unidades',
              history: doc.data().history || [],
              productType: doc.data().productType || 'SIMPLE',
              receta: doc.data().receta || []
            })))
          );

          Promise.all(newInventoryPromises).then(newItems => {
            const combined = [...legacyItems, ...newItems.flat()];
            setInventory(combined);
          });
        });
        unsubscribes.push(legacyUnsub);
      } else {
        const inventoryPath = selectedInventoryId === 'legacy'
          ? `companies/${companyId}/inventory`
          : `companies/${companyId}/inventories/${selectedInventoryId}/products`;

        const q = query(
          collection(db, inventoryPath),
          orderBy('name', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            stock: Number(doc.data().stock) || 0,
            ppp: Number(doc.data().ppp) || 0,
            minStock: Number(doc.data().minStock) || 10,
            category: doc.data().category || '',
            unit: doc.data().unit || 'unidades',
            history: doc.data().history || [],
            productType: doc.data().productType || 'SIMPLE',
            receta: doc.data().receta || []
          }));
          setInventory(items);
        });
        unsubscribes.push(unsubscribe);
      }
    };

    loadInventory();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [selectedInventoryId, inventories]);

  // ===== FILTRAR SALIDAS POR INVENTARIO SELECCIONADO =====
  const filteredExits = useMemo(() => {
    if (selectedInventoryId === 'all') {
      return inventoryExits;
    }

    const inventoryProductIds = new Set(inventory.map(item => item.id));

    return inventoryExits.filter(exit => {
      if (!exit.products || !Array.isArray(exit.products)) return false;
      return exit.products.some(product => {
        const productId = product.productId || product.id;
        return inventoryProductIds.has(productId);
      });
    });
  }, [inventoryExits, inventory, selectedInventoryId]);

  // ===== CÁLCULOS DE KPIs DE VENTAS REALES =====
  const salesKPIs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Mes seleccionado
    const [sy, sm] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(sy, sm - 1, 1);
    const monthEnd = new Date(sy, sm, 0, 23, 59, 59);
    const prevMonthStart = new Date(sy, sm - 2, 1);
    const prevMonthEnd = new Date(sy, sm - 1, 0, 23, 59, 59);
    const isCurrentMonth = selectedMonth === availableMonths[0].key;

    const ventasHoy = isCurrentMonth ? filteredExits.filter(exit => exit.createdAt >= todayStart) : [];
    const ventasAyer = isCurrentMonth ? filteredExits.filter(exit => exit.createdAt >= yesterdayStart && exit.createdAt < todayStart) : [];
    // Semana: últimos 7 días pero sin cruzar al mes anterior
    const semanaStart = isCurrentMonth
      ? (weekStart > monthStart ? weekStart : monthStart)
      : monthStart;
    const ventasSemana = isCurrentMonth ? filteredExits.filter(exit => exit.createdAt >= semanaStart && exit.createdAt <= monthEnd) : [];
    const ventasSemanaAnterior = isCurrentMonth ? filteredExits.filter(exit => exit.createdAt >= prevWeekStart && exit.createdAt < semanaStart) : [];
    const ventasMes = filteredExits.filter(exit => exit.createdAt >= monthStart && exit.createdAt <= monthEnd);
    const ventasMesAnterior = filteredExits.filter(exit => exit.createdAt >= prevMonthStart && exit.createdAt <= prevMonthEnd);

    const calcularTotal = (exits) => {
      return exits.reduce((total, exit) => {
        if (exit.products && Array.isArray(exit.products)) {
          return total + exit.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
        }
        return total;
      }, 0);
    };

    const calcularValor = (exits) => {
      return exits.reduce((total, exit) => {
        if (exit.totalValue) {
          return total + Number(exit.totalValue);
        }
        if (exit.products && Array.isArray(exit.products)) {
          return total + exit.products.reduce((sum, p) => {
            if (p.totalValue) return sum + Number(p.totalValue);
            const quantity = Number(p.quantity) || 0;
            const unitValue = Number(p.unitValue) || Number(p.ppp) || 0;
            return sum + (quantity * unitValue);
          }, 0);
        }
        return total;
      }, 0);
    };

    const valorHoy = calcularValor(ventasHoy);
    const valorAyer = calcularValor(ventasAyer);
    const valorSemana = calcularValor(ventasSemana);
    const valorSemanaAnterior = calcularValor(ventasSemanaAnterior);
    const valorMes = calcularValor(ventasMes);
    const valorMesAnterior = calcularValor(ventasMesAnterior);

    const calcPct = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Desglose de las ventas de hoy por medio de pago -- mismo cálculo que
    // ya usa cash-register-service.js:closeCashRegister / CashRegisterPage:calcTotals
    // (pagos mixtos cuentan la parte en efectivo aparte, fiado no entra en efectivo).
    const porMetodoPagoHoy = ventasHoy.reduce((acc, exit) => {
      const amt = exit.totalValue || 0;
      if (exit.splitPayment && exit.splitCashAmount > 0) {
        acc.CASH += exit.splitCashAmount;
        const rest = amt - exit.splitCashAmount;
        if (exit.paymentMethod === 'CARD') acc.CARD += rest;
        else if (exit.paymentMethod === 'TRANSFER') acc.TRANSFER += rest;
        else acc.OTHER += rest;
      } else {
        switch (exit.paymentMethod) {
          case 'CASH': acc.CASH += amt; break;
          case 'CARD': acc.CARD += amt; break;
          case 'TRANSFER': acc.TRANSFER += amt; break;
          default: acc.OTHER += amt; break; // incluye CREDIT (fiado) y otros
        }
      }
      return acc;
    }, { CASH: 0, CARD: 0, TRANSFER: 0, OTHER: 0 });

    return {
      cantidadHoy: calcularTotal(ventasHoy),
      cantidadSemana: calcularTotal(ventasSemana),
      cantidadMes: calcularTotal(ventasMes),
      valorHoy,
      valorSemana,
      valorMes,
      numVentasHoy: ventasHoy.length,
      numVentasSemana: ventasSemana.length,
      numVentasMes: ventasMes.length,
      pctHoy: calcPct(valorHoy, valorAyer),
      pctSemana: calcPct(valorSemana, valorSemanaAnterior),
      pctMes: calcPct(valorMes, valorMesAnterior),
      porMetodoPagoHoy
    };
  }, [filteredExits]);

  // ===== STOCK CRÍTICO =====
  // Un producto ELABORADO (plato con receta) siempre tiene stock=0 en su
  // propio doc -- se prepara al vender descontando insumos, nunca lleva
  // stock propio (ver ProductoElaboradoModal.jsx). Antes este widget lo
  // trataba igual que un producto simple y lo marcaba "sin stock" para
  // SIEMPRE, sin importar si realmente había insumos para prepararlo --
  // ruido constante y falso para cualquier negocio de cocina/restaurante.
  // La disponibilidad real de un ELABORADO depende de si alcanza el stock
  // de CADA insumo de su receta (con conversión de unidad, ya que la
  // receta puede pedir en "g" un insumo guardado en "kg").
  const stockCritico = useMemo(() => {
    const stockById = {};
    inventory.forEach(item => { stockById[item.id] = item.stock; });

    const estaDisponible = (item) => {
      if (item.productType !== 'ELABORADO') return item.stock > 0;
      if (!item.receta?.length) return true; // sin receta cargada, no se puede evaluar -- se asume disponible
      return item.receta.every(ing => {
        const stockInsumo = stockById[ing.insumoId] ?? 0;
        const cantidadNecesaria = convertUnit(Number(ing.cantidad) || 0, ing.unidad, ing.unidadStock || ing.unidad);
        return stockInsumo >= cantidadNecesaria;
      });
    };

    const sinStock = inventory.filter(item => !estaDisponible(item));
    const critico = inventory.filter(item =>
      item.productType !== 'ELABORADO' && item.stock <= item.minStock && item.stock > 0
    );

    return {
      critico: critico.length,
      sinStock: sinStock.length,
      items: [...sinStock, ...critico].slice(0, 5)
    };
  }, [inventory]);

  // ===== VALOR TOTAL DEL INVENTARIO =====
  const inventoryValue = useMemo(() => {
    return inventory.reduce((total, item) => {
      return total + (item.stock * item.ppp);
    }, 0);
  }, [inventory]);

  // ===== PRODUCTOS MÁS VENDIDOS =====
  const topProducts = useMemo(() => {
    const productSales = {};
    const [sy, sm] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(sy, sm - 1, 1);
    const monthEnd = new Date(sy, sm, 0, 23, 59, 59);

    const inventoryMap = {};
    inventory.forEach(item => {
      inventoryMap[item.id] = item;
    });

    filteredExits.filter(e => e.createdAt >= monthStart && e.createdAt <= monthEnd).forEach(exit => {
      const exitItems = exit.products || exit.items || [];

      if (Array.isArray(exitItems)) {
        exitItems.forEach(item => {
          const id = item.productId || item.itemId || item.id;
          const quantity = Number(item.quantity) || 0;

          if (!id) return;

          const inventoryItem = inventoryMap[id];
          const name = inventoryItem?.name || item.name || item.itemName || 'Producto sin nombre';
          const photoURL = inventoryItem?.photoURL || item.photoURL || null;

          if (!productSales[id]) {
            productSales[id] = {
              id,
              name,
              photoURL,
              totalQuantity: 0,
              totalSales: 0
            };
          }

          productSales[id].totalQuantity += quantity;
          productSales[id].totalSales += 1;
        });
      }
    });

    return Object.values(productSales)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);
  }, [filteredExits, inventory, selectedMonth]);

  // ===== GRÁFICA DE VENTAS (ÚLTIMOS 7 DÍAS) =====
  const salesChartData = useMemo(() => {
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const ventasDelDia = filteredExits.filter(exit =>
        exit.createdAt >= date && exit.createdAt < nextDay
      );

      const cantidad = ventasDelDia.reduce((total, exit) => {
        if (exit.products && Array.isArray(exit.products)) {
          return total + exit.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
        }
        return total;
      }, 0);

      const valor = ventasDelDia.reduce((total, exit) => {
        if (exit.totalValue) {
          return total + Number(exit.totalValue);
        }
        if (exit.products && Array.isArray(exit.products)) {
          return total + exit.products.reduce((sum, p) => {
            if (p.totalValue) return sum + Number(p.totalValue);
            const qty = Number(p.quantity) || 0;
            const unitValue = Number(p.unitValue) || Number(p.ppp) || 0;
            return sum + (qty * unitValue);
          }, 0);
        }
        return total;
      }, 0);

      const dayName = date.toLocaleDateString('es-CL', { weekday: 'short' });

      days.push({
        fecha: date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
        dia: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        cantidad: cantidad,
        valor: Math.round(valor),
        ventas: ventasDelDia.length
      });
    }

    return days;
  }, [filteredExits]);

  // ===== MOVIMIENTOS RECIENTES =====
  const recentMovements = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return filteredExits
      .filter(exit => exit.createdAt >= todayStart)
      .slice(0, 5).map(exit => ({
      id: exit.id,
      workerName: exit.workerName || 'Trabajador',
      warehouseName: exit.warehouseName || 'Bodega',
      totalProducts: exit.products?.length || 0,
      totalQuantity: exit.products?.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0) || 0,
      totalValue: exit.totalValue || exit.products?.reduce((sum, p) => sum + (Number(p.totalValue) || 0), 0) || 0,
      createdAt: exit.createdAt,
      products: exit.products || []
    }));
  }, [filteredExits]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount || 0);

  // Ingresos y mermas del mes actual extraídos del history de productos
  const inventoryMovements = useMemo(() => {
    const [sy, sm] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(sy, sm - 1, 1);
    const monthEnd = new Date(sy, sm, 0, 23, 59, 59);
    const ingresos = [];
    const mermas = [];
    inventory.forEach(prod => {
      (prod.history || []).forEach(h => {
        const fecha = new Date(h.date);
        if (fecha < monthStart || fecha > monthEnd) return;
        const base = { producto: prod.name, unidad: prod.unit || 'u', fecha, qty: Math.abs(h.qty || h.quantity || 0) };
        if (h.type === 'shrinkage') mermas.push({ ...base, reason: h.reason || '', valor: base.qty * (prod.ppp || 0) });
        else if (h.type === 'entry' || !h.type || h.type === 'purchase') ingresos.push(base);
      });
    });
    ingresos.sort((a, b) => b.fecha - a.fecha);
    mermas.sort((a, b) => b.fecha - a.fecha);
    return { ingresos, mermas, totalMermas: mermas.reduce((s, m) => s + m.valor, 0) };
  }, [inventory, selectedMonth]);

  const formatCompact = (amount) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return formatCurrency(amount);
  };

  // Percentage badge component
  const PctBadge = ({ value }) => {
    const isPositive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
        isPositive
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/15 text-red-600 dark:text-red-400'
      }`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  // Custom chart tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`px-4 py-3 rounded-xl shadow-xl border ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
        }`}>
          <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>{entry.name}:</span>
              <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {entry.dataKey === 'valor' ? formatCurrency(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-slate-950' : 'bg-gray-50'
      }`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-14 h-14 border-[3px] border-blue-500/30 border-t-blue-500 rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Cargando panel...
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className={`min-h-screen transition-colors ${
        isDark ? 'bg-slate-950' : 'bg-gray-50/80'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">

          {/* ===== HEADER ===== */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 sm:mb-8"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {getGreeting()}
                </p>
                <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  Panel de Ventas
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Calendar className="w-3.5 h-3.5" />
                    {currentTime.toLocaleDateString('es-CL', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {currentTime.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/salida-inventario')}
                  className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/25 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Nueva Venta</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/historial')}
                  className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Reportes</span>
                </motion.button>
              </div>
            </div>

            {/* Selectores — inventario y mes */}
            <div className="mt-4 flex flex-wrap gap-2">
              {!assignedInventories && (
                <select
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                    isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  <option value="all">Todos los inventarios</option>
                  {hasLegacyInventory && <option value="legacy">Inventario Principal</option>}
                  {inventories.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.name}</option>
                  ))}
                </select>
              )}
              {/* Selector de mes */}
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                  selectedMonth !== availableMonths[0].key
                    ? isDark
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-violet-50 border-violet-300 text-violet-700'
                    : isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                {availableMonths.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              {selectedMonth !== availableMonths[0].key && (
                <button
                  onClick={() => setSelectedMonth(availableMonths[0].key)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Mes actual
                </button>
              )}
            </div>
          </motion.div>

          {/* ===== VENTAS DEL DÍA - HERO CARD ===== */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6 ${
              isDark
                ? 'bg-gradient-to-br from-blue-600/20 via-slate-800 to-indigo-600/20 border border-blue-500/20'
                : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700'
            }`}
          >
            {/* Glow effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${isDark ? 'text-blue-300/70' : 'text-blue-200'}`}>
                  {selectedMonth === availableMonths[0].key ? 'Ventas de Hoy' : `Ventas — ${availableMonths.find(m => m.key === selectedMonth)?.label}`}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-white/20 text-white'
                }`}>
                  {selectedMonth === availableMonths[0].key ? 'En vivo' : 'Histórico'}
                </span>
              </div>

              <div className="flex items-end gap-3 mb-3">
                <SensitiveInfoGuard type="costs">
                  <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    isDark ? 'text-white' : 'text-white'
                  }`}>
                    {selectedMonth === availableMonths[0].key
                      ? formatCurrency(salesKPIs.valorHoy)
                      : formatCurrency(salesKPIs.valorMes)}
                  </h2>
                </SensitiveInfoGuard>
                {selectedMonth === availableMonths[0].key && salesKPIs.pctHoy !== 0 && <PctBadge value={salesKPIs.pctHoy} />}
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className={`w-4 h-4 ${isDark ? 'text-blue-300/60' : 'text-blue-200'}`} />
                  <span className={`text-sm font-semibold ${isDark ? 'text-blue-100' : 'text-white'}`}>
                    {selectedMonth === availableMonths[0].key ? salesKPIs.numVentasHoy : salesKPIs.numVentasMes}
                  </span>
                  <span className={`text-sm ${isDark ? 'text-blue-300/60' : 'text-blue-200'}`}>ventas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className={`w-4 h-4 ${isDark ? 'text-blue-300/60' : 'text-blue-200'}`} />
                  <span className={`text-sm font-semibold ${isDark ? 'text-blue-100' : 'text-white'}`}>
                    {selectedMonth === availableMonths[0].key ? salesKPIs.cantidadHoy.toFixed(0) : salesKPIs.cantidadMes.toFixed(0)}
                  </span>
                  <span className={`text-sm ${isDark ? 'text-blue-300/60' : 'text-blue-200'}`}>unidades</span>
                </div>
              </div>

              {/* Desglose por medio de pago -- solo para "hoy" (en vivo), no
                  para meses históricos. Mismo cálculo que ya usa el cierre
                  de turno de caja (cash-register-service.js), para que el
                  total de efectivo acá coincida con lo que la cajera espera
                  contar al cerrar su turno. */}
              {selectedMonth === availableMonths[0].key && salesKPIs.valorHoy > 0 && (
                <SensitiveInfoGuard type="costs">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 pt-3 border-t border-white/10">
                    {[
                      { key: 'CASH', icon: '💵', label: 'Efectivo' },
                      { key: 'CARD', icon: '💳', label: 'Tarjeta' },
                      { key: 'TRANSFER', icon: '🏦', label: 'Transferencia' },
                      { key: 'OTHER', icon: '💰', label: 'Otro' },
                    ].filter(m => salesKPIs.porMetodoPagoHoy[m.key] > 0).map(m => (
                      <div key={m.key} className="flex items-center gap-1.5">
                        <span className="text-xs">{m.icon}</span>
                        <span className={`text-xs font-semibold ${isDark ? 'text-blue-100' : 'text-white'}`}>
                          {formatCurrency(salesKPIs.porMetodoPagoHoy[m.key])}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-blue-300/60' : 'text-blue-200'}`}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </SensitiveInfoGuard>
              )}
            </div>
          </motion.div>

          {/* Resumen de pedidos de la tienda online -- se muestra antes que
              las métricas de venta porque, para un negocio con delivery
              activo, es lo más urgente de revisar al entrar. No renderiza
              nada si el negocio no tiene tienda pública activa. */}
          <DashboardOrdersSummary isDark={isDark} />

          {/* ===== KPI CARDS ROW ===== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6" data-tour="dashboard-cards">
            {/* Semana */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-2xl p-4 sm:p-5 transition-shadow hover:shadow-lg ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-indigo-500/15' : 'bg-indigo-50'
                }`}>
                  <TrendingUp className={`w-4.5 h-4.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                </div>
                {salesKPIs.pctSemana !== 0 && <PctBadge value={salesKPIs.pctSemana} />}
              </div>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                Últimos 7 días
              </p>
              <SensitiveInfoGuard type="costs">
                <p className={`text-lg sm:text-xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatCompact(salesKPIs.valorSemana)}
                </p>
              </SensitiveInfoGuard>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                {salesKPIs.numVentasSemana} ventas
              </p>
            </motion.div>

            {/* Mes */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`rounded-2xl p-4 sm:p-5 transition-shadow hover:shadow-lg ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-violet-500/15' : 'bg-violet-50'
                }`}>
                  <Award className={`w-4.5 h-4.5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                </div>
                {salesKPIs.pctMes !== 0 && <PctBadge value={salesKPIs.pctMes} />}
              </div>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {selectedMonth === availableMonths[0].key ? 'Este mes' : availableMonths.find(m => m.key === selectedMonth)?.label}
              </p>
              <SensitiveInfoGuard type="costs">
                <p className={`text-lg sm:text-xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatCompact(salesKPIs.valorMes)}
                </p>
              </SensitiveInfoGuard>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                {salesKPIs.numVentasMes} ventas
              </p>
            </motion.div>

            {/* Valor Inventario */}
            <SensitiveInfoGuard type="inventory_value">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`rounded-2xl p-4 sm:p-5 transition-shadow hover:shadow-lg ${
                  isDark
                    ? 'bg-slate-800/80 border border-slate-700/60'
                    : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'
                  }`}>
                    <DollarSign className={`w-4.5 h-4.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                </div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Valor inventario
                </p>
                <p className={`text-lg sm:text-xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatCompact(inventoryValue)}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {inventory.length} productos
                </p>
              </motion.div>
            </SensitiveInfoGuard>

            {/* Stock Crítico */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`rounded-2xl p-4 sm:p-5 transition-shadow hover:shadow-lg ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  (stockCritico.sinStock + stockCritico.critico) > 0
                    ? isDark ? 'bg-red-500/15' : 'bg-red-50'
                    : isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'
                }`}>
                  <AlertTriangle className={`w-4.5 h-4.5 ${
                    (stockCritico.sinStock + stockCritico.critico) > 0
                      ? isDark ? 'text-red-400' : 'text-red-600'
                      : isDark ? 'text-emerald-400' : 'text-emerald-600'
                  }`} />
                </div>
              </div>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                Stock Crítico
              </p>
              <div className="flex items-baseline gap-2">
                <p className={`text-lg sm:text-xl font-extrabold ${
                  stockCritico.sinStock > 0 ? 'text-red-500' : isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {stockCritico.sinStock}
                </p>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>sin stock</span>
                <p className={`text-lg sm:text-xl font-extrabold ${
                  stockCritico.critico > 0 ? 'text-amber-500' : isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {stockCritico.critico}
                </p>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>bajo</span>
              </div>
            </motion.div>
          </div>

          {/* ===== CHART ===== */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 ${
              isDark
                ? 'bg-slate-800/80 border border-slate-700/60'
                : 'bg-white border border-gray-100 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Tendencia de Ventas
                </h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  Últimos 7 días
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Unidades</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Valor</span>
                </div>
              </div>
            </div>

            {salesChartData.every(d => d.cantidad === 0) ? (
              <div className="text-center py-12">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  isDark ? 'bg-slate-700' : 'bg-gray-100'
                }`}>
                  <TrendingUp className={`w-7 h-7 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  No hay ventas registradas
                </h3>
                <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Comienza registrando tu primera venta
                </p>
                <button
                  onClick={() => navigate('/salida-inventario')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/25 transition-colors inline-flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Registrar Venta
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorCantidad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#1e293b' : '#f1f5f9'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dia"
                    stroke={isDark ? '#475569' : '#94a3b8'}
                    style={{ fontSize: '11px', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    stroke={isDark ? '#475569' : '#94a3b8'}
                    style={{ fontSize: '11px' }}
                    axisLine={false}
                    tickLine={false}
                    dx={-5}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cantidad"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#colorCantidad)"
                    name="Unidades"
                    dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: isDark ? '#0f172a' : '#ffffff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorValor)"
                    name="Ventas"
                    dot={{ fill: '#6366f1', r: 2.5, strokeWidth: 0 }}
                    activeDot={{ r: 4, stroke: '#6366f1', strokeWidth: 2, fill: isDark ? '#0f172a' : '#ffffff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* ===== TWO COLUMN: TOP PRODUCTS + STOCK CRÍTICO ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Más Vendidos */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className={`rounded-2xl p-4 sm:p-6 ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-amber-500/15' : 'bg-amber-50'
                  }`}>
                    <Award className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  </div>
                  <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Más Vendidos
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/que-comprar')}
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}
                >
                  Qué comprar <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {topProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No hay ventas aún</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Rank */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === 0
                          ? 'bg-amber-500/15 text-amber-500'
                          : index === 1
                          ? 'bg-slate-400/15 text-slate-400'
                          : index === 2
                          ? 'bg-orange-500/15 text-orange-500'
                          : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>

                      {/* Photo */}
                      {product.photoURL ? (
                        <img
                          src={product.photoURL}
                          alt={product.name}
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDark ? 'bg-slate-700' : 'bg-gray-100'
                        }`}>
                          <Package className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                        </div>
                      )}

                      {/* Name */}
                      <span className={`flex-1 font-medium text-sm truncate ${
                        isDark ? 'text-slate-200' : 'text-gray-800'
                      }`}>
                        {product.name}
                      </span>

                      {/* Quantity */}
                      <span className={`text-base font-bold flex-shrink-0 ${
                        isDark ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        {product.totalQuantity.toFixed(0)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Stock Crítico */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`rounded-2xl p-4 sm:p-6 ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-red-500/15' : 'bg-red-50'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Stock Crítico
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/mis-inventarios')}
                  className={`text-xs font-semibold flex items-center gap-0.5 transition-colors ${
                    isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Ver todo
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {stockCritico.items.length === 0 ? (
                <div className="text-center py-8">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                    isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                  }`}>
                    <Package className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    Todo el stock está bien
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stockCritico.items.map((item, index) => {
                    const isZero = item.stock === 0;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + index * 0.05 }}
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          isDark
                            ? isZero ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                            : isZero ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isZero
                              ? isDark ? 'bg-red-500/20' : 'bg-red-100'
                              : isDark ? 'bg-amber-500/20' : 'bg-amber-100'
                          }`}>
                            <BoxIcon className={`w-3.5 h-3.5 ${
                              isZero
                                ? isDark ? 'text-red-400' : 'text-red-600'
                                : isDark ? 'text-amber-400' : 'text-amber-600'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`font-medium text-sm block truncate ${
                              isDark ? 'text-slate-200' : 'text-gray-800'
                            }`}>
                              {item.name}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                              {item.unit}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className={`text-base font-bold ${
                            isZero ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {item.stock}
                          </span>
                          <span className={`text-[10px] font-medium ${
                            isZero ? 'text-red-400/70' : 'text-amber-400/70'
                          }`}>
                            {isZero ? 'Agotado' : 'Bajo'}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* ===== FEED EN VIVO ===== */}
          <div className="mb-4 sm:mb-6">
            <DashboardLiveFeed movements={recentMovements} isDark={isDark} />
          </div>

          {/* ===== MOVIMIENTOS RECIENTES (oculto — reemplazado por LiveFeed) ===== */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="hidden"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-blue-500/15' : 'bg-blue-50'
                }`}>
                  <Activity className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Últimas Ventas
                </h2>
              </div>
              <button
                onClick={() => navigate('/historial')}
                className={`text-xs font-semibold flex items-center gap-0.5 transition-colors ${
                  isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Ver todo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMovements.length === 0 ? (
              <div className="text-center py-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                  isDark ? 'bg-slate-700' : 'bg-gray-100'
                }`}>
                  <Activity className={`w-7 h-7 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Sin movimientos
                </h3>
                <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Registra tu primera venta
                </p>
                <button
                  onClick={() => navigate('/salida-inventario')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/25 transition-colors inline-flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Registrar Venta
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMovements.map((movement, index) => (
                  <motion.div
                    key={movement.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.04 }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Indicator */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDark ? 'bg-blue-500/15' : 'bg-blue-50'
                    }`}>
                      <ShoppingCart className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {movement.workerName}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                          isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {movement.warehouseName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                          {movement.totalProducts} prod. · {movement.totalQuantity.toFixed(0)} uds
                        </span>
                      </div>
                    </div>

                    {/* Value + Time */}
                    <div className="text-right flex-shrink-0">
                      <SensitiveInfoGuard type="costs">
                        <span className={`text-sm font-bold block ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          {formatCurrency(movement.totalValue)}
                        </span>
                      </SensitiveInfoGuard>
                      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {movement.createdAt.toLocaleString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ===== INGRESOS Y MERMAS DEL MES ===== */}
          {(inventoryMovements.ingresos.length > 0 || inventoryMovements.mermas.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
            >
              {/* Ingresos */}
              <div
                onClick={() => setMovModal('ingresos')}
                className={`rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg ${isDark ? 'bg-slate-800/80 border border-slate-700/60 hover:border-emerald-500/30' : 'bg-white border border-gray-100 shadow-sm hover:border-emerald-200'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
                    <PackagePlus className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ingresos del mes</h2>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    {inventoryMovements.ingresos.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {inventoryMovements.ingresos.slice(0, 4).map((h, i) => (
                    <div key={i} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${isDark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{h.producto}</p>
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                          {h.fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ml-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+{h.qty} {h.unidad}</span>
                    </div>
                  ))}
                  {inventoryMovements.ingresos.length === 0 && (
                    <p className={`text-xs text-center py-4 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>Sin ingresos este mes</p>
                  )}
                </div>
                <div className={`mt-3 pt-2 border-t flex items-center justify-center gap-1 text-xs font-semibold ${isDark ? 'border-slate-700/50 text-emerald-400' : 'border-gray-100 text-emerald-600'}`}>
                  Ver todos <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Mermas */}
              <div
                onClick={() => setMovModal('mermas')}
                className={`rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg ${isDark ? 'bg-slate-800/80 border border-slate-700/60 hover:border-orange-500/30' : 'bg-white border border-gray-100 shadow-sm hover:border-orange-200'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/15' : 'bg-orange-50'}`}>
                    <Trash2 className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                  </div>
                  <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mermas del mes</h2>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                    {inventoryMovements.mermas.length}
                  </span>
                </div>
                {inventoryMovements.totalMermas > 0 && (
                  <p className={`text-xs mb-2 font-semibold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                    Costo de mermas: {formatCurrency(inventoryMovements.totalMermas)}
                  </p>
                )}
                <div className="space-y-2">
                  {inventoryMovements.mermas.slice(0, 4).map((h, i) => (
                    <div key={i} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${isDark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{h.producto}</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                            {h.fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                          </p>
                          {h.reason && <span className={`text-[9px] px-1 py-0.5 rounded ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>{h.reason}</span>}
                        </div>
                      </div>
                      <span className={`text-xs font-bold ml-2 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>−{h.qty} {h.unidad}</span>
                    </div>
                  ))}
                  {inventoryMovements.mermas.length === 0 && (
                    <p className={`text-xs text-center py-4 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>Sin mermas este mes</p>
                  )}
                </div>
                <div className={`mt-3 pt-2 border-t flex items-center justify-center gap-1 text-xs font-semibold ${isDark ? 'border-slate-700/50 text-orange-400' : 'border-gray-100 text-orange-600'}`}>
                  Ver todos <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== QUICK ACTIONS ===== */}
          <motion.div
            data-tour="quick-actions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="grid grid-cols-3 gap-3 sm:gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/salida-inventario')}
              className={`p-4 sm:p-5 rounded-2xl text-left transition-shadow hover:shadow-lg ${
                isDark
                  ? 'bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/20'
                  : 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-600/20'
              }`}
            >
              <Zap className={`w-6 h-6 sm:w-7 sm:h-7 mb-2 ${isDark ? 'text-blue-400' : 'text-white'}`} />
              <h3 className={`font-bold text-sm sm:text-base mb-0.5 ${isDark ? 'text-white' : 'text-white'}`}>
                Venta
              </h3>
              <p className={`text-[10px] sm:text-xs hidden sm:block ${isDark ? 'text-blue-300/60' : 'text-blue-100'}`}>
                Registrar salida
              </p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/mis-inventarios')}
              className={`p-4 sm:p-5 rounded-2xl text-left transition-shadow hover:shadow-lg ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <Package className={`w-6 h-6 sm:w-7 sm:h-7 mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`} />
              <h3 className={`font-bold text-sm sm:text-base mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Inventario
              </h3>
              <p className={`text-[10px] sm:text-xs hidden sm:block ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                Gestionar stock
              </p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/historial')}
              className={`p-4 sm:p-5 rounded-2xl text-left transition-shadow hover:shadow-lg ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <BarChart3 className={`w-6 h-6 sm:w-7 sm:h-7 mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`} />
              <h3 className={`font-bold text-sm sm:text-base mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Reportes
              </h3>
              <p className={`text-[10px] sm:text-xs hidden sm:block ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                Análisis completo
              </p>
            </motion.button>
          </motion.div>

        </div>
      </div>

      {/* Modal ingresos / mermas */}
      {movModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setMovModal(null)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                {movModal === 'ingresos'
                  ? <PackagePlus className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  : <Trash2 className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                }
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {movModal === 'ingresos' ? 'Ingresos del mes' : 'Mermas del mes'}
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  movModal === 'ingresos'
                    ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                    : isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'
                }`}>
                  {movModal === 'ingresos' ? inventoryMovements.ingresos.length : inventoryMovements.mermas.length}
                </span>
              </div>
              <button onClick={() => setMovModal(null)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                ✕
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {movModal === 'ingresos' && inventoryMovements.ingresos.map((h, i) => (
                <div key={i} className={`flex items-center justify-between py-2.5 border-b last:border-0 ${isDark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{h.producto}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {h.fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ml-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+{h.qty} {h.unidad}</span>
                </div>
              ))}
              {movModal === 'mermas' && inventoryMovements.mermas.map((h, i) => (
                <div key={i} className={`flex items-center justify-between py-2.5 border-b last:border-0 ${isDark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{h.producto}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {h.fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {h.reason && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>{h.reason}</span>}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <span className={`text-sm font-bold block ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>−{h.qty} {h.unidad}</span>
                    {h.valor > 0 && <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{formatCurrency(h.valor)}</span>}
                  </div>
                </div>
              ))}
            </div>

            {movModal === 'mermas' && inventoryMovements.totalMermas > 0 && (
              <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <p className={`text-sm font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                  Costo total de mermas: {formatCurrency(inventoryMovements.totalMermas)}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
