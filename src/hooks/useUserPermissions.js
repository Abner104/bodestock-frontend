// src/hooks/useUserPermissions.js
/**
 * Hook para verificar permisos del usuario actual
 * Usado para controlar acceso a páginas, botones y funcionalidades
 */

import { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase/firebase.js';
import { getWorkerByEmail } from '../services/workers-service.js';
import { DEFAULT_ROLES } from '../config/database-schema.js';

export function useUserPermissions() {
  const [permissions, setPermissions] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [worker, setWorker] = useState(null);

  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;

        if (!user) {
          setPermissions([]);
          setUserRole(null);
          setIsAdmin(false);
          setWorker(null);
          setLoading(false);
          return;
        }

        // Obtener el trabajador por email
        const workerData = await getWorkerByEmail(user.email);

        if (!workerData) {
          // Usuario sin rol (admin legacy o super admin)
          console.log('Usuario sin rol de trabajador - asumiendo permisos de ADMIN');
          setPermissions(DEFAULT_ROLES.ADMIN.permissions);
          setUserRole('ADMIN');
          setIsAdmin(true);
          setWorker(null);
          setLoading(false);
          return;
        }

        // Guardar datos del trabajador
        setWorker(workerData);
        setUserRole(workerData.role);
        setIsAdmin(workerData.role === 'ADMIN');

        // Cargar permisos personalizados o del rol
        if (workerData.customPermissions && workerData.customPermissions.length > 0) {
          // Usar permisos personalizados
          setPermissions(workerData.customPermissions);
          console.log('✅ Permisos personalizados cargados:', workerData.customPermissions);
        } else {
          // Usar permisos del rol por defecto
          const rolePermissions = DEFAULT_ROLES[workerData.role]?.permissions || [];
          setPermissions(rolePermissions);
          console.log('✅ Permisos del rol cargados:', rolePermissions);
        }

      } catch (error) {
        console.error('Error cargando permisos del usuario:', error);
        setPermissions([]);
        setUserRole(null);
        setIsAdmin(false);
        setWorker(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserPermissions();

    // Recargar permisos cuando cambie el usuario
    const unsubscribe = auth.onAuthStateChanged(() => {
      loadUserPermissions();
    });

    return () => unsubscribe();
  }, []);

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const hasPermission = useCallback((permission) => {
    // Admin siempre tiene todos los permisos
    if (isAdmin && userRole === 'ADMIN') return true;

    // Verificar si tiene el permiso específico
    return permissions.includes(permission);
  }, [permissions, isAdmin, userRole]);

  /**
   * Verifica si el usuario tiene ALGUNO de los permisos listados
   */
  const hasAnyPermission = useCallback((permissionList) => {
    if (isAdmin && userRole === 'ADMIN') return true;
    return permissionList.some(p => permissions.includes(p));
  }, [permissions, isAdmin, userRole]);

  /**
   * Verifica si el usuario tiene TODOS los permisos listados
   */
  const hasAllPermissions = useCallback((permissionList) => {
    if (isAdmin && userRole === 'ADMIN') return true;
    return permissionList.every(p => permissions.includes(p));
  }, [permissions, isAdmin, userRole]);

  /**
   * Verifica si el usuario puede acceder a una bodega específica
   */
  const canAccessWarehouse = useCallback((warehouseId) => {
    if (!worker) return true; // Sin trabajador = admin legacy

    // Si tiene acceso a todas las bodegas
    if (hasPermission('access_all_warehouses')) return true;

    // Verificar si la bodega está en las asignadas
    return worker.assignedWarehouses?.includes(warehouseId) || false;
  }, [worker, hasPermission]);

  /**
   * Verifica si el usuario puede ver información sensible (costos, ganancias)
   */
  const canViewSensitiveInfo = useCallback(() => {
    return hasAnyPermission(['view_costs', 'view_profits', 'read_all']);
  }, [hasAnyPermission]);

  /**
   * Verifica si el usuario solo puede ver stock (sin costos)
   */
  const canViewStockOnly = useCallback(() => {
    return hasPermission('view_stock_only') && !canViewSensitiveInfo();
  }, [hasPermission, canViewSensitiveInfo]);

  return {
    permissions,
    userRole,
    worker,
    loading,
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessWarehouse,
    canViewSensitiveInfo,
    canViewStockOnly
  };
}

/**
 * Hook simplificado para verificar un solo permiso
 */
export function usePermission(permission) {
  const { hasPermission, loading } = useUserPermissions();
  return { allowed: hasPermission(permission), loading };
}

/**
 * Hook para verificar si puede acceder a una ruta/página
 */
export function useRouteAccess(requiredPermissions = []) {
  const { hasAnyPermission, loading, isAdmin } = useUserPermissions();

  if (loading) return { canAccess: null, loading: true };

  // Si no requiere permisos, permitir acceso
  if (requiredPermissions.length === 0) return { canAccess: true, loading: false };

  // Admin siempre puede acceder
  if (isAdmin) return { canAccess: true, loading: false };

  // Verificar si tiene alguno de los permisos requeridos
  const canAccess = hasAnyPermission(requiredPermissions);

  return { canAccess, loading: false };
}
