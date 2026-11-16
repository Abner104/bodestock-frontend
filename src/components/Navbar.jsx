// src/components/Navbar.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase.js";
import { collection, onSnapshot, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getUserCompanyId } from "../services/companyService.js";
import { getWorkerByEmail } from "../services/workers-service.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, FileText, DollarSign, User, Users,
  ShoppingBag, ShoppingCart, Settings, LogOut, Warehouse, Archive,
  ChevronDown, Shield, CreditCard, BarChart2, UtensilsCrossed, MapPin
} from "lucide-react";
import Logo from "./ui/Logo";
import ThemeToggle from "./ui/ThemeToggle";
import DynamicIslandNotification from "./DynamicIslandNotification";
import InventoryAssistant from "./InventoryAssistant";
import ModernSidebar from "./ui/ModernSidebar";
import assistantBotGif from '../assets/RobotSaludando.gif';
import { useTheme } from "../contexts/ThemeContext.jsx";
import { filterNavItemsByPermissions } from "../utils/permissionsHelper.js";
import { usePlanFeatures } from "../hooks/usePlanFeatures.js";
import { ROUTE_FEATURE_MAP } from "../config/plan-features.js";
import { useRealCompanyContext, formatContextForPrompt } from "../hooks/useAssistantContext.js";

export default function Navbar() {
  const { hasFeature } = usePlanFeatures();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Impersonation banner
  const impersonationData = (() => {
    try {
      const raw = sessionStorage.getItem('impersonation');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const handleExitImpersonation = async () => {
    const returnPath = impersonationData?.returnPath || '/super-admin';
    const superAdminToken = impersonationData?.superAdminToken;
    sessionStorage.removeItem('impersonation');
    try {
      if (superAdminToken) {
        const { signInWithCustomToken, onAuthStateChanged } = await import('firebase/auth');
        await signInWithCustomToken(auth, superAdminToken);
        // Esperar a que Firebase confirme el nuevo usuario antes de redirigir
        await new Promise((resolve) => {
          const unsub = onAuthStateChanged(auth, (user) => {
            if (user) { unsub(); resolve(); }
          });
          setTimeout(resolve, 3000); // máximo 3s de espera
        });
      } else {
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
      }
    } catch {}
    window.location.href = returnPath;
  };
  const [userRole, setUserRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [hasViewedNotifications, setHasViewedNotifications] = useState(false);
  const [previousLowStockCount, setPreviousLowStockCount] = useState(0);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const realCompanyContext = useRealCompanyContext(isAssistantOpen);

  // Auto-abrir asistente para usuarios nuevos (reemplaza el WelcomeTour)
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('bodestock-tour-completed');
    const hasAiOnboarded = localStorage.getItem('bodestock-ai-onboarded');
    if (!hasOnboarded && !hasAiOnboarded) {
      // Esperar a que la app cargue completamente
      const timer = setTimeout(() => {
        setIsAssistantOpen(true);
        localStorage.setItem('bodestock-ai-onboarded', 'true');
        // Marcar también el tour viejo para no mostrar ambos
        localStorage.setItem('bodestock-tour-completed', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);
  const [companyId, setCompanyId] = useState(null);
  const [gestionActivo, setGestionActivo] = useState(false);
  const [isFoodBusiness, setIsFoodBusiness] = useState(false);
  const [isWholesaleBusiness, setIsWholesaleBusiness] = useState(false);
  const [hasActiveStore, setHasActiveStore] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [userPermissions, setUserPermissions] = useState([]);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900 && !('ontouchstart' in window) && navigator.maxTouchPoints === 0;

  // Close avatar menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const { clearCompanyCache } = await import('../services/companyService');
      clearCompanyCache();
      await signOut(auth);
      setAvatarMenuOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Detectar rol y permisos del usuario
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserRole(null);
        setCurrentUser(null);
        setUserPermissions([]);
        return;
      }

      try {
        const worker = await getWorkerByEmail(user.email);
        if (worker) {
          setUserRole(worker.role);
          setCurrentUser({
            name: worker.name,
            email: worker.email,
            role: worker.role
          });

          if (worker.customPermissions && worker.customPermissions.length > 0) {
            setUserPermissions(worker.customPermissions);
          } else {
            const { DEFAULT_ROLES } = await import('../config/database-schema.js');
            const rolePermissions = DEFAULT_ROLES[worker.role]?.permissions || [];
            setUserPermissions(rolePermissions);
          }
        } else {
          const { DEFAULT_ROLES } = await import('../config/database-schema.js');
          const adminPermissions = DEFAULT_ROLES.ADMIN?.permissions || [];
          setUserRole('ADMIN');
          setCurrentUser({
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: 'ADMIN'
          });
          setUserPermissions(adminPermissions);
        }

        const cid = await getUserCompanyId();
        setCompanyId(cid);

        // Verificar si Mi Consultor está activo para esta empresa
        if (cid) {
          try {
            const configDoc = await getDoc(doc(db, `companies/${cid}/gestion_config/settings`));
            if (configDoc.exists()) setGestionActivo(configDoc.data().gestionActivo === true);
          } catch {}

          // "Mesas" solo aplica a negocios de comida (mismos rubros que usan recetas)
          try {
            const { companyHasFoodBusiness } = await import('../services/companyService.js');
            setIsFoodBusiness(await companyHasFoodBusiness(cid));
          } catch {}

          // "Buscar clientes cerca" solo aplica a distribuidoras/mayoristas
          try {
            const { companyIsWholesale } = await import('../services/companyService.js');
            setIsWholesaleBusiness(await companyIsWholesale(cid));
          } catch {}

          // "Pedidos" (gestión de pedidos de la tienda pública, ver
          // OrdersManagement.jsx / companies/{cid}/orders) solo tiene
          // sentido mostrarlo si al menos un inventario tiene la tienda
          // con carrito activada -- antes aparecía siempre para VENDEDORA
          // sin relación con si la tienda estaba prendida, y nunca para
          // quien realmente administra el negocio (ADMIN/ENCARGADA/GERENTE).
          // catalogEnabled NO vive en el documento raíz de cada inventario
          // (companies/{cid}/inventories/{id}), vive en su subcolección
          // metadata (companies/{cid}/inventories/{id}/metadata/{metaId})
          // -- por eso hay que usar getAllInventories(), que ya resuelve
          // esa metadata por inventario, en vez de leer el nivel raíz
          // directo (bug real: devolvía false siempre, el doc raíz casi
          // no tiene campos propios).
          try {
            const { getAllInventories } = await import('../services/inventories-service.js');
            const allInventories = await getAllInventories();
            setHasActiveStore(allInventories.some((inv) => inv.catalogEnabled === true));
          } catch {}
        }
      } catch (error) {
        console.error('Error obteniendo rol:', error);
        const { DEFAULT_ROLES } = await import('../config/database-schema.js');
        const adminPermissions = DEFAULT_ROLES.ADMIN?.permissions || [];
        setUserRole('ADMIN');
        setCurrentUser({
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          role: 'ADMIN'
        });
        setUserPermissions(adminPermissions);
      }
    });

    return () => unsubscribe();
  }, []);

  // Badge de "Pedidos" en el menú -- cuenta en tiempo real los pedidos
  // pendientes (status PENDING u oficial 'pendiente' de la tienda pública,
  // ver STATUS_FROM_TIENDA en orders-service.js) para que el negocio vea de
  // un vistazo que hay algo nuevo sin tener que entrar a la pantalla.
  // Solo se activa si hay tienda activa, mismo gate que hasActiveStore.
  useEffect(() => {
    if (!companyId || !hasActiveStore) {
      setPendingOrdersCount(0);
      return;
    }
    const q = query(
      collection(db, `companies/${companyId}/orders`),
      where('status', 'in', ['PENDING', 'pendiente'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingOrdersCount(snapshot.size);
    }, (error) => {
      console.error('Error contando pedidos pendientes:', error);
    });
    return () => unsubscribe();
  }, [companyId, hasActiveStore]);

  // Monitorear productos con stock bajo + próximos a vencer (todos los inventarios)
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribes = [];

    const loadAlerts = async () => {
      try {
        const cid = await getUserCompanyId();
        if (!cid) return;

        const allAlerts = { lowStock: [], expiring: [] };
        const updateAlerts = () => {
          setLowStockItems([...allAlerts.lowStock, ...allAlerts.expiring]);
        };

        const processSnapshot = (snapshot, source) => {
          const now = new Date();
          const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const low = [];
          const expiring = [];

          snapshot.forEach((d) => {
            const item = { id: d.id, ...d.data(), _source: source };

            // Los elaborados no tienen stock físico — ignorar en alertas
            const isElaborado = item.productType === 'ELABORADO' || (Array.isArray(item.receta) && item.receta.length > 0);
            if (isElaborado) return;

            const stock = item.stock || 0;

            // Stock bajo
            if (stock === 0 || stock <= 5) {
              low.push({ ...item, _alertType: 'lowStock' });
            }

            // Próximo a vencer
            if (item.expiryDate && stock > 0) {
              try {
                const exp = item.expiryDate.toDate ? item.expiryDate.toDate() : new Date(item.expiryDate);
                if (exp <= in30Days) {
                  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
                  expiring.push({ ...item, _alertType: 'expiring', _daysLeft: diffDays });
                }
              } catch { /* ignore */ }
            }
          });

          return { low, expiring };
        };

        // Detectar inventarios asignados para filtrar alertas
        let allowedInventories = null;
        if (currentUser) {
          const workerData = await getWorkerByEmail(currentUser.email);
          if (workerData && workerData.assignedInventories && workerData.assignedInventories.length > 0) {
            allowedInventories = new Set(workerData.assignedInventories);
          }
        }

        // 1. Escuchar inventario legacy (solo si no tiene restricción)
        if (!allowedInventories) {
          try {
            const legacyUnsub = onSnapshot(
              collection(db, `companies/${cid}/inventory`),
              (snapshot) => {
                const { low, expiring } = processSnapshot(snapshot, 'legacy');
                allAlerts.lowStock = allAlerts.lowStock.filter(i => i._source !== 'legacy').concat(low);
                allAlerts.expiring = allAlerts.expiring.filter(i => i._source !== 'legacy').concat(expiring);
                updateAlerts();
              }
            );
            unsubscribes.push(legacyUnsub);
          } catch { /* no legacy */ }
        }

        // 2. Escuchar inventarios dinámicos (filtrados si tiene asignación)
        const { getDocs } = await import('firebase/firestore');
        const inventoriesSnap = await getDocs(collection(db, `companies/${cid}/inventories`));

        for (const inv of inventoriesSnap.docs) {
          const invId = inv.id;
          // Si tiene inventarios asignados, saltarse los que no corresponden
          if (allowedInventories && !allowedInventories.has(invId)) continue;

          const productsUnsub = onSnapshot(
            collection(db, `companies/${cid}/inventories/${invId}/products`),
            (snapshot) => {
              const { low, expiring } = processSnapshot(snapshot, invId);
              allAlerts.lowStock = allAlerts.lowStock.filter(i => i._source !== invId).concat(low);
              allAlerts.expiring = allAlerts.expiring.filter(i => i._source !== invId).concat(expiring);
              updateAlerts();
            }
          );
          unsubscribes.push(productsUnsub);
        }
      } catch (error) {
        console.error('Error cargando alertas:', error);
      }
    };

    loadAlerts();
    return () => {
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, [currentUser]);

  // Sound on new notifications
  useEffect(() => {
    if (lowStockItems.length > previousLowStockCount && previousLowStockCount > 0 && !hasViewedNotifications) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ8PU6nl8LJjHgU5j9fzy3osBSh+zPLaizsIGGS57uihUREMTqXh8bllHwU2jdXzzn0vBSaByO/dij0HGWi88Oielr7ABL8MBgABB0kP');
      audio.volume = 0.3;
      audio.play().catch(() => {});
      setHasViewedNotifications(false);
    }
    setPreviousLowStockCount(lowStockItems.length);
  }, [lowStockItems.length, previousLowStockCount, hasViewedNotifications]);

  const toggleDrawer = () => setDrawerOpen(p => !p);

  // All menu items with lucide icons
  const allMenuItems = [
    { label: "Inicio", icon: Home, path: "/" },
    // "Pedidos" (OrdersManagement.jsx, gestiona companies/{cid}/orders) solo
    // tiene algo que mostrar cuando al menos un inventario activó la tienda
    // con carrito (inventory.catalogEnabled) -- antes aparecía siempre para
    // VENDEDORA sin relación con la tienda, y nunca para quien realmente
    // administra el negocio. Roles alineados con la ruta real en App.jsx
    // (allowedRoles={['ADMIN', 'ENCARGADA', 'VENDEDORA']}).
    //
    // Va justo después de "Inicio" (en vez de más abajo, junto a "Mis
    // Ventas") porque un negocio con tienda activa necesita revisarlo
    // varias veces al día -- es lo más urgente del panel, no un ítem
    // secundario entre Salidas y Trabajadores.
    ...(hasActiveStore ? [{ label: "Pedidos", icon: FileText, path: "/pedidos", roles: ['ADMIN', 'ENCARGADA', 'VENDEDORA'], badge: pendingOrdersCount }] : []),
    { label: "Reportes", icon: FileText, path: "/historial" },
    { label: "Qué comprar", icon: ShoppingCart, path: "/que-comprar", roles: ['ADMIN', 'SUPERVISOR', 'GERENTE'] },
    { label: "Caja", icon: CreditCard, path: "/caja", roles: ['ADMIN', 'CAJERA'] },
    { label: "Clientes", icon: Users, path: "/clientes", roles: ['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE'] },
    { label: "Costeo", icon: DollarSign, path: "/costeo", adminOnly: true },
    { label: "P.costeados", icon: ShoppingBag, path: "/catalogo", adminOnly: true },
    { label: "Mis Inventarios", icon: Archive, path: "/mis-inventarios", roles: ['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'WORKER'] },
    { label: "Salidas", icon: Warehouse, path: "/mis-bodegas", roles: ['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'WORKER'] },
    ...(isFoodBusiness ? [{ label: "Mesas", icon: UtensilsCrossed, path: "/mis-mesas", roles: ['ADMIN', 'ENCARGADA', 'GARZON'] }] : []),
    { label: "Vender", icon: ShoppingBag, path: "/mis-bodegas", roles: ['VENDEDORA'] },
    { label: "Clientes", icon: Users, path: "/clientes", roles: ['VENDEDORA'] },
    { label: "Mis Ventas", icon: CreditCard, path: "/mis-ventas", roles: ['VENDEDORA'] },
    // "Buscar clientes cerca" — solo distribuidoras/mayoristas (businessType
    // WHOLESALE), no tiene sentido para restaurantes, inmobiliarias, etc.
    ...(isWholesaleBusiness ? [{ label: "Buscar clientes", icon: MapPin, path: "/terreno", roles: ['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'VENDEDORA'] }] : []),
    { label: "Trabajadores", icon: Users, path: "/trabajadores" },
    { label: "Configuración", icon: Settings, path: "/settings" },
    // Mi Consultor — solo visible si el SA lo activó para esta empresa
    ...(gestionActivo ? [{ label: "Mi Consultor", icon: BarChart2, path: "/mi-consultor", adminOnly: true }] : []),
  ];

  // Filter by permissions AND plan features
  const getMenuItems = () => {
    if (!userPermissions || userPermissions.length === 0) {
      return [];
    }
    const byPermission = filterNavItemsByPermissions(allMenuItems, userPermissions);
    return byPermission.filter(item => {
      // Ocultar items adminOnly a trabajadores
      if (item.adminOnly && userRole !== 'ADMIN') return false;
      if (item.roles && !item.roles.includes(userRole)) return false;
      // Quitar items cuya feature esté desactivada para esta empresa
      // Los items adminOnly siempre se muestran aunque la feature no esté (el admin puede verlos)
      const requiredFeature = ROUTE_FEATURE_MAP[item.path];
      if (!requiredFeature) return true;
      if (item.adminOnly && userRole === 'ADMIN') return true;
      return hasFeature(requiredFeature);
    });
  };

  const menuItems = getMenuItems();

  const homePath = ['WORKER', 'CAJERA', 'VENDEDORA', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'GARZON'].includes(userRole)
    ? '/dashboard-trabajador'
    : '/';

  return (
    <>
      {/* IMPERSONATION BANNER eliminado — se muestra dentro del navbar */}

      {/* ===== TOP BAR ===== */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-2xl ${
          impersonationData?.active
            ? 'bg-amber-500/90 border-amber-400/60'
            : isDark
              ? 'bg-slate-900/80 border-slate-700/50'
              : 'bg-white/80 border-gray-200/50'
        }`}
      >
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">

            {/* LEFT: Hamburger + Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 md:flex-none">
              {/* Hamburger button */}
              <motion.button
                onClick={toggleDrawer}
                className={`p-2.5 rounded-xl transition-colors ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Abrir menú"
              >
                <motion.div
                  animate={drawerOpen ? { rotate: 180 } : { rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M4 6h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"
                      animate={drawerOpen ? { d: "M6 6L18 18" } : { d: "M4 6h16" }}
                      transition={{ duration: 0.3 }}
                    />
                    <motion.path
                      d="M4 12h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"
                      animate={drawerOpen ? { opacity: 0 } : { opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                    <motion.path
                      d="M4 18h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"
                      animate={drawerOpen ? { d: "M6 18L18 6" } : { d: "M4 18h16" }}
                      transition={{ duration: 0.3 }}
                    />
                  </svg>
                </motion.div>
              </motion.button>

              {/* Logo */}
              <Logo
                size="xs"
                animated={true}
                onClick={() => navigate(homePath)}
              />
            </div>

            {/* CENTER: badge impersonación O notificaciones */}
            {impersonationData?.active ? (
              <div className="flex items-center gap-2 text-white">
                <Shield className="w-4 h-4 shrink-0 opacity-80" />
                <span className="text-sm font-semibold">{impersonationData.companyName}</span>
                <span className="hidden sm:inline text-xs text-white/70 font-normal">· Super Admin</span>
                <button
                  onClick={handleExitImpersonation}
                  className="ml-2 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold"
                >
                  Salir
                </button>
              </div>
            ) : currentUser && userRole === 'ADMIN' && (
              <div className={isDesktop ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto" : "flex-none flex justify-center pointer-events-auto"}>
                <DynamicIslandNotification
                  lowStockItems={lowStockItems}
                  hasViewedNotifications={hasViewedNotifications}
                  onMarkAsViewed={() => setHasViewedNotifications(true)}
                  isMobile={!isDesktop}
                  isDark={isDark}
                />
              </div>
            )}

            {/* RIGHT: Theme + AI + Avatar */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 md:flex-none justify-end">
              {/* Theme Toggle - Desktop only */}
              <div className="hidden md:block">
                <ThemeToggle size="sm" />
              </div>

              {/* AI Assistant button - Solo para ADMIN con feature ai_assistant */}
              {userRole === 'ADMIN' && hasFeature('ai_assistant') && (
                <motion.button
                  onClick={() => setIsAssistantOpen(true)}
                  className="relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Asistente de Inventario IA"
                >
                  <img
                    src={assistantBotGif}
                    alt="AI Assistant"
                    className="w-11 h-11 sm:w-12 sm:h-12 object-contain"
                  />
                </motion.button>
              )}

              {/* Avatar with dropdown */}
              {currentUser && (
                <div className="relative" ref={avatarMenuRef}>
                  <motion.button
                    onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                    className={`flex items-center gap-2 p-1 pr-2 rounded-full transition-colors ${
                      isDark
                        ? 'hover:bg-slate-800'
                        : 'hover:bg-gray-100'
                    }`}
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/30">
                      {currentUser.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 hidden sm:block transition-transform ${
                      avatarMenuOpen ? 'rotate-180' : ''
                    } ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
                  </motion.button>

                  {/* Avatar Dropdown Menu */}
                  <AnimatePresence>
                    {avatarMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className={`absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border overflow-hidden ${
                          isDark
                            ? 'bg-slate-800/95 backdrop-blur-xl border-slate-700'
                            : 'bg-white/95 backdrop-blur-xl border-gray-200'
                        }`}
                      >
                        {/* User info */}
                        <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30">
                              {currentUser.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {currentUser.name}
                              </p>
                              <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {currentUser.email}
                              </p>
                              <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {currentUser.role}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="py-2 px-2">
                          <button
                            onClick={() => { navigate('/profile'); setAvatarMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                              isDark
                                ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            <User className="w-4 h-4" />
                            Mi Perfil
                          </button>

                          <div className={`h-px mx-3 my-1 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`} />

                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Cerrar Sesión
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Modern Sidebar */}
      <ModernSidebar
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        menuItems={menuItems}
        userRole={userRole}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Modal del Asistente de Inventario */}
      <InventoryAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        userContext={{
          companyId: companyId,
          page: location.pathname,
          inventorySnapshot: formatContextForPrompt(realCompanyContext),
          totalProducts: realCompanyContext?.totalProducts,
          totalInventories: realCompanyContext?.resumenPorInventario?.length || 0,
          alertsCount: (realCompanyContext?.outOfStock?.length || 0) + (realCompanyContext?.critical?.length || 0)
        }}
      />
    </>
  );
}
