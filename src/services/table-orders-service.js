// src/services/table-orders-service.js
/**
 * Pedidos de mesa (garzón → cocina). Usa la misma colección companies/{id}/orders
 * que ya escucha KitchenDisplay.jsx, con el mismo esquema que esa pantalla espera
 * (status en minúsculas: pendiente/preparando/listo, items con name/qty/price/productId).
 * No confundir con orders-service.js, que maneja pedidos del catálogo público
 * (status en MAYÚSCULAS: PENDING/APPROVED/...) — son dos flujos separados sobre la
 * misma colección, por eso este archivo existe aparte.
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from './companyService.js';
import { setTableOrder } from './tables-service.js';

function getOrdersPath(companyId) {
  return `companies/${companyId}/orders`;
}

/**
 * Escucha en tiempo real el pedido activo de una mesa (o null si no tiene)
 */
export const listenToOrder = (companyId, orderId, callback) => {
  if (!orderId) {
    callback(null);
    return () => {};
  }
  return onSnapshot(doc(db, getOrdersPath(companyId), orderId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
};

/**
 * Crea el pedido de una mesa (si todavía no existe) o agrega ítems a uno existente.
 * @param {Object} params
 * @param {string} params.tableId
 * @param {string} params.tableName
 * @param {string|null} params.existingOrderId - orderId actual de la mesa, si ya tenía uno abierto
 * @param {string} params.inventoryId
 * @param {Array} params.newItems - [{ productId, name, qty, price, station }]
 * @returns {Promise<string>} orderId
 */
export const sendItemsToKitchen = async ({ tableId, tableName, existingOrderId, inventoryId, newItems }) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');
  if (!newItems || newItems.length === 0) throw new Error('No hay productos para enviar');

  const itemsForOrder = newItems.map(i => ({
    productId: i.productId,
    name: i.name,
    qty: i.qty,
    price: i.price,
    station: i.station || 'kitchen',
  }));

  if (existingOrderId) {
    const orderRef = doc(db, getOrdersPath(companyId), existingOrderId);
    const snap = await getDoc(orderRef);
    if (snap.exists() && snap.data().status !== 'listo') {
      const prevItems = snap.data().items || [];
      await updateDoc(orderRef, {
        items: [...prevItems, ...itemsForOrder],
        // Si la cocina ya lo había marcado "preparando", el nuevo envío lo vuelve a poner
        // como pendiente para que lo vean de nuevo — evita que un ítem nuevo pase inadvertido.
        status: 'pendiente',
      });
      return existingOrderId;
    }
    // El pedido anterior ya se cerró (listo) — se crea uno nuevo para la mesa
  }

  const newOrderRef = await addDoc(collection(db, getOrdersPath(companyId)), {
    clientName: tableName,
    tableId,
    inventoryId,
    items: itemsForOrder,
    status: 'pendiente',
    stockDescontado: false,
    createdAt: serverTimestamp(),
  });

  await setTableOrder(tableId, newOrderRef.id);
  return newOrderRef.id;
};
