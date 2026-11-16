// src/services/permission-requests-service.js
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from './companyService.js';

/**
 * Servicio para manejar solicitudes de permisos cuando trabajadores exceden límites
 */

/**
 * Crear una nueva solicitud de permiso
 */
export const createPermissionRequest = async (requestData) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const docRef = await addDoc(collection(db, `companies/${companyId}/permission_requests`), {
      workerId: requestData.workerId,
      workerName: requestData.workerName,
      workerEmail: requestData.workerEmail,
      warehouseId: requestData.warehouseId,
      warehouseName: requestData.warehouseName,

      // Tipo de límite excedido
      limitType: requestData.limitType, // 'MONEY' o 'PRODUCTS'
      dailyLimit: requestData.dailyLimit,
      usedAmount: requestData.usedAmount,
      availableAmount: requestData.availableAmount,
      requestedAmount: requestData.requestedAmount,

      // Para límites de productos
      usedProducts: requestData.usedProducts || 0,
      availableProducts: requestData.availableProducts || 0,
      requestedProducts: requestData.requestedProducts || 0,

      // Detalles de productos solicitados
      products: requestData.products || [],
      totalValue: requestData.totalValue || 0,

      // Información de la solicitud
      reason: requestData.reason, // Motivo de la salida original
      reasonName: requestData.reasonName,
      notes: requestData.notes || '',

      // Metadatos
      status: 'PENDING', // PENDING, APPROVED, REJECTED
      requestedAt: serverTimestamp(),
      priority: calculatePriority(requestData),

      // Se completan cuando se resuelve
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      rejectionReason: null
    });

    console.log('Permission request created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating permission request:', error);
    throw error;
  }
};

/**
 * Aprobar una solicitud de permiso
 */
export const approvePermissionRequest = async (requestId, approvalData) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const requestRef = doc(db, `companies/${companyId}/permission_requests`, requestId);

    await updateDoc(requestRef, {
      status: 'APPROVED',
      resolvedAt: serverTimestamp(),
      resolvedBy: approvalData.approvedBy,
      resolutionNotes: approvalData.notes || ''
    });

    console.log('Permission request approved:', requestId);
    return true;
  } catch (error) {
    console.error('Error approving permission request:', error);
    throw error;
  }
};

/**
 * Rechazar una solicitud de permiso
 */
export const rejectPermissionRequest = async (requestId, rejectionData) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const requestRef = doc(db, `companies/${companyId}/permission_requests`, requestId);

    await updateDoc(requestRef, {
      status: 'REJECTED',
      resolvedAt: serverTimestamp(),
      resolvedBy: rejectionData.rejectedBy,
      rejectionReason: rejectionData.reason,
      resolutionNotes: rejectionData.notes || ''
    });

    console.log('Permission request rejected:', requestId);
    return true;
  } catch (error) {
    console.error('Error rejecting permission request:', error);
    throw error;
  }
};

/**
 * Obtener solicitudes de permisos pendientes
 */
export const getPendingPermissionRequests = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const q = query(
      collection(db, `companies/${companyId}/permission_requests`),
      where('status', '==', 'PENDING'),
      orderBy('priority', 'desc'),
      orderBy('requestedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const requests = [];

    querySnapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return requests;
  } catch (error) {
    console.error('Error getting pending permission requests:', error);
    throw error;
  }
};

/**
 * Obtener solicitudes de permisos por trabajador
 */
export const getPermissionRequestsByWorker = async (workerId, status = null) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    let q;

    if (status) {
      q = query(
        collection(db, `companies/${companyId}/permission_requests`),
        where('workerId', '==', workerId),
        where('status', '==', status),
        orderBy('requestedAt', 'desc')
      );
    } else {
      q = query(
        collection(db, `companies/${companyId}/permission_requests`),
        where('workerId', '==', workerId),
        orderBy('requestedAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const requests = [];

    querySnapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return requests;
  } catch (error) {
    console.error('Error getting permission requests by worker:', error);
    throw error;
  }
};

/**
 * Obtener una solicitud de permiso específica
 */
export const getPermissionRequest = async (requestId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const docRef = doc(db, `companies/${companyId}/permission_requests`, requestId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting permission request:', error);
    throw error;
  }
};

/**
 * Listener en tiempo real para solicitudes pendientes
 */
export const onPendingPermissionRequestsChange = async (callback) => {
  const companyId = await getUserCompanyId();
  if (!companyId) {
    console.warn('⚠️  No se pudo obtener el companyId del usuario');
    callback([]); // Retornar array vacío
    return () => {}; // Retornar función de cleanup vacía
  }

  const q = query(
    collection(db, `companies/${companyId}/permission_requests`),
    where('status', '==', 'PENDING')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    // Ordenar en cliente para evitar necesidad de índice compuesto
    requests.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
    callback(requests);
  }, (error) => {
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
      console.warn('⚠️  Permission requests no disponibles:', error.code);
      callback([]);
    } else {
      console.error('Error in permission requests listener:', error);
      callback([]);
    }
  });
};

/**
 * Calcular prioridad de una solicitud
 * Mayor prioridad = más urgente
 */
const calculatePriority = (requestData) => {
  let priority = 1;

  // Prioridad base según tipo de límite
  if (requestData.limitType === 'MONEY') {
    const exceedPercentage = (requestData.requestedAmount - requestData.availableAmount) / requestData.dailyLimit;
    if (exceedPercentage > 0.5) priority += 3; // Excede más del 50%
    else if (exceedPercentage > 0.2) priority += 2; // Excede más del 20%
    else priority += 1;
  } else if (requestData.limitType === 'PRODUCTS') {
    const exceedAmount = requestData.requestedProducts - requestData.availableProducts;
    if (exceedAmount > 5) priority += 3;
    else if (exceedAmount > 2) priority += 2;
    else priority += 1;
  }

  // Prioridad adicional según motivo
  const highPriorityReasons = ['SALE', 'PRODUCTION'];
  if (highPriorityReasons.includes(requestData.reason)) {
    priority += 1;
  }

  return Math.min(priority, 5); // Máximo 5
};

/**
 * Obtener estadísticas de solicitudes de permisos
 */
export const getPermissionRequestsStats = async (startDate = null, endDate = null) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    let q = collection(db, `companies/${companyId}/permission_requests`);

    if (startDate && endDate) {
      q = query(
        q,
        where('requestedAt', '>=', startDate),
        where('requestedAt', '<=', endDate)
      );
    }

    const querySnapshot = await getDocs(q);
    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      byWorker: {},
      byReason: {},
      totalExcessValue: 0,
      totalExcessProducts: 0
    };

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      stats.total++;

      // Por status
      stats[data.status?.toLowerCase()] = (stats[data.status?.toLowerCase()] || 0) + 1;

      // Por trabajador
      stats.byWorker[data.workerId] = (stats.byWorker[data.workerId] || 0) + 1;

      // Por motivo
      stats.byReason[data.reason] = (stats.byReason[data.reason] || 0) + 1;

      // Excesos totales
      if (data.limitType === 'MONEY') {
        stats.totalExcessValue += Math.max(0, data.requestedAmount - data.availableAmount);
      } else if (data.limitType === 'PRODUCTS') {
        stats.totalExcessProducts += Math.max(0, data.requestedProducts - data.availableProducts);
      }
    });

    return stats;
  } catch (error) {
    console.error('Error getting permission requests stats:', error);
    throw error;
  }
};

/**
 * Limpiar solicitudes antiguas resueltas
 */
export const cleanupOldPermissionRequests = async (daysOld = 30) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const q = query(
      collection(db, `companies/${companyId}/permission_requests`),
      where('resolvedAt', '<', cutoffDate),
      where('status', 'in', ['APPROVED', 'REJECTED'])
    );

    const querySnapshot = await getDocs(q);
    const deletionPromises = [];

    querySnapshot.forEach((docSnapshot) => {
      deletionPromises.push(deleteDoc(doc(db, `companies/${companyId}/permission_requests`, docSnapshot.id)));
    });

    await Promise.all(deletionPromises);
    console.log(`Cleaned up ${deletionPromises.length} old permission requests`);
    return deletionPromises.length;
  } catch (error) {
    console.error('Error cleaning up old permission requests:', error);
    throw error;
  }
};