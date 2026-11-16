// src/components/MobileBottomNav.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Package,
  ShoppingBag,
  Calculator,
  Warehouse,
  Archive,
  CreditCard
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getUserRole } from '../services/companyService';
import { getWorkerByEmail } from '../services/workers-service';
import { auth } from '../firebase/firebase';
import { filterNavItemsByPermissions } from '../utils/permissionsHelper';

// Detectar iPhone/iPad
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const [userPermissions, setUserPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Obtener rol y permisos del usuario
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        await getUserRole();

        // Obtener permisos personalizados del trabajador
        if (auth.currentUser?.email) {
          const worker = await getWorkerByEmail(auth.currentUser.email);
          if (worker) {
            setIsAdmin(worker.role === 'ADMIN');
            if (worker.customPermissions && worker.customPermissions.length > 0) {
              setUserPermissions(worker.customPermissions);
            } else {
              const { DEFAULT_ROLES } = await import('../config/database-schema.js');
              const rolePermissions = DEFAULT_ROLES[worker.role]?.permissions || [];
              setUserPermissions(rolePermissions);
            }
          } else {
            // No worker record = admin/owner of the company
            setIsAdmin(true);
            const { DEFAULT_ROLES } = await import('../config/database-schema.js');
            const adminPermissions = DEFAULT_ROLES.ADMIN?.permissions || [];
            setUserPermissions(adminPermissions);
          }
        }
      } catch (error) {
        console.error('Error obteniendo datos del usuario:', error);
        setIsAdmin(true);
        const { DEFAULT_ROLES } = await import('../config/database-schema.js');
        const adminPermissions = DEFAULT_ROLES.ADMIN?.permissions || [];
        setUserPermissions(adminPermissions);
      }
    };
    fetchUserData();
  }, []);

  // Definir menú completo (TODAS las rutas posibles)
  // workerOnly: rutas que solo deben verse para trabajadores/cajeras, NO para admin
  const allNavItems = useMemo(() => {
    return [
      { icon: Home, label: 'Dashboard', path: '/', adminOnly: true },
      { icon: Home, label: 'Mi Dashboard', path: '/dashboard-trabajador', workerOnly: true },
      { icon: Archive, label: 'Inventarios', path: '/mis-inventarios', adminOnly: true },
      { icon: Warehouse, label: 'Bodegas', path: '/mis-bodegas', adminOnly: true },
      { icon: Calculator, label: 'Costeo', path: '/costeo', adminOnly: true },
      { icon: CreditCard, label: 'Caja', path: '/caja', adminOnly: true },
    ];
  }, []);

  // Filtrar según permisos del usuario
  const navItems = useMemo(() => {
    if (!userPermissions || userPermissions.length === 0) {
      return [];
    }

    // Si es admin, excluir rutas workerOnly. Si es trabajador, excluir adminOnly.
    const itemsToFilter = allNavItems.filter(item => {
      if (item.workerOnly && isAdmin) return false;
      if (item.adminOnly && !isAdmin) return false;
      return true;
    });

    const filtered = filterNavItemsByPermissions(itemsToFilter, userPermissions);

    // Limitar a 5 rutas principales
    return filtered.slice(0, 5);
  }, [userPermissions, allNavItems, isAdmin]);

  const isActive = (path) => location.pathname === path;

  // No mostrar en iOS
  if (isIOS()) return null;

  return (
    <>
      {/* Bottom Navigation Bar */}
      <motion.nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* iOS Blur Background */}
        <div className={`
          backdrop-blur-2xl border-t
          ${isDark
            ? 'bg-slate-900/80 border-slate-700/50'
            : 'bg-white/80 border-gray-200/50'
          }
        `}>
          {/* Safe Area Bottom Padding (para iPhone con notch/home indicator) */}
          <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-around px-2 py-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <motion.button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-xl transition-all relative"
                    whileTap={{ scale: 0.85 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {/* Active Indicator Background */}
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className={`
                          absolute inset-0 rounded-xl
                          ${isDark ? 'bg-blue-500/20' : 'bg-blue-500/10'}
                        `}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}

                    {/* Icon Container */}
                    <motion.div
                      className="relative z-10 mb-1"
                      animate={{
                        scale: active ? 1.1 : 1,
                        y: active ? -2 : 0
                      }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Icon
                        className={`w-6 h-6 transition-colors ${
                          active
                            ? 'text-blue-500'
                            : isDark
                            ? 'text-gray-400'
                            : 'text-gray-500'
                        }`}
                        strokeWidth={active ? 2.5 : 2}
                      />
                    </motion.div>

                    {/* Label */}
                    <motion.span
                      className={`
                        text-[10px] font-semibold relative z-10 transition-colors
                        ${active
                          ? 'text-blue-500'
                          : isDark
                          ? 'text-gray-400'
                          : 'text-gray-500'
                        }
                      `}
                      animate={{
                        opacity: active ? 1 : 0.8
                      }}
                    >
                      {item.label}
                    </motion.span>

                    {/* Active Dot Indicator */}
                    {active && (
                      <motion.div
                        className="absolute -top-1 w-1 h-1 bg-blue-500 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.nav>
    </>
  );
};

export default MobileBottomNav;
