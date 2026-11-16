// src/hooks/usePermissions.js
// Hook de React para verificar permisos del usuario

import { useState, useEffect } from 'react';
import { getUserPermissions, hasPermission, hasAnyPermission, canAccessRoute } from '../services/permissionsService.js';
import { auth } from '../firebase/firebase.js';

/**
 * Hook para obtener permisos del usuario actual
 * @returns {Object} - { permissions, loading, hasPermission, hasAnyPermission, canAccessRoute }
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;

        if (!user) {
          console.warn('⚠️  No hay usuario autenticado');
          setPermissions([]);
          setLoading(false);
          return;
        }

        const perms = await getUserPermissions();
        if (mounted) {
          setPermissions(perms);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error cargando permisos:', error);
        if (mounted) {
          setPermissions([]);
          setLoading(false);
        }
      }
    };

    loadPermissions();

    // Recargar permisos cuando cambie el usuario autenticado
    const unsubscribe = auth.onAuthStateChanged(() => {
      loadPermissions();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Función helper para verificar un permiso
  const checkPermission = (permission) => {
    // Si tiene read_all o write_all, tiene todos los permisos
    if (permissions.includes('read_all') || permissions.includes('write_all')) {
      return true;
    }
    return permissions.includes(permission);
  };

  // Función helper para verificar si tiene alguno de los permisos
  const checkAnyPermission = (requiredPermissions) => {
    // Si tiene read_all o write_all, tiene todos los permisos
    if (permissions.includes('read_all') || permissions.includes('write_all')) {
      return true;
    }
    return requiredPermissions.some(p => permissions.includes(p));
  };

  // Función helper para verificar acceso a ruta
  const checkRouteAccess = (route) => {
    const routePermissions = {
      '/': ['access_dashboard'],
      '/dashboard': ['access_dashboard'],
      '/inventario': ['access_inventory', 'read_inventory'],
      '/costeo': ['view_costs', 'read_all'],
      '/mis-bodegas': ['access_sales', 'access_inventory', 'access_all_warehouses', 'access_assigned_warehouses'], // Permite CAJERA con access_sales o access_assigned_warehouses
      '/historial': ['access_reports', 'view_reports'],
      '/trabajadores': ['access_workers', 'manage_workers'],
      '/profile': [], // Todos pueden acceder
      '/plans': ['read_all'],
      '/notificaciones': [],
      '/catalogo': ['access_inventory', 'read_inventory']
    };

    const requiredPerms = routePermissions[route];

    // Si no hay permisos requeridos, todos pueden acceder
    if (!requiredPerms || requiredPerms.length === 0) {
      return true;
    }

    return checkAnyPermission(requiredPerms);
  };

  return {
    permissions,
    loading,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    canAccessRoute: checkRouteAccess
  };
}

export default usePermissions;
