// src/components/PermissionGuard.jsx
/**
 * Componente que protege rutas y componentes según permisos
 * Si el usuario no tiene el permiso requerido, muestra un mensaje de acceso denegado
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserPermissions } from '../hooks/useUserPermissions.js';
import { usePlanFeatures } from '../hooks/usePlanFeatures.js';
import { motion } from 'framer-motion';
import { ShieldOff, AlertTriangle, Home } from 'lucide-react';

export function PermissionGuard({ requiredPermission, children, fallback = null }) {
  const { hasPermission, loading } = useUserPermissions();

  // Mientras carga, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Si no tiene permiso
  if (!hasPermission(requiredPermission)) {
    // Si hay fallback personalizado, usarlo
    if (fallback) {
      return fallback;
    }

    // Mensaje de acceso denegado por defecto
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <ShieldOff className="w-10 h-10 text-red-600" />
          </motion.div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Acceso Denegado
          </h2>

          <p className="text-slate-600 mb-6">
            No tienes permisos para acceder a esta sección del sistema.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-yellow-900 mb-1">
                  Permiso requerido
                </p>
                <p className="text-xs text-yellow-700">
                  <code className="bg-yellow-100 px-2 py-0.5 rounded">
                    {requiredPermission}
                  </code>
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.history.back()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Volver al Inicio
          </button>
        </motion.div>
      </div>
    );
  }

  // Si tiene permiso, renderizar children
  return <>{children}</>;
}

/**
 * Componente inline para ocultar elementos según permisos
 * Uso: <InlinePermissionGuard requiredPermission="view_costs">...</InlinePermissionGuard>
 */
export function InlinePermissionGuard({ requiredPermission, children, fallback = null }) {
  const { hasPermission, loading } = useUserPermissions();

  if (loading) return null;
  if (!hasPermission(requiredPermission)) return fallback;

  return <>{children}</>;
}

/**
 * Hook para proteger acciones según permisos
 * Uso: const canDelete = useHasPermission('delete_all');
 */
export function useHasPermission(requiredPermission) {
  const { hasPermission } = useUserPermissions();
  return hasPermission(requiredPermission);
}

/**
 * Protege una ruta según si la empresa tiene la feature activa.
 * Si la feature está desactivada (por companyFeatures override o plan),
 * redirige al inicio en lugar de mostrar la página.
 */
export function FeatureGuard({ feature, children }) {
  const { hasFeature, loading } = usePlanFeatures();
  if (loading) return null;
  if (!hasFeature(feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Componente para ocultar información sensible (costos, ganancias)
 */
export function SensitiveInfoGuard({ children, type = 'costs' }) {
  const { hasPermission } = useUserPermissions();

  const permissionMap = {
    costs: 'view_costs',
    profits: 'view_profits',
    reports: 'view_reports',
    inventory_value: 'view_costs'
  };

  const requiredPermission = permissionMap[type];

  if (!hasPermission(requiredPermission)) {
    return (
      <div className="inline-flex items-center gap-1 text-slate-400">
        <ShieldOff className="w-4 h-4" />
        <span className="text-sm">Oculto</span>
      </div>
    );
  }

  return <>{children}</>;
}
