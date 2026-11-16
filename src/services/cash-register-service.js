// src/services/cash-register-service.js
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from './companyService.js';

/**
 * Obtener el turno activo de un trabajador (si existe)
 */
export const getActiveCashRegister = async (workerId) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  const q = query(
    collection(db, `companies/${companyId}/cash_registers`),
    where('workerId', '==', workerId),
    where('status', '==', 'open'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docData = snapshot.docs[0];
  return { id: docData.id, ...docData.data() };
};

/**
 * Abrir un nuevo turno de caja
 */
export const openCashRegister = async ({ workerId, workerName, initialCash, warehouseId, warehouseName }) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  // Verificar que no haya otro turno abierto
  const existing = await getActiveCashRegister(workerId);
  if (existing) throw new Error('Ya tienes un turno abierto. Debes cerrarlo primero.');

  const ref = await addDoc(collection(db, `companies/${companyId}/cash_registers`), {
    workerId,
    workerName,
    warehouseId: warehouseId || null,
    warehouseName: warehouseName || null,
    initialCash: Number(initialCash) || 0,
    status: 'open',
    openedAt: serverTimestamp(),
    closedAt: null,
    // Totales por método de pago (se actualizan al cerrar)
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    totalOther: 0,
    totalSales: 0,
    salesCount: 0,
    // Cierre
    physicalCash: null,
    difference: null,
    closingNote: null,
  });

  return ref.id;
};

/**
 * Registrar un retiro de efectivo de la caja durante el turno (ej. para
 * pagarle en efectivo a un proveedor que llega con mercadería). Sin esto,
 * esa plata sale físicamente pero el sistema sigue pensando que está en
 * caja -- closeCashRegister resta el total de estos movimientos del
 * efectivo esperado.
 */
export const registerCashWithdrawal = async ({ cashRegisterId, workerId, workerName, amount, reason }) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) throw new Error('Ingresa un monto válido para el retiro.');
  if (!reason || !reason.trim()) throw new Error('Indica el motivo del retiro.');

  const ref = await addDoc(collection(db, `companies/${companyId}/cash_movements`), {
    cashRegisterId,
    workerId,
    workerName: workerName || null,
    type: 'withdrawal',
    amount: numAmount,
    reason: reason.trim(),
    createdAt: serverTimestamp(),
  });

  return ref.id;
};

/**
 * Listar los movimientos de caja (hoy solo retiros) de un turno.
 */
export const getCashMovements = async (cashRegisterId, forcedCompanyId) => {
  const companyId = forcedCompanyId || await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  const q = query(
    collection(db, `companies/${companyId}/cash_movements`),
    where('cashRegisterId', '==', cashRegisterId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() || null,
  }));
};

/**
 * Cerrar el turno de caja activo
 * Calcula totales desde las salidas de inventario registradas en el turno
 */
export const closeCashRegister = async ({ cashRegisterId, workerId, physicalCash, closingNote }) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  // Obtener el turno actual para saber cuándo abrió
  const registerRef = doc(db, `companies/${companyId}/cash_registers`, cashRegisterId);

  // Buscar todas las salidas del turno
  const exitsQ = query(
    collection(db, `companies/${companyId}/inventory_exits`),
    where('cashRegisterId', '==', cashRegisterId),
    where('status', '==', 'active')
  );
  const exitsSnap = await getDocs(exitsQ);

  const totalWithdrawals = (await getCashMovements(cashRegisterId))
    .filter((m) => m.type === 'withdrawal')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  // Calcular totales por método de pago
  let totalCash = 0;
  let totalCard = 0;
  let totalTransfer = 0;
  let totalOther = 0;
  let totalSales = 0;
  let salesCount = 0;

  exitsSnap.forEach((d) => {
    const exit = d.data();
    const amount = exit.totalValue || 0;
    totalSales += amount;
    salesCount += 1;

    if (exit.splitPayment && exit.splitCashAmount > 0) {
      // Pago mixto: efectivo + otro método
      totalCash += exit.splitCashAmount;
      const cardPart = amount - exit.splitCashAmount;
      switch (exit.paymentMethod) {
        case 'CARD': totalCard += cardPart; break;
        case 'TRANSFER': totalTransfer += cardPart; break;
        default: totalOther += cardPart; break;
      }
    } else {
      switch (exit.paymentMethod) {
        case 'CASH': totalCash += amount; break;
        case 'CARD': totalCard += amount; break;
        case 'TRANSFER': totalTransfer += amount; break;
        case 'CREDIT': totalOther += amount; break; // fiado — no entra en efectivo
        default: totalOther += amount; break;
      }
    }
  });

  const physical = Number(physicalCash) || 0;

  // Actualizar el documento de cierre
  await updateDoc(registerRef, {
    status: 'closed',
    closedAt: serverTimestamp(),
    totalCash,
    totalCard,
    totalTransfer,
    totalOther,
    totalSales,
    salesCount,
    totalWithdrawals,
    physicalCash: physical,
    closingNote: closingNote || null,
  });

  return {
    totalCash,
    totalCard,
    totalTransfer,
    totalOther,
    totalSales,
    salesCount,
    totalWithdrawals,
    physicalCash: physical,
  };
};

/**
 * Obtener historial de turnos (para admin)
 */
export const getCashRegisterHistory = async ({ limitCount = 50, companyId: forcedCompanyId } = {}) => {
  const companyId = forcedCompanyId || await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  const q = query(
    collection(db, `companies/${companyId}/cash_registers`),
    orderBy('openedAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      openedAt: data.openedAt?.toDate?.() || null,
      closedAt: data.closedAt?.toDate?.() || null,
    };
  });
};

/**
 * Obtener las salidas de un turno específico
 */
export const getExitsByCashRegister = async (cashRegisterId, forcedCompanyId) => {
  const companyId = forcedCompanyId || await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  const q = query(
    collection(db, `companies/${companyId}/inventory_exits`),
    where('cashRegisterId', '==', cashRegisterId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() || null,
  }));
};

// Métodos de pago base (Chile por defecto)
// En componentes con acceso al contexto, usar useRegionContext().paymentMethods en su lugar
export const PAYMENT_METHODS = {
  CASH:      { label: 'Efectivo',        icon: '💵', color: 'bg-green-100 text-green-800' },
  CARD:      { label: 'Débito/Crédito',  icon: '💳', color: 'bg-blue-100 text-blue-800' },
  TRANSFER:  { label: 'Transferencia',   icon: '🏦', color: 'bg-purple-100 text-purple-800' },
  CREDIT:    { label: 'Fiado',           icon: '📒', color: 'bg-orange-100 text-orange-800' },
  ZELLE:     { label: 'Zelle',           icon: '💸', color: 'bg-blue-100 text-blue-800' },
  USDT:      { label: 'USDT / Binance',  icon: '₿',  color: 'bg-yellow-100 text-yellow-800' },
  PAGOMOVIL: { label: 'Pago Móvil',      icon: '📲', color: 'bg-purple-100 text-purple-800' },
  OTHER:     { label: 'Otro',            icon: '💰', color: 'bg-gray-100 text-gray-800' },
};
