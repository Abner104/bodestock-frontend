// src/services/permissionsService.js
// Servicio para verificar permisos de usuarios basado en sus roles

import { getUserRole } from './companyService.js';
import { DEFAULT_ROLES } from '../config/database-schema.js';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase.js';

/**
 * Obtener los permisos del usuario actual
 * @returns {Promise<string[]>} - Array de permisos
 */
export const getUserPermissions = async () => {
  try {
    const role = await getUserRole();
    if (!role) {
      console.warn('⚠️  Usuario sin rol asignado');
      return [];
    }

    // Buscar permisos del rol en DEFAULT_ROLES
    const roleConfig = DEFAULT_ROLES[role];
    if (roleConfig) {
      return roleConfig.permissions || [];
    }

    // Si no está en DEFAULT_ROLES, buscar en Firestore
    console.warn('⚠️  Rol no encontrado en DEFAULT_ROLES, buscando en Firestore...');
    const { getUserCompanyId } = await import('./companyService.js');
    const companyId = await getUserCompanyId();

    if (!companyId) {
      console.error('❌ No se pudo obtener companyId para buscar permisos');
      return [];
    }

    const rolesRef = collection(db, `companies/${companyId}/roles`);
    const roleQuery = query(rolesRef, where('id', '==', role), limit(1));
    const roleSnapshot = await getDocs(roleQuery);

    if (!roleSnapshot.empty) {
      const roleData = roleSnapshot.docs[0].data();
      return roleData.permissions || [];
    }

    console.error('❌ No se encontraron permisos para el rol:', role);
    return [];
  } catch (error) {
    console.error('❌ Error obteniendo permisos:', error);
    return [];
  }
};

/**
 * Verificar si el usuario tiene un permiso específico
 * @param {string} permission - Nombre del permiso a verificar
 * @returns {Promise<boolean>}
 */
export const hasPermission = async (permission) => {
  try {
    const permissions = await getUserPermissions();

    // Si tiene read_all o write_all, tiene todos los permisos
    if (permissions.includes('read_all') || permissions.includes('write_all')) {
      return true;
    }

    return permissions.includes(permission);
  } catch (error) {
    console.error('❌ Error verificando permiso:', error);
    return false;
  }
};

/**
 * Verificar si el usuario tiene ALGUNO de los permisos especificados
 * @param {string[]} requiredPermissions - Array de permisos requeridos
 * @returns {Promise<boolean>}
 */
export const hasAnyPermission = async (requiredPermissions) => {
  try {
    const userPermissions = await getUserPermissions();

    // Si tiene read_all o write_all, tiene todos los permisos
    if (userPermissions.includes('read_all') || userPermissions.includes('write_all')) {
      return true;
    }

    return requiredPermissions.some(permission => userPermissions.includes(permission));
  } catch (error) {
    console.error('❌ Error verificando permisos:', error);
    return false;
  }
};

/**
 * Verificar si el usuario tiene TODOS los permisos especificados
 * @param {string[]} requiredPermissions - Array de permisos requeridos
 * @returns {Promise<boolean>}
 */
export const hasAllPermissions = async (requiredPermissions) => {
  try {
    const userPermissions = await getUserPermissions();

    // Si tiene read_all o write_all, tiene todos los permisos
    if (userPermissions.includes('read_all') || userPermissions.includes('write_all')) {
      return true;
    }

    return requiredPermissions.every(permission => userPermissions.includes(permission));
  } catch (error) {
    console.error('❌ Error verificando permisos:', error);
    return false;
  }
};

/**
 * Verificar permisos para rutas específicas
 * @param {string} route - Ruta a verificar (ej: '/trabajadores', '/inventario')
 * @returns {Promise<boolean>}
 */
export const canAccessRoute = async (route) => {
  const routePermissions = {
    '/': ['access_dashboard'],
    '/dashboard': ['access_dashboard'],
    '/inventario': ['access_inventory', 'read_inventory'],
    '/costeo': ['view_costs', 'read_all'],
    '/mis-bodegas': ['access_sales', 'access_inventory', 'access_all_warehouses', 'access_assigned_warehouses'],
    '/historial': ['access_reports', 'view_reports'],
    '/trabajadores': ['access_workers', 'manage_workers'],
    '/profile': [], // Todos pueden acceder
    '/plans': ['read_all'],
    '/notificaciones': [],
    '/catalogo': ['access_inventory', 'read_inventory'],
    '/dashboard-trabajador': ['record_exits', 'access_sales', 'access_assigned_warehouses', 'view_own_activity'], // Cajera/Worker/Vendedora
    '/salida-inventario': ['record_exits', 'access_sales'],
    '/caja': ['record_exits', 'access_sales'], // Solo cajera tiene record_exits
  };

  const requiredPerms = routePermissions[route];

  // Si no hay permisos requeridos, todos pueden acceder
  if (!requiredPerms || requiredPerms.length === 0) {
    return true;
  }

  // Verificar si tiene alguno de los permisos requeridos
  return await hasAnyPermission(requiredPerms);
};

/**
 * Obtener todas las rutas accesibles para el usuario actual
 * @returns {Promise<string[]>} - Array de rutas accesibles
 */
export const getAccessibleRoutes = async () => {
  const allRoutes = [
    '/',
    '/dashboard',
    '/inventario',
    '/costeo',
    '/mis-bodegas',
    '/historial',
    '/trabajadores',
    '/profile',
    '/plans',
    '/notificaciones',
    '/catalogo'
  ];

  const accessible = [];

  for (const route of allRoutes) {
    const canAccess = await canAccessRoute(route);
    if (canAccess) {
      accessible.push(route);
    }
  }

  return accessible;
};

export default {
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessRoute,
  getAccessibleRoutes
};
