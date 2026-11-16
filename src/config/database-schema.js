// src/config/database-schema.js
// Estructura de base de datos para el sistema de trabajadores

// ======== COLECCIONES DE FIRESTORE ========

// 1. Colección: "workers" (trabajadores)
export const WorkerSchema = {
  id: "string", // ID único del trabajador
  email: "string", // Email de Firebase Auth
  name: "string", // Nombre completo
  role: "string", // ADMIN, SUPERVISOR, WORKER
  isActive: "boolean", // Si está activo o deshabilitado
  assignedInventories: ["array"], // IDs de inventarios asignados (nuevo sistema)
  assignedWarehouses: ["array"], // IDs de bodegas asignadas (legacy o específicas)

  // Límites flexibles
  limitType: "string", // "MONEY", "UNITS", "NONE"
  dailyLimitMoney: "number", // Límite diario en CLP (solo si limitType = "MONEY")
  dailyLimitUnits: "number", // Límite diario en unidades totales (kg, litros, unidades, etc.)

  createdAt: "timestamp",
  updatedAt: "timestamp",
  createdBy: "string" // ID del admin que lo creó
};

// 2. Colección: "roles" (roles y permisos)
export const RoleSchema = {
  id: "string", // ADMIN, SUPERVISOR, WORKER
  name: "string", // Nombre del rol
  permissions: ["array"], // Lista de permisos
  description: "string", // Descripción del rol
  isSystemRole: "boolean" // Si es un rol del sistema (no se puede eliminar)
};

// 3. Colección: "inventory_exits" (salidas de inventario)
export const InventoryExitSchema = {
  id: "string", // ID único de la salida
  workerId: "string", // ID del trabajador que registró la salida
  warehouseId: "string", // ID de la bodega
  products: ["array"], // Array de productos con cantidades
  totalValue: "number", // Valor total de la salida en CLP
  reason: "string", // SALE, WASTE, TRANSFER, OTHER
  notes: "string", // Notas adicionales
  timestamp: "timestamp", // Cuándo se registró
  status: "string" // PENDING, APPROVED, REJECTED
};

// 4. Estructura de productos en salidas
export const ExitProductSchema = {
  productId: "string", // ID del producto en inventory
  productName: "string", // Nombre del producto
  quantity: "number", // Cantidad retirada
  unit: "string", // Unidad (kg, unidad, litros)
  unitValue: "number", // Valor unitario en CLP
  totalValue: "number" // Valor total (quantity * unitValue)
};

// 5. Colección: "daily_limits" (control de límites diarios)
export const DailyLimitSchema = {
  id: "string", // workerId-date (ej: worker123-2024-01-15)
  workerId: "string", // ID del trabajador
  date: "string", // Fecha en formato YYYY-MM-DD
  limitType: "string", // "MONEY", "UNITS", "NONE"
  usedAmountMoney: "number", // Cantidad usada en CLP (si limitType = "MONEY")
  usedAmountUnits: "number", // Cantidad usada en unidades totales (si limitType = "UNITS")
  transactions: ["array"], // IDs de las transacciones del día
  lastUpdated: "timestamp"
};

// ======== ROLES PREDEFINIDOS ========

export const DEFAULT_ROLES = {
  ADMIN: {
    id: "ADMIN",
    name: "Administrador",
    permissions: [
      "read_all",
      "write_all",
      "delete_all",
      "manage_workers",
      "manage_roles",
      "unlimited_withdrawals",
      "access_all_warehouses",
      "view_reports",
      "manage_inventory",
      "view_costs",
      "view_profits",
      "access_dashboard",
      "access_inventory",
      "access_sales",
      "access_reports",
      "access_workers",
      "access_settings"
    ],
    description: "Acceso completo al sistema",
    isSystemRole: true
  },
  ENCARGADA: {
    id: "ENCARGADA",
    name: "Encargada de Tienda",
    permissions: [
      "read_inventory",
      "record_exits",
      "approve_exits",
      "view_team_activity",
      "access_assigned_warehouses",
      "manage_team_limits",
      "view_reports",
      "view_costs",
      "view_profits",
      "access_dashboard",
      "access_inventory",
      "access_sales",
      "access_reports",
      "manage_inventory"
    ],
    description: "Gestión completa de la tienda y supervisión del equipo",
    isSystemRole: true
  },
  CAJERA: {
    id: "CAJERA",
    name: "Cajera",
    permissions: [
      "record_exits",
      "access_assigned_warehouses",
      "view_own_activity",
      "access_sales",
      "view_stock_only",
      "view_sale_prices"  // ✅ PUEDE ver precios de venta para cobrar
    ],
    description: "Registro de ventas con precios de venta (sin ver costos, ganancias ni dashboard)",
    isSystemRole: true
  },
  VENDEDORA: {
    id: "VENDEDORA",
    name: "Vendedor",
    permissions: [
      "read_inventory",
      "record_exits",
      "access_assigned_warehouses",
      "view_own_activity",
      "access_inventory",
      "access_sales",
      "view_stock_only",
      "view_sale_prices",
      "access_customers"
    ],
    description: "Consulta de inventario, precios de venta y registro de ventas (sin ver costos)",
    isSystemRole: true
  },
  SUPERVISOR: {
    id: "SUPERVISOR",
    name: "Supervisor",
    permissions: [
      "read_inventory",
      "record_exits",
      "approve_exits",
      "view_team_activity",
      "access_assigned_warehouses",
      "manage_team_limits",
      "access_dashboard",
      "access_inventory",
      "access_reports"
    ],
    description: "Supervisión de bodegas asignadas y equipo de trabajo",
    isSystemRole: true
  },
  WORKER: {
    id: "WORKER",
    name: "Trabajador",
    permissions: [
      "read_inventory",
      "record_exits",
      "access_assigned_warehouses",
      "view_own_activity"
    ],
    description: "Registro de salidas de inventario con límites",
    isSystemRole: true
  },
  GERENTE: {
    id: "GERENTE",
    name: "Gerente",
    permissions: [
      "read_all",
      "write_all",
      "view_reports",
      "view_costs",
      "view_profits",
      "manage_inventory",
      "access_dashboard",
      "access_inventory",
      "access_sales",
      "access_reports",
      "access_all_warehouses",
      "unlimited_withdrawals"
    ],
    description: "Gestión completa con acceso a reportes financieros",
    isSystemRole: true
  },
  GARZON: {
    id: "GARZON",
    name: "Garzón / Mesero",
    permissions: [
      "read_inventory",
      "record_exits",
      "access_assigned_tables",
      "view_own_activity",
      "access_sales",
      "view_stock_only",
      "view_sale_prices"
    ],
    description: "Toma pedidos por mesa y registra ventas (sin ver costos ni ganancias)",
    isSystemRole: true
  }
};

// ======== TIPOS DE SALIDAS ========

export const EXIT_REASONS = {
  SALE: {
    id: "SALE",
    name: "Venta",
    description: "Producto vendido a cliente",
    requiresApproval: false,
    color: "#4CAF50"
  },
  WASTE: {
    id: "WASTE",
    name: "Merma/Desperdicio",
    description: "Producto vencido, dañado o perdido",
    requiresApproval: true,
    color: "#f44336"
  },
  TRANSFER: {
    id: "TRANSFER",
    name: "Transferencia",
    description: "Movimiento entre bodegas",
    requiresApproval: false,
    color: "#2196F3"
  },
  PRODUCTION: {
    id: "PRODUCTION",
    name: "Producción",
    description: "Usado para elaborar otro producto",
    requiresApproval: false,
    color: "#FF9800"
  },
  CREDIT: {
    id: "CREDIT",
    name: "Fiado/Crédito",
    description: "Venta a crédito, el cliente paga después",
    requiresApproval: false,
    color: "#FFC107"
  },
  OTHER: {
    id: "OTHER",
    name: "Otro",
    description: "Otras razones",
    requiresApproval: true,
    color: "#9E9E9E"
  }
};

// ======== TIPOS DE LÍMITES ========

export const LIMIT_TYPES = {
  NONE: {
    id: "NONE",
    name: "Sin límite",
    description: "Acceso ilimitado",
    icon: "∞"
  },
  MONEY: {
    id: "MONEY",
    name: "Límite en dinero",
    description: "Límite diario en pesos chilenos",
    icon: "$"
  },
  UNITS: {
    id: "UNITS",
    name: "Límite en cantidad total",
    description: "Límite diario basado en la suma de todas las cantidades (5kg + 3L + 10 unidades = 18 total)",
    icon: "⚖️"
  }
};

// ======== PERMISOS DISPONIBLES ========

export const AVAILABLE_PERMISSIONS = {
  // ========== LECTURA ==========
  "read_all": {
    name: "Leer todo el sistema",
    description: "Acceso completo de lectura a todas las secciones",
    category: "Lectura"
  },
  "read_inventory": {
    name: "Ver inventario",
    description: "Consultar productos y stock",
    category: "Lectura"
  },
  "view_reports": {
    name: "Ver reportes",
    description: "Acceso a reportes y estadísticas",
    category: "Lectura"
  },
  "view_own_activity": {
    name: "Ver actividad propia",
    description: "Ver su propio historial de actividades",
    category: "Lectura"
  },
  "view_team_activity": {
    name: "Ver actividad del equipo",
    description: "Ver actividades de otros trabajadores",
    category: "Lectura"
  },

  // ========== VISUALIZACIÓN DE INFORMACIÓN SENSIBLE ==========
  "view_costs": {
    name: "Ver costos y PPP",
    description: "Ver precios de costo y PPP de productos",
    category: "Información Sensible"
  },
  "view_profits": {
    name: "Ver ganancias",
    description: "Ver márgenes de ganancia y utilidades",
    category: "Información Sensible"
  },
  "view_stock_only": {
    name: "Ver solo stock (sin costos)",
    description: "Ver cantidades disponibles sin precios de costo",
    category: "Información Sensible"
  },
  "view_sale_prices": {
    name: "Ver precios de venta",
    description: "Ver precios de venta al público",
    category: "Información Sensible"
  },

  // ========== ESCRITURA ==========
  "write_all": {
    name: "Escribir en todo el sistema",
    description: "Capacidad de crear y modificar cualquier registro",
    category: "Escritura"
  },
  "record_exits": {
    name: "Registrar salidas",
    description: "Registrar ventas y salidas de inventario",
    category: "Escritura"
  },
  "manage_inventory": {
    name: "Gestionar inventario",
    description: "Crear, editar y eliminar productos",
    category: "Escritura"
  },
  "approve_exits": {
    name: "Aprobar salidas",
    description: "Autorizar salidas que requieren aprobación",
    category: "Escritura"
  },
  "register_purchases": {
    name: "Registrar ingreso de mercadería",
    description: "Recibir pedidos de proveedores (cantidad y costo) sin acceso al resto de Inventario",
    category: "Escritura"
  },

  // ========== ELIMINACIÓN ==========
  "delete_all": {
    name: "Eliminar cualquier registro",
    description: "Capacidad de eliminar registros del sistema",
    category: "Eliminación"
  },

  // ========== GESTIÓN ==========
  "manage_workers": {
    name: "Gestionar trabajadores",
    description: "Crear, editar y administrar trabajadores",
    category: "Gestión"
  },
  "manage_roles": {
    name: "Gestionar roles",
    description: "Modificar permisos y roles del sistema",
    category: "Gestión"
  },
  "manage_team_limits": {
    name: "Gestionar límites del equipo",
    description: "Modificar límites diarios de trabajadores",
    category: "Gestión"
  },

  // ========== ACCESO A SECCIONES ==========
  "access_dashboard": {
    name: "Acceso al Dashboard",
    description: "Ver página principal con estadísticas",
    category: "Acceso a Secciones"
  },
  "access_inventory": {
    name: "Acceso a Inventario",
    description: "Acceder a la sección de inventario",
    category: "Acceso a Secciones"
  },
  "access_sales": {
    name: "Acceso a Ventas",
    description: "Acceder a la sección de ventas y salidas",
    category: "Acceso a Secciones"
  },
  "access_reports": {
    name: "Acceso a Reportes",
    description: "Acceder a la sección de reportes",
    category: "Acceso a Secciones"
  },
  "access_workers": {
    name: "Acceso a Trabajadores",
    description: "Acceder a gestión de trabajadores",
    category: "Acceso a Secciones"
  },
  "access_settings": {
    name: "Acceso a Configuración",
    description: "Acceder a configuración del sistema",
    category: "Acceso a Secciones"
  },

  // ========== ACCESO A BODEGAS ==========
  "access_all_warehouses": {
    name: "Acceso a todas las bodegas",
    description: "Ver y operar en todas las bodegas",
    category: "Acceso a Bodegas"
  },
  "access_assigned_warehouses": {
    name: "Acceso a bodegas asignadas",
    description: "Solo puede acceder a sus bodegas asignadas",
    category: "Acceso a Bodegas"
  },

  // ========== LÍMITES ==========
  "unlimited_withdrawals": {
    name: "Retiros sin límite",
    description: "Sin restricciones en montos o cantidades",
    category: "Límites"
  },

  // ========== ACCESO A MESAS (restaurantes) ==========
  "access_tables": {
    name: "Acceso a todas las mesas",
    description: "Ver y operar en todas las mesas del local",
    category: "Acceso a Mesas"
  },
  "access_assigned_tables": {
    name: "Acceso a mesas asignadas",
    description: "Solo puede tomar pedidos en sus mesas asignadas",
    category: "Acceso a Mesas"
  },
  "manage_tables": {
    name: "Gestionar mesas",
    description: "Crear, editar y eliminar mesas del local",
    category: "Acceso a Mesas"
  }
};

// ========== AGRUPACIÓN DE PERMISOS POR CATEGORÍA ==========
export const PERMISSION_CATEGORIES = {
  "Lectura": ["read_all", "read_inventory", "view_reports", "view_own_activity", "view_team_activity"],
  "Información Sensible": ["view_costs", "view_profits", "view_stock_only", "view_sale_prices"],
  "Escritura": ["write_all", "record_exits", "manage_inventory", "approve_exits", "register_purchases"],
  "Eliminación": ["delete_all"],
  "Gestión": ["manage_workers", "manage_roles", "manage_team_limits"],
  "Acceso a Secciones": ["access_dashboard", "access_inventory", "access_sales", "access_reports", "access_workers", "access_settings"],
  "Acceso a Bodegas": ["access_all_warehouses", "access_assigned_warehouses"],
  "Límites": ["unlimited_withdrawals"],
  "Acceso a Mesas": ["access_tables", "access_assigned_tables", "manage_tables"]
};