// App.jsx
import React, { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { auth } from "./firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import GlobalLoading from "./components/GlobalLoading";
import ProtectedRoute from "./components/ProtectedRoute";
import { PermissionGuard, FeatureGuard } from "./components/PermissionGuard";
import useAutoLogout from "./hooks/useAutoLogout";
import { useCompanyStatus } from "./hooks/useCompanyStatus";
import { usePresence } from "./hooks/usePresence";
import { SUPER_ADMIN_EMAIL } from "./config/env";

// Lazy-loaded — incluye páginas públicas y componentes de layout pesados
const Navbar = lazy(() => import("./components/Navbar"));
const SuperAdminLayout = lazy(() => import("./components/SuperAdminLayout"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const TrialBanner = lazy(() => import("./components/TrialBanner"));
const SubscriptionExpiredScreen = lazy(() => import("./components/SubscriptionExpiredScreen"));
const MobileBottomNav = lazy(() => import("./components/MobileBottomNav"));
const WorkerDrawerMenu = lazy(() => import("./components/WorkerDrawerMenu"));
const EmailVerificationScreen = lazy(() => import("./components/EmailVerificationScreen"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-loaded pages — se cargan solo cuando el usuario navega a esa ruta
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const ProductCostingWizardV2 = lazy(() => import("./pages/ProductCostingWizardV2"));
const Inventory = lazy(() => import("./components/Inventory"));
const ProductsCatalog = lazy(() => import("./pages/ProductsCatalog"));
const WorkersManagement = lazy(() => import("./pages/WorkersManagement"));
const InventoryExit = lazy(() => import("./pages/InventoryExit"));
const InventoryExitsReport = lazy(() => import("./pages/InventoryExitsReport"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const WorkerWarehouses = lazy(() => import("./pages/WorkerWarehouses"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const UpgradePlan = lazy(() => import("./pages/UpgradePlan"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFailure = lazy(() => import("./pages/PaymentFailure"));
const PaymentPending = lazy(() => import("./pages/PaymentPending"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
const AyudaPage = lazy(() => import("./pages/AyudaPage"));
const PublicCatalog = lazy(() => import("./pages/PublicCatalog"));
const PublicCatalogLanding = lazy(() => import("./pages/PublicCatalogLanding"));
const PublicStore = lazy(() => import("./pages/PublicStore"));
const KitchenDisplay = lazy(() => import("./pages/KitchenDisplay"));
const OrdersManagement = lazy(() => import("./pages/OrdersManagement"));
const InventoriesManagement = lazy(() => import("./pages/InventoriesManagement"));
const TablesManagement = lazy(() => import("./pages/TablesManagement"));
const TableOrder = lazy(() => import("./pages/TableOrder"));
const CustomersManagement = lazy(() => import("./pages/CustomersManagement"));
const SuperAdminReferrals = lazy(() => import("./pages/SuperAdminReferrals"));
const SuperAdminPlans = lazy(() => import("./pages/SuperAdminPlans"));
const SuperAdminCompanyDetail = lazy(() => import("./pages/SuperAdminCompanyDetail"));
const SuperAdminEmpresas = lazy(() => import("./pages/SuperAdminEmpresas"));
const SuperAdminAnalytics = lazy(() => import("./pages/SuperAdminAnalytics"));
const SuperAdminCalendario = lazy(() => import("./pages/SuperAdminCalendario"));
const SuperAdminDemo = lazy(() => import("./pages/SuperAdminDemo"));
const SuperAdminIngresos = lazy(() => import("./pages/SuperAdminIngresos"));
const SuperAdminGestion = lazy(() => import("./pages/SuperAdminGestion"));
const SuperAdminAgentRoom = lazy(() => import("./pages/SuperAdminAgentRoom"));
const SuperAdminMapDesigner = lazy(() => import("./pages/SuperAdminMapDesigner"));
const SuperAdminBodestockWorld = lazy(() => import("./pages/SuperAdminBodestockWorld"));
const SuperAdminCiudad3D = lazy(() => import("./pages/SuperAdminCiudad3D"));
const MiConsultor = lazy(() => import("./pages/MiConsultor"));
const CashRegisterPage = lazy(() => import("./pages/CashRegisterPage"));
const PurchaseReceiving = lazy(() => import("./pages/PurchaseReceiving"));
const MisVentas = lazy(() => import("./pages/MisVentas"));
const TerrenoProspeccion = lazy(() => import("./pages/TerrenoProspeccion"));

function App({ darkMode, setDarkMode }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minLoadingTime, setMinLoadingTime] = useState(true);
  const [workerRole, setWorkerRole] = useState(null);
  const [workerRoleChecked, setWorkerRoleChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto logout después de 30 minutos de inactividad
  useAutoLogout(30);

  // Presencia en línea — escribe lastSeen cada 60s en Firestore
  usePresence(workerRole?.name || null);

  const { status: companyStatus, active: companyActive, loading: companyLoading } = useCompanyStatus();

  // Tiempo mínimo de visualización del loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingTime(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const authTimeout = setTimeout(() => {
      if (isMounted) {
        setUser(auth.currentUser || null);
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isMounted) {
        clearTimeout(authTimeout);
        setUser(currentUser);
        setLoading(false);
        if (!currentUser) {
          setWorkerRole(null);
          setWorkerRoleChecked(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  // workerRole nunca se llenaba en ningún lado — quedaba en null para todo el
  // mundo, admin incluido, lo que hacía que isWorkerRoute (más abajo) ocultara
  // el navbar a cualquiera que entrara a /salida-inventario u otra ruta de
  // trabajador, no solo a los trabajadores reales. Se resuelve leyendo el
  // custom claim "role" del token, la misma fuente que ya usa redirectByRole.
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    user.getIdTokenResult()
      .then((tokenResult) => {
        if (!isMounted) return;
        const claimRole = tokenResult.claims.role;
        const workerRoles = ['WORKER', 'CAJERA', 'VENDEDORA', 'SUPERVISOR', 'ENCARGADA', 'GARZON'];
        setWorkerRole(claimRole && workerRoles.includes(claimRole) ? claimRole : null);
        setWorkerRoleChecked(true);
      })
      .catch(() => {
        if (isMounted) setWorkerRoleChecked(true);
      });
    return () => { isMounted = false; };
  }, [user]);

  // Guardar URL solo cuando se monta el componente si no hay usuario
  useEffect(() => {
    const currentUser = auth.currentUser;

    // Solo guardar si NO hay usuario Y la URL es válida
    if (!currentUser && (location.search || location.pathname.includes('/salida-inventario'))) {
      // Y solo si NO estamos en /login (para evitar sobrescribir)
      if (!location.pathname.includes('/login')) {
        const targetUrl = location.pathname + location.search;
        console.log('💾 App.jsx - Guardando URL para después del login:', targetUrl);
        localStorage.setItem('redirectAfterLogin', targetUrl);
      }
    }
  }, []); // Solo se ejecuta una vez al montar

  // Redirigir usuarios automáticamente según su rol cuando están en "/"
  useEffect(() => {
    if (!user) return;

    // Super admin → /super-admin
    if (user.email === SUPER_ADMIN_EMAIL) {
      if (location.pathname !== '/super-admin' && !location.pathname.startsWith('/super-admin/')) {
        navigate('/super-admin', { replace: true });
      }
      return;
    }

    const redirectByRole = async () => {
      try {
        const tokenResult = await Promise.race([
          user.getIdTokenResult(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
        const companyId = tokenResult.claims.companyId;

        // Sin companyId en claims → usuario sin empresa configurada
        if (!companyId && !location.pathname.startsWith('/register') && location.pathname !== '/') {
          navigate('/register', { replace: true });
          return;
        }

        if (location.pathname !== '/') return;

        // Workers/Cajeras/Vendedoras/Garzones → /dashboard-trabajador
        const claimRole = tokenResult.claims.role;
        const workerRoles = ['WORKER', 'CAJERA', 'VENDEDORA', 'GARZON'];
        if (claimRole && workerRoles.includes(claimRole)) {
          navigate('/dashboard-trabajador', { replace: true });
        }
      } catch (err) {
        console.error('Error verificando rol para redirección:', err);
      }
    };
    redirectByRole();
  }, [user, location.pathname, navigate]);

  // Mostrar loading si aún no ha cargado Firebase O si no ha pasado el tiempo mínimo
  if (loading || minLoadingTime) {
    return <GlobalLoading />;
  }

  // Si el usuario está autenticado pero no verificó su email, mostrar pantalla de verificación
  // Excepción: super admin y usuarios Google (ya tienen email verificado por Google)
  const isPublicRoute = ['/landing', '/login', '/register', '/terminos', '/privacidad'].includes(location.pathname)
    || location.pathname.startsWith('/catalogo-publico')
    || location.pathname.startsWith('/tienda');
  if (user && !user.emailVerified && !isPublicRoute && user.email !== SUPER_ADMIN_EMAIL) {
    return <EmailVerificationScreen />;
  }

  // Detectar si el usuario actual es Super Admin
  const isSuperAdmin = user && user.email === SUPER_ADMIN_EMAIL;
  const isSuperAdminRoute = location.pathname.startsWith('/super-admin');

  // Rutas de trabajador que tienen su propio header (no necesitan navbar del sistema)
  const workerRoutes = ['/dashboard-trabajador', '/salida-inventario', '/mis-bodegas', '/caja', '/mis-ventas', '/mesa'];
  const vendedoraExtraRoutes = ['/clientes', '/pedidos', '/profile'];
  const workerOnlyRoles = ['WORKER', 'CAJERA', 'VENDEDORA', 'SUPERVISOR', 'ENCARGADA', 'GARZON'];
  const isWorkerRole = workerRole && workerOnlyRoles.includes(workerRole);
  const isOnWorkerPath = workerRoutes.some(r => location.pathname.startsWith(r));
  const isOnVendedoraExtra = workerRole === 'VENDEDORA' && vendedoraExtraRoutes.some(r => location.pathname.startsWith(r));
  // Ocultar navbar si ES ruta de trabajador Y el usuario logueado es un trabajador real
  // (o todavía no terminamos de verificar su rol, para evitar el flash del navbar).
  // OJO: antes esto era "isWorkerRole || !workerRole" — como workerRole nunca se
  // llenaba, la segunda mitad siempre era true y ocultaba el navbar también a
  // admins que entraran a estas rutas (ej. Dashboard → /salida-inventario).
  const isWorkerRoute = (isOnWorkerPath || isOnVendedoraExtra) && (isWorkerRole || !workerRoleChecked);

  // Rutas que no deben tener padding (sin navbar)
  const noNavbarRoutes = ['/landing', '/login', '/register', '/terminos', '/privacidad'];
  const shouldHavePadding = user && !noNavbarRoutes.includes(location.pathname) && !isWorkerRoute;

  // Rutas que no deben mostrar el navbar del SaaS
  const hideNavbarRoutes = ['/landing', '/login', '/register', '/terminos', '/privacidad'];
  const showNavbar = user && !hideNavbarRoutes.includes(location.pathname) && !isWorkerRoute;

  // Super Admin usa su propio layout con sidebar
  const showSaasNavbar = showNavbar && !isSuperAdminRoute;

  // Rutas permitidas aunque la cuenta esté vencida
  const ALLOWED_EXPIRED = ['/plans', '/upgrade', '/payment-success', '/payment-failure', '/payment-pending', '/login', '/landing'];
  const isAllowedWhenExpired = ALLOWED_EXPIRED.some(p => location.pathname.startsWith(p));

  // Bloqueo real: devuelve SOLO la pantalla de expiración, sin rutas accesibles
  const isExpired = user && !isSuperAdminRoute && !companyLoading &&
    (companyStatus === 'trial_expired' || companyStatus === 'billing_expired' ||
     companyStatus === 'suspended' || companyStatus === 'cancelled');

  if (isExpired && !isAllowedWhenExpired) {
    return (
      <SubscriptionExpiredScreen billingExpired={companyStatus === 'billing_expired' || companyStatus === 'suspended' || companyStatus === 'cancelled'} />
    );
  }

  return (
    <>
      {showSaasNavbar && <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />}
      {showSaasNavbar && <TrialBanner />}
      {user && !isSuperAdminRoute && !isWorkerRoute && <MobileBottomNav />}
      {user && isOnVendedoraExtra && <WorkerDrawerMenu workerRole={workerRole} />}
      <main className={shouldHavePadding && !isSuperAdminRoute ? "pt-16 min-h-screen overflow-auto md:pb-4 transition-[padding-right] duration-300 ease-in-out [body.assistant-sidebar-open_&]:md:pr-[400px]" : !isSuperAdminRoute ? "min-h-screen overflow-auto" : ""}>
        <Suspense fallback={<GlobalLoading />}>
        <Routes>
          {/* Ruta de landing - siempre disponible */}
          <Route path="/landing" element={<LandingPage />} />

          {/* Ruta de login - siempre disponible */}
          <Route path="/login" element={<Login />} />

          {/* Ruta de registro - siempre disponible */}
          <Route path="/register" element={<Register />} />

          {/* Términos y Privacidad - siempre disponibles */}
          <Route path="/terminos" element={<TermsOfService />} />
          <Route path="/privacidad" element={<PrivacyPolicy />} />
          <Route path="/ayuda" element={<AyudaPage />} />

          {/* Catálogo Público - disponible sin autenticación */}
          <Route path="/catalogo-publico/:companyId" element={<PublicCatalogLanding />} />
          <Route path="/catalogo-publico/:companyId/:inventoryId" element={<PublicCatalog />} />
          {/* Tienda con carrito self-checkout */}
          <Route path="/tienda/:companyId/:inventoryId" element={<PublicStore />} />
          <Route path="/tienda/:companyId" element={<PublicStore />} />
          {/* Pantalla de pedidos para caja/empleado */}
          <Route path="/pedidos-caja" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'WORKER', 'GERENTE', 'CAJERA', 'GARZON']}>
              <KitchenDisplay />
            </ProtectedRoute>
          } />
          {/* Alias legacy */}
          <Route path="/cocina" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'WORKER', 'GERENTE', 'CAJERA', 'GARZON']}>
              <KitchenDisplay />
            </ProtectedRoute>
          } />

          {/* Ruta de upgrade - disponible para usuarios autenticados */}
          {user && <Route path="/upgrade" element={<UpgradePlan />} />}

          {/* Rutas de resultado de pago - disponibles para usuarios autenticados */}
          {user && <Route path="/payment-success" element={<PaymentSuccess />} />}
          {user && <Route path="/payment-failure" element={<PaymentFailure />} />}
          {user && <Route path="/payment-pending" element={<PaymentPending />} />}

          {/* Ruta raíz: landing para no logueados, dashboard para logueados */}
          <Route path="/" element={
            user ? (
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE']}>
                <PermissionGuard requiredPermission="access_dashboard">
                  <Dashboard />
                </PermissionGuard>
              </ProtectedRoute>
            ) : (
              <LandingPage />
            )
          } />

          {user ? (
            <>
              {/* ===== SUPER ADMIN ROUTES — wrapped en SuperAdminLayout ===== */}
              <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
              <Route path="/super-admin/empresas" element={<SuperAdminLayout><SuperAdminEmpresas /></SuperAdminLayout>} />
              <Route path="/super-admin/agentes" element={<SuperAdminLayout><SuperAdminAgentRoom /></SuperAdminLayout>} />
              <Route path="/super-admin/map-designer" element={<SuperAdminLayout><SuperAdminMapDesigner /></SuperAdminLayout>} />
              <Route path="/super-admin/bodestock-world" element={<SuperAdminLayout><SuperAdminBodestockWorld /></SuperAdminLayout>} />
              <Route path="/super-admin/ciudad-3d" element={<SuperAdminLayout><SuperAdminCiudad3D /></SuperAdminLayout>} />
              <Route path="/super-admin/analytics" element={<SuperAdminLayout><SuperAdminAnalytics /></SuperAdminLayout>} />
              <Route path="/super-admin/referidos" element={<SuperAdminLayout><SuperAdminReferrals /></SuperAdminLayout>} />
              <Route path="/super-admin/planes" element={<SuperAdminLayout><SuperAdminPlans /></SuperAdminLayout>} />
              <Route path="/super-admin/empresa/:companyId" element={<SuperAdminLayout><SuperAdminCompanyDetail /></SuperAdminLayout>} />
              <Route path="/super-admin/calendario" element={<SuperAdminLayout><SuperAdminCalendario /></SuperAdminLayout>} />
              <Route path="/super-admin/demo" element={<SuperAdminLayout><SuperAdminDemo /></SuperAdminLayout>} />
              <Route path="/super-admin/ingresos" element={<SuperAdminLayout><SuperAdminIngresos /></SuperAdminLayout>} />
              <Route path="/super-admin/gestion/:companyId" element={<SuperAdminLayout><SuperAdminGestion /></SuperAdminLayout>} />

              {/* Mi Consultor — visible solo si gestionActivo en Firestore */}
              <Route path="/mi-consultor" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GERENTE']}>
                  <MiConsultor />
                </ProtectedRoute>
              } />

              {/* Funciones administrativas - Admins y Supervisores */}
              <Route path="/costeo" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
                  <ProductCostingWizardV2 />
                </ProtectedRoute>
              } />

              <Route path="/catalogo" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
                  <ProductsCatalog />
                </ProtectedRoute>
              } />

              {/* Inventario principal (legacy) */}
              <Route path="/inventario" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'VENDEDORA', 'CAJERA']}>
                  <PermissionGuard requiredPermission="access_inventory">
                    <Inventory />
                  </PermissionGuard>
                </ProtectedRoute>
              } />

              {/* Inventario dinámico - Ruta con inventoryId */}
              <Route path="/inventario/:inventoryId" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'VENDEDORA', 'CAJERA']}>
                  <PermissionGuard requiredPermission="access_inventory">
                    <Inventory />
                  </PermissionGuard>
                </ProtectedRoute>
              } />

              <Route path="/trabajadores" element={
                <ProtectedRoute requiredPermissions={['access_workers', 'manage_workers']}>
                  <PermissionGuard requiredPermission="access_workers">
                    <WorkersManagement />
                  </PermissionGuard>
                </ProtectedRoute>
              } />

              <Route path="/historial" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'VENDEDORA']}>
                    <InventoryExitsReport />
                </ProtectedRoute>
              } />

              <Route path="/clientes" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'VENDEDORA']}>
                  <FeatureGuard feature="customers">
                    <CustomersManagement />
                  </FeatureGuard>
                </ProtectedRoute>
              } />

              <Route path="/notificaciones" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
                  <NotificationsPage />
                </ProtectedRoute>
              } />

              {/* Funciones de trabajador y supervisor */}
              <Route path="/salida-inventario" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'WORKER', 'CAJERA', 'VENDEDORA', 'ENCARGADA', 'GERENTE']}>
                  <InventoryExit />
                </ProtectedRoute>
              } />

              <Route path="/dashboard-trabajador" element={
                <ProtectedRoute allowedRoles={['WORKER', 'CAJERA', 'VENDEDORA', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'GARZON']}>
                  <WorkerDashboard />
                </ProtectedRoute>
              } />

              <Route path="/mis-ventas" element={
                <ProtectedRoute allowedRoles={['VENDEDORA']}>
                  <MisVentas />
                </ProtectedRoute>
              } />

              <Route path="/terreno" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ENCARGADA', 'GERENTE', 'VENDEDORA']}>
                  <TerrenoProspeccion />
                </ProtectedRoute>
              } />

              <Route path="/caja" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'CAJERA']}>
                  <CashRegisterPage />
                </ProtectedRoute>
              } />

              <Route path="/recepcion-pedido" element={
                <ProtectedRoute requiredPermissions={['manage_inventory', 'register_purchases']}>
                  <PurchaseReceiving />
                </ProtectedRoute>
              } />

              <Route path="/mis-bodegas" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'WORKER', 'CAJERA', 'VENDEDORA', 'ENCARGADA', 'GERENTE']}>
                  <WorkerWarehouses />
                </ProtectedRoute>
              } />

              {/* Perfil - Todos los usuarios autenticados */}
              <Route path="/profile" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'WORKER', 'CAJERA', 'VENDEDORA', 'ENCARGADA', 'GERENTE']}>
                  <Profile />
                </ProtectedRoute>
              } />

              {/* Configuración - Solo ADMIN */}
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Settings />
                </ProtectedRoute>
              } />

              {/* Planes y suscripciones - Solo ADMIN */}
              <Route path="/plans" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <PlansPage />
                </ProtectedRoute>
              } />

              {/* Pedidos - ADMIN, ENCARGADA, VENDEDOR */}
              <Route path="/pedidos" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ENCARGADA', 'VENDEDORA']}>
                  <PermissionGuard requiredPermission="access_sales">
                    <OrdersManagement />
                  </PermissionGuard>
                </ProtectedRoute>
              } />

              {/* Mis Inventarios - Solo ADMIN */}
              <Route path="/mis-inventarios" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <PermissionGuard requiredPermission="access_inventory">
                    <InventoriesManagement />
                  </PermissionGuard>
                </ProtectedRoute>
              } />

              {/* Mesas - ADMIN gestiona, ENCARGADA y GARZON consultan */}
              <Route path="/mis-mesas" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ENCARGADA', 'GARZON']}>
                  <TablesManagement />
                </ProtectedRoute>
              } />

              {/* Pedido de una mesa - POS del garzón */}
              <Route path="/mesa/:tableId" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ENCARGADA', 'GARZON']}>
                  <TableOrder />
                </ProtectedRoute>
              } />

              {/* 404 - Página no encontrada */}
              <Route path="*" element={<NotFound />} />
            </>
          ) : (
            <Route path="*" element={<Login />} />
          )}
        </Routes>
        </Suspense>
        {/* Spacer para que el contenido no quede detrás del MobileBottomNav */}
        {user && !isSuperAdminRoute && (
          <div className="md:hidden" style={{ height: 'calc(5rem + env(safe-area-inset-bottom))' }} />
        )}
      </main>

      {/* Toast notifications container */}
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;
