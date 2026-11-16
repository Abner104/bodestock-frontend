// src/utils/permissionsHelper.js
/**
 * Helper para manejar permisos y acceso a rutas basado en permisos personalizados
 */

/**
 * Mapeo de rutas/secciones a permisos requeridos
 * Una ruta puede requerir uno o más permisos (ANY = al menos uno, ALL = todos)
 *
 * IMPORTANTE: Estos permisos deben coincidir con los de database-schema.js
 */
export const ROUTE_PERMISSIONS = {
  // Dashboard Principal (Admin, Gerente, Encargada, Supervisor)
  '/': {
    requiredPermissions: ['access_dashboard'],
    mode: 'ANY'
  },

  // Mi Dashboard (Trabajadores, Cajera, Vendedora, etc.)
  '/dashboard-trabajador': {
    requiredPermissions: ['view_own_activity'],
    mode: 'ANY'
  },

  // Inventario - Gestión completa de productos
  '/inventario': {
    requiredPermissions: ['access_inventory', 'manage_inventory'],
    mode: 'ANY'
  },

  // Bodegas y Salidas - Registro de ventas/salidas
  '/mis-bodegas': {
    requiredPermissions: ['access_sales', 'record_exits'],
    mode: 'ANY'
  },

  // Mesas - Toma de pedidos en restaurantes (Garzón, Encargada, Admin)
  '/mis-mesas': {
    requiredPermissions: ['access_tables', 'access_assigned_tables', 'manage_tables'],
    mode: 'ANY'
  },

  // Catálogo - Ver productos (lectura)
  '/catalogo': {
    requiredPermissions: ['read_inventory'],
    mode: 'ANY'
  },

  // Costeo - Cálculo de costos de productos terminados
  '/costeo': {
    requiredPermissions: ['manage_inventory', 'view_costs'],
    mode: 'ANY'
  },

  // Reportes - Historial y estadísticas
  '/historial': {
    requiredPermissions: ['access_reports', 'view_reports'],
    mode: 'ANY'
  },

  // Trabajadores - Gestión de empleados
  '/trabajadores': {
    requiredPermissions: ['access_workers', 'manage_workers'],
    mode: 'ANY'
  },

  // Notificaciones - Solo ADMIN
  '/notificaciones': {
    requiredPermissions: ['read_all'], // Solo ADMIN tiene este permiso
    mode: 'ANY'
  },

  // Perfil - Todos tienen acceso
  '/profile': {
    requiredPermissions: [],
    mode: 'ANY'
  },

  // Planes - Solo ADMIN
  '/plans': {
    requiredPermissions: ['access_settings'],
    mode: 'ANY'
  },

  // Pedidos - ADMIN, ENCARGADA, VENDEDOR
  '/pedidos': {
    requiredPermissions: ['access_sales', 'record_exits', 'approve_exits'],
    mode: 'ANY'
  },

  // Mis Inventarios - Solo ADMIN
  '/mis-inventarios': {
    requiredPermissions: ['access_inventory', 'manage_inventory'],
    mode: 'ANY'
  },

  '/clientes': {
    requiredPermissions: ['manage_inventory', 'view_reports', 'access_reports', 'access_dashboard', 'access_customers'],
    mode: 'ANY'
  },

  // Configuración - Solo ADMIN
  '/settings': {
    requiredPermissions: ['access_settings'],
    mode: 'ANY'
  }
};

/**
 * Verifica si un usuario tiene permiso para acceder a una ruta
 * @param {string} route - Ruta a verificar (ej: '/inventario')
 * @param {array} userPermissions - Permisos del usuario
 * @returns {boolean} - true si tiene acceso, false si no
 */
export const hasRouteAccess = (route, userPermissions = []) => {
  // Si no hay permisos definidos, denegar acceso
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }

  // Permisos wildcard que dan acceso a todas las rutas
  const WILDCARD_PERMISSIONS = ['read_all', 'write_all', 'delete_all'];
  if (WILDCARD_PERMISSIONS.some(wp => userPermissions.includes(wp))) {
    return true;
  }

  // Obtener configuración de permisos para la ruta
  const routeConfig = ROUTE_PERMISSIONS[route];

  // Si la ruta no requiere permisos, permitir acceso
  if (!routeConfig || routeConfig.requiredPermissions.length === 0) {
    return true;
  }

  // Verificar según el modo
  if (routeConfig.mode === 'ALL') {
    // Requiere TODOS los permisos
    return routeConfig.requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );
  } else {
    // Requiere AL MENOS UNO de los permisos (mode === 'ANY')
    return routeConfig.requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );
  }
};

/**
 * Verifica si un usuario tiene un permiso específico
 * @param {string} permission - Permiso a verificar
 * @param {array} userPermissions - Permisos del usuario
 * @returns {boolean}
 */
export const hasPermission = (permission, userPermissions = []) => {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }

  // Permisos especiales que dan acceso a todo
  if (userPermissions.includes('read_all') ||
      userPermissions.includes('write_all') ||
      userPermissions.includes('delete_all')) {
    return true;
  }

  return userPermissions.includes(permission);
};

/**
 * Filtra un array de items de navegación según los permisos del usuario
 * @param {array} navItems - Items de navegación [{path, label, icon, ...}]
 * @param {array} userPermissions - Permisos del usuario
 * @returns {array} - Items filtrados
 */
export const filterNavItemsByPermissions = (navItems, userPermissions = []) => {
  if (!navItems || navItems.length === 0) {
    return [];
  }

  return navItems.filter(item => {
    // Si no tiene path, es un item especial (como "Más"), incluirlo
    if (!item.path) {
      return true;
    }

    // Verificar si tiene acceso a la ruta
    return hasRouteAccess(item.path, userPermissions);
  });
};

/**
 * Obtiene los permisos de un trabajador (desde customPermissions o rol base)
 * @param {object} worker - Objeto del trabajador con customPermissions y role
 * @returns {array} - Array de permisos
 */
export const getWorkerPermissions = (worker) => {
  if (!worker) {
    return [];
  }

  // Si tiene customPermissions, usarlos
  if (worker.customPermissions && worker.customPermissions.length > 0) {
    return worker.customPermissions;
  }

  // Si no, buscar permisos del rol base (ADMIN, CAJERA, etc.)
  // Esto se puede importar desde DEFAULT_ROLES si es necesario
  return [];
};
