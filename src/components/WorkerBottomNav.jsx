// src/components/WorkerBottomNav.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Warehouse, UserCircle, ShoppingCart, CreditCard, ClipboardList } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

const WorkerBottomNav = ({ workerRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();

  if (isIOS()) return null;

  const baseItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard-trabajador' },
    { icon: Warehouse, label: 'Bodegas', path: '/mis-bodegas' },
    { icon: ClipboardList, label: 'Pedidos', path: '/pedidos-caja' },
    { icon: UserCircle, label: 'Perfil', path: '/profile' },
  ];

  const cajeraItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard-trabajador' },
    { icon: CreditCard, label: 'Caja', path: '/caja' },
    { icon: ShoppingCart, label: 'Vender', path: '/mis-bodegas' },
    { icon: UserCircle, label: 'Perfil', path: '/profile' },
  ];

  const navItems = workerRole === 'CAJERA' ? cajeraItems : baseItems;

  const isActive = (path) => location.pathname === path;

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className={`backdrop-blur-2xl border-t ${
        isDark ? 'bg-slate-900/90 border-slate-700/50' : 'bg-white/90 border-gray-200/50'
      }`}>
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
                  {active && (
                    <motion.div
                      layoutId="workerActiveTab"
                      className={`absolute inset-0 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <motion.div
                    className="relative z-10 mb-1"
                    animate={{ scale: active ? 1.1 : 1, y: active ? -2 : 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Icon
                      className={`w-6 h-6 transition-colors ${
                        active ? 'text-blue-500' : isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </motion.div>
                  <motion.span
                    className={`text-[10px] font-semibold relative z-10 transition-colors ${
                      active ? 'text-blue-500' : isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                    animate={{ opacity: active ? 1 : 0.8 }}
                  >
                    {item.label}
                  </motion.span>
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
  );
};

export default WorkerBottomNav;
