// src/config/permissions-routes-map.js
/**
 * Mapeo visual de permisos a rutas que desbloquean
 * Este archivo se usa para mostrar tooltips informativos en el wizard de trabajadores
 */

export const PERMISSION_ROUTE_MAP = {
  // Acceso a Secciones
  "access_dashboard": "🔓 Dashboard Principal (/)",
  "access_inventory": "🔓 Inventario (/inventario)",
  "access_sales": "🔓 Bodegas/Salidas (/mis-bodegas)",
  "access_reports": "🔓 Reportes (/historial)",
  "access_workers": "🔓 Trabajadores (/trabajadores)",
  "access_settings": "🔓 Planes (/plans)",
  "access_customers": "🔓 Clientes (/clientes)",

  // Lectura
  "read_all": "🔓 Notificaciones + Todo el sistema",
  "read_inventory": "🔓 Catálogo (/catalogo)",
  "view_reports": "🔓 Reportes (/historial)",
  "view_own_activity": "🔓 Mi Dashboard (/dashboard-trabajador)",
  "view_team_activity": "",

  // Información Sensible
  "view_costs": "🔓 Costeo (/costeo)",
  "view_profits": "",
  "view_stock_only": "",
  "view_sale_prices": "💰 Ver precios en catálogo",

  // Escritura
  "write_all": "",
  "record_exits": "🔓 Bodegas/Salidas (/mis-bodegas)",
  "manage_inventory": "🔓 Inventario + Costeo (/inventario + /costeo)",
  "approve_exits": "",

  // Eliminación
  "delete_all": "",

  // Gestión
  "manage_workers": "🔓 Trabajadores (/trabajadores)",
  "manage_roles": "",
  "manage_team_limits": "",

  // Bodegas
  "access_all_warehouses": "",
  "access_assigned_warehouses": "",

  // Límites
  "unlimited_withdrawals": ""
};

/**
 * Obtener descripción de qué desbloquea un permiso
 * @param {string} permissionKey - Clave del permiso
 * @returns {string} - Descripción de lo que desbloquea
 */
export const getPermissionUnlocks = (permissionKey) => {
  return PERMISSION_ROUTE_MAP[permissionKey] || "";
};
