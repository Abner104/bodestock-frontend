// src/components/ui/ModernSidebar.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import Logo from './Logo';

const ModernSidebar = ({ isOpen, onClose, menuItems, userRole, currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  const sidebarVariants = {
    closed: {
      x: '-100%',
      transition: { type: 'spring', stiffness: 400, damping: 40 }
    },
    open: {
      x: 0,
      transition: { type: 'spring', stiffness: 400, damping: 40 }
    }
  };

  const backdropVariants = {
    closed: { opacity: 0 },
    open: { opacity: 1 }
  };

  const itemVariants = {
    closed: { x: -20, opacity: 0 },
    open: (i) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: i * 0.04,
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    })
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]"
          />

          {/* Sidebar */}
          <motion.div
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className={`fixed top-0 left-0 h-full w-80 shadow-2xl z-[10000] flex flex-col border-r ${
              isDark
                ? 'bg-slate-900 border-slate-700/50'
                : 'bg-white border-gray-200/50'
            }`}
          >
            {/* Header */}
            <div className={`p-5 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <Logo size="sm" animated={true} />
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className={`p-2 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* User Info */}
              {currentUser && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isDark
                      ? 'bg-slate-800/50 border-slate-700/50'
                      : 'bg-gray-50 border-gray-200/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/25">
                    {currentUser.name?.charAt(0)?.toUpperCase() || currentUser.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {currentUser.name || currentUser.email}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {userRole || 'Usuario'}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-3 px-3">
              <nav className="space-y-1">
                {menuItems
                  .filter(item => item.path && !item.type)
                  .map((item, index) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                      <motion.button
                        key={item.path}
                        custom={index}
                        variants={itemVariants}
                        initial="closed"
                        animate="open"
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleNavigation(item.path)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                          ${isActive
                            ? isDark
                              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                              : 'bg-blue-50 text-blue-600 border border-blue-200'
                            : isDark
                              ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }
                        `}
                      >
                        <span className={`
                          flex items-center justify-center w-8 h-8 rounded-lg transition-colors
                          ${isActive
                            ? isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                            : isDark ? 'bg-slate-800' : 'bg-gray-100'
                          }
                        `}>
                          {Icon ? (
                            <Icon className={`w-[18px] h-[18px] ${isActive ? isDark ? 'text-blue-400' : 'text-blue-600' : ''}`} />
                          ) : null}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>

                        {/* Badge numérico opcional (ej. pedidos pendientes
                            en "Pedidos") -- solo se renderiza si el item
                            trae item.badge > 0, no afecta a los demás. */}
                        {item.badge > 0 && (
                          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}

                        {/* Active dot */}
                        {isActive && (
                          <motion.div
                            layoutId="sidebarActive"
                            className="w-1.5 h-1.5 rounded-full bg-blue-500"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
              </nav>
            </div>

            {/* Footer */}
            <div className={`p-3 border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
              {/* Logout button */}
              {onLogout && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { onLogout(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors mb-2"
                >
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                    isDark ? 'bg-red-500/10' : 'bg-red-50'
                  }`}>
                    <LogOut className="w-[18px] h-[18px]" />
                  </span>
                  <span className="flex-1 text-left">Cerrar Sesión</span>
                </motion.button>
              )}

              <div className={`text-center text-[10px] py-2 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                <p>Bodestock SaaS · 2024</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ModernSidebar;
