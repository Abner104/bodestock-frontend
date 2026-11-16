// src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Traducciones en español
const es = {
  // Navegación
  nav: {
    dashboard: 'Dashboard',
    catalog: 'Catálogo',
    inventory: 'Inventario',
    myInventories: 'Mis Inventarios',
    exits: 'Salidas',
    workers: 'Trabajadores',
    settings: 'Configuración',
    profile: 'Mi Perfil',
    logout: 'Cerrar Sesión'
  },

  // Dashboard
  dashboard: {
    welcome: 'Bienvenido',
    totalSales: 'Ventas Totales',
    totalProducts: 'Productos Totales',
    lowStock: 'Stock Bajo',
    totalValue: 'Valor Total Inventario',
    recentMovements: 'Movimientos Recientes',
    topProducts: 'Productos Más Vendidos',
    salesChart: 'Gráfico de Ventas'
  },

  // Inventario
  inventory: {
    title: 'Inventario',
    addProduct: 'Agregar Producto',
    search: 'Buscar productos...',
    name: 'Nombre',
    sku: 'SKU',
    category: 'Categoría',
    stock: 'Stock',
    price: 'Precio',
    totalValue: 'Valor Total',
    actions: 'Acciones',
    edit: 'Editar',
    delete: 'Eliminar',
    purchase: 'Comprar',
    history: 'Historial',
    transfer: 'Transferir',
    shrinkage: 'Merma'
  },

  // Formularios
  form: {
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    edit: 'Editar',
    add: 'Agregar',
    search: 'Buscar',
    filter: 'Filtrar',
    export: 'Exportar',
    import: 'Importar',
    loading: 'Cargando...',
    saving: 'Guardando...'
  },

  // Configuración
  settings: {
    title: 'Configuración',
    plans: 'Planes',
    billing: 'API Facturación',
    notifications: 'Alertas',
    inventory: 'Inventario',
    general: 'General',
    language: 'Idioma',
    currency: 'Moneda',
    timezone: 'Zona Horaria',
    saveSettings: 'Guardar Configuración'
  },

  // Mensajes
  messages: {
    success: 'Operación exitosa',
    error: 'Error en la operación',
    saved: 'Guardado correctamente',
    deleted: 'Eliminado correctamente',
    updated: 'Actualizado correctamente',
    loading: 'Cargando...',
    noData: 'No hay datos disponibles',
    confirmDelete: '¿Estás seguro de eliminar?'
  },

  // Común
  common: {
    yes: 'Sí',
    no: 'No',
    ok: 'OK',
    back: 'Volver',
    next: 'Siguiente',
    previous: 'Anterior',
    finish: 'Finalizar',
    total: 'Total',
    date: 'Fecha',
    user: 'Usuario',
    status: 'Estado'
  }
};

// Traducciones en inglés
const en = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    catalog: 'Catalog',
    inventory: 'Inventory',
    myInventories: 'My Inventories',
    exits: 'Exits',
    workers: 'Workers',
    settings: 'Settings',
    profile: 'My Profile',
    logout: 'Logout'
  },

  // Dashboard
  dashboard: {
    welcome: 'Welcome',
    totalSales: 'Total Sales',
    totalProducts: 'Total Products',
    lowStock: 'Low Stock',
    totalValue: 'Total Inventory Value',
    recentMovements: 'Recent Movements',
    topProducts: 'Top Products',
    salesChart: 'Sales Chart'
  },

  // Inventory
  inventory: {
    title: 'Inventory',
    addProduct: 'Add Product',
    search: 'Search products...',
    name: 'Name',
    sku: 'SKU',
    category: 'Category',
    stock: 'Stock',
    price: 'Price',
    totalValue: 'Total Value',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    purchase: 'Purchase',
    history: 'History',
    transfer: 'Transfer',
    shrinkage: 'Shrinkage'
  },

  // Forms
  form: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    loading: 'Loading...',
    saving: 'Saving...'
  },

  // Settings
  settings: {
    title: 'Settings',
    plans: 'Plans',
    billing: 'Billing API',
    notifications: 'Alerts',
    inventory: 'Inventory',
    general: 'General',
    language: 'Language',
    currency: 'Currency',
    timezone: 'Timezone',
    saveSettings: 'Save Settings'
  },

  // Messages
  messages: {
    success: 'Operation successful',
    error: 'Operation error',
    saved: 'Saved successfully',
    deleted: 'Deleted successfully',
    updated: 'Updated successfully',
    loading: 'Loading...',
    noData: 'No data available',
    confirmDelete: 'Are you sure you want to delete?'
  },

  // Common
  common: {
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    finish: 'Finish',
    total: 'Total',
    date: 'Date',
    user: 'User',
    status: 'Status'
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en }
    },
    lng: 'es', // idioma por defecto
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
