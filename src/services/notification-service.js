// src/services/notification-service.js
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from './companyService.js';

/**
 * Servicio para manejar notificaciones de stock bajo
 */

// Configuración por defecto de notificaciones
const DEFAULT_NOTIFICATION_SETTINGS = {
  email: {
    enabled: false,
    address: '',
    threshold: 5, // Stock mínimo para enviar alerta
    lastSent: null
  },
  general: {
    checkInterval: 24, // Horas entre verificaciones
    enabled: true
  }
};

/**
 * Obtener configuración de notificaciones
 */
export const getNotificationSettings = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const settingsDoc = await getDoc(doc(db, `companies/${companyId}/settings`, 'notifications'));

    if (settingsDoc.exists()) {
      return { id: settingsDoc.id, ...settingsDoc.data() };
    } else {
      // Crear configuración por defecto si no existe
      await setDoc(doc(db, `companies/${companyId}/settings`, 'notifications'), DEFAULT_NOTIFICATION_SETTINGS);
      return { id: 'notifications', ...DEFAULT_NOTIFICATION_SETTINGS };
    }
  } catch (error) {
    console.error('Error obteniendo configuración de notificaciones:', error);
    throw error;
  }
};

/**
 * Actualizar configuración de notificaciones
 */
export const updateNotificationSettings = async (settings) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    await updateDoc(doc(db, `companies/${companyId}/settings`, 'notifications'), settings);
    console.log('✅ Configuración de notificaciones actualizada');
    return true;
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    throw error;
  }
};

/**
 * Obtener productos con stock bajo
 * @param {number} threshold - Umbral de stock bajo
 * @param {string} inventoryId - ID del inventario específico (opcional)
 * @returns {Promise<Array>} - Productos con stock bajo
 */
export const getLowStockProducts = async (threshold = 5, inventoryId = null) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    // Si hay inventoryId, buscar en la nueva estructura
    // Si no, buscar en la estructura legacy
    const inventoryPath = inventoryId
      ? `companies/${companyId}/inventories/${inventoryId}/products`
      : `companies/${companyId}/inventory`;

    const productsQuery = query(
      collection(db, inventoryPath),
      where('stock', '<=', threshold),
      where('stock', '>', 0) // Excluir productos sin stock
    );

    const snapshot = await getDocs(productsQuery);
    const lowStockProducts = [];

    snapshot.forEach(doc => {
      lowStockProducts.push({
        id: doc.id,
        inventoryId: inventoryId || 'legacy', // Agregar referencia al inventario
        ...doc.data()
      });
    });

    console.log(`📊 Encontrados ${lowStockProducts.length} productos con stock bajo${inventoryId ? ` en inventario ${inventoryId}` : ''}`);
    return lowStockProducts;
  } catch (error) {
    console.error('Error obteniendo productos con stock bajo:', error);
    throw error;
  }
};

/**
 * Obtener productos con stock bajo de TODOS los inventarios
 * @param {number} threshold - Umbral de stock bajo
 * @returns {Promise<Object>} - Objeto con productos agrupados por inventario
 */
export const getAllLowStockProducts = async (threshold = 5) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const allLowStockProducts = {
      legacy: [],
      inventories: {}
    };

    // 1. Obtener productos del inventario legacy
    try {
      const legacyProducts = await getLowStockProducts(threshold, null);
      allLowStockProducts.legacy = legacyProducts;
    } catch (error) {
      console.warn('No hay inventario legacy o error al cargar:', error.message);
    }

    // 2. Obtener todos los inventarios dinámicos
    const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
    const inventoriesSnapshot = await getDocs(inventoriesRef);

    // 3. Por cada inventario, obtener productos con stock bajo
    for (const inventoryDoc of inventoriesSnapshot.docs) {
      const inventoryId = inventoryDoc.id;

      // Obtener metadata del inventario
      const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
      const metadataSnapshot = await getDocs(metadataRef);

      let inventoryName = inventoryId;
      if (!metadataSnapshot.empty) {
        const metadata = metadataSnapshot.docs[0].data();
        inventoryName = metadata.name || inventoryId;
      }

      // Obtener productos con stock bajo de este inventario
      const products = await getLowStockProducts(threshold, inventoryId);

      if (products.length > 0) {
        allLowStockProducts.inventories[inventoryId] = {
          name: inventoryName,
          products: products
        };
      }
    }

    const totalProducts = allLowStockProducts.legacy.length +
      Object.values(allLowStockProducts.inventories).reduce((sum, inv) => sum + inv.products.length, 0);

    console.log(`📊 Total: ${totalProducts} productos con stock bajo en todos los inventarios`);

    return allLowStockProducts;
  } catch (error) {
    console.error('Error obteniendo productos con stock bajo de todos los inventarios:', error);
    throw error;
  }
};

/**
 * Obtener productos próximos a vencer
 * @param {number} daysThreshold - Días antes del vencimiento para alertar
 * @param {string} inventoryId - ID del inventario específico (opcional)
 * @returns {Promise<Array>} - Productos próximos a vencer
 */
export const getExpiringProducts = async (daysThreshold = 7, inventoryId = null) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const inventoryPath = inventoryId
      ? `companies/${companyId}/inventories/${inventoryId}/products`
      : `companies/${companyId}/inventory`;

    const snapshot = await getDocs(collection(db, inventoryPath));
    const expiringProducts = [];
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.expiryDate) {
        const expiryDate = data.expiryDate.toDate ? data.expiryDate.toDate() : new Date(data.expiryDate);

        // Si la fecha de vencimiento está entre hoy y el threshold
        if (expiryDate >= now && expiryDate <= thresholdDate) {
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

          expiringProducts.push({
            id: doc.id,
            inventoryId: inventoryId || 'legacy',
            daysUntilExpiry,
            expiryDate: expiryDate,
            ...data
          });
        }
      }
    });

    // Ordenar por días hasta vencer (más urgente primero)
    expiringProducts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    console.log(`⏰ Encontrados ${expiringProducts.length} productos por vencer${inventoryId ? ` en inventario ${inventoryId}` : ''}`);
    return expiringProducts;
  } catch (error) {
    console.error('Error obteniendo productos por vencer:', error);
    throw error;
  }
};

/**
 * Obtener productos próximos a vencer de TODOS los inventarios
 * @param {number} daysThreshold - Días antes del vencimiento
 * @returns {Promise<Object>} - Objeto con productos agrupados por inventario
 */
export const getAllExpiringProducts = async (daysThreshold = 7) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const allExpiringProducts = {
      legacy: [],
      inventories: {}
    };

    // 1. Obtener productos del inventario legacy
    try {
      const legacyProducts = await getExpiringProducts(daysThreshold, null);
      allExpiringProducts.legacy = legacyProducts;
    } catch (error) {
      console.warn('No hay inventario legacy o error al cargar:', error.message);
    }

    // 2. Obtener todos los inventarios dinámicos
    const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
    const inventoriesSnapshot = await getDocs(inventoriesRef);

    // 3. Por cada inventario, obtener productos por vencer
    for (const inventoryDoc of inventoriesSnapshot.docs) {
      const inventoryId = inventoryDoc.id;

      // Obtener metadata del inventario
      const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
      const metadataSnapshot = await getDocs(metadataRef);

      let inventoryName = inventoryId;
      if (!metadataSnapshot.empty) {
        const metadata = metadataSnapshot.docs[0].data();
        inventoryName = metadata.name || inventoryId;
      }

      // Obtener productos por vencer de este inventario
      const products = await getExpiringProducts(daysThreshold, inventoryId);

      if (products.length > 0) {
        allExpiringProducts.inventories[inventoryId] = {
          name: inventoryName,
          products: products
        };
      }
    }

    const totalProducts = allExpiringProducts.legacy.length +
      Object.values(allExpiringProducts.inventories).reduce((sum, inv) => sum + inv.products.length, 0);

    console.log(`⏰ Total: ${totalProducts} productos por vencer en todos los inventarios`);

    return allExpiringProducts;
  } catch (error) {
    console.error('Error obteniendo productos por vencer de todos los inventarios:', error);
    throw error;
  }
};

/**
 * Verificar si necesita enviar notificación (evitar spam)
 */
export const shouldSendNotification = (lastSent, intervalHours = 24) => {
  if (!lastSent) return true;

  const now = new Date();
  const lastSentDate = new Date(lastSent);
  const hoursDiff = (now - lastSentDate) / (1000 * 60 * 60);

  return hoursDiff >= intervalHours;
};

/**
 * Generar HTML para email de notificación
 */
export const generateLowStockEmailHTML = (products, companyName = 'Tu Empresa') => {
  const productRows = products.map(product => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-weight: 500;">${product.name}</td>
      <td style="padding: 12px; text-align: center;">${product.code || 'N/A'}</td>
      <td style="padding: 12px; text-align: center; color: ${product.stock <= 2 ? '#ef4444' : '#f59e0b'}; font-weight: bold;">
        ${product.stock} ${product.unit || 'unidades'}
      </td>
      <td style="padding: 12px;">${product.category || 'Sin categoría'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alerta de Stock Bajo</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #1f2937 0%, #ea580c 100%); border-radius: 10px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Alerta de Stock Bajo</h1>
        <p style="color: #f3f4f6; margin: 10px 0 0 0;">${companyName}</p>
      </div>

      <!-- Mensaje principal -->
      <div style="margin-bottom: 25px;">
        <p style="font-size: 16px; margin-bottom: 15px;">
          <strong>Atención:</strong> Se han detectado <strong style="color: #ea580c;">${products.length}</strong>
          ${products.length === 1 ? 'producto' : 'productos'} con stock bajo en el inventario.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Es recomendable revisar estos productos y considerar realizar pedidos de reposición.
        </p>
      </div>

      <!-- Tabla de productos -->
      <div style="margin-bottom: 25px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 15px; text-align: left; font-weight: 600; color: #374151;">Producto</th>
              <th style="padding: 15px; text-align: center; font-weight: 600; color: #374151;">Código</th>
              <th style="padding: 15px; text-align: center; font-weight: 600; color: #374151;">Stock</th>
              <th style="padding: 15px; text-align: left; font-weight: 600; color: #374151;">Categoría</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
      </div>

      <!-- Acciones recomendadas -->
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #ea580c; margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; color: #ea580c;">📋 Acciones Recomendadas:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
          <li>Revisar proveedores para estos productos</li>
          <li>Verificar tiempos de entrega</li>
          <li>Considerar aumentar stock de seguridad</li>
          <li>Evaluar demanda reciente del producto</li>
        </ul>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>📅 Fecha de reporte: ${new Date().toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        <p>🤖 Este es un mensaje automático del sistema de gestión de inventario.</p>
        <p style="margin-top: 15px;">
          <strong>${companyName}</strong> | Sistema de Gestión de Inventario
        </p>
      </div>

    </body>
    </html>
  `;
};

/**
 * Registrar notificación enviada (para historial)
 */
export const logNotificationSent = async (type, recipient, productCount) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const logData = {
      type,
      recipient,
      productCount,
      timestamp: new Date(),
      status: 'sent'
    };

    await setDoc(doc(collection(db, `companies/${companyId}/notificationLogs`)), logData);

    // Actualizar timestamp de última notificación enviada
    await updateDoc(doc(db, `companies/${companyId}/settings`, 'notifications'), {
      [`${type}.lastSent`]: new Date().toISOString()
    });

    console.log(`✅ Notificación ${type} registrada para ${recipient}`);
  } catch (error) {
    console.error('Error registrando notificación:', error);
  }
};

/**
 * Función principal para verificar y enviar notificaciones
 */
export const checkAndSendLowStockNotifications = async () => {
  try {
    console.log('🔍 Verificando stock bajo...');

    // Obtener configuración
    const companyId = await getUserCompanyId();
    if (!companyId) return { success: false, message: 'Sin empresa' };

    const settings = await getNotificationSettings();

    if (settings.lowStockAlerts === false) {
      console.log('⏸️ Alertas de stock bajo deshabilitadas');
      return { success: false, message: 'Alertas deshabilitadas' };
    }

    // Leer umbral desde settings/inventory
    const invSnap = await getDoc(doc(db, `companies/${companyId}/settings`, 'inventory'));
    const invSettings = invSnap.exists() ? invSnap.data() : {};
    const threshold = invSettings.lowStockThreshold ?? settings.email?.threshold ?? 5;

    // El super-admin puede forzar el destinatario desde companies/{id}.notificationEmail
    // (override que prevalece sobre el email guardado en settings/notifications)
    const companySnap = await getDoc(doc(db, 'companies', companyId));
    const notifOverride = companySnap.exists() ? companySnap.data().notificationEmail : null;
    const recipientEmail = (notifOverride || '').trim() || settings.email?.address;

    // Verificar si debe enviar notificación (evitar spam)
    if (!shouldSendNotification(settings.email?.lastSent, settings.general?.checkInterval || 24)) {
      console.log('⏰ Muy pronto para enviar otra notificación');
      return { success: false, message: 'Muy pronto para enviar notificación' };
    }

    // Obtener productos con stock bajo
    const lowStockProducts = await getLowStockProducts(threshold);

    if (lowStockProducts.length === 0) {
      console.log('✅ No hay productos con stock bajo');
      return { success: true, message: 'No hay productos con stock bajo' };
    }

    console.log(`📧 Preparando email para ${lowStockProducts.length} productos`);

    // Aquí normalmente enviarías el email a través de un servicio backend
    // Por ahora, registramos la notificación y retornamos los datos para envío manual

    const emailData = {
      to: recipientEmail,
      subject: `🚨 Alerta de Stock Bajo - ${lowStockProducts.length} productos`,
      html: generateLowStockEmailHTML(lowStockProducts),
      products: lowStockProducts
    };

    // Registrar que se "envió" la notificación
    await logNotificationSent('email', recipientEmail, lowStockProducts.length);

    return {
      success: true,
      message: `Notificación preparada para ${lowStockProducts.length} productos`,
      emailData,
      products: lowStockProducts
    };

  } catch (error) {
    console.error('Error en verificación de stock:', error);
    return { success: false, message: error.message };
  }
};