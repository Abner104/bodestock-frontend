// src/services/orders-service.js
/**
 * Servicio para gestionar pedidos/órdenes de clientes
 * Soporta pedidos desde catálogo público y desde vendedores
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from './companyService';

// Mapea el status en español/minúscula que usa PublicStore.jsx (tienda con
// carrito) al vocabulario oficial de este servicio (createOrder ya lo
// documenta: PENDING/APPROVED/INVOICED/REJECTED/CANCELLED). 'listo' no
// tiene equivalente 1:1 -- se trata como APPROVED (ya se armó, falta
// facturar/cerrar), consistente con el resto del flujo de este archivo.
const STATUS_FROM_TIENDA = {
  pendiente: 'PENDING',
  listo: 'APPROVED',
  rechazado: 'REJECTED',
  cancelado: 'CANCELLED',
};

// Inverso de STATUS_FROM_TIENDA -- para filtrar por status oficial (ej.
// getAllOrders({ status: 'PENDING' })) sin perder los pedidos de la tienda
// pública, que en Firestore tienen el valor en español/minúscula.
const TIENDA_STATUSES_FOR = Object.entries(STATUS_FROM_TIENDA).reduce((acc, [es, oficial]) => {
  (acc[oficial] ||= []).push(es);
  return acc;
}, {});

/**
 * PublicStore.jsx (la tienda pública con carrito) escribe los pedidos con
 * su propio esquema (clientName, clientPhone, subtotal, items con
 * qty/name/price, status en español/minúscula) en vez del esquema oficial
 * de este servicio (customerInfo, totalAmount, items con
 * quantity/productName/totalPrice, status en mayúsculas) -- nunca pasa por
 * createOrder(). Se normaliza acá, en el único punto donde se leen todos
 * los pedidos, para que OrdersManagement.jsx (que ya asume el esquema
 * oficial) no tenga que conocer dos formatos distintos.
 */
function normalizeOrder(raw) {
  // Ya viene en el esquema oficial (pedido creado por createOrder) -- no tocar.
  if (raw.customerInfo || raw.clientName === undefined) return raw;

  return {
    ...raw,
    customerInfo: {
      nombre: raw.clientName || 'Cliente',
      telefono: raw.clientPhone || '',
      email: raw.clientEmail || '',
    },
    totalAmount: raw.subtotal ?? 0,
    items: (raw.items || []).map((it) => ({
      ...it,
      productName: it.name,
      quantity: it.byWeight ? (it.confirmedGrams ?? it.requestedGrams ?? 0) : (it.qty || 0),
      // unitPrice lo usa OrdersManagement.jsx al editar cantidades
      // (cambiarCantidadEdit recalcula totalPrice = quantity * unitPrice)
      // -- sin esto, editar un pedido de la tienda pública ponía el precio
      // en $0 al tocar +/-.
      unitPrice: it.byWeight ? (it.pricePerKg || 0) : (it.price || 0),
      totalPrice: it.byWeight ? (it.confirmedPrice ?? 0) : ((it.price || 0) * (it.qty || 0)),
    })),
    status: STATUS_FROM_TIENDA[raw.status] || raw.status,
  };
}

/**
 * Crear un nuevo pedido
 * @param {Object} orderData - {
 *   customerInfo: { nombre, email, telefono, rut?, direccion, comuna },
 *   items: [{ productId, productName, quantity, unit, unitPrice, totalPrice, presentacion? }],
 *   totalAmount: number,
 *   notes: string,
 *   source: 'PUBLIC_CATALOG' | 'VENDOR_ASSISTED',
 *   vendorId?: string (si es asistido por vendedor)
 * }
 * @returns {Promise<string>} - ID del pedido creado
 */
export const createOrder = async (orderData, publicCompanyId = null) => {
  try {
    // Si viene de catálogo público, usar el companyId pasado directamente (no hay usuario autenticado)
    const companyId = publicCompanyId || await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Validar datos mínimos — el teléfono es obligatorio solo para pedidos del catálogo público
    // (donde es el único contacto); para pedidos asistidos por vendedor ya hay un cliente registrado
    if (!orderData.customerInfo?.nombre) {
      throw new Error('El nombre del cliente es obligatorio');
    }
    if (orderData.source !== 'VENDOR_ASSISTED' && !orderData.customerInfo?.telefono) {
      throw new Error('El teléfono del cliente es obligatorio');
    }

    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('El pedido debe contener al menos un producto');
    }

    const docRef = await addDoc(
      collection(db, `companies/${companyId}/orders`),
      {
        ...orderData,
        status: 'PENDING', // PENDING, APPROVED, INVOICED, REJECTED, CANCELLED
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    console.log('✅ Pedido creado:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creando pedido:', error);
    throw error;
  }
};

/**
 * Obtener todos los pedidos de la empresa
 * @param {Object} filters - { status?: string, startDate?: Date, endDate?: Date }
 * @returns {Promise<Array>} - Lista de pedidos
 */
export const getAllOrders = async (filters = {}) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    let q = query(
      collection(db, `companies/${companyId}/orders`),
      orderBy('createdAt', 'desc')
    );

    // Aplicar filtro de estado si existe -- incluye también el valor en
    // español/minúscula que usa la tienda pública para ese mismo status
    // (ver STATUS_FROM_TIENDA), para no perder esos pedidos del filtro.
    if (filters.status) {
      const tiendaEquivalents = TIENDA_STATUSES_FOR[filters.status] || [];
      q = tiendaEquivalents.length > 0
        ? query(q, where('status', 'in', [filters.status, ...tiendaEquivalents]))
        : query(q, where('status', '==', filters.status));
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => normalizeOrder({
      id: doc.id,
      ...doc.data()
    }));

    // Filtrar por fechas en el cliente (Firestore tiene limitaciones con múltiples where)
    if (filters.startDate || filters.endDate) {
      return orders.filter(order => {
        const orderDate = order.createdAt?.toDate();
        if (!orderDate) return false;

        if (filters.startDate && orderDate < filters.startDate) return false;
        if (filters.endDate && orderDate > filters.endDate) return false;

        return true;
      });
    }

    return orders;
  } catch (error) {
    console.error('❌ Error obteniendo pedidos:', error);
    throw error;
  }
};

/**
 * Listener en tiempo real para pedidos pendientes
 * @param {Function} callback - Función que recibe los pedidos actualizados
 * @returns {Function} - Función para detener el listener
 */
export const listenToPendingOrders = (callback) => {
  return new Promise(async (resolve) => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('No se pudo obtener el companyId');

      // 'in' con el status oficial + su equivalente en español de la
      // tienda pública (ver STATUS_FROM_TIENDA) -- sin esto, los pedidos
      // nuevos de PublicStore.jsx (status: 'pendiente') nunca disparaban
      // este listener en tiempo real ni el badge de notificaciones.
      const q = query(
        collection(db, `companies/${companyId}/orders`),
        where('status', 'in', ['PENDING', ...(TIENDA_STATUSES_FOR.PENDING || [])]),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => normalizeOrder({
          id: doc.id,
          ...doc.data()
        }));
        callback(orders);
      });

      resolve(unsubscribe);
    } catch (error) {
      console.error('❌ Error configurando listener de pedidos:', error);
      throw error;
    }
  });
};

/**
 * Obtener un pedido por ID
 * @param {string} orderId - ID del pedido
 * @returns {Promise<Object|null>} - Pedido encontrado o null
 */
export const getOrderById = async (orderId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const docRef = doc(db, `companies/${companyId}/orders`, orderId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return normalizeOrder({
      id: docSnap.id,
      ...docSnap.data()
    });
  } catch (error) {
    console.error('❌ Error obteniendo pedido:', error);
    throw error;
  }
};

/**
 * Actualizar estado de un pedido
 * @param {string} orderId - ID del pedido
 * @param {string} newStatus - Nuevo estado (PENDING, APPROVED, INVOICED, REJECTED, CANCELLED)
 * @param {Object} additionalData - Datos adicionales (ej: invoiceId, rejectionReason)
 * @returns {Promise<void>}
 */
export const updateOrderStatus = async (orderId, newStatus, additionalData = {}) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const validStatuses = ['PENDING', 'APPROVED', 'INVOICED', 'DELIVERING', 'DELIVERED', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Estado inválido: ${newStatus}`);
    }

    await updateDoc(
      doc(db, `companies/${companyId}/orders`, orderId),
      {
        status: newStatus,
        ...additionalData,
        updatedAt: serverTimestamp()
      }
    );

    console.log(`✅ Pedido ${orderId} actualizado a estado: ${newStatus}`);
  } catch (error) {
    console.error('❌ Error actualizando estado del pedido:', error);
    throw error;
  }
};

/**
 * Editar los items y total de un pedido pendiente (antes de confirmar entrega)
 * @param {string} orderId - ID del pedido
 * @param {Array} items - Nuevo array de items
 * @param {number} totalAmount - Nuevo total
 */
export const updateOrderItems = async (orderId, items, totalAmount) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    await updateDoc(
      doc(db, `companies/${companyId}/orders`, orderId),
      { items, totalAmount, updatedAt: serverTimestamp() }
    );

    console.log(`✅ Pedido ${orderId} editado`);
  } catch (error) {
    console.error('❌ Error editando pedido:', error);
    throw error;
  }
};

/**
 * Aprobar pedido y prepararlo para facturación
 * @param {string} orderId - ID del pedido
 * @param {string} approvedBy - ID del usuario que aprueba
 * @returns {Promise<Object>} - Pedido actualizado
 */
export const approveOrder = async (orderId, approvedBy) => {
  try {
    await updateOrderStatus(orderId, 'APPROVED', {
      approvedBy,
      approvedAt: serverTimestamp()
    });

    return await getOrderById(orderId);
  } catch (error) {
    console.error('❌ Error aprobando pedido:', error);
    throw error;
  }
};

/**
 * Marcar pedido como "en camino" (salió a entregar) -- tramo de delivery
 * entre Aprobado y Entregado. El cliente lo ve reflejado en tiempo real en
 * su pantalla de seguimiento (ver PublicStore.jsx).
 * @param {string} orderId - ID del pedido
 */
export const markAsDelivering = async (orderId) => {
  try {
    await updateOrderStatus(orderId, 'DELIVERING', {
      deliveringAt: serverTimestamp()
    });
    return await getOrderById(orderId);
  } catch (error) {
    console.error('❌ Error marcando pedido en camino:', error);
    throw error;
  }
};

/**
 * Marcar pedido como entregado -- cierra el tramo de delivery.
 * @param {string} orderId - ID del pedido
 */
export const markAsDelivered = async (orderId) => {
  try {
    await updateOrderStatus(orderId, 'DELIVERED', {
      deliveredAt: serverTimestamp()
    });
    return await getOrderById(orderId);
  } catch (error) {
    console.error('❌ Error marcando pedido entregado:', error);
    throw error;
  }
};

/**
 * Marcar pedido como facturado
 * @param {string} orderId - ID del pedido
 * @param {Object} invoiceData - { folio, trackId, pdf?, xml? }
 * @returns {Promise<void>}
 */
export const markAsInvoiced = async (orderId, invoiceData) => {
  try {
    await updateOrderStatus(orderId, 'INVOICED', {
      invoice: invoiceData,
      invoicedAt: serverTimestamp()
    });

    console.log(`✅ Pedido ${orderId} marcado como facturado`);
  } catch (error) {
    console.error('❌ Error marcando pedido como facturado:', error);
    throw error;
  }
};

/**
 * Rechazar pedido
 * @param {string} orderId - ID del pedido
 * @param {string} reason - Motivo del rechazo
 * @param {string} rejectedBy - ID del usuario que rechaza
 * @returns {Promise<void>}
 */
export const rejectOrder = async (orderId, reason, rejectedBy) => {
  try {
    await updateOrderStatus(orderId, 'REJECTED', {
      rejectionReason: reason,
      rejectedBy,
      rejectedAt: serverTimestamp()
    });

    console.log(`✅ Pedido ${orderId} rechazado`);
  } catch (error) {
    console.error('❌ Error rechazando pedido:', error);
    throw error;
  }
};

/**
 * Eliminar un pedido (solo si está PENDING o REJECTED)
 * @param {string} orderId - ID del pedido
 * @returns {Promise<void>}
 */
export const deleteOrder = async (orderId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Verificar que el pedido se pueda eliminar
    const order = await getOrderById(orderId);
    if (!order) throw new Error('Pedido no encontrado');

    if (!['PENDING', 'REJECTED', 'CANCELLED'].includes(order.status)) {
      throw new Error('Solo se pueden eliminar pedidos pendientes, rechazados o cancelados');
    }

    await deleteDoc(doc(db, `companies/${companyId}/orders`, orderId));
    console.log('✅ Pedido eliminado:', orderId);
  } catch (error) {
    console.error('❌ Error eliminando pedido:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de pedidos
 * @returns {Promise<Object>} - { total, pending, approved, invoiced, rejected }
 */
export const getOrdersStats = async () => {
  try {
    const allOrders = await getAllOrders();

    return {
      total: allOrders.length,
      pending: allOrders.filter(o => o.status === 'PENDING').length,
      approved: allOrders.filter(o => o.status === 'APPROVED').length,
      invoiced: allOrders.filter(o => o.status === 'INVOICED').length,
      rejected: allOrders.filter(o => o.status === 'REJECTED').length,
      cancelled: allOrders.filter(o => o.status === 'CANCELLED').length
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de pedidos:', error);
    throw error;
  }
};

export default {
  createOrder,
  getAllOrders,
  listenToPendingOrders,
  getOrderById,
  updateOrderStatus,
  approveOrder,
  markAsInvoiced,
  rejectOrder,
  deleteOrder,
  getOrdersStats
};
