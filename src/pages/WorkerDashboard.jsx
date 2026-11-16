// src/pages/WorkerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Warehouse,
  DollarSign,
  User,
  LogOut,
  AlertCircle,
  AlertTriangle,
  Star,
  Sparkles,
  ShoppingCart,
  BarChart3,
  Shield,
  Clock,
  TrendingUp,
  Activity,
  CheckCircle,
  Calendar,
  ArrowRight,
  Bell,
  Zap,
  Camera,
  Lock,
  Unlock,
  MapPin
} from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebase.js';
import { getWorkerByEmail, formatCLP } from '../services/workers-service.js';
import { getWorkerDailyUsage, getExitsByWorker } from '../services/inventory-exits-service.js';
import { getActiveCashRegister } from '../services/cash-register-service.js';
import { getUserCompanyId } from '../services/companyService.js';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { AreaChart, Area, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import ImprovedBarcodeScanner from '../components/inventory/ImprovedBarcodeScanner.jsx';
import GlobalLoading from '../components/GlobalLoading.jsx';
import WorkerDrawerMenu from '../components/WorkerDrawerMenu.jsx';

const WorkerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState(null);
  const [dailyUsage, setDailyUsage] = useState(null);
  const [assignedWarehouses, setAssignedWarehouses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showScanner, setShowScanner] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [inventoriesWithWarehouses, setInventoriesWithWarehouses] = useState([]);
  const [activeCashRegister, setActiveCashRegister] = useState(null);
  const [isWholesaleBusiness, setIsWholesaleBusiness] = useState(false);

  // ===== EFECTOS =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔍 WorkerDashboard - Usuario actual:', user?.email || 'No autenticado');

      if (!user) {
        console.log('❌ No hay usuario autenticado, redirigiendo al login');
        navigate('/login');
        return;
      }

      try {
        console.log('🔍 Buscando datos del trabajador:', user.email);
        // Obtener datos del trabajador
        const workerData = await getWorkerByEmail(user.email);

        if (!workerData) {
          // Puede ser que no tenga companyId en claims todavía
          // No cerrar sesión, mostrar error y dejar que el admin lo revise
          console.log('❌ Trabajador no encontrado en la base de datos');
          setLoading(false);
          return;
        }

        console.log('✅ Trabajador encontrado:', workerData.name, '- Rol:', workerData.role);

        if (workerData.role === 'ADMIN') {
          // Admin debe ir al dashboard principal
          console.log('➡️ Admin detectado, redirigiendo al dashboard principal');
          navigate('/dashboard');
          return;
        }

        console.log('✅ Configurando trabajador en el estado');
        setWorker(workerData);

        // Cargar turno de caja activo para CAJERA
        if (workerData.role === 'CAJERA' && workerData.id) {
          try {
            const active = await getActiveCashRegister(workerData.id);
            setActiveCashRegister(active);
          } catch (e) {
            console.warn('⚠️ No se pudo cargar turno de caja:', e.message);
          }
        }

        // Cargar bodegas asignadas
        await loadAssignedWarehouses(workerData);

        // Cargar TODOS los inventarios con sus bodegas
        await loadAllInventoriesWithWarehouses(workerData);

        // Obtener uso diario - continuar aunque falle
        try {
          const usage = await getWorkerDailyUsage(workerData.id);
          setDailyUsage(usage);
          console.log('✅ Uso diario cargado');
        } catch (usageError) {
          console.warn('⚠️ Error cargando uso diario (no crítico):', usageError.message);
          setDailyUsage(null);
        }


        setLoading(false);

      } catch (error) {
        console.error('🚨 Error crítico cargando datos del trabajador:', error);
        await signOut(auth);
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Actualizar hora en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar actividad reciente cuando tengamos el worker
  useEffect(() => {
    if (worker) {
      loadRecentActivity(worker.id);
    }
  }, [worker]);

  // "Buscar clientes cerca" solo aplica a distribuidoras/mayoristas
  useEffect(() => {
    (async () => {
      try {
        const { companyIsWholesale } = await import('../services/companyService.js');
        const companyId = await getUserCompanyId();
        setIsWholesaleBusiness(await companyIsWholesale(companyId));
      } catch {}
    })();
  }, []);

  // Cargar productos cuando tengamos bodegas asignadas
  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        const companyId = await getUserCompanyId();
        if (!companyId) return;

        const inventoryRef = collection(db, `companies/${companyId}/inventory`);
        const snapshot = await getDocs(inventoryRef);
        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setAllProducts(products);
      } catch (error) {
        console.error('Error cargando productos:', error);
      }
    };

    if (assignedWarehouses.length > 0 && !loading) {
      loadAllProducts();
    }
  }, [assignedWarehouses, loading]);

  // ===== FUNCIONES =====
  const loadAssignedWarehouses = async (workerData) => {
    try {
      console.log('🏭 Cargando bodegas asignadas:', workerData.assignedWarehouses);

      if (!workerData.assignedWarehouses || workerData.assignedWarehouses.length === 0) {
        console.log('⚠️ Sin bodegas asignadas');
        setAssignedWarehouses([]);
        return;
      }

      // Obtener detalles de las bodegas
      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('❌ No se pudo obtener el companyId');
        setAssignedWarehouses([]);
        return;
      }

      const warehousesQuery = query(
        collection(db, `companies/${companyId}/warehouses`),
        where('__name__', 'in', workerData.assignedWarehouses)
      );

      const snapshot = await getDocs(warehousesQuery);
      const warehouses = [];

      snapshot.forEach(doc => {
        warehouses.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('✅ Bodegas cargadas:', warehouses.length);
      setAssignedWarehouses(warehouses);

    } catch (error) {
      console.error('Error cargando bodegas:', error);
      setAssignedWarehouses([]);
    }
  };

  const loadAllInventoriesWithWarehouses = async (workerData) => {
    try {
      console.log('📦 Cargando TODOS los inventarios con sus bodegas...');
      const companyId = await getUserCompanyId();
      if (!companyId) return;

      // Obtener todos los inventarios
      const inventoriesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories`));
      const inventoriesData = [];

      for (const invDoc of inventoriesSnapshot.docs) {
        const inventory = {
          id: invDoc.id,
          ...invDoc.data(),
          warehouses: []
        };

        // Obtener bodegas de este inventario
        const warehousesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/warehouses`));

        warehousesSnapshot.forEach(whDoc => {
          const warehouse = {
            id: whDoc.id,
            ...whDoc.data(),
            inventoryId: invDoc.id,
            inventoryName: inventory.name
          };

          // Solo agregar si el trabajador tiene acceso a esta bodega
          if (workerData.assignedWarehouses && workerData.assignedWarehouses.includes(whDoc.id)) {
            inventory.warehouses.push(warehouse);
          }
        });

        // Solo agregar inventarios que tengan al menos una bodega accesible
        if (inventory.warehouses.length > 0) {
          inventoriesData.push(inventory);
        }
      }

      console.log('✅ Inventarios cargados:', inventoriesData.length, inventoriesData);
      setInventoriesWithWarehouses(inventoriesData);

    } catch (error) {
      console.error('Error cargando inventarios y bodegas:', error);
      setInventoriesWithWarehouses([]);
    }
  };

  const loadRecentActivity = async (workerId) => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return;

      const exitsQuery = query(
        collection(db, `companies/${companyId}/inventory_exits`),
        where('workerId', '==', workerId),
        limit(10)
      );

      const snapshot = await getDocs(exitsQuery);
      const activities = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          ...data,
          exitDate: data.exitDate?.toDate() || new Date()
        });
      });

      setRecentActivity(activities);
    } catch (error) {
      console.warn('Error cargando actividad reciente:', error);
      setRecentActivity([]);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };


  const navigateToWarehouse = (warehouse) => {
    // Navegar directamente a la salida de inventario de la bodega
    const params = new URLSearchParams({
      warehouseId: warehouse.id,
      name: warehouse.name,
      location: warehouse.location || '',
      inventoryId: warehouse.inventoryId || '',
      inventoryName: warehouse.inventoryName || ''
    });

    navigate(`/salida-inventario?${params.toString()}`);
  };






  // Animaciones simplificadas


  // ===== RENDERIZADO =====
  if (loading) {
    return <GlobalLoading />;
  }

  if (!worker) {
    return (
      <motion.div
        className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Background Animated Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-red-500 to-red-600 rounded-full opacity-20"
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
          />
        </div>

        <motion.div
          className="relative z-10 text-center bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200 p-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", damping: 15 }}
          >
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          </motion.div>
          <motion.h2
            className="text-xl font-semibold text-gray-900 mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Acceso Denegado
          </motion.h2>
          <motion.p
            className="text-gray-600"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            No tienes permisos para acceder a esta vista.
          </motion.p>
        </motion.div>
      </motion.div>
    );
  }

  const getRemainingLimit = () => {
    if (!dailyUsage || worker.limitType === 'NONE') return null;

    if (worker.limitType === 'MONEY') {
      const used = dailyUsage.usedAmountMoney || 0;
      const limit = worker.dailyLimitMoney || 0;
      const remaining = Math.max(0, limit - used);
      return {
        type: 'money',
        used,
        limit,
        remaining,
        percentage: limit > 0 ? (used / limit) * 100 : 0
      };
    } else if (worker.limitType === 'PRODUCTS') {
      const used = dailyUsage.usedAmountProducts || 0;
      const limit = worker.dailyLimitProducts || 0;
      const remaining = Math.max(0, limit - used);
      return {
        type: 'products',
        used,
        limit,
        remaining,
        percentage: limit > 0 ? (used / limit) * 100 : 0
      };
    }

    return null;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const limitInfo = getRemainingLimit();

  // Datos de ejemplo para gráficos (puedes mejorar esto con datos reales)
  const weeklyData = [
    { day: 'Lun', value: 12 },
    { day: 'Mar', value: 19 },
    { day: 'Mié', value: 15 },
    { day: 'Jue', value: 22 },
    { day: 'Vie', value: 18 },
    { day: 'Sáb', value: 8 },
    { day: 'Dom', value: 5 },
  ];

  const handleScanSuccess = (product) => {
    console.log('📷 Producto escaneado:', product);
    setShowScanner(false);

    // Navegar a la salida de inventario con el producto pre-seleccionado
    if (assignedWarehouses.length > 0) {
      const firstWarehouse = assignedWarehouses[0];
      const params = new URLSearchParams({
        warehouseId: firstWarehouse.id,
        name: firstWarehouse.name,
        location: firstWarehouse.location || '',
        productId: product.id
      });
      navigate(`/salida-inventario?${params.toString()}`);
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Header Moderno */}
        <motion.div
          className="bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-xl"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row items-center justify-between gap-4">
              {/* Left - Greeting */}
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                <motion.div
                  className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-500/20"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  animate={{
                    boxShadow: [
                      '0 10px 30px rgba(59, 130, 246, 0.3)',
                      '0 10px 40px rgba(99, 102, 241, 0.4)',
                      '0 10px 30px rgba(59, 130, 246, 0.3)',
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <User className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-xl md:text-3xl font-bold text-white mb-1">
                    {getGreeting()}, <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{worker.name}</span>
                  </h1>
                  <p className="text-xs md:text-sm text-blue-200 flex items-center gap-2">
                    <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                    {formatDate(currentTime)}
                    <span className="hidden md:inline">•</span>
                    <Clock className="w-3 h-3 md:w-4 md:h-4 hidden md:inline" />
                    <span className="hidden md:inline">{formatTime(currentTime)}</span>
                  </p>
                </div>
              </div>

              {/* Right - Drawer Menu */}
              <WorkerDrawerMenu workerRole={worker?.role} workerName={worker?.name} workerPermissions={worker?.customPermissions || []} showTerreno={isWholesaleBusiness} />
            </div>
          </div>
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
          {/* Alert if near limit */}
          {limitInfo && limitInfo.percentage > 85 && (
            <motion.div
              className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-l-4 border-amber-500 p-4 rounded-xl shadow-lg backdrop-blur-sm border border-amber-500/30"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Límite Cercano</h3>
                  <p className="text-sm text-amber-200">
                    Has usado {Math.round(limitInfo.percentage)}% de tu límite diario.
                    {limitInfo.type === 'money'
                      ? ` Quedan ${formatCLP(limitInfo.remaining)} disponibles.`
                      : ` Quedan ${limitInfo.remaining} productos disponibles.`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Card de caja para CAJERA */}
          {worker?.role === 'CAJERA' && (
            <motion.button
              onClick={() => navigate('/caja')}
              className={`w-full rounded-3xl text-center transition-all relative overflow-hidden ${
                activeCashRegister
                  ? 'bg-gradient-to-br from-green-500 to-emerald-700 shadow-[0_8px_32px_rgba(16,185,129,0.4)]'
                  : 'bg-gradient-to-br from-slate-600 to-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Círculo decorativo de fondo */}
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />

              <div className="relative p-8 flex flex-col items-center gap-4">
                {/* Ícono grande */}
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl ${
                  activeCashRegister
                    ? 'bg-white/20 ring-4 ring-white/30'
                    : 'bg-white/10 ring-4 ring-white/10'
                }`}>
                  {activeCashRegister
                    ? <Unlock className="w-12 h-12 text-white" />
                    : <Lock className="w-12 h-12 text-white/80" />
                  }
                </div>

                {/* Estado */}
                <div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
                    activeCashRegister ? 'bg-green-400/30 text-green-100' : 'bg-white/10 text-white/60'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${activeCashRegister ? 'bg-green-300 animate-pulse' : 'bg-white/40'}`} />
                    {activeCashRegister ? 'TURNO ACTIVO' : 'SIN TURNO'}
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-1">
                    {activeCashRegister ? 'Caja Abierta' : 'Caja Cerrada'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {activeCashRegister
                      ? `Fondo inicial: ${formatCLP(activeCashRegister.initialCash || 0)}`
                      : 'Toca para iniciar tu turno'}
                  </p>
                </div>

                {/* CTA */}
                <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm mt-1 ${
                  activeCashRegister
                    ? 'bg-white text-emerald-700'
                    : 'bg-white/20 text-white'
                }`}>
                  {activeCashRegister ? 'Ver mi caja' : 'Abrir turno'}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.button>
          )}

          {/* Panel VENDEDORA */}
          {worker?.role === 'VENDEDORA' && (
            <motion.div className="space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              {/* Stats rápidas del día */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                  <p className="text-xs text-blue-300 font-medium mb-1">Ventas hoy</p>
                  <p className="text-2xl font-bold text-white">
                    {recentActivity.filter(a => {
                      const d = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.() || new Date();
                      return d.toDateString() === new Date().toDateString() && a.reason === 'SALE';
                    }).length}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                  <p className="text-xs text-blue-300 font-medium mb-1">Monto hoy</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCLP(recentActivity.filter(a => {
                      const d = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.() || new Date();
                      return d.toDateString() === new Date().toDateString() && a.reason === 'SALE';
                    }).reduce((s, a) => s + (a.totalValue || 0), 0))}
                  </p>
                </div>
              </div>

              {/* Acciones principales */}
              <motion.button
                onClick={() => navigate('/salida-inventario')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 shadow-xl border border-blue-400/20 hover:border-blue-400/50 transition-all text-left group"
                whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-lg">Nueva Venta</p>
                    <p className="text-sm text-blue-200">Registrar venta de productos</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>

              <motion.button
                onClick={() => navigate('/mis-ventas')}
                className="w-full bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:border-purple-400/40 hover:bg-white/15 transition-all text-left group"
                whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-lg">Mis Ventas y Comisión</p>
                    <p className="text-sm text-blue-200">Historial de ventas y comisión a cobrar</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>

              {isWholesaleBusiness && (
                <motion.button
                  onClick={() => navigate('/terreno')}
                  className="w-full bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:border-emerald-400/40 hover:bg-white/15 transition-all text-left group"
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-emerald-300" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg">Buscar clientes cerca</p>
                      <p className="text-sm text-blue-200">Encuentra negocios cerca de donde estás</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              )}

              {/* Límite diario si aplica */}
              {limitInfo && (
                <div className={`rounded-2xl p-4 border ${
                  limitInfo.percentage > 90 ? 'bg-red-500/10 border-red-500/30' :
                  limitInfo.percentage > 70 ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-green-500/10 border-green-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">Límite diario</p>
                    <p className={`text-sm font-bold ${
                      limitInfo.percentage > 90 ? 'text-red-400' :
                      limitInfo.percentage > 70 ? 'text-amber-400' : 'text-green-400'
                    }`}>{Math.round(limitInfo.percentage)}%</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${
                      limitInfo.percentage > 90 ? 'bg-red-400' :
                      limitInfo.percentage > 70 ? 'bg-amber-400' : 'bg-green-400'
                    }`} style={{ width: `${Math.min(limitInfo.percentage, 100)}%` }} />
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    {limitInfo.type === 'money' ? `Disponible: ${formatCLP(limitInfo.remaining)}` : `Disponible: ${limitInfo.remaining} productos`}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Panel GARZÓN */}
          {worker?.role === 'GARZON' && (
            <motion.div className="space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <motion.button
                onClick={() => navigate('/mis-mesas')}
                className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 shadow-xl border border-blue-400/30 hover:border-blue-400/60 transition-all text-center relative overflow-hidden"
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
                <div className="relative flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl bg-white/20 ring-4 ring-white/30">
                    <Warehouse className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-white mb-1">Mis Mesas</h3>
                    <p className="text-white/70 text-sm">Tocá para ver el mapa de mesas y tomar pedidos</p>
                  </div>
                  <div className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm mt-1 bg-white text-indigo-700">
                    Ir a Mesas
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.button>
            </motion.div>
          )}

          {/* Acciones Rápidas - Para roles que no son CAJERA, VENDEDORA ni GARZON */}
          {worker?.role !== 'CAJERA' && worker?.role !== 'VENDEDORA' && worker?.role !== 'GARZON' && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.button
              onClick={() => navigate('/salida-inventario')}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-xl border border-blue-400/30 hover:border-blue-400/60 transition-all text-left group"
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-white/10 group-hover:ring-white/30 transition-all">
                  <ShoppingCart className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white">Registrar Salida</h3>
                  <p className="text-sm text-blue-200">Registrar venta o retiro de productos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-blue-200 group-hover:text-white transition-colors">
                <span className="text-sm font-medium">Ir a registrar</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
            {limitInfo ? (
              <motion.div className={`bg-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-xl border transition-all ${limitInfo.percentage > 90 ? 'border-red-500/50' : limitInfo.percentage > 70 ? 'border-amber-500/50' : 'border-green-500/50'} hover:bg-white/15`} whileHover={{ y: -5, scale: 1.02 }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-lg ring-4 ${limitInfo.percentage > 90 ? 'bg-gradient-to-br from-red-500 to-red-600 ring-red-500/20' : limitInfo.percentage > 70 ? 'bg-gradient-to-br from-amber-500 to-amber-600 ring-amber-500/20' : 'bg-gradient-to-br from-green-500 to-green-600 ring-green-500/20'}`}>
                    <BarChart3 className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <div>
                    <div className={`text-3xl md:text-4xl font-bold ${limitInfo.percentage > 90 ? 'text-red-400' : limitInfo.percentage > 70 ? 'text-amber-400' : 'text-green-400'}`}>{Math.round(limitInfo.percentage)}%</div>
                    <p className="text-sm text-blue-200 font-medium">Límite Usado</p>
                  </div>
                </div>
                <p className={`text-sm ${limitInfo.percentage > 90 ? 'text-red-200' : limitInfo.percentage > 70 ? 'text-amber-200' : 'text-green-200'}`}>
                  {limitInfo.type === 'money' ? `Disponible: ${formatCLP(limitInfo.remaining)}` : `Disponible: ${limitInfo.remaining} productos`}
                </p>
              </motion.div>
            ) : (
              <motion.button onClick={() => navigate('/mis-bodegas')} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-xl border border-white/20 hover:border-indigo-500/50 hover:bg-white/15 transition-all text-left group" whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-indigo-500/20">
                    <Warehouse className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-white">Mis Bodegas</h3>
                    <p className="text-sm text-blue-200">Ver inventario asignado</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-blue-200 group-hover:text-white transition-colors">
                  <span className="text-sm font-medium">Ver bodegas</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            )}
          </motion.div>
          )}

          {/* Actividad Reciente */}
          {recentActivity.length > 0 && (
            <motion.div
              className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 md:p-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Actividad Reciente</h2>
                    <p className="text-blue-100 text-xs">Últimas salidas registradas</p>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-5 space-y-3">
                {recentActivity.map((activity, idx) => (
                  <div key={activity.id || idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {activity.products?.length || 0} producto(s)
                      </p>
                      <p className="text-xs text-blue-200/70">
                        {activity.exitDate instanceof Date ? activity.exitDate.toLocaleDateString('es-CL') : ''}
                      </p>
                    </div>
                    {activity.totalValue && (
                      <span className="text-sm font-bold text-green-400">{formatCLP(activity.totalValue)}</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default WorkerDashboard;