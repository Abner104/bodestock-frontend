// src/services/stock-triggers.js
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from './companyService';
import { checkAndSendLowStockNotifications, getLowStockProducts } from './notification-service';

/**
 * Monitor de stock en tiempo real
 * Se ejecuta cuando hay cambios en productos
 */
class StockMonitor {
  constructor() {
    this.listeners = new Map();
    this.lastNotificationCheck = null;
    this.isMonitoring = false;
  }

  /**
   * Iniciar monitoreo de stock
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('📊 Monitor de stock ya está ejecutándose');
      return;
    }

    console.log('🚀 Iniciando monitor de stock en tiempo real...');
    this.isMonitoring = true;

    try {
      // Verificar configuración de notificaciones
      const settingsDoc = await getDoc(doc(db, 'settings', 'notifications'));
      if (!settingsDoc.exists() || !settingsDoc.data().general?.enabled) {
        console.log('⏸️ Notificaciones deshabilitadas - monitor detenido');
        this.isMonitoring = false;
        return;
      }

      // Monitorear cambios en productos
      this.monitorProductChanges();

      // Verificación periódica (cada 30 minutos)
      this.startPeriodicCheck();

      console.log('✅ Monitor de stock iniciado correctamente');
    } catch (error) {
      console.error('❌ Error iniciando monitor de stock:', error);
      this.isMonitoring = false;
    }
  }

  /**
   * Detener monitoreo
   */
  stopMonitoring() {
    console.log('🛑 Deteniendo monitor de stock...');

    // Detener todos los listeners
    this.listeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.listeners.clear();

    // Detener verificación periódica
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }

    this.isMonitoring = false;
    console.log('✅ Monitor de stock detenido');
  }

  /**
   * Monitorear cambios en productos específicos
   */
  monitorProductChanges() {
    // Esta función se ejecutaría idealmente con un listener global
    // Por limitaciones de Firestore en el cliente, usaremos verificación periódica
    console.log('👀 Iniciando monitoreo de cambios en productos...');
  }

  /**
   * Verificación periódica cada 30 minutos
   */
  startPeriodicCheck() {
    // Verificación inicial
    this.checkStockLevels();

    // Verificación cada 30 minutos (1800000 ms)
    this.periodicCheckInterval = setInterval(() => {
      this.checkStockLevels();
    }, 30 * 60 * 1000); // 30 minutos

    console.log('⏰ Verificación periódica configurada (cada 30 minutos)');
  }

  /**
   * Verificar niveles de stock
   */
  async checkStockLevels() {
    try {
      console.log('🔍 Verificando niveles de stock...');

      // Obtener configuración desde la ruta correcta por empresa
      const companyId = await getUserCompanyId();
      if (!companyId) return;

      const [notifSnap, invSnap] = await Promise.all([
        getDoc(doc(db, `companies/${companyId}/settings`, 'notifications')),
        getDoc(doc(db, `companies/${companyId}/settings`, 'inventory')),
      ]);

      const notifSettings = notifSnap.exists() ? notifSnap.data() : {};
      const invSettings = invSnap.exists() ? invSnap.data() : {};

      if (notifSettings.lowStockAlerts === false) {
        console.log('⏸️ Alertas de stock bajo deshabilitadas');
        return;
      }

      const threshold = invSettings.lowStockThreshold ?? 5;
      const now = new Date();

      // Verificar si debe enviar notificación (respetando intervalo)
      const shouldCheck = this.shouldCheckNow(notifSettings.lastSent, 24);

      if (!shouldCheck) {
        console.log('⏰ Muy pronto para verificar de nuevo');
        return;
      }

      // Verificar productos con stock bajo
      const lowStockProducts = await getLowStockProducts(threshold);

      if (lowStockProducts.length > 0) {
        console.log(`⚠️ Detectados ${lowStockProducts.length} productos con stock bajo:`,
          lowStockProducts.map(p => `${p.name} (${p.stock})`));

        // Intentar enviar notificación
        const result = await checkAndSendLowStockNotifications();

        if (result.success) {
          console.log('✅ Notificación de stock bajo procesada');

          // Mostrar notificación en navegador si está permitido
          this.showBrowserNotification(lowStockProducts);
        } else {
          console.log('⚠️ No se pudo procesar la notificación:', result.message);
        }
      } else {
        console.log('✅ Todos los productos tienen stock adecuado');
      }

      this.lastNotificationCheck = now;
    } catch (error) {
      console.error('❌ Error verificando stock:', error);
    }
  }

  /**
   * Verificar si debe hacer la verificación ahora
   */
  shouldCheckNow(lastSent, intervalHours) {
    if (!lastSent) return true;

    const now = new Date();
    const lastSentDate = new Date(lastSent);
    const hoursDiff = (now - lastSentDate) / (1000 * 60 * 60);

    return hoursDiff >= intervalHours;
  }

  /**
   * Mostrar notificación del navegador
   */
  async showBrowserNotification(products) {
    // Verificar si las notificaciones están permitidas
    if ('Notification' in window) {
      let permission = Notification.permission;

      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        const notification = new Notification('🚨 Stock Bajo Detectado', {
          body: `${products.length} ${products.length === 1 ? 'producto tiene' : 'productos tienen'} stock bajo`,
          icon: '/favicon.ico', // Asegúrate de tener un favicon
          badge: '/favicon.ico',
          tag: 'stock-alert',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'Ver Detalles'
            }
          ]
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = '/notificaciones';
          notification.close();
        };

        // Auto-cerrar después de 10 segundos
        setTimeout(() => {
          notification.close();
        }, 10000);
      }
    }
  }

  /**
   * Obtener estado del monitor
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      activeListeners: this.listeners.size,
      lastCheck: this.lastNotificationCheck,
      periodicCheckActive: !!this.periodicCheckInterval
    };
  }
}

// Instancia global del monitor
const stockMonitor = new StockMonitor();

/**
 * Inicializar monitoreo automático
 */
export const initializeStockMonitoring = async () => {
  try {
    await stockMonitor.startMonitoring();
    return { success: true, message: 'Monitor de stock iniciado' };
  } catch (error) {
    console.error('Error inicializando monitor:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Detener monitoreo
 */
export const stopStockMonitoring = () => {
  stockMonitor.stopMonitoring();
  return { success: true, message: 'Monitor de stock detenido' };
};

/**
 * Forzar verificación manual
 */
export const forceStockCheck = async () => {
  if (!stockMonitor.isMonitoring) {
    return { success: false, message: 'Monitor no está ejecutándose' };
  }

  try {
    await stockMonitor.checkStockLevels();
    return { success: true, message: 'Verificación manual completada' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

/**
 * Obtener estado del monitor
 */
export const getMonitorStatus = () => {
  return stockMonitor.getStatus();
};

/**
 * Auto-inicializar cuando se importa el módulo
 */
export const autoInitialize = () => {
  // Solo auto-inicializar en producción o cuando está configurado
  if (import.meta.env.MODE === 'production' || import.meta.env.VITE_AUTO_STOCK_MONITOR === 'true') {
    setTimeout(() => {
      initializeStockMonitoring();
    }, 5000); // Esperar 5 segundos después de cargar la app
  }
};

// Exportar la instancia para control directo si es necesario
export { stockMonitor };

// Comentar auto-inicialización para control manual
// autoInitialize();