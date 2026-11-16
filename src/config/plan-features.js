// src/config/plan-features.js
// Definición de features y límites por plan - Bodestock

export const PLAN_FEATURES = {
  trial: {
    name: 'Trial',
    subtitle: '30 días gratis',
    price: 0,
    maxUsers: Infinity,
    maxProducts: Infinity,
    maxWarehouses: Infinity,
    maxInventories: Infinity,
    features: [
      'inventory_management',
      'exits_tracking',
      'barcode_scanner',
      'excel_export',
      'pdf_export',
      'reports_basic',
      'email_alerts',
      'dark_mode',
      'mobile_app',
      'worker_management',
      'role_permissions',
      'multiple_warehouses',
      'ai_assistant', // Trial incluye IA para que el cliente la pruebe y se enamore
    ]
  },
  free: {
    name: 'Free',
    subtitle: 'Sin plan activo',
    price: 0,
    maxUsers: 1,
    maxProducts: 100,
    maxWarehouses: 1,
    maxInventories: 1,
    features: [
      'inventory_management',
    ]
  },
  basico: {
    name: 'Básico',
    subtitle: '1 Sucursal',
    price: 29990,
    maxUsers: 3,
    maxProducts: 1000,
    maxWarehouses: 1,
    maxInventories: 1,
    features: [
      'inventory_management',
      'exits_tracking',
      'barcode_scanner',
      'excel_export',
      'pdf_export',
      'reports_basic',
      'email_alerts',
      'dark_mode',
      'mobile_app',
      'worker_management',
      'role_permissions',
      'product_costing',
      'ai_assistant', // Incluido en básico — $9.990 del plan cubre el uso de IA
    ]
  },
  profesional: {
    name: 'Profesional',
    subtitle: '2 Sucursales',
    price: 59990,
    maxUsers: 4,
    maxProducts: 5000,
    maxWarehouses: 2,
    maxInventories: 2,
    features: [
      'inventory_management',
      'exits_tracking',
      'barcode_scanner',
      'excel_export',
      'pdf_export',
      'reports_basic',
      'reports_advanced',
      'email_alerts',
      'dark_mode',
      'mobile_app',
      'worker_management',
      'role_permissions',
      'multi_warehouse',
      'product_costing',
      'ai_assistant',
    ]
  },
  personalizado: {
    name: 'Personalizado',
    subtitle: 'A tu medida',
    price: 0, // Contactar por WhatsApp
    maxUsers: Infinity,
    maxProducts: Infinity,
    maxWarehouses: Infinity,
    maxInventories: Infinity,
    contactWhatsApp: true,
    features: ['*'] // todas las features
  }
};

// Add-ons disponibles para sumar al plan base
export const ADDONS = {
  costing: {
    id: 'costing',
    name: 'Costeo PPP',
    description: 'Calcula el costo real de tus productos',
    price: 9990,
    features: ['product_costing'],
    icon: 'Calculator',
    details: [
      'Cálculo automático con Precio Promedio Ponderado',
      'Costeo por insumos y recetas',
      'Simulación de márgenes y escenarios de precio',
      'Historial de variación de costos',
      'Catálogo de productos con costo actualizado',
    ],
  },
  multi_warehouse: {
    id: 'multi_warehouse',
    name: 'Sucursal adicional',
    description: 'Agrega una sucursal o bodega extra',
    price: 10990,
    pricePerUnit: true,
    features: ['multi_warehouse'],
    icon: 'Warehouse',
    details: [
      'Cada sucursal tiene su propio inventario',
      'Transferencias de stock entre bodegas',
      'Alertas de stock por sucursal',
      'Asigna trabajadores a bodegas específicas',
      'Reportes separados por sucursal',
    ],
  },
  invoicing: {
    id: 'invoicing',
    name: 'Facturación SII',
    description: 'Emite boletas y facturas electrónicas',
    price: 14990,
    features: ['invoicing', 'customers', 'orders', 'public_catalog'],
    icon: 'Receipt',
    details: [
      'Boletas electrónicas (Tipo 39) válidas ante SII',
      'Facturas electrónicas (Tipo 33)',
      'Guías de despacho electrónicas (Tipo 52)',
      'Notas de crédito para anulaciones',
      'PDF descargable de cada documento emitido',
      'Cartera de clientes incluida',
      'Gestión de pedidos incluida',
    ],
  },
  customers: {
    id: 'customers',
    name: 'Clientes y Pedidos',
    description: 'CRM, cartera de clientes y gestión de pedidos',
    price: 9990,
    features: ['customers', 'orders', 'public_catalog'],
    icon: 'Users2',
    details: [
      'Cartera de clientes con historial de compras',
      'Gestión de pedidos desde recepción hasta entrega',
      'Catálogo público compartible por link',
      'Asocia pedidos a clientes específicos',
      'Seguimiento de estado de cada pedido',
    ],
  },
  ai_assistant: {
    id: 'ai_assistant',
    name: 'Asistente IA',
    description: 'Consulta tu inventario en lenguaje natural',
    price: 7990,
    features: ['ai_assistant', 'reports_advanced'],
    icon: 'Sparkles',
    details: [
      'Pregunta en español: "¿Qué producto se vende más?"',
      'Alertas inteligentes de reposición',
      'Reportes avanzados con ranking de productos',
      'Análisis de tendencias de venta',
      'Sugerencias de optimización de stock',
    ],
  },
};

// Labels legibles para cada feature
export const FEATURE_LABELS = {
  inventory_management: 'Gestión de inventario en tiempo real',
  exits_tracking: 'Control de salidas y ventas',
  barcode_scanner: 'Escáner de código de barras',
  product_costing: 'Costeo inteligente de productos (PPP)',
  excel_export: 'Exportar a Excel',
  pdf_export: 'Exportar a PDF',
  reports_basic: 'Reportes de ventas e inventario',
  reports_advanced: 'Reportes avanzados y ranking',
  email_alerts: 'Alertas de stock bajo por email',
  worker_management: 'Gestión de trabajadores y equipos',
  role_permissions: 'Roles y permisos personalizados',
  dark_mode: 'Modo oscuro',
  mobile_app: 'App móvil optimizada',
  ai_assistant: 'Asistente IA de inventario',
  public_catalog: 'Catálogo público compartible',
  customers: 'Cartera de clientes',
  orders: 'Gestión de pedidos',
  invoicing: 'Facturación electrónica (SII)',
  multi_warehouse: 'Multi-bodega / sucursales',
  whatsapp_alerts: 'Alertas por WhatsApp',
  api_access: 'Acceso API',
  custom_integrations: 'Integraciones personalizadas',
  priority_support: 'Soporte prioritario',
};

// Mapa de rutas/acciones a features requeridas
export const ROUTE_FEATURE_MAP = {
  '/costeo': 'product_costing',
  '/catalogo': 'product_costing',
  // '/historial': 'reports_basic', // Reportes disponible en todos los planes
  '/clientes': 'customers',
  '/pedidos': 'orders',
  '/catalogo-publico': 'public_catalog',
};

// Features que se requieren a nivel de componente (no ruta)
export const COMPONENT_FEATURE_MAP = {
  'excel_export': 'excel_export',
  'ai_assistant': 'ai_assistant',
  'advanced_reports': 'reports_advanced',
};

// Backward compatibility aliases (old feature names → new)
export const FEATURE_ALIASES = {
  'inventory_basic': 'inventory_management',
  'exits_basic': 'exits_tracking',
  'reports': 'reports_basic',
  'advanced_reports': 'reports_advanced',
  'costing': 'product_costing',
  'public_catalog': 'public_catalog',
  'multi_branch': 'multi_warehouse',
};
