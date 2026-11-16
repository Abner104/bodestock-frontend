// src/components/WorkerDrawerMenu.jsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, CreditCard, ShoppingCart, UserCircle, LogOut, Warehouse, History, Users, ClipboardList, ArrowLeft, UtensilsCrossed, MapPin, PackagePlus } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase';

const ROLE_LABELS = {
  VENDEDORA: 'Vendedor',
  CAJERA: 'Cajero/a',
  WORKER: 'Trabajador',
  SUPERVISOR: 'Supervisor',
  ENCARGADA: 'Encargado/a',
  ADMIN: 'Administrador',
  GARZON: 'Garzón',
};

const WorkerDrawerMenu = ({ workerRole, workerName, workerPermissions = [], dark = true, showTerreno = false }) => {
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.pathname !== '/dashboard-trabajador';

  const cajeraItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard-trabajador' },
    { icon: CreditCard, label: 'Caja', path: '/caja' },
    { icon: ShoppingCart, label: 'Vender', path: '/mis-bodegas' },
    // Solo si el admin le activó el permiso puntual -- la CAJERA no tiene
    // manage_inventory/read_inventory por defecto (ver DEFAULT_ROLES en
    // database-schema.js), así que sin esto no vería el resto de Inventario.
    ...(workerPermissions.includes('register_purchases')
      ? [{ icon: PackagePlus, label: 'Recibir pedido', path: '/recepcion-pedido' }]
      : []),
    { icon: UserCircle, label: 'Mi Perfil', path: '/profile' },
  ];

  const vendedorItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard-trabajador' },
    { icon: ShoppingCart, label: 'Vender', path: '/clientes?modo=vender' },
    { icon: Users, label: 'Clientes', path: '/clientes' },
    { icon: ClipboardList, label: 'Pedidos', path: '/pedidos' },
    { icon: History, label: 'Mis Ventas', path: '/mis-ventas' },
    ...(showTerreno ? [{ icon: MapPin, label: 'Buscar clientes', path: '/terreno' }] : []),
    { icon: UserCircle, label: 'Mi Perfil', path: '/profile' },
  ];

  const workerItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard-trabajador' },
    { icon: Warehouse, label: 'Bodegas', path: '/mis-bodegas' },
    { icon: UserCircle, label: 'Mi Perfil', path: '/profile' },
  ];

  const garzonItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard-trabajador' },
    { icon: UtensilsCrossed, label: 'Mesas', path: '/mis-mesas' },
    { icon: UserCircle, label: 'Mi Perfil', path: '/profile' },
  ];

  const items = workerRole === 'CAJERA' ? cajeraItems
    : workerRole === 'VENDEDORA' ? vendedorItems
    : workerRole === 'GARZON' ? garzonItems
    : workerItems;

  const handleNav = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await signOut(auth);
    navigate('/login');
  };

  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, width: 288,
              zIndex: 10000, display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(135deg, rgb(15,23,42) 0%, rgb(30,27,75) 100%)'
            }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {canGoBack && (
                  <motion.button
                    onClick={() => { setOpen(false); navigate(-1); }}
                    style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}
                    whileTap={{ scale: 0.9 }}
                    title="Volver atrás"
                  >
                    <ArrowLeft size={16} />
                  </motion.button>
                )}
                <div>
                  {workerName && <p style={{ color: 'white', fontWeight: 700, fontSize: 16, marginTop: 2 }}>{workerName}</p>}
                  {workerRole && <p style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600, marginTop: 2 }}>{ROLE_LABELS[workerRole] || workerRole}</p>}
                </div>
              </div>
              <motion.button
                onClick={() => setOpen(false)}
                style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((item, i) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <motion.button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: active ? 'rgba(59,130,246,0.25)' : 'transparent',
                      color: active ? 'white' : 'rgba(255,255,255,0.7)',
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? '#3b82f6' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                    {active && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 4, background: '#60a5fa' }} />}
                  </motion.button>
                );
              })}
            </div>

            {/* Logout */}
            <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <motion.button
                onClick={handleLogout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', background: 'transparent', color: '#f87171' }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ background: 'rgba(239,68,68,0.1)' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LogOut size={18} />
                </div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Cerrar Sesión</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Botón hamburguesa */}
      <motion.button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          dark
            ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
        }`}
        whileTap={{ scale: 0.9 }}
      >
        <Menu className="w-5 h-5" />
      </motion.button>

      {/* Portal: renderiza fuera del árbol DOM para evitar que transform de ancestros rompa el fixed */}
      {createPortal(drawer, document.body)}
    </>
  );
};

export default WorkerDrawerMenu;
