// src/components/guards/PermissionGuard.jsx
/**
 * Componente para proteger secciones según permisos del usuario
 * Si no tiene permiso, muestra mensaje de acceso denegado
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldOff, Lock } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions.js';
import GlobalLoading from '../GlobalLoading.jsx';

export default function PermissionGuard({
  children,
  requiredPermissions = [],
  requireAll = false, // Si true, requiere TODOS los permisos. Si false, requiere AL MENOS UNO
  fallback = null, // Componente alternativo si no tiene permiso
  showMessage = true // Si mostrar mensaje de acceso denegado
}) {
  const { hasAnyPermission, hasAllPermissions, loading, userRole } = useUserPermissions();

  if (loading) {
    return <GlobalLoading />;
  }

  // Si no requiere permisos, mostrar contenido
  if (requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  // Verificar permisos
  const hasAccess = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  if (!hasAccess) {
    // Mostrar fallback si existe
    if (fallback) {
      return <>{fallback}</>;
    }

    // Mostrar mensaje de acceso denegado
    if (showMessage) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[400px] flex items-center justify-center p-8"
        >
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <ShieldOff className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Acceso Denegado
            </h2>
            <p className="text-slate-600 mb-4">
              No tienes los permisos necesarios para acceder a esta sección.
            </p>
            <div className="bg-slate-100 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                <Lock className="w-4 h-4" />
                <span>Tu rol actual: <strong>{userRole || 'Sin rol'}</strong></span>
              </div>
              {requiredPermissions.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  Permisos requeridos: {requiredPermissions.join(', ')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    // No mostrar nada
    return null;
  }

  // Usuario tiene permiso, mostrar contenido
  return <>{children}</>;
}

/**
 * Guard simple para botones y elementos inline
 */
export function InlinePermissionGuard({
  children,
  requiredPermissions = [],
  requireAll = false
}) {
  const { hasAnyPermission, hasAllPermissions, loading } = useUserPermissions();

  if (loading) return null;

  if (requiredPermissions.length === 0) return <>{children}</>;

  const hasAccess = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  return hasAccess ? <>{children}</> : null;
}

/**
 * Guard para ocultar información sensible (costos, ganancias)
 */
export function SensitiveInfoGuard({ children, showPlaceholder = true }) {
  const { canViewSensitiveInfo, loading } = useUserPermissions();

  if (loading) return null;

  if (!canViewSensitiveInfo()) {
    return showPlaceholder ? <span className="text-slate-400">●●●●●</span> : null;
  }

  return <>{children}</>;
}
