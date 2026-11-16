// src/services/tables-service.js
/**
 * Servicio de mesas - CRUD de mesas de restaurante en Firestore
 * Sigue el mismo patrón que warehouseService.js
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId, getUserRole, isUserSuperAdmin } from './companyService.js';

export const TABLE_STATUS = {
  FREE: 'free',
  OCCUPIED: 'occupied',
  BILLING: 'billing', // por cobrar — pidió la cuenta
};

function getTablesPath(companyId) {
  return `companies/${companyId}/tables`;
}

/**
 * Crea una mesa nueva
 * @param {Object} tableData - { name, zone? }
 * @returns {Promise<string>} ID de la mesa creada
 */
export const createTable = async (tableData) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  const name = String(tableData?.name || '').trim();
  if (!name) throw new Error('El nombre/número de mesa es requerido');

  const docRef = await addDoc(collection(db, getTablesPath(companyId)), {
    name,
    zone: tableData.zone || '',
    status: TABLE_STATUS.FREE,
    currentOrderId: null,
    assignedWorkerId: null,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
};

/**
 * Actualiza una mesa (nombre, zona)
 */
export const updateTable = async (tableId, tableData) => {
  if (!tableId) throw new Error('ID de mesa es requerido');
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  const name = String(tableData?.name || '').trim();
  if (!name) throw new Error('El nombre/número de mesa es requerido');

  await updateDoc(doc(db, getTablesPath(companyId), tableId), {
    name,
    zone: tableData.zone || '',
    updatedAt: serverTimestamp(),
  });
};

/**
 * Elimina una mesa — solo si está libre
 */
export const deleteTable = async (tableId, tables = []) => {
  if (!tableId) throw new Error('ID de mesa es requerido');

  const userRole = await getUserRole();
  const isSuperAdmin = await isUserSuperAdmin();
  if (userRole !== 'ADMIN' && !isSuperAdmin) {
    throw new Error('Solo los administradores pueden eliminar mesas');
  }

  const table = tables.find(t => t.id === tableId);
  if (table && table.status !== TABLE_STATUS.FREE) {
    throw new Error('No se puede eliminar una mesa ocupada. Cierra la cuenta primero.');
  }

  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  await deleteDoc(doc(db, getTablesPath(companyId), tableId));
};

/**
 * Escucha las mesas de la empresa en tiempo real (necesario porque varios
 * meseros/cajeros ven el mismo mapa de mesas al mismo tiempo)
 * @param {string} companyId
 * @param {(tables: Array) => void} callback
 * @returns {Function} unsubscribe
 */
export const listenToTables = (companyId, callback) => {
  const q = query(collection(db, getTablesPath(companyId)), orderBy('name'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Marca una mesa como ocupada, asociada a un pedido y a quién la abrió
 */
export const occupyTable = async (tableId, { orderId, workerId }) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  await updateDoc(doc(db, getTablesPath(companyId), tableId), {
    status: TABLE_STATUS.OCCUPIED,
    currentOrderId: orderId,
    assignedWorkerId: workerId,
    openedAt: serverTimestamp(),
  });
};

/**
 * Libera una mesa (después de cobrar)
 */
export const freeTable = async (tableId) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  await updateDoc(doc(db, getTablesPath(companyId), tableId), {
    status: TABLE_STATUS.FREE,
    currentOrderId: null,
    assignedWorkerId: null,
    openedAt: null,
  });
};

/**
 * Obtiene una mesa puntual (para la pantalla de pedido, que necesita
 * revalidar que sigue siendo del garzón antes de dejarlo operar)
 */
export const getTable = async (tableId) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  const snap = await getDoc(doc(db, getTablesPath(companyId), tableId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Asocia el pedido (order) recién creado a la mesa
 */
export const setTableOrder = async (tableId, orderId) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo identificar la empresa');

  await updateDoc(doc(db, getTablesPath(companyId), tableId), { currentOrderId: orderId });
};
